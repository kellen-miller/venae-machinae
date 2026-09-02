import { createEmptyTopology } from '../topology/topology';
import { createEmptyElectricalModel } from '../electrical/electrical';
import { createEmptyFluidModel } from '../fluid/fluid';
import { getFormulaDefinition } from '../calculation/formula-catalog';
import { createEngineeringQuantity } from '../calculation/quantity';
import { unitSemantic } from '../calculation/unit-registry';
import { retainStaleValidationHistory } from '../validation/finding';
import { createEmptyBuildRecord } from '../build/build-record';

import type { CalculationRequest } from '../calculation/evaluate-calculation';
import type { CalculationOutcome } from '../calculation/evaluate-calculation';
import type { EngineeringQuantity } from '../calculation/quantity';
import type { CandidateScreenRequest, ScreeningResult } from '../calculation/screen-candidates';
import type { ElectricalModel } from '../electrical/electrical';
import type { EngineeringEvidence } from '../evidence/evidence';
import type { FluidModel } from '../fluid/fluid';
import type { OperatingState } from '../operating-state/operating-state';
import type { OperatingStateOverlay } from '../operating-state/evaluate-overlay';
import type { Point, SubjectId, Topology } from '../topology/topology';
import type { ValidationApplicabilityDecision, ValidationHistory } from '../validation/finding';
import type { BuildRecord } from '../build/build-record';

export type { OperatingState } from '../operating-state/operating-state';

export type ResultId = string;

export type PartDefinition = Readonly<{
  id: SubjectId;
  label: string;
  revision: number;
  provenance: string;
}>;

export type PartRequirement = Readonly<{
  id: SubjectId;
  subjectId: SubjectId;
  partDefinitionId?: SubjectId | undefined;
  variant?: string | undefined;
  label: string;
  quantity: string;
  unit?: string | undefined;
  domain?: 'electrical' | 'fluid' | undefined;
  systemId?: SubjectId | undefined;
}>;

export type ProjectResult = Readonly<{
  id: ResultId;
  sourceRevision: number;
  status: 'current' | 'stale' | 'unknown' | 'unsupported' | 'failed';
  kind: string;
  detail:
    | Readonly<{ type: 'calculation'; outcome: CalculationOutcome }>
    | Readonly<{ type: 'screening'; result: ScreeningResult }>
    | Readonly<{ type: 'overlay'; overlay: OperatingStateOverlay }>
    | Readonly<{ type: 'validation'; history: ValidationHistory }>
    | null;
}>;

export function retainStaleProjectResult(result: ProjectResult): ProjectResult {
  if (result.status !== 'current') return result;
  if (result.detail?.type === 'validation') {
    return {
      ...result,
      status: 'stale',
      detail: {
        type: 'validation',
        history: retainStaleValidationHistory(result.detail.history)
      }
    };
  }
  if (result.detail?.type !== 'overlay') return { ...result, status: 'stale' };

  return {
    ...result,
    status: 'stale',
    detail: {
      type: 'overlay',
      overlay: {
        ...result.detail.overlay,
        status: 'stale',
        systems: result.detail.overlay.systems.map((system) => ({
          ...system,
          channels: system.channels.map((channel) => ({
            ...channel,
            evaluationStatus: 'stale'
          }))
        }))
      }
    }
  };
}

export type SubjectTombstone = Readonly<{
  subjectId: SubjectId;
  subjectKind: 'component' | 'connection';
  successorId: SubjectId;
}>;

export type EngineeringValue = Readonly<{
  id: SubjectId;
  decimal: string;
  unit: string;
  provenance: string;
}>;

export type VehicleBackground = Readonly<{
  assetHash: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  calibration: Readonly<{
    first: Point;
    second: Point;
    distance: Readonly<{ decimal: string; unit: 'mm' | 'cm' | 'm' | 'in' | 'ft' }>;
  }>;
  position: Point;
  opacity: string;
  visible: boolean;
  locked: boolean;
}>;

export type ProjectSnapshot = Readonly<{
  id: SubjectId;
  name: string;
  createdAt: string;
  revision: number;
  topology: Topology;
  electrical: ElectricalModel;
  fluid: FluidModel;
  calculations: readonly CalculationRequest[];
  screenings: readonly CandidateScreenRequest[];
  partDefinitions: readonly PartDefinition[];
  partRequirements: readonly PartRequirement[];
  build: BuildRecord;
  evidence: readonly EngineeringEvidence[];
  results: readonly ProjectResult[];
  validationApplicabilityDecisions: readonly ValidationApplicabilityDecision[];
  tombstones: readonly SubjectTombstone[];
  engineeringValues: readonly EngineeringValue[];
  operatingStates: readonly OperatingState[];
  settings: Readonly<{ unitSystem: 'metric' | 'imperial' }>;
  assetHashes: readonly string[];
  vehicleBackground: VehicleBackground | null;
}>;

export function createBlankProject(input: {
  id: SubjectId;
  name: string;
  createdAt: string;
}): ProjectSnapshot {
  return {
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    revision: 0,
    topology: createEmptyTopology(),
    electrical: createEmptyElectricalModel(),
    fluid: createEmptyFluidModel(),
    calculations: [],
    screenings: [],
    partDefinitions: [],
    partRequirements: [],
    build: createEmptyBuildRecord(),
    evidence: [],
    results: [],
    validationApplicabilityDecisions: [],
    tombstones: [],
    engineeringValues: [],
    operatingStates: [],
    settings: { unitSystem: 'metric' },
    assetHashes: [],
    vehicleBackground: null
  };
}

export type CalculationModelRejection = Readonly<{
  code: 'invalid-calculation' | 'invalid-screening';
  message: string;
}>;

function invalidQuantityMessage(quantity: EngineeringQuantity): string | null {
  try {
    createEngineeringQuantity(quantity);
  } catch (error) {
    return error instanceof Error ? error.message : 'Engineering Quantity is invalid';
  }
  if (
    unitSemantic(quantity.unit) !== quantity.semantic ||
    (quantity.uncertainty !== null && unitSemantic(quantity.uncertainty.unit) !== quantity.semantic)
  ) {
    return `Unit ${quantity.unit} does not represent ${quantity.semantic}`;
  }

  return null;
}

export function validateCalculationModel(
  snapshot: ProjectSnapshot
): CalculationModelRejection | null {
  const calculationIds = new Set<string>();
  const quantityIds = new Set<string>();
  for (const calculation of snapshot.calculations) {
    const formula = getFormulaDefinition(calculation.formulaId);
    if (!formula) {
      return {
        code: 'invalid-calculation',
        message: `Formula ${calculation.formulaId} is not executable`
      };
    }
    if (!calculation.id.trim() || calculationIds.has(calculation.id)) {
      return {
        code: 'invalid-calculation',
        message: `Calculation identity ${calculation.id} is absent or duplicated`
      };
    }
    calculationIds.add(calculation.id);
    if (!projectSubjectExists(snapshot, calculation.subjectId)) {
      return {
        code: 'invalid-calculation',
        message: `Calculation ${calculation.id} references an absent subject`
      };
    }
    if (
      !snapshot.operatingStates.some(
        (operatingState) => operatingState.id === calculation.operatingStateId
      )
    ) {
      return {
        code: 'invalid-calculation',
        message: `Calculation ${calculation.id} references an absent Operating State`
      };
    }
    if (
      calculation.pathId !== null &&
      !snapshot.topology.routes.some((route) => route.id === calculation.pathId)
    ) {
      return {
        code: 'invalid-calculation',
        message: `Calculation ${calculation.id} references an absent Route`
      };
    }
    if (
      (formula.output === null && calculation.desiredOutputUnit !== null) ||
      (formula.output !== null &&
        calculation.desiredOutputUnit !== null &&
        unitSemantic(calculation.desiredOutputUnit) !== formula.output.semantic)
    ) {
      return {
        code: 'invalid-calculation',
        message: `Calculation ${calculation.id} requests an incompatible output unit`
      };
    }
    for (const input of calculation.inputs) {
      const invalidQuantity = invalidQuantityMessage(input.quantity);
      if (
        !input.quantity.id.trim() ||
        quantityIds.has(input.quantity.id) ||
        invalidQuantity !== null
      ) {
        return {
          code: 'invalid-calculation',
          message: `Calculation ${calculation.id} contains an invalid or duplicate input identity${
            invalidQuantity ? `: ${invalidQuantity}` : ''
          }`
        };
      }
      quantityIds.add(input.quantity.id);
    }
  }

  const screeningIds = new Set<string>();
  for (const screening of snapshot.screenings) {
    if (!screening.id.trim() || screeningIds.has(screening.id)) {
      return {
        code: 'invalid-screening',
        message: `Screening identity ${screening.id} is absent or duplicated`
      };
    }
    screeningIds.add(screening.id);
    if (!projectSubjectExists(snapshot, screening.subjectId)) {
      return {
        code: 'invalid-screening',
        message: `Screening ${screening.id} references an absent subject`
      };
    }
    if (
      !snapshot.operatingStates.some(
        (operatingState) => operatingState.id === screening.operatingStateId
      )
    ) {
      return {
        code: 'invalid-screening',
        message: `Screening ${screening.id} references an absent Operating State`
      };
    }
    const candidateIds = screening.selectedCandidates.map((candidate) => candidate.id);
    const criterionIds = screening.criteria.map((criterion) => criterion.id);
    if (
      candidateIds.length === 0 ||
      criterionIds.length === 0 ||
      new Set(candidateIds).size !== candidateIds.length ||
      new Set(criterionIds).size !== criterionIds.length
    ) {
      return {
        code: 'invalid-screening',
        message: `Screening ${screening.id} requires unique selected Part Definitions and criteria`
      };
    }
    const absentCandidateId = candidateIds.find(
      (candidateId) => !snapshot.partDefinitions.some((definition) => definition.id === candidateId)
    );
    if (absentCandidateId) {
      return {
        code: 'invalid-screening',
        message: `Screening ${screening.id} references absent Part Definition ${absentCandidateId}`
      };
    }
    for (const criterion of screening.criteria) {
      if (criterion.comparison.kind === 'includes') continue;
      const invalidLimit = invalidQuantityMessage(criterion.comparison.limit);
      if (invalidLimit) {
        return {
          code: 'invalid-screening',
          message: `Screening ${screening.id} contains an invalid criterion: ${invalidLimit}`
        };
      }
    }
    for (const candidate of screening.selectedCandidates) {
      for (const evidence of Object.values(candidate.evidence)) {
        if (!evidence || evidence.kind !== 'quantity') continue;
        const invalidEvidence = invalidQuantityMessage(evidence.quantity);
        if (invalidEvidence) {
          return {
            code: 'invalid-screening',
            message: `Screening ${screening.id} contains invalid candidate evidence: ${invalidEvidence}`
          };
        }
      }
    }
  }

  return null;
}

export function projectSubjectExists(snapshot: ProjectSnapshot, subjectId: SubjectId): boolean {
  return (
    snapshot.id === subjectId ||
    snapshot.topology.systems.some((subject) => subject.id === subjectId) ||
    snapshot.topology.components.some(
      (subject) => subject.id === subjectId || subject.ports.some((port) => port.id === subjectId)
    ) ||
    snapshot.topology.connections.some((subject) => subject.id === subjectId) ||
    snapshot.topology.routes.some((subject) => subject.id === subjectId) ||
    snapshot.topology.segments.some((subject) => subject.id === subjectId) ||
    snapshot.electrical.circuits.some((subject) => subject.id === subjectId) ||
    snapshot.electrical.harnesses.some((subject) => subject.id === subjectId) ||
    snapshot.electrical.bundles.some(
      (subject) =>
        subject.id === subjectId || subject.twistedPairs.some((pair) => pair.id === subjectId)
    ) ||
    snapshot.fluid.media.some((subject) => subject.id === subjectId) ||
    snapshot.fluid.behaviors.some((subject) => subject.id === subjectId) ||
    snapshot.fluid.boundaryConditions.some((subject) => subject.id === subjectId) ||
    snapshot.calculations.some(
      (subject) =>
        subject.id === subjectId || subject.inputs.some((input) => input.quantity.id === subjectId)
    ) ||
    snapshot.screenings.some((subject) => subject.id === subjectId) ||
    snapshot.partDefinitions.some((subject) => subject.id === subjectId) ||
    snapshot.partRequirements.some((subject) => subject.id === subjectId) ||
    snapshot.build.procurementChoices.some((subject) => subject.id === subjectId) ||
    snapshot.build.installations.some((subject) => subject.id === subjectId) ||
    snapshot.evidence.some((subject) => subject.id === subjectId) ||
    snapshot.engineeringValues.some((subject) => subject.id === subjectId) ||
    snapshot.operatingStates.some((subject) => subject.id === subjectId) ||
    snapshot.operatingStates.some((state) =>
      [
        ...state.commands,
        ...state.conditions,
        ...state.measurements,
        ...state.assumptions,
        ...state.bindings,
        ...state.bindings.flatMap((binding) => (binding.behavior ? [binding.behavior] : []))
      ].some((subject) => subject.id === subjectId)
    ) ||
    snapshot.results.some((subject) => subject.id === subjectId) ||
    snapshot.tombstones.some(
      (subject) => subject.subjectId === subjectId || subject.successorId === subjectId
    )
  );
}
