import { APPLICATION_VERSIONS } from '../version/version-registry';
import { applyEvaluationChangeSet, workerRequestSchema } from './protocol';

import type {
  CancelEvaluation,
  EvaluationFailed,
  EvaluationProject,
  EvaluationRequest,
  WorkerResult
} from './protocol';

type ActiveEvaluation = {
  request: EvaluationRequest;
  canceled: boolean;
};

type EvaluationWorkerScope = {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  postMessage(message: WorkerResult): void;
};

const workerScope = globalThis as unknown as EvaluationWorkerScope;
let mirror: EvaluationProject | null = null;
let active: ActiveEvaluation | null = null;
let mirrorFormulaCatalogVersion: number | null = null;
let mirrorValidationRuleCatalogVersion: number | null = null;

function resultIdentity(request: EvaluationRequest | CancelEvaluation) {
  return {
    requestId: request.requestId,
    projectRevision: request.projectRevision,
    inputFingerprint: request.inputFingerprint,
    formulaCatalogVersion: request.formulaCatalogVersion,
    validationRuleCatalogVersion: request.validationRuleCatalogVersion,
    schemaVersion: request.schemaVersion
  };
}

function fail(
  request: EvaluationRequest,
  reason: EvaluationFailed['reason'],
  message: string
): void {
  workerScope.postMessage({
    type: 'evaluation-failed',
    ...resultIdentity(request),
    reason,
    message,
    requiresInitialization:
      reason === 'revision-gap' ||
      reason === 'schema-mismatch' ||
      reason === 'catalog-version-mismatch'
  });
}

async function evaluate(token: ActiveEvaluation): Promise<void> {
  const evaluating = mirror;
  if (!evaluating) {
    fail(token.request, 'evaluation-error', 'Evaluation mirror is unavailable');
    return;
  }

  for (let index = 0; index < evaluating.components.length; index += 25) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (token.canceled) {
      workerScope.postMessage({
        type: 'evaluation-canceled',
        ...resultIdentity(token.request)
      });
      return;
    }
  }

  if (token.canceled) {
    workerScope.postMessage({
      type: 'evaluation-canceled',
      ...resultIdentity(token.request)
    });
    return;
  }

  workerScope.postMessage({
    type: 'evaluation-succeeded',
    ...resultIdentity(token.request),
    summary: {
      componentCount: evaluating.components.length,
      connectionCount: evaluating.connections.length,
      engineeringValueCount: evaluating.engineeringValues.length,
      operatingStateCount: evaluating.operatingStates.length
    }
  });
  if (active === token) active = null;
}

function start(request: EvaluationRequest): void {
  if (active) active.canceled = true;
  const token = { request, canceled: false };
  active = token;
  void evaluate(token).catch((error: unknown) => {
    if (active === token) active = null;
    fail(request, 'evaluation-error', error instanceof Error ? error.message : 'Evaluation failed');
  });
}

workerScope.addEventListener('message', (event) => {
  const parsed = workerRequestSchema.safeParse(event.data);
  if (!parsed.success) return;

  const request = parsed.data;
  if (request.type === 'cancel-evaluation') {
    if (active?.request.requestId === request.requestId) active.canceled = true;
    return;
  }

  if (
    request.schemaVersion !== APPLICATION_VERSIONS.projectDocumentSchema ||
    (request.type === 'initialize-evaluation' &&
      request.project.schemaVersion !== APPLICATION_VERSIONS.projectDocumentSchema)
  ) {
    fail(request, 'schema-mismatch', 'Evaluation schema version is not supported');
    return;
  }

  if (
    request.formulaCatalogVersion !== APPLICATION_VERSIONS.formulaCatalog ||
    request.validationRuleCatalogVersion !== APPLICATION_VERSIONS.validationRuleCatalog
  ) {
    fail(request, 'catalog-version-mismatch', 'Evaluation catalog version is not supported');
    return;
  }

  if (request.type === 'initialize-evaluation') {
    mirror = request.project;
    mirrorFormulaCatalogVersion = request.formulaCatalogVersion;
    mirrorValidationRuleCatalogVersion = request.validationRuleCatalogVersion;
    start(request);
    return;
  }

  if (!mirror || request.changeSet.baseRevision !== mirror.projectRevision) {
    fail(request, 'revision-gap', 'Evaluation mirror revision does not match the change set');
    return;
  }

  if (
    request.formulaCatalogVersion !== mirrorFormulaCatalogVersion ||
    request.validationRuleCatalogVersion !== mirrorValidationRuleCatalogVersion
  ) {
    fail(request, 'catalog-version-mismatch', 'Evaluation catalogs changed after initialization');
    return;
  }

  try {
    mirror = applyEvaluationChangeSet(mirror, request);
  } catch (error) {
    fail(request, 'revision-gap', error instanceof Error ? error.message : 'Revision gap');
    return;
  }

  start(request);
});
