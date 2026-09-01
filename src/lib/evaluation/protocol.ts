import { z } from 'zod';

import type { ProjectDocument } from '../persistence/project-document';

z.config({ jitless: true });

const identity = z.string().min(1).max(160);
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
const decimalString = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const version = z.number().int().positive();

const messageIdentityShape = {
  requestId: identity,
  projectRevision: z.number().int().nonnegative(),
  inputFingerprint: fingerprint,
  formulaCatalogVersion: version,
  validationRuleCatalogVersion: version,
  schemaVersion: version
};

const evaluationPortSchema = z.strictObject({
  id: identity,
  domain: z.enum(['electrical', 'fluid'])
});

const evaluationComponentSchema = z.strictObject({
  id: identity,
  ports: z.array(evaluationPortSchema)
});

const evaluationConnectionSchema = z.strictObject({
  id: identity,
  sourcePortId: identity,
  targetPortId: identity,
  kind: z.enum(['electrical-wire', 'electrical-mate', 'fluid-hose', 'fluid-tube', 'fluid-pipe'])
});

const evaluationEngineeringValueSchema = z.strictObject({
  id: identity,
  decimal: decimalString,
  unit: identity,
  provenance: z.string().min(1)
});

const evaluationOperatingStateSchema = z.strictObject({
  id: identity,
  name: z.string().min(1),
  description: z.string()
});

export const evaluationProjectSchema = z.strictObject({
  schemaVersion: version,
  projectRevision: z.number().int().nonnegative(),
  components: z.array(evaluationComponentSchema),
  connections: z.array(evaluationConnectionSchema),
  engineeringValues: z.array(evaluationEngineeringValueSchema),
  operatingStates: z.array(evaluationOperatingStateSchema)
});

const evaluationChangeSetSchema = z.strictObject({
  baseRevision: z.number().int().nonnegative(),
  upsertComponents: z.array(evaluationComponentSchema),
  removeComponentIds: z.array(identity),
  upsertConnections: z.array(evaluationConnectionSchema),
  removeConnectionIds: z.array(identity),
  upsertEngineeringValues: z.array(evaluationEngineeringValueSchema),
  removeEngineeringValueIds: z.array(identity),
  upsertOperatingStates: z.array(evaluationOperatingStateSchema),
  removeOperatingStateIds: z.array(identity)
});

export const initializeEvaluationSchema = z.strictObject({
  type: z.literal('initialize-evaluation'),
  ...messageIdentityShape,
  project: evaluationProjectSchema
});

export const evaluateChangeSetSchema = z.strictObject({
  type: z.literal('evaluate-change-set'),
  ...messageIdentityShape,
  changeSet: evaluationChangeSetSchema
});

export const cancelEvaluationSchema = z.strictObject({
  type: z.literal('cancel-evaluation'),
  ...messageIdentityShape
});

const evaluationSummarySchema = z.strictObject({
  componentCount: z.number().int().nonnegative(),
  connectionCount: z.number().int().nonnegative(),
  engineeringValueCount: z.number().int().nonnegative(),
  operatingStateCount: z.number().int().nonnegative()
});

export const evaluationSucceededSchema = z.strictObject({
  type: z.literal('evaluation-succeeded'),
  ...messageIdentityShape,
  summary: evaluationSummarySchema
});

export const evaluationFailedSchema = z.strictObject({
  type: z.literal('evaluation-failed'),
  ...messageIdentityShape,
  reason: z.enum([
    'revision-gap',
    'schema-mismatch',
    'catalog-version-mismatch',
    'evaluation-error'
  ]),
  message: z.string().min(1),
  requiresInitialization: z.boolean()
});

export const evaluationCanceledSchema = z.strictObject({
  type: z.literal('evaluation-canceled'),
  ...messageIdentityShape
});

export const workerRequestSchema = z.discriminatedUnion('type', [
  initializeEvaluationSchema,
  evaluateChangeSetSchema,
  cancelEvaluationSchema
]);

export const workerResultSchema = z.discriminatedUnion('type', [
  evaluationSucceededSchema,
  evaluationFailedSchema,
  evaluationCanceledSchema
]);

export type EvaluationProject = z.infer<typeof evaluationProjectSchema>;
export type InitializeEvaluation = z.infer<typeof initializeEvaluationSchema>;
export type EvaluateChangeSet = z.infer<typeof evaluateChangeSetSchema>;
export type CancelEvaluation = z.infer<typeof cancelEvaluationSchema>;
export type EvaluationSucceeded = z.infer<typeof evaluationSucceededSchema>;
export type EvaluationFailed = z.infer<typeof evaluationFailedSchema>;
export type EvaluationCanceled = z.infer<typeof evaluationCanceledSchema>;
export type EvaluationRequest = InitializeEvaluation | EvaluateChangeSet;
export type WorkerRequest = z.infer<typeof workerRequestSchema>;
export type WorkerResult = z.infer<typeof workerResultSchema>;
export type ProjectSystemAction = {
  type: 'publish-evaluation';
  outcome: EvaluationSucceeded | EvaluationFailed;
};

export function createEvaluationProject(document: ProjectDocument): EvaluationProject {
  return evaluationProjectSchema.parse({
    schemaVersion: document.schemaVersion,
    projectRevision: document.project.revision,
    components: document.topology.components.map((component) => ({
      id: component.id,
      ports: component.ports.map((port) => ({ id: port.id, domain: port.domain }))
    })),
    connections: document.topology.connections.map((connection) => ({
      id: connection.id,
      sourcePortId: connection.sourcePortId,
      targetPortId: connection.targetPortId,
      kind: connection.kind
    })),
    engineeringValues: document.engineeringValues.map((value) => ({ ...value })),
    operatingStates: document.operatingStates.map((state) => ({ ...state }))
  });
}

export function applyEvaluationChangeSet(
  project: EvaluationProject,
  message: EvaluateChangeSet
): EvaluationProject {
  if (message.changeSet.baseRevision !== project.projectRevision) {
    throw new Error(
      `Evaluation revision gap: mirror ${project.projectRevision}, change base ${message.changeSet.baseRevision}`
    );
  }

  if (message.schemaVersion !== project.schemaVersion) {
    throw new Error(
      `Evaluation schema mismatch: mirror ${project.schemaVersion}, change ${message.schemaVersion}`
    );
  }

  const componentUpserts = new Map(
    message.changeSet.upsertComponents.map((component) => [component.id, component])
  );
  const removedComponentIds = new Set(message.changeSet.removeComponentIds);
  const components = project.components
    .filter((component) => !removedComponentIds.has(component.id))
    .map((component) => componentUpserts.get(component.id) ?? component);
  const existingComponentIds = new Set(components.map((component) => component.id));
  for (const component of message.changeSet.upsertComponents) {
    if (!existingComponentIds.has(component.id)) components.push(component);
  }

  const connectionUpserts = new Map(
    message.changeSet.upsertConnections.map((connection) => [connection.id, connection])
  );
  const removedConnectionIds = new Set(message.changeSet.removeConnectionIds);
  const connections = project.connections
    .filter((connection) => !removedConnectionIds.has(connection.id))
    .map((connection) => connectionUpserts.get(connection.id) ?? connection);
  const existingConnectionIds = new Set(connections.map((connection) => connection.id));
  for (const connection of message.changeSet.upsertConnections) {
    if (!existingConnectionIds.has(connection.id)) connections.push(connection);
  }

  const engineeringValueUpserts = new Map(
    message.changeSet.upsertEngineeringValues.map((value) => [value.id, value])
  );
  const removedEngineeringValueIds = new Set(message.changeSet.removeEngineeringValueIds);
  const engineeringValues = project.engineeringValues
    .filter((value) => !removedEngineeringValueIds.has(value.id))
    .map((value) => engineeringValueUpserts.get(value.id) ?? value);
  const existingEngineeringValueIds = new Set(engineeringValues.map((value) => value.id));
  for (const value of message.changeSet.upsertEngineeringValues) {
    if (!existingEngineeringValueIds.has(value.id)) engineeringValues.push(value);
  }

  const operatingStateUpserts = new Map(
    message.changeSet.upsertOperatingStates.map((state) => [state.id, state])
  );
  const removedOperatingStateIds = new Set(message.changeSet.removeOperatingStateIds);
  const operatingStates = project.operatingStates
    .filter((state) => !removedOperatingStateIds.has(state.id))
    .map((state) => operatingStateUpserts.get(state.id) ?? state);
  const existingOperatingStateIds = new Set(operatingStates.map((state) => state.id));
  for (const state of message.changeSet.upsertOperatingStates) {
    if (!existingOperatingStateIds.has(state.id)) operatingStates.push(state);
  }

  return evaluationProjectSchema.parse({
    ...project,
    projectRevision: message.projectRevision,
    components,
    connections,
    engineeringValues,
    operatingStates
  });
}

export function evaluationIdentityMatches(
  request: EvaluationRequest,
  result: WorkerResult
): boolean {
  return (
    request.requestId === result.requestId &&
    request.projectRevision === result.projectRevision &&
    request.inputFingerprint === result.inputFingerprint &&
    request.formulaCatalogVersion === result.formulaCatalogVersion &&
    request.validationRuleCatalogVersion === result.validationRuleCatalogVersion &&
    request.schemaVersion === result.schemaVersion
  );
}
