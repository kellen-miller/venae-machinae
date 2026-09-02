import {
  cancelEvaluationSchema,
  evaluationIdentityMatches,
  initializeEvaluationSchema,
  workerRequestSchema,
  workerResultSchema
} from './protocol';
import { canonicalJson } from '../exchange/canonical-json';
import { recordValidationRunFailure } from '../validation/evaluate-validation';
import { EMPTY_VALIDATION_HISTORY } from '../validation/finding';

import type { EvaluationPreparationResult } from './evaluation-preparation';
import type { EvaluationRequest, InitializeEvaluation, ProjectSystemAction } from './protocol';
import type {
  ProjectEvaluationRequest,
  ProjectEvaluationScheduler
} from '../session/project-session.svelte';

function validationScopeForEvaluation(
  scope: ProjectEvaluationRequest['scope']
): InitializeEvaluation['scope'] {
  if (scope.kind === 'all') return { kind: 'validate-project' };
  if (scope.kind === 'review-profile') {
    return { kind: 'review-profile', profileId: scope.profileId };
  }
  return { kind: 'incremental', subjectIds: [...scope.subjectIds] };
}

type ScheduledEvaluation = {
  request: EvaluationRequest;
  initialization: InitializeEvaluation;
};

type EvaluationClientDependencies = {
  createWorker: () => Worker;
  isServerConnected: () => boolean;
  publish: (action: ProjectSystemAction) => void;
  cancellationGraceMs?: number | undefined;
};

export class EvaluationClient {
  readonly #createWorker: () => Worker;
  readonly #isServerConnected: () => boolean;
  readonly #publish: (action: ProjectSystemAction) => void;
  readonly #cancellationGraceMs: number;
  #worker: Worker | null = null;
  #active: ScheduledEvaluation | null = null;
  #queued: ScheduledEvaluation | null = null;
  #latest: ScheduledEvaluation | null = null;
  #cancellationTimer: ReturnType<typeof setTimeout> | null = null;
  #automaticRestartUsed = false;
  #automaticInitializationUsed = false;
  #closed = false;

  constructor(dependencies: EvaluationClientDependencies) {
    this.#createWorker = dependencies.createWorker;
    this.#isServerConnected = dependencies.isServerConnected;
    this.#publish = dependencies.publish;
    this.#cancellationGraceMs = dependencies.cancellationGraceMs ?? 250;
    if (!Number.isFinite(this.#cancellationGraceMs) || this.#cancellationGraceMs < 0) {
      throw new Error('Cancellation grace must be a nonnegative finite duration');
    }
  }

  schedule(scheduled: ScheduledEvaluation): void {
    if (this.#closed) throw new Error('Evaluation client is closed');

    const request = workerRequestSchema.parse(scheduled.request);
    if (request.type === 'cancel-evaluation') {
      throw new Error('Cancel messages cannot be scheduled as evaluations');
    }

    const initialization = initializeEvaluationSchema.parse(scheduled.initialization);
    if (
      request.requestId !== initialization.requestId ||
      request.projectRevision !== initialization.projectRevision ||
      request.inputFingerprint !== initialization.inputFingerprint ||
      request.formulaCatalogVersion !== initialization.formulaCatalogVersion ||
      request.validationRuleCatalogVersion !== initialization.validationRuleCatalogVersion ||
      request.schemaVersion !== initialization.schemaVersion ||
      canonicalJson(request.scope) !== canonicalJson(initialization.scope) ||
      initialization.project.projectRevision !== initialization.projectRevision ||
      initialization.project.schemaVersion !== initialization.schemaVersion
    ) {
      throw new Error('Evaluation fallback initialization does not match its request identity');
    }

    const candidate = { request, initialization };
    this.#latest = candidate;
    this.#automaticInitializationUsed = false;
    if (this.#active) {
      this.#queued = candidate;
      this.cancel();
      return;
    }

    const requiresInitialization = !this.#worker && request.type === 'evaluate-change-set';
    if (!this.#worker && !this.#isServerConnected()) return;
    this.#dispatch(candidate, requiresInitialization);
  }

  cancel(): void {
    if (!this.#active || !this.#worker || this.#closed) return;
    const request = this.#active.request;
    const cancellation = cancelEvaluationSchema.parse({
      type: 'cancel-evaluation',
      requestId: request.requestId,
      projectRevision: request.projectRevision,
      inputFingerprint: request.inputFingerprint,
      formulaCatalogVersion: request.formulaCatalogVersion,
      validationRuleCatalogVersion: request.validationRuleCatalogVersion,
      schemaVersion: request.schemaVersion
    });
    this.#worker.postMessage(cancellation);
    if (this.#cancellationTimer) return;

    const canceledRequestId = request.requestId;
    this.#cancellationTimer = setTimeout(() => {
      this.#cancellationTimer = null;
      if (this.#active?.request.requestId !== canceledRequestId) return;

      const replacement = this.#queued;
      this.#queued = null;
      this.#active = null;
      this.#terminateWorker();
      if (!this.#isServerConnected()) return;

      this.#ensureWorker();
      if (replacement) this.#dispatch(replacement, true);
    }, this.#cancellationGraceMs);
  }

  retry(): boolean {
    if (this.#closed || !this.#latest || !this.#isServerConnected()) return false;
    if (this.#active) return false;

    this.#terminateWorker();
    this.#automaticRestartUsed = false;
    this.#automaticInitializationUsed = false;
    this.#ensureWorker();
    this.#dispatch(this.#latest, true);
    return true;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#clearCancellationTimer();
    this.#active = null;
    this.#queued = null;
    this.#latest = null;
    this.#terminateWorker();
  }

  readonly #onMessage = (event: MessageEvent<unknown>): void => {
    const parsed = workerResultSchema.safeParse(event.data);
    if (!parsed.success || !this.#active) return;

    const result = parsed.data;
    if (!evaluationIdentityMatches(this.#active.request, result)) return;

    this.#clearCancellationTimer();
    const completed = this.#active;
    this.#active = null;
    const canAutomaticallyInitialize =
      result.type === 'evaluation-failed' &&
      result.requiresInitialization &&
      this.#isServerConnected() &&
      !this.#automaticInitializationUsed;
    if (result.type !== 'evaluation-canceled' && !canAutomaticallyInitialize) {
      this.#publish({ type: 'publish-evaluation', outcome: result });
      if (result.type === 'evaluation-succeeded') {
        this.#automaticRestartUsed = false;
        this.#automaticInitializationUsed = false;
      }
    }

    const next = this.#queued;
    this.#queued = null;
    if (next) {
      this.#dispatch(next, result.type === 'evaluation-failed' && result.requiresInitialization);
      return;
    }

    if (result.type === 'evaluation-failed' && result.requiresInitialization) {
      this.#latest = completed;
      if (canAutomaticallyInitialize) {
        this.#automaticInitializationUsed = true;
        this.#terminateWorker();
        this.#dispatch(completed, true);
      }
    }
  };

  readonly #onError = (event: Event): void => {
    event.preventDefault();
    this.#clearCancellationTimer();
    const retained = this.#queued ?? this.#active ?? this.#latest;
    this.#active = null;
    this.#queued = null;
    this.#terminateWorker();
    if (!retained) return;

    this.#latest = retained;
    if (!this.#isServerConnected() || this.#automaticRestartUsed) return;

    this.#automaticRestartUsed = true;
    this.#ensureWorker();
    this.#dispatch(retained, true);
  };

  #dispatch(scheduled: ScheduledEvaluation, initialize: boolean): void {
    const worker = this.#ensureWorker();
    this.#active = scheduled;
    worker.postMessage(initialize ? scheduled.initialization : scheduled.request);
  }

  #ensureWorker(): Worker {
    if (this.#worker) return this.#worker;
    if (this.#closed) throw new Error('Evaluation client is closed');

    const worker = this.#createWorker();
    worker.addEventListener('message', this.#onMessage);
    worker.addEventListener('error', this.#onError);
    this.#worker = worker;
    return worker;
  }

  #terminateWorker(): void {
    if (!this.#worker) return;
    this.#worker.removeEventListener('message', this.#onMessage);
    this.#worker.removeEventListener('error', this.#onError);
    this.#worker.terminate();
    this.#worker = null;
  }

  #clearCancellationTimer(): void {
    if (!this.#cancellationTimer) return;
    clearTimeout(this.#cancellationTimer);
    this.#cancellationTimer = null;
  }
}

export class BrowserProjectEvaluationScheduler implements ProjectEvaluationScheduler {
  readonly #client: EvaluationClient;
  readonly #createPreparationWorker: () => Worker;
  readonly #isServerConnected: () => boolean;
  readonly #requests = new Map<string, ProjectEvaluationRequest>();
  #preparationWorker: Worker | null = null;
  #preparingRequestId: string | null = null;
  #preparationPosted = false;
  #sequence = 0;
  #closed = false;
  readonly #stopServerReconnect: () => void;

  constructor(dependencies: {
    createWorker: () => Worker;
    createPreparationWorker: () => Worker;
    isServerConnected: () => boolean;
    onServerReconnect: (listener: () => void) => () => void;
  }) {
    this.#createPreparationWorker = dependencies.createPreparationWorker;
    this.#isServerConnected = dependencies.isServerConnected;
    this.#client = new EvaluationClient({
      createWorker: dependencies.createWorker,
      isServerConnected: dependencies.isServerConnected,
      publish: (action) => this.#publish(action)
    });
    this.#stopServerReconnect = dependencies.onServerReconnect(() => {
      if (this.#preparingRequestId !== null) {
        if (!this.#preparationPosted) this.#dispatchPreparation();
        return;
      }

      this.#client.retry();
    });
  }

  schedule(request: ProjectEvaluationRequest): void {
    if (this.#closed) throw new Error('Project evaluation scheduler is closed');
    this.#sequence += 1;
    const requestId = crypto.randomUUID();
    this.#requests.clear();
    this.#requests.set(requestId, request);
    this.#preparingRequestId = requestId;
    this.#preparationPosted = false;
    if (!this.#preparationWorker && !this.#isServerConnected()) return;
    this.#dispatchPreparation();
  }

  #dispatchPreparation(): void {
    const requestId = this.#preparingRequestId;
    if (!requestId || this.#preparationPosted) return;
    const request = this.#requests.get(requestId);
    if (!request) return;

    try {
      this.#ensurePreparationWorker().postMessage({
        type: 'prepare-evaluation',
        sequence: this.#sequence,
        requestId,
        sourceRevision: request.sourceRevision,
        snapshot: request.snapshot,
        scope: request.scope
      });
      this.#preparationPosted = true;
    } catch {
      this.#terminatePreparationWorker();
      if (!this.#isServerConnected()) return;
      this.#publishPreparationFailure(requestId);
    }
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#sequence += 1;
    this.#requests.clear();
    this.#preparingRequestId = null;
    this.#preparationPosted = false;
    this.#terminatePreparationWorker();
    this.#stopServerReconnect();
    this.#client.close();
  }

  readonly #onPreparationMessage = (event: MessageEvent<unknown>): void => {
    const candidate = event.data as {
      type?: unknown;
      sequence?: unknown;
      requestId?: unknown;
    };
    if (
      (candidate.type !== 'evaluation-prepared' &&
        candidate.type !== 'evaluation-preparation-failed') ||
      typeof candidate.sequence !== 'number' ||
      typeof candidate.requestId !== 'string' ||
      this.#closed ||
      candidate.sequence !== this.#sequence ||
      !this.#requests.has(candidate.requestId)
    ) {
      return;
    }
    const result = event.data as EvaluationPreparationResult;

    if (result.type === 'evaluation-preparation-failed') {
      this.#publishPreparationFailure(result.requestId);
      return;
    }

    this.#preparingRequestId = null;
    this.#preparationPosted = false;
    try {
      this.#client.schedule({
        request: result.request!,
        initialization: result.initialization!
      });
    } catch {
      this.#publishPreparationFailure(result.requestId);
    }
  };

  readonly #onPreparationError = (event: Event): void => {
    event.preventDefault();
    const requestId = this.#preparingRequestId;
    this.#terminatePreparationWorker();
    this.#preparationPosted = false;
    if (requestId === null || !this.#isServerConnected()) return;
    this.#publishPreparationFailure(requestId);
  };

  #ensurePreparationWorker(): Worker {
    if (this.#preparationWorker) return this.#preparationWorker;
    if (this.#closed) throw new Error('Project evaluation scheduler is closed');

    const worker = this.#createPreparationWorker();
    worker.addEventListener('message', this.#onPreparationMessage);
    worker.addEventListener('error', this.#onPreparationError);
    this.#preparationWorker = worker;
    return worker;
  }

  #terminatePreparationWorker(): void {
    if (!this.#preparationWorker) return;
    this.#preparationWorker.removeEventListener('message', this.#onPreparationMessage);
    this.#preparationWorker.removeEventListener('error', this.#onPreparationError);
    this.#preparationWorker.terminate();
    this.#preparationWorker = null;
  }

  #publishPreparationFailure(requestId: string): void {
    const request = this.#requests.get(requestId);
    if (!request) return;
    this.#requests.delete(requestId);
    if (this.#preparingRequestId === requestId) {
      this.#preparingRequestId = null;
      this.#preparationPosted = false;
    }
    request.publish([
      {
        id: 'result-evaluation-summary',
        sourceRevision: request.sourceRevision,
        status: 'failed',
        kind: 'evaluation-summary',
        detail: null
      }
    ]);
  }

  #publish(action: ProjectSystemAction): void {
    const request = this.#requests.get(action.outcome.requestId);
    if (!request) return;
    this.#requests.delete(action.outcome.requestId);
    const validationScope = validationScopeForEvaluation(request.scope);
    const priorValidationResult = request.snapshot.results.find(
      (result) => result.detail?.type === 'validation'
    );
    const priorValidationHistory =
      priorValidationResult?.detail?.type === 'validation'
        ? priorValidationResult.detail.history
        : EMPTY_VALIDATION_HISTORY;
    const results =
      action.outcome.type === 'evaluation-succeeded' && action.outcome.results.length > 0
        ? action.outcome.results.map((result) => ({
            ...result,
            sourceRevision: request.sourceRevision
          }))
        : action.outcome.type === 'evaluation-failed'
          ? [
              {
                id: 'result-validation-history',
                sourceRevision: request.sourceRevision,
                status: 'failed' as const,
                kind: 'validation',
                detail: {
                  type: 'validation' as const,
                  history: recordValidationRunFailure(priorValidationHistory, {
                    runId: action.outcome.requestId,
                    projectRevision: request.sourceRevision,
                    evaluatedAt: new Date().toISOString(),
                    scope: validationScope,
                    status: 'failed'
                  })
                }
              },
              {
                id: 'result-evaluation-summary',
                sourceRevision: request.sourceRevision,
                status: 'failed' as const,
                kind: 'evaluation-summary',
                detail: null
              }
            ]
          : [
              {
                id: 'result-evaluation-summary',
                sourceRevision: request.sourceRevision,
                status:
                  action.outcome.type === 'evaluation-succeeded'
                    ? ('current' as const)
                    : ('failed' as const),
                kind: 'evaluation-summary',
                detail: null
              }
            ];
    request.publish(results);
  }
}
