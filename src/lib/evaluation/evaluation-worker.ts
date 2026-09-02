import { APPLICATION_VERSIONS } from '../version/version-registry';
import {
  applyEvaluationChangeSet,
  evaluationDerivedResultSchema,
  workerRequestSchema
} from './protocol';
import { evaluateCalculation } from '../calculation/evaluate-calculation';
import { screenCandidates } from '../calculation/screen-candidates';
import { evaluateOperatingStateOverlay } from '../operating-state/evaluate-overlay';
import { createEmptyElectricalModel } from '../electrical/electrical';
import { createEmptyFluidModel } from '../fluid/fluid';

import type {
  CancelEvaluation,
  EvaluationDerivedResult,
  EvaluationFailed,
  EvaluationProject,
  EvaluationRequest,
  WorkerResult
} from './protocol';
import type { ProjectResult, ProjectSnapshot } from '../project/project';

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

  const evaluatedAt = new Date().toISOString();
  const results: EvaluationDerivedResult[] = [];
  for (let index = 0; index < evaluating.calculations.length; index += 1) {
    if (index > 0 && index % 25 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (token.canceled) {
        workerScope.postMessage({
          type: 'evaluation-canceled',
          ...resultIdentity(token.request)
        });
        return;
      }
    }

    const calculation = evaluating.calculations[index];
    if (!calculation) continue;
    const outcome = evaluateCalculation(calculation, evaluatedAt);
    results.push(
      evaluationDerivedResultSchema.parse({
        id: `result-${calculation.id}`,
        kind: 'calculation',
        status:
          outcome.status === 'calculated'
            ? 'current'
            : outcome.status === 'unknown'
              ? 'unknown'
              : 'unsupported',
        detail: { type: 'calculation', outcome }
      })
    );
  }
  for (let index = 0; index < evaluating.screenings.length; index += 1) {
    if (index > 0 && index % 25 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (token.canceled) {
        workerScope.postMessage({
          type: 'evaluation-canceled',
          ...resultIdentity(token.request)
        });
        return;
      }
    }

    const screening = evaluating.screenings[index];
    if (!screening) continue;
    results.push(
      evaluationDerivedResultSchema.parse({
        id: `result-${screening.id}`,
        kind: 'screening',
        status: 'current',
        detail: { type: 'screening', result: screenCandidates(screening) }
      })
    );
  }

  const overlayResults: ProjectResult[] = results.map((result) => ({
    ...result,
    sourceRevision: evaluating.projectRevision
  }));
  const overlaySnapshot: ProjectSnapshot = {
    id: evaluating.projectId,
    name: 'Evaluation mirror',
    createdAt: '1970-01-01T00:00:00.000Z',
    revision: evaluating.projectRevision,
    topology: {
      systems: evaluating.systems.map((system) => ({
        ...system,
        label: system.id
      })),
      components: evaluating.components.map((component) => ({
        id: component.id,
        label: component.id,
        kind: 'part',
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '0', y: '0' },
        ports: component.ports.map((port) => ({
          ...port,
          componentId: component.id,
          label: port.id,
          mediumId: port.domain === 'fluid' ? 'evaluation-medium' : null,
          interfaceKey: null
        }))
      })),
      connections: evaluating.connections.map((connection) => ({
        ...connection,
        label: connection.id,
        interfaceAssessment: 'unknown',
        routeId: null
      })),
      routes: [],
      segments: []
    },
    electrical: {
      ...createEmptyElectricalModel(),
      circuits: evaluating.circuits
    },
    fluid: createEmptyFluidModel(),
    calculations: evaluating.calculations,
    screenings: evaluating.screenings,
    partDefinitions: [],
    partRequirements: [],
    evidence: evaluating.evidence,
    results: overlayResults,
    tombstones: [],
    engineeringValues: evaluating.engineeringValues,
    operatingStates: evaluating.operatingStates,
    settings: { unitSystem: 'metric' },
    assetHashes: [],
    vehicleBackground: null
  };
  for (const state of evaluating.operatingStates) {
    const overlay = evaluateOperatingStateOverlay(
      overlaySnapshot,
      state.id,
      token.request.inputFingerprint
    );
    results.push(
      evaluationDerivedResultSchema.parse({
        id: `result-overlay-${state.id}`,
        kind: 'overlay',
        status: 'current',
        detail: { type: 'overlay', overlay }
      })
    );
  }

  workerScope.postMessage({
    type: 'evaluation-succeeded',
    ...resultIdentity(token.request),
    summary: {
      componentCount: evaluating.components.length,
      connectionCount: evaluating.connections.length,
      engineeringValueCount: evaluating.engineeringValues.length,
      operatingStateCount: evaluating.operatingStates.length
    },
    results
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
