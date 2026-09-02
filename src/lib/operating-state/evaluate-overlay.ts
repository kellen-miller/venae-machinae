import { z } from 'zod';

import { validateOperatingStateModel } from './operating-state';

import type { OverlayChannel, StateBinding, StateBindingDirection } from './operating-state';
import type { ProjectSnapshot } from '../project/project';

z.config({ jitless: true });

export type OverlayAvailability =
  'available' | 'partial' | 'unavailable' | 'conflicting' | 'unsupported' | 'excluded';

export type OverlayTrace = Readonly<{
  physicalConnectionId: string;
  pathConnectionIds: readonly string[];
  operatingStateId: string;
  stateBindingId: string;
  componentBehaviorId: string | null;
  calculationResultId: string | null;
  evidenceIds: readonly string[];
  sources: readonly string[];
  assumptions: readonly string[];
  omissions: readonly string[];
  applicability: string;
  uncertainty: string | null;
  conflicts: readonly string[];
}>;

export type OverlayMark = Readonly<{
  id: string;
  connectionId: string;
  systemId: string;
  channel: Exclude<OverlayChannel, 'finding' | 'selection'>;
  status: Exclude<OverlayAvailability, 'partial'>;
  label: string;
  staticCue: string;
  value: string | null;
  unit: string | null;
  direction: StateBindingDirection | null;
  trace: OverlayTrace;
}>;

export type OverlayChannelEvaluation = Readonly<{
  channel: Exclude<OverlayChannel, 'finding' | 'selection'>;
  availability: OverlayAvailability;
  evaluationStatus: 'current' | 'stale' | 'failed';
  markIds: readonly string[];
  omissions: readonly string[];
}>;

export type OverlaySystemEvaluation = Readonly<{
  systemId: string;
  channels: readonly OverlayChannelEvaluation[];
}>;

export type OperatingStateOverlay = Readonly<{
  id: string;
  operatingStateId: string;
  operatingStateName: string;
  sourceRevision: number;
  inputFingerprint: string;
  status: 'current' | 'stale' | 'failed';
  systems: readonly OverlaySystemEvaluation[];
  marks: readonly OverlayMark[];
}>;

export type StateCompareDifference = Readonly<{
  connectionId: string;
  channel: Exclude<OverlayChannel, 'finding' | 'selection'>;
  classification: 'added' | 'removed' | 'status-changed' | 'value-changed' | 'trace-changed';
  leftLabel: string | null;
  rightLabel: string | null;
}>;

const identity = z.string().min(1).max(320);
const overlayAvailabilitySchema = z.enum([
  'available',
  'partial',
  'unavailable',
  'conflicting',
  'unsupported',
  'excluded'
]);
const overlayChannelSchema = z.enum([
  'potential',
  'current',
  'signal',
  'fluid-direction',
  'temperature'
]);
const overlayTraceSchema = z.strictObject({
  physicalConnectionId: identity,
  pathConnectionIds: z.array(identity),
  operatingStateId: identity,
  stateBindingId: identity,
  componentBehaviorId: identity.nullable(),
  calculationResultId: identity.nullable(),
  evidenceIds: z.array(identity),
  sources: z.array(z.string().min(1)),
  assumptions: z.array(z.string().min(1)),
  omissions: z.array(z.string().min(1)),
  applicability: z.string().min(1),
  uncertainty: z.string().min(1).nullable(),
  conflicts: z.array(z.string().min(1))
});
const overlayMarkSchema = z.strictObject({
  id: identity,
  connectionId: identity,
  systemId: identity,
  channel: overlayChannelSchema,
  status: z.enum(['available', 'unavailable', 'conflicting', 'unsupported', 'excluded']),
  label: z.string().min(1),
  staticCue: z.string().min(1),
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
  trace: overlayTraceSchema
});
const overlayChannelEvaluationSchema = z.strictObject({
  channel: overlayChannelSchema,
  availability: overlayAvailabilitySchema,
  evaluationStatus: z.enum(['current', 'stale', 'failed']),
  markIds: z.array(identity),
  omissions: z.array(z.string().min(1))
});

export const operatingStateOverlaySchema = z.strictObject({
  id: identity,
  operatingStateId: identity,
  operatingStateName: z.string().min(1),
  sourceRevision: z.number().int().nonnegative(),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(['current', 'stale', 'failed']),
  systems: z.array(
    z.strictObject({
      systemId: identity,
      channels: z.array(overlayChannelEvaluationSchema)
    })
  ),
  marks: z.array(overlayMarkSchema)
});

export function evaluateOperatingStateOverlay(
  snapshot: ProjectSnapshot,
  operatingStateId: string,
  inputFingerprint: string
): OperatingStateOverlay {
  if (!/^[a-f0-9]{64}$/.test(inputFingerprint)) {
    throw new Error('Overlay input fingerprint must be a lowercase SHA-256 digest');
  }
  const state = snapshot.operatingStates.find((candidate) => candidate.id === operatingStateId);
  if (!state) throw new Error(`Operating State ${operatingStateId} does not exist`);

  const rejection = validateOperatingStateModel(snapshot);
  if (rejection) throw new Error(rejection.message);

  const marks = state.bindings.map((binding) =>
    createMark(snapshot, state.id, binding, binding.subjectId)
  );
  const systems = snapshot.topology.systems
    .filter((system) => state.bindings.some((binding) => binding.systemId === system.id))
    .map((system) => {
      const channels = state.bindings
        .filter((binding) => binding.systemId === system.id)
        .map((binding) => binding.channel)
        .filter((channel, index, candidates) => candidates.indexOf(channel) === index)
        .map((channel) => {
          const bindings = state.bindings.filter(
            (binding) => binding.systemId === system.id && binding.channel === channel
          );
          const channelMarks = marks.filter(
            (mark) => mark.systemId === system.id && mark.channel === channel
          );
          return {
            channel,
            availability: channelAvailability(bindings),
            evaluationStatus: 'current' as const,
            markIds: channelMarks.map((mark) => mark.id),
            omissions: bindings.flatMap((binding) => binding.omissions)
          };
        });
      return { systemId: system.id, channels };
    });

  return {
    id: `overlay:${state.id}:${snapshot.revision}:${inputFingerprint.slice(0, 12)}`,
    operatingStateId: state.id,
    operatingStateName: state.name,
    sourceRevision: snapshot.revision,
    inputFingerprint,
    status: 'current',
    systems,
    marks
  };
}

export function compareOperatingStateOverlays(
  left: OperatingStateOverlay,
  right: OperatingStateOverlay
): readonly StateCompareDifference[] {
  const leftMarks = new Map(left.marks.map((mark) => [markIdentity(mark), mark]));
  const rightMarks = new Map(right.marks.map((mark) => [markIdentity(mark), mark]));
  const identities = [...new Set([...leftMarks.keys(), ...rightMarks.keys()])].sort();
  const differences: StateCompareDifference[] = [];

  for (const identity of identities) {
    const leftMark = leftMarks.get(identity);
    const rightMark = rightMarks.get(identity);
    if (!leftMark && rightMark) {
      differences.push({
        connectionId: rightMark.connectionId,
        channel: rightMark.channel,
        classification: 'added',
        leftLabel: null,
        rightLabel: rightMark.label
      });
      continue;
    }
    if (leftMark && !rightMark) {
      differences.push({
        connectionId: leftMark.connectionId,
        channel: leftMark.channel,
        classification: 'removed',
        leftLabel: leftMark.label,
        rightLabel: null
      });
      continue;
    }
    if (!leftMark || !rightMark) continue;

    const classification =
      leftMark.status !== rightMark.status || leftMark.direction !== rightMark.direction
        ? 'status-changed'
        : leftMark.value !== rightMark.value || leftMark.unit !== rightMark.unit
          ? 'value-changed'
          : JSON.stringify(leftMark.trace) !== JSON.stringify(rightMark.trace)
            ? 'trace-changed'
            : null;
    if (classification) {
      differences.push({
        connectionId: leftMark.connectionId,
        channel: leftMark.channel,
        classification,
        leftLabel: leftMark.label,
        rightLabel: rightMark.label
      });
    }
  }

  return differences;
}

function createMark(
  snapshot: ProjectSnapshot,
  operatingStateId: string,
  binding: StateBinding,
  connectionId: string
): OverlayMark {
  const status = bindingStatus(binding);
  const evidenceSources = binding.evidenceIds.flatMap((evidenceId) => {
    const evidence = snapshot.evidence.find((candidate) => candidate.id === evidenceId);
    return evidence?.provenance ? [evidence.provenance] : [];
  });
  const label = bindingLabel(binding);

  return {
    id: `overlay-mark:${operatingStateId}:${binding.id}:${connectionId}`,
    connectionId,
    systemId: binding.systemId,
    channel: binding.channel,
    status,
    label,
    staticCue: directionCue(binding.direction, binding.evidenceState),
    value: binding.value,
    unit: binding.unit,
    direction: binding.direction,
    trace: {
      physicalConnectionId: connectionId,
      pathConnectionIds: binding.pathConnectionIds,
      operatingStateId,
      stateBindingId: binding.id,
      componentBehaviorId: binding.behavior?.id ?? null,
      calculationResultId: binding.calculationResultId,
      evidenceIds: binding.evidenceIds,
      sources: [...new Set([...binding.provenance, ...evidenceSources])],
      assumptions: binding.assumptions,
      omissions: binding.omissions,
      applicability: binding.applicability,
      uncertainty: binding.uncertainty,
      conflicts: binding.conflictValues
    }
  };
}

function bindingStatus(binding: StateBinding): OverlayMark['status'] {
  if (binding.evidenceState === 'known') return 'available';
  if (binding.evidenceState === 'unknown') return 'unavailable';
  return binding.evidenceState;
}

function channelAvailability(bindings: readonly StateBinding[]): OverlayAvailability {
  if (bindings.some((binding) => binding.evidenceState === 'conflicting')) return 'conflicting';
  if (bindings.some((binding) => binding.evidenceState === 'unsupported')) return 'unsupported';
  if (bindings.every((binding) => binding.evidenceState === 'excluded')) return 'excluded';
  if (bindings.every((binding) => binding.evidenceState === 'unknown')) return 'unavailable';
  if (
    bindings.some((binding) => binding.evidenceState !== 'known' || binding.omissions.length > 0)
  ) {
    return 'partial';
  }
  return 'available';
}

function bindingLabel(binding: StateBinding): string {
  if (binding.evidenceState === 'conflicting') {
    return `Conflicting ${binding.channel}: ${binding.conflictValues.join(' / ')} ${binding.unit ?? ''}`.trim();
  }
  if (binding.evidenceState === 'unknown') return `${binding.channel} unknown`;
  if (binding.evidenceState === 'unsupported') return `${binding.channel} unsupported`;
  if (binding.evidenceState === 'excluded') return `${binding.channel} explicitly excluded`;

  if (binding.channel === 'potential') {
    return `${binding.value} ${binding.unit} relative to ${binding.referenceSubjectId}`;
  }
  if (binding.channel === 'current') {
    return `${binding.value} ${binding.unit} conventional ${binding.direction}`;
  }
  if (binding.channel === 'signal') return `Signal ${binding.direction}`;
  if (binding.channel === 'fluid-direction') return `Fluid path ${binding.direction}`;
  return `${binding.value} ${binding.unit} at ${binding.subjectId}`;
}

function directionCue(
  direction: StateBindingDirection | null,
  evidenceState: StateBinding['evidenceState']
): string {
  if (evidenceState === 'unsupported') return '! unsupported';
  if (
    direction === 'source-to-load' ||
    direction === 'driver-to-receiver' ||
    direction === 'forward'
  ) {
    return `→ ${direction}`;
  }
  if (direction === 'load-to-return' || direction === 'reverse') return `← ${direction}`;
  if (direction === 'bidirectional') return '↔ bidirectional';
  if (direction === 'zero') return '0 explicitly zero';
  if (direction === 'conflicting') return '⇄ conflicting';
  if (direction === 'excluded') return '× excluded';
  if (direction === 'unknown' || evidenceState === 'unknown') return '? unknown';
  return '• value';
}

function markIdentity(mark: OverlayMark): string {
  return `${mark.connectionId}:${mark.channel}`;
}
