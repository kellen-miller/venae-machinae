import { z } from 'zod';

import {
  calculationOutcomeSchema,
  calculationRequestSchema,
  candidateScreenRequestSchema,
  screeningResultSchema
} from '../calculation/calculation-schema';
import { operatingStateSchema } from '../operating-state/operating-state';
import { operatingStateOverlaySchema } from '../operating-state/evaluate-overlay';
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

const evaluationSystemSchema = z.strictObject({
  id: identity,
  domain: z.enum(['electrical', 'fluid']),
  mediumId: identity.nullable()
});

const evaluationComponentSchema = z.strictObject({
  id: identity,
  ports: z.array(evaluationPortSchema)
});

const evaluationConnectionSchema = z.strictObject({
  id: identity,
  systemId: identity,
  sourcePortId: identity,
  targetPortId: identity,
  domain: z.enum(['electrical', 'fluid']),
  mediumId: identity.nullable(),
  kind: z.enum(['electrical-wire', 'electrical-mate', 'fluid-hose', 'fluid-tube', 'fluid-pipe'])
});

const evaluationCircuitSchema = z.strictObject({
  id: identity,
  label: z.string().min(1),
  systemId: identity,
  connectionIds: z.array(identity),
  componentIds: z.array(identity),
  protectionComponentIds: z.array(identity)
});

const evaluationEngineeringValueSchema = z.strictObject({
  id: identity,
  decimal: decimalString,
  unit: identity,
  provenance: z.string().min(1)
});

const evaluationEvidenceSchema = z.strictObject({
  id: identity,
  subjectId: identity,
  label: z.string().min(1),
  state: z.enum(['known', 'unknown', 'conflicting']),
  value: z.string().nullable(),
  unit: z.string().nullable(),
  provenance: z.string().nullable(),
  conflictValues: z.array(z.string())
});

export const evaluationProjectSchema = z.strictObject({
  schemaVersion: version,
  projectId: identity,
  projectRevision: z.number().int().nonnegative(),
  systems: z.array(evaluationSystemSchema),
  components: z.array(evaluationComponentSchema),
  connections: z.array(evaluationConnectionSchema),
  circuits: z.array(evaluationCircuitSchema),
  evidence: z.array(evaluationEvidenceSchema),
  engineeringValues: z.array(evaluationEngineeringValueSchema),
  operatingStates: z.array(operatingStateSchema),
  calculations: z.array(calculationRequestSchema),
  screenings: z.array(candidateScreenRequestSchema)
});

const evaluationChangeSetSchema = z.strictObject({
  baseRevision: z.number().int().nonnegative(),
  upsertSystems: z.array(evaluationSystemSchema),
  removeSystemIds: z.array(identity),
  upsertComponents: z.array(evaluationComponentSchema),
  removeComponentIds: z.array(identity),
  upsertConnections: z.array(evaluationConnectionSchema),
  removeConnectionIds: z.array(identity),
  upsertCircuits: z.array(evaluationCircuitSchema),
  removeCircuitIds: z.array(identity),
  upsertEvidence: z.array(evaluationEvidenceSchema),
  removeEvidenceIds: z.array(identity),
  upsertEngineeringValues: z.array(evaluationEngineeringValueSchema),
  removeEngineeringValueIds: z.array(identity),
  upsertOperatingStates: z.array(operatingStateSchema),
  removeOperatingStateIds: z.array(identity),
  upsertCalculations: z.array(calculationRequestSchema),
  removeCalculationIds: z.array(identity),
  upsertScreenings: z.array(candidateScreenRequestSchema),
  removeScreeningIds: z.array(identity)
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

export const evaluationDerivedResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    id: identity,
    kind: z.literal('calculation'),
    status: z.enum(['current', 'unknown', 'unsupported']),
    detail: z.strictObject({ type: z.literal('calculation'), outcome: calculationOutcomeSchema })
  }),
  z.strictObject({
    id: identity,
    kind: z.literal('screening'),
    status: z.literal('current'),
    detail: z.strictObject({ type: z.literal('screening'), result: screeningResultSchema })
  }),
  z.strictObject({
    id: identity,
    kind: z.literal('overlay'),
    status: z.literal('current'),
    detail: z.strictObject({ type: z.literal('overlay'), overlay: operatingStateOverlaySchema })
  })
]);

export const evaluationSucceededSchema = z.strictObject({
  type: z.literal('evaluation-succeeded'),
  ...messageIdentityShape,
  summary: evaluationSummarySchema,
  results: z.array(evaluationDerivedResultSchema)
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
export type EvaluationDerivedResult = z.infer<typeof evaluationDerivedResultSchema>;
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
    projectId: document.project.id,
    projectRevision: document.project.revision,
    systems: document.topology.systems.map((system) => ({
      id: system.id,
      domain: system.domain,
      mediumId: system.mediumId
    })),
    components: document.topology.components.map((component) => ({
      id: component.id,
      ports: component.ports.map((port) => ({ id: port.id, domain: port.domain }))
    })),
    connections: document.topology.connections.map((connection) => ({
      id: connection.id,
      systemId: connection.systemId,
      sourcePortId: connection.sourcePortId,
      targetPortId: connection.targetPortId,
      domain: connection.domain,
      mediumId: connection.mediumId,
      kind: connection.kind
    })),
    circuits: document.electrical.circuits.map((circuit) => ({ ...circuit })),
    evidence: document.evidence.map((evidence) => ({ ...evidence })),
    engineeringValues: document.engineeringValues.map((value) => ({ ...value })),
    operatingStates: document.operatingStates.map((state) => ({ ...state })),
    calculations: document.calculations.map((calculation) => structuredClone(calculation)),
    screenings: document.screenings.map((screening) => structuredClone(screening))
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

  const systemUpserts = new Map(
    message.changeSet.upsertSystems.map((system) => [system.id, system])
  );
  const removedSystemIds = new Set(message.changeSet.removeSystemIds);
  const systems = project.systems
    .filter((system) => !removedSystemIds.has(system.id))
    .map((system) => systemUpserts.get(system.id) ?? system);
  const existingSystemIds = new Set(systems.map((system) => system.id));
  for (const system of message.changeSet.upsertSystems) {
    if (!existingSystemIds.has(system.id)) systems.push(system);
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

  const circuitUpserts = new Map(
    message.changeSet.upsertCircuits.map((circuit) => [circuit.id, circuit])
  );
  const removedCircuitIds = new Set(message.changeSet.removeCircuitIds);
  const circuits = project.circuits
    .filter((circuit) => !removedCircuitIds.has(circuit.id))
    .map((circuit) => circuitUpserts.get(circuit.id) ?? circuit);
  const existingCircuitIds = new Set(circuits.map((circuit) => circuit.id));
  for (const circuit of message.changeSet.upsertCircuits) {
    if (!existingCircuitIds.has(circuit.id)) circuits.push(circuit);
  }

  const evidenceUpserts = new Map(
    message.changeSet.upsertEvidence.map((evidence) => [evidence.id, evidence])
  );
  const removedEvidenceIds = new Set(message.changeSet.removeEvidenceIds);
  const evidence = project.evidence
    .filter((item) => !removedEvidenceIds.has(item.id))
    .map((item) => evidenceUpserts.get(item.id) ?? item);
  const existingEvidenceIds = new Set(evidence.map((item) => item.id));
  for (const item of message.changeSet.upsertEvidence) {
    if (!existingEvidenceIds.has(item.id)) evidence.push(item);
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

  const calculationUpserts = new Map(
    message.changeSet.upsertCalculations.map((calculation) => [calculation.id, calculation])
  );
  const removedCalculationIds = new Set(message.changeSet.removeCalculationIds);
  const calculations = project.calculations
    .filter((calculation) => !removedCalculationIds.has(calculation.id))
    .map((calculation) => calculationUpserts.get(calculation.id) ?? calculation);
  const existingCalculationIds = new Set(calculations.map((calculation) => calculation.id));
  for (const calculation of message.changeSet.upsertCalculations) {
    if (!existingCalculationIds.has(calculation.id)) calculations.push(calculation);
  }

  const screeningUpserts = new Map(
    message.changeSet.upsertScreenings.map((screening) => [screening.id, screening])
  );
  const removedScreeningIds = new Set(message.changeSet.removeScreeningIds);
  const screenings = project.screenings
    .filter((screening) => !removedScreeningIds.has(screening.id))
    .map((screening) => screeningUpserts.get(screening.id) ?? screening);
  const existingScreeningIds = new Set(screenings.map((screening) => screening.id));
  for (const screening of message.changeSet.upsertScreenings) {
    if (!existingScreeningIds.has(screening.id)) screenings.push(screening);
  }

  return evaluationProjectSchema.parse({
    ...project,
    projectRevision: message.projectRevision,
    systems,
    components,
    connections,
    circuits,
    evidence,
    engineeringValues,
    operatingStates,
    calculations,
    screenings
  });
}

export function createEvaluationChangeSet(
  previous: EvaluationProject,
  current: EvaluationProject,
  identity: Omit<EvaluateChangeSet, 'type' | 'changeSet'>
): EvaluateChangeSet {
  if (current.projectRevision <= previous.projectRevision) {
    throw new Error('Evaluation change set requires a newer Project revision');
  }

  function changedRecords<T extends { id: string }>(
    before: readonly T[],
    after: readonly T[]
  ): Readonly<{ upserts: T[]; removals: string[] }> {
    const previousById = new Map(before.map((record) => [record.id, record]));
    const currentIds = new Set(after.map((record) => record.id));
    return {
      upserts: after.filter(
        (record) => JSON.stringify(previousById.get(record.id)) !== JSON.stringify(record)
      ),
      removals: before.filter((record) => !currentIds.has(record.id)).map((record) => record.id)
    };
  }

  const components = changedRecords(previous.components, current.components);
  const systems = changedRecords(previous.systems, current.systems);
  const connections = changedRecords(previous.connections, current.connections);
  const circuits = changedRecords(previous.circuits, current.circuits);
  const evidence = changedRecords(previous.evidence, current.evidence);
  const engineeringValues = changedRecords(previous.engineeringValues, current.engineeringValues);
  const operatingStates = changedRecords(previous.operatingStates, current.operatingStates);
  const calculations = changedRecords(previous.calculations, current.calculations);
  const screenings = changedRecords(previous.screenings, current.screenings);

  return evaluateChangeSetSchema.parse({
    type: 'evaluate-change-set',
    ...identity,
    changeSet: {
      baseRevision: previous.projectRevision,
      upsertSystems: systems.upserts,
      removeSystemIds: systems.removals,
      upsertComponents: components.upserts,
      removeComponentIds: components.removals,
      upsertConnections: connections.upserts,
      removeConnectionIds: connections.removals,
      upsertCircuits: circuits.upserts,
      removeCircuitIds: circuits.removals,
      upsertEvidence: evidence.upserts,
      removeEvidenceIds: evidence.removals,
      upsertEngineeringValues: engineeringValues.upserts,
      removeEngineeringValueIds: engineeringValues.removals,
      upsertOperatingStates: operatingStates.upserts,
      removeOperatingStateIds: operatingStates.removals,
      upsertCalculations: calculations.upserts,
      removeCalculationIds: calculations.removals,
      upsertScreenings: screenings.upserts,
      removeScreeningIds: screenings.removals
    }
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
