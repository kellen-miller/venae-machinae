import { z } from 'zod';

import type { ProjectSnapshot } from '../project/project';
import type { SubjectId } from '../topology/topology';

export const OVERLAY_CHANNELS = [
  'potential',
  'current',
  'signal',
  'fluid-direction',
  'temperature',
  'finding',
  'selection'
] as const;

export type OverlayChannel = (typeof OVERLAY_CHANNELS)[number];
export type StateBindingEvidenceState =
  'known' | 'unknown' | 'conflicting' | 'unsupported' | 'excluded';
export type StateBindingDirection =
  | 'source-to-load'
  | 'load-to-return'
  | 'driver-to-receiver'
  | 'bidirectional'
  | 'forward'
  | 'reverse'
  | 'zero'
  | 'unknown'
  | 'conflicting'
  | 'excluded';

export type StateStatement = Readonly<{
  id: SubjectId;
  subjectId: SubjectId;
  label: string;
  value: string;
  unit: string | null;
  provenance: string;
}>;

export type StateBindingBehavior = Readonly<{
  id: SubjectId;
  componentId: SubjectId;
  description: string;
  provenance: string;
}>;

export type StateBinding = Readonly<{
  id: SubjectId;
  subjectId: SubjectId;
  systemId: SubjectId;
  channel: Exclude<OverlayChannel, 'finding' | 'selection'>;
  evidenceState: StateBindingEvidenceState;
  value: string | null;
  unit: string | null;
  direction: StateBindingDirection | null;
  referenceSubjectId: SubjectId | null;
  pathConnectionIds: readonly SubjectId[];
  behavior: StateBindingBehavior | null;
  calculationResultId: string | null;
  evidenceIds: readonly SubjectId[];
  assumptions: readonly string[];
  omissions: readonly string[];
  applicability: string;
  uncertainty: string | null;
  conflictValues: readonly string[];
  provenance: readonly string[];
}>;

export type OperatingState = Readonly<{
  id: SubjectId;
  name: string;
  description: string;
  commands: readonly StateStatement[];
  conditions: readonly StateStatement[];
  measurements: readonly StateStatement[];
  assumptions: readonly StateStatement[];
  applicableEvidenceIds: readonly SubjectId[];
  bindings: readonly StateBinding[];
}>;

export type OperatingStateModelRejection = Readonly<{
  code: 'invalid-operating-state' | 'invalid-state-binding';
  message: string;
}>;

const identity = z.string().min(1).max(160);
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const stateStatementSchema = z.strictObject({
  id: identity,
  subjectId: identity,
  label: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().min(1).nullable(),
  provenance: z.string().min(1)
});
const stateBindingBehaviorSchema = z.strictObject({
  id: identity,
  componentId: identity,
  description: z.string().min(1),
  provenance: z.string().min(1)
});

export const stateBindingSchema = z.strictObject({
  id: identity,
  subjectId: identity,
  systemId: identity,
  channel: z.enum(['potential', 'current', 'signal', 'fluid-direction', 'temperature']),
  evidenceState: z.enum(['known', 'unknown', 'conflicting', 'unsupported', 'excluded']),
  value: z.string().min(1).nullable(),
  unit: z.string().min(1).nullable(),
  direction: z
    .enum([
      'source-to-load',
      'load-to-return',
      'driver-to-receiver',
      'bidirectional',
      'forward',
      'reverse',
      'zero',
      'unknown',
      'conflicting',
      'excluded'
    ])
    .nullable(),
  referenceSubjectId: identity.nullable(),
  pathConnectionIds: z.array(identity),
  behavior: stateBindingBehaviorSchema.nullable(),
  calculationResultId: identity.nullable(),
  evidenceIds: z.array(identity),
  assumptions: z.array(z.string().min(1)),
  omissions: z.array(z.string().min(1)),
  applicability: z.string().min(1),
  uncertainty: z.string().min(1).nullable(),
  conflictValues: z.array(z.string().min(1)),
  provenance: z.array(z.string().min(1))
});

export const operatingStateSchema = z.strictObject({
  id: identity,
  name: z.string().min(1),
  description: z.string(),
  commands: z.array(stateStatementSchema),
  conditions: z.array(stateStatementSchema),
  measurements: z.array(stateStatementSchema),
  assumptions: z.array(stateStatementSchema),
  applicableEvidenceIds: z.array(identity),
  bindings: z.array(stateBindingSchema)
});

const electricalPrimaryChannels = new Set<OverlayChannel>(['potential', 'current', 'signal']);

export function createOperatingState(input: {
  id: SubjectId;
  name: string;
  description: string;
}): OperatingState {
  return {
    ...input,
    commands: [],
    conditions: [],
    measurements: [],
    assumptions: [],
    applicableEvidenceIds: [],
    bindings: []
  };
}

export function createReferenceOperatingStates(
  identity: (name: string, index: number) => SubjectId
): readonly OperatingState[] {
  return [
    ['Key Off / Cold', 'Key off with explicitly cold recorded conditions.'],
    ['Fuel Prime', 'Key-on fuel-prime static review.'],
    ['Run Cold', 'Running with explicitly cold recorded conditions.'],
    ['Run Hot / Fan On', 'Running hot with fan command explicitly on.'],
    ['Heat Soak / Key Off', 'Key off during an explicitly recorded heat-soak condition.']
  ].map(([name, description], index) =>
    createOperatingState({ id: identity(name!, index), name: name!, description: description! })
  );
}

export function selectOverlayChannel(
  selected: readonly OverlayChannel[],
  channel: OverlayChannel,
  enabled: boolean
): readonly OverlayChannel[] {
  const next = new Set(selected);
  if (enabled) {
    if (electricalPrimaryChannels.has(channel)) {
      for (const primary of electricalPrimaryChannels) next.delete(primary);
    }
    next.add(channel);
  } else {
    next.delete(channel);
  }

  return OVERLAY_CHANNELS.filter((candidate) => next.has(candidate));
}

export function validateOperatingStateModel(
  snapshot: ProjectSnapshot
): OperatingStateModelRejection | null {
  const projectSubjectIds = new Set<string>([
    snapshot.id,
    ...snapshot.topology.systems.map((subject) => subject.id),
    ...snapshot.topology.components.flatMap((subject) => [
      subject.id,
      ...subject.ports.map((port) => port.id)
    ]),
    ...snapshot.topology.connections.map((subject) => subject.id),
    ...snapshot.topology.routes.map((subject) => subject.id),
    ...snapshot.topology.segments.map((subject) => subject.id),
    ...snapshot.evidence.map((subject) => subject.id),
    ...snapshot.engineeringValues.map((subject) => subject.id),
    ...snapshot.calculations.flatMap((subject) => [
      subject.id,
      ...subject.inputs.map((input) => input.quantity.id)
    ]),
    ...snapshot.screenings.map((subject) => subject.id),
    ...snapshot.partDefinitions.map((subject) => subject.id),
    ...snapshot.partRequirements.map((subject) => subject.id),
    ...snapshot.results.map((subject) => subject.id),
    ...snapshot.fluid.behaviors.map((subject) => subject.id),
    ...snapshot.fluid.boundaryConditions.map((subject) => subject.id)
  ]);
  const stateIds = new Set<string>();
  const nestedIds = new Set<string>();
  const evidenceIds = new Set(snapshot.evidence.map((evidence) => evidence.id));
  const resultIds = new Set(snapshot.results.map((result) => result.id));
  const systems = new Map(snapshot.topology.systems.map((system) => [system.id, system]));
  const connections = new Map(
    snapshot.topology.connections.map((connection) => [connection.id, connection])
  );
  const components = new Set(snapshot.topology.components.map((component) => component.id));

  for (const state of snapshot.operatingStates) {
    if (!state.id.trim() || stateIds.has(state.id) || !state.name.trim()) {
      return invalidState(`Operating State ${state.id} is repeated or unnamed`);
    }
    stateIds.add(state.id);

    if (
      new Set(state.applicableEvidenceIds).size !== state.applicableEvidenceIds.length ||
      state.applicableEvidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId))
    ) {
      return invalidState(`Operating State ${state.id} has invalid applicable evidence`);
    }

    for (const statements of [
      state.commands,
      state.conditions,
      state.measurements,
      state.assumptions
    ]) {
      for (const statement of statements) {
        if (
          !statement.id.trim() ||
          nestedIds.has(statement.id) ||
          projectSubjectIds.has(statement.id) ||
          !projectSubjectExists(snapshot, statement.subjectId) ||
          !statement.label.trim() ||
          !statement.value.trim() ||
          !statement.provenance.trim()
        ) {
          return invalidState(`Operating State ${state.id} contains an invalid statement`);
        }
        nestedIds.add(statement.id);
      }
    }

    for (const binding of state.bindings) {
      const system = systems.get(binding.systemId);
      const connection = connections.get(binding.subjectId);
      const pathConnections = binding.pathConnectionIds.map((connectionId) =>
        connections.get(connectionId)
      );
      if (
        !binding.id.trim() ||
        nestedIds.has(binding.id) ||
        projectSubjectIds.has(binding.id) ||
        !system ||
        !connection ||
        connection.systemId !== binding.systemId ||
        !binding.pathConnectionIds.includes(binding.subjectId) ||
        new Set(binding.pathConnectionIds).size !== binding.pathConnectionIds.length ||
        pathConnections.some(
          (pathConnection) => !pathConnection || pathConnection.systemId !== binding.systemId
        ) ||
        new Set(binding.evidenceIds).size !== binding.evidenceIds.length ||
        binding.evidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId)) ||
        (binding.calculationResultId !== null && !resultIds.has(binding.calculationResultId)) ||
        !binding.applicability.trim() ||
        binding.assumptions.some((assumption) => !assumption.trim()) ||
        binding.omissions.some((omission) => !omission.trim()) ||
        binding.provenance.some((source) => !source.trim()) ||
        (binding.behavior !== null &&
          (!binding.behavior.id.trim() ||
            nestedIds.has(binding.behavior.id) ||
            projectSubjectIds.has(binding.behavior.id) ||
            !components.has(binding.behavior.componentId) ||
            !binding.behavior.description.trim() ||
            !binding.behavior.provenance.trim()))
      ) {
        return invalidBinding(`State Binding ${binding.id} has invalid references or trace data`);
      }
      nestedIds.add(binding.id);
      if (binding.behavior) nestedIds.add(binding.behavior.id);

      if (
        (system.domain === 'electrical' &&
          (binding.channel === 'fluid-direction' || binding.channel === 'temperature')) ||
        (system.domain === 'fluid' &&
          (binding.channel === 'potential' ||
            binding.channel === 'current' ||
            binding.channel === 'signal'))
      ) {
        return invalidBinding(`State Binding ${binding.id} crosses engineering domains`);
      }

      if (
        binding.evidenceState === 'conflicting' &&
        binding.conflictValues.filter((value) => value.trim()).length < 2
      ) {
        return invalidBinding(`State Binding ${binding.id} needs every conflicting value`);
      }
      if (
        (binding.evidenceState === 'unknown' ||
          binding.evidenceState === 'unsupported' ||
          binding.evidenceState === 'excluded') &&
        binding.value !== null
      ) {
        return invalidBinding(`State Binding ${binding.id} cannot hide a value behind its status`);
      }
      if (binding.evidenceState === 'known' && binding.provenance.length === 0) {
        return invalidBinding(`Known State Binding ${binding.id} needs explicit provenance`);
      }

      const semanticRejection = validateChannelSemantics(binding, snapshot);
      if (semanticRejection) return semanticRejection;
    }
  }

  return null;
}

function validateChannelSemantics(
  binding: StateBinding,
  snapshot: ProjectSnapshot
): OperatingStateModelRejection | null {
  if (binding.channel === 'potential') {
    const hasLocatedSource = binding.evidenceIds.some((evidenceId) =>
      snapshot.evidence.some(
        (evidence) =>
          evidence.id === evidenceId &&
          evidence.subjectId === binding.subjectId &&
          evidence.state === 'known'
      )
    );
    if (
      binding.evidenceState === 'known' &&
      (!binding.value ||
        !decimalPattern.test(binding.value) ||
        !binding.unit ||
        !binding.referenceSubjectId ||
        !projectSubjectExists(snapshot, binding.referenceSubjectId) ||
        binding.direction !== null ||
        !hasLocatedSource)
    ) {
      return invalidBinding(
        `Potential Binding ${binding.id} needs a value and identified return/reference only`
      );
    }
    return null;
  }

  if (binding.channel === 'current') {
    const pathSet = new Set(binding.pathConnectionIds);
    const ownsCompleteCircuit = snapshot.electrical.circuits.some(
      (circuit) =>
        circuit.systemId === binding.systemId &&
        circuit.connectionIds.length === pathSet.size &&
        circuit.connectionIds.every((connectionId) => pathSet.has(connectionId))
    );
    const calculationResult =
      binding.calculationResultId === null
        ? null
        : snapshot.results.find((result) => result.id === binding.calculationResultId);
    const calculationOutput =
      calculationResult?.detail?.type === 'calculation'
        ? calculationResult.detail.outcome.output
        : null;
    const hasApprovedCalculatedCurrent =
      calculationResult?.detail?.type === 'calculation' &&
      calculationResult.detail.outcome.status === 'calculated' &&
      calculationOutput?.kind === 'quantity' &&
      calculationOutput.semantic === 'electric-current';
    if (
      binding.evidenceState === 'known' &&
      (!binding.value ||
        !decimalPattern.test(binding.value) ||
        !binding.unit ||
        !ownsCompleteCircuit ||
        (binding.direction !== 'source-to-load' && binding.direction !== 'load-to-return') ||
        (binding.evidenceIds.length === 0 && !hasApprovedCalculatedCurrent))
    ) {
      return invalidBinding(
        `Current Binding ${binding.id} needs a complete path, conventional direction, and explicit evidence`
      );
    }
    return null;
  }

  if (binding.channel === 'signal') {
    if (
      binding.evidenceState === 'known' &&
      (!binding.behavior ||
        (binding.direction !== 'driver-to-receiver' && binding.direction !== 'bidirectional'))
    ) {
      return invalidBinding(
        `Signal Binding ${binding.id} needs an explicit directed or bidirectional Behavior`
      );
    }
    return null;
  }

  if (binding.channel === 'fluid-direction') {
    const fluidDirections = new Set<StateBindingDirection>([
      'forward',
      'reverse',
      'zero',
      'unknown',
      'conflicting',
      'excluded'
    ]);
    if (!binding.direction || !fluidDirections.has(binding.direction)) {
      return invalidBinding(`Fluid direction Binding ${binding.id} needs an explicit path status`);
    }
    if (
      binding.evidenceState === 'known' &&
      (binding.direction === 'forward' || binding.direction === 'reverse') &&
      !binding.behavior
    ) {
      return invalidBinding(
        `Fluid direction Binding ${binding.id} needs an explicit Component Behavior`
      );
    }
    return null;
  }

  if (
    binding.evidenceState === 'known' &&
    (!binding.value ||
      !decimalPattern.test(binding.value) ||
      !binding.unit ||
      binding.evidenceIds.length === 0)
  ) {
    return invalidBinding(
      `Temperature Binding ${binding.id} needs explicit located evidence and a numeric value`
    );
  }
  if (binding.direction !== null) {
    return invalidBinding(`Temperature Binding ${binding.id} cannot imply direction`);
  }

  return null;
}

function projectSubjectExists(snapshot: ProjectSnapshot, subjectId: SubjectId): boolean {
  return (
    snapshot.id === subjectId ||
    snapshot.topology.systems.some((subject) => subject.id === subjectId) ||
    snapshot.topology.components.some(
      (subject) => subject.id === subjectId || subject.ports.some((port) => port.id === subjectId)
    ) ||
    snapshot.topology.connections.some((subject) => subject.id === subjectId) ||
    snapshot.topology.routes.some((subject) => subject.id === subjectId) ||
    snapshot.topology.segments.some((subject) => subject.id === subjectId) ||
    snapshot.evidence.some((subject) => subject.id === subjectId) ||
    snapshot.engineeringValues.some((subject) => subject.id === subjectId) ||
    snapshot.calculations.some((subject) => subject.id === subjectId) ||
    snapshot.screenings.some((subject) => subject.id === subjectId) ||
    snapshot.partDefinitions.some((subject) => subject.id === subjectId) ||
    snapshot.partRequirements.some((subject) => subject.id === subjectId) ||
    snapshot.results.some((subject) => subject.id === subjectId) ||
    snapshot.fluid.behaviors.some((subject) => subject.id === subjectId) ||
    snapshot.fluid.boundaryConditions.some((subject) => subject.id === subjectId)
  );
}

function invalidState(message: string): OperatingStateModelRejection {
  return { code: 'invalid-operating-state', message };
}

function invalidBinding(message: string): OperatingStateModelRejection {
  return { code: 'invalid-state-binding', message };
}
