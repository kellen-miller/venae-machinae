import {
  createEvaluationChangeSet,
  createEvaluationProject,
  initializeEvaluationSchema
} from './protocol';
import { canonicalJson, sha256Hex } from '../exchange/canonical-json';
import { projectSnapshotToDocument } from '../persistence/project-document';
import { APPLICATION_VERSIONS } from '../version/version-registry';

import type { EvaluationProject, EvaluationRequest, InitializeEvaluation } from './protocol';
import type { ProjectEvaluationRequest, EvaluationScope } from '../session/project-session.svelte';
import type { ProjectSnapshot } from '../project/project';

export type PrepareEvaluationRequest = Readonly<{
  type: 'prepare-evaluation';
  sequence: number;
  requestId: string;
  sourceRevision: number;
  snapshot: ProjectSnapshot;
  scope: EvaluationScope;
}>;

export type PreparedEvaluation = Readonly<{
  type: 'evaluation-prepared';
  sequence: number;
  requestId: string;
  request: EvaluationRequest;
  initialization: InitializeEvaluation;
}>;

export type EvaluationPreparationFailed = Readonly<{
  type: 'evaluation-preparation-failed';
  sequence: number;
  requestId: string;
  message: string;
}>;

export type EvaluationPreparationResult = PreparedEvaluation | EvaluationPreparationFailed;

function validationScopeForEvaluation(
  scope: ProjectEvaluationRequest['scope']
): InitializeEvaluation['scope'] {
  if (scope.kind === 'all') return { kind: 'validate-project' };
  if (scope.kind === 'review-profile') {
    return { kind: 'review-profile', profileId: scope.profileId };
  }

  return { kind: 'incremental', subjectIds: [...scope.subjectIds] };
}

export async function prepareEvaluation(
  input: PrepareEvaluationRequest,
  previous: EvaluationProject | null
): Promise<Readonly<{ result: PreparedEvaluation; project: EvaluationProject }>> {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new Error('Evaluation preparation sequence must be a positive safe integer');
  }
  if (input.requestId.length === 0 || input.sourceRevision !== input.snapshot.revision) {
    throw new Error('Evaluation preparation identity does not match its Project Snapshot');
  }

  const document = projectSnapshotToDocument(input.snapshot);
  const project = createEvaluationProject(document);
  const scope = validationScopeForEvaluation(input.scope);
  const inputFingerprint = await sha256Hex(canonicalJson({ project, scope }));
  const identity = {
    requestId: input.requestId,
    projectRevision: input.sourceRevision,
    inputFingerprint,
    formulaCatalogVersion: APPLICATION_VERSIONS.formulaCatalog,
    validationRuleCatalogVersion: APPLICATION_VERSIONS.validationRuleCatalog,
    schemaVersion: APPLICATION_VERSIONS.projectDocumentSchema,
    scope
  };
  const initialization = initializeEvaluationSchema.parse({
    type: 'initialize-evaluation',
    ...identity,
    project
  });
  const request =
    previous && project.projectRevision > previous.projectRevision
      ? createEvaluationChangeSet(previous, project, identity)
      : initialization;

  return {
    result: {
      type: 'evaluation-prepared',
      sequence: input.sequence,
      requestId: input.requestId,
      request,
      initialization
    },
    project
  };
}
