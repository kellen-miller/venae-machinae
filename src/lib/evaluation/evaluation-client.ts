import {
  cancelEvaluationSchema,
  createEvaluationProject,
  evaluationIdentityMatches,
  initializeEvaluationSchema,
  workerRequestSchema,
  workerResultSchema
} from './protocol';
import { canonicalJson, sha256Hex } from '../exchange/canonical-json';
import { projectSnapshotToDocument } from '../persistence/project-document';
import { APPLICATION_VERSIONS } from '../version/version-registry';

import type { EvaluationRequest, InitializeEvaluation, ProjectSystemAction } from './protocol';
import type {
  ProjectEvaluationRequest,
  ProjectEvaluationScheduler
} from '../session/project-session.svelte';

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
      initialization.project.projectRevision !== initialization.projectRevision ||
      initialization.project.schemaVersion !== initialization.schemaVersion
    ) {
      throw new Error('Evaluation fallback initialization does not match its request identity');
    }

    const candidate = { request, initialization };
    this.#latest = candidate;
    if (this.#active) {
      this.#queued = candidate;
      this.cancel();
      return;
    }

    if (!this.#worker && !this.#isServerConnected()) return;
    this.#dispatch(candidate, false);
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
    if (result.type !== 'evaluation-canceled') {
      this.#publish({ type: 'publish-evaluation', outcome: result });
      if (result.type === 'evaluation-succeeded') this.#automaticRestartUsed = false;
    }

    const next = this.#queued;
    this.#queued = null;
    if (next) {
      this.#dispatch(next, result.type === 'evaluation-failed' && result.requiresInitialization);
      return;
    }

    if (result.type === 'evaluation-failed' && result.requiresInitialization) {
      this.#latest = completed;
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
  readonly #requests = new Map<string, ProjectEvaluationRequest>();
  #sequence = 0;
  #closed = false;

  constructor(dependencies: { createWorker: () => Worker; isServerConnected: () => boolean }) {
    this.#client = new EvaluationClient({
      ...dependencies,
      publish: (action) => this.#publish(action)
    });
  }

  schedule(request: ProjectEvaluationRequest): void {
    if (this.#closed) throw new Error('Project evaluation scheduler is closed');
    const sequence = ++this.#sequence;
    void this.#prepare(request, sequence).catch(() => {
      if (this.#closed || sequence !== this.#sequence) return;
      request.publish([
        {
          id: 'result-evaluation-summary',
          sourceRevision: request.sourceRevision,
          status: 'failed',
          kind: 'evaluation-summary'
        }
      ]);
    });
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#sequence += 1;
    this.#requests.clear();
    this.#client.close();
  }

  async #prepare(request: ProjectEvaluationRequest, sequence: number): Promise<void> {
    const document = projectSnapshotToDocument(request.snapshot);
    const project = createEvaluationProject(document);
    const inputFingerprint = await sha256Hex(canonicalJson(project));
    if (this.#closed || sequence !== this.#sequence) return;

    const initialization: InitializeEvaluation = {
      type: 'initialize-evaluation',
      requestId: crypto.randomUUID(),
      projectRevision: request.sourceRevision,
      inputFingerprint,
      formulaCatalogVersion: APPLICATION_VERSIONS.formulaCatalog,
      validationRuleCatalogVersion: APPLICATION_VERSIONS.validationRuleCatalog,
      schemaVersion: APPLICATION_VERSIONS.projectDocumentSchema,
      project
    };
    this.#requests.clear();
    this.#requests.set(initialization.requestId, request);
    this.#client.schedule({ request: initialization, initialization });
  }

  #publish(action: ProjectSystemAction): void {
    const request = this.#requests.get(action.outcome.requestId);
    if (!request) return;
    this.#requests.delete(action.outcome.requestId);
    request.publish([
      {
        id: 'result-evaluation-summary',
        sourceRevision: request.sourceRevision,
        status: action.outcome.type === 'evaluation-succeeded' ? 'current' : 'failed',
        kind: 'evaluation-summary'
      }
    ]);
  }
}
