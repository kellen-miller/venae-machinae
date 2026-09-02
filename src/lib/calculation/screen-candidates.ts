import { compareDecimals } from './quantity';
import { convertDecimal, unitSemantic } from './unit-registry';

import type { EngineeringQuantity } from './quantity';

export type ScreenEvidence =
  | Readonly<{ kind: 'quantity'; quantity: EngineeringQuantity }>
  | Readonly<{
      kind: 'values';
      state: 'known' | 'conflicting';
      values: readonly string[];
    }>;

export type ScreenCriterion = Readonly<{
  id: string;
  label: string;
  evidenceKey: string;
  applicability: 'applicable' | 'not-applicable';
  comparison:
    | Readonly<{ kind: 'at-least' | 'at-most'; limit: EngineeringQuantity }>
    | Readonly<{ kind: 'includes'; required: string }>;
}>;

export type CandidateScreenRequest = Readonly<{
  id: string;
  subjectId: string;
  operatingStateId: string;
  criteria: readonly ScreenCriterion[];
  selectedCandidates: readonly Readonly<{
    id: string;
    label: string;
    evidence: Readonly<Record<string, ScreenEvidence | null>>;
  }>[];
}>;

export type ScreenComparison = Readonly<{
  criterionId: string;
  outcome: 'pass' | 'fail' | 'indeterminate' | 'unevaluated' | 'not-applicable';
  reason:
    'bound-overlap' | 'missing-evidence' | 'conflicting-evidence' | 'quantity-mismatch' | null;
}>;

export type ScreeningResult = Readonly<{
  screeningId: string;
  subjectId: string;
  operatingStateId: string;
  candidates: readonly Readonly<{
    candidateId: string;
    label: string;
    comparisons: readonly ScreenComparison[];
  }>[];
}>;

function compareQuantity(
  criterion: ScreenCriterion,
  evidence: Extract<ScreenEvidence, { kind: 'quantity' }>
): ScreenComparison {
  if (criterion.comparison.kind === 'includes') {
    return {
      criterionId: criterion.id,
      outcome: 'indeterminate',
      reason: 'quantity-mismatch'
    };
  }

  const limit = criterion.comparison.limit;
  const quantity = evidence.quantity;
  if (
    quantity.semantic !== limit.semantic ||
    unitSemantic(quantity.unit) !== unitSemantic(limit.unit)
  ) {
    return {
      criterionId: criterion.id,
      outcome: 'indeterminate',
      reason: 'quantity-mismatch'
    };
  }

  const point = convertDecimal(quantity.decimal, quantity.unit, limit.unit);
  const lower = quantity.bounds
    ? convertDecimal(quantity.bounds.lower, quantity.unit, limit.unit)
    : point;
  const upper = quantity.bounds
    ? convertDecimal(quantity.bounds.upper, quantity.unit, limit.unit)
    : point;
  const limitDecimal = limit.decimal;
  if (criterion.comparison.kind === 'at-least') {
    if (compareDecimals(lower, limitDecimal) >= 0) {
      return { criterionId: criterion.id, outcome: 'pass', reason: null };
    }
    if (compareDecimals(upper, limitDecimal) < 0) {
      return { criterionId: criterion.id, outcome: 'fail', reason: null };
    }
  } else {
    if (compareDecimals(upper, limitDecimal) <= 0) {
      return { criterionId: criterion.id, outcome: 'pass', reason: null };
    }
    if (compareDecimals(lower, limitDecimal) > 0) {
      return { criterionId: criterion.id, outcome: 'fail', reason: null };
    }
  }

  return { criterionId: criterion.id, outcome: 'indeterminate', reason: 'bound-overlap' };
}

function compareValues(
  criterion: ScreenCriterion,
  evidence: Extract<ScreenEvidence, { kind: 'values' }>
): ScreenComparison {
  if (criterion.comparison.kind !== 'includes') {
    return {
      criterionId: criterion.id,
      outcome: 'indeterminate',
      reason: 'quantity-mismatch'
    };
  }
  if (evidence.state === 'conflicting') {
    return {
      criterionId: criterion.id,
      outcome: 'indeterminate',
      reason: 'conflicting-evidence'
    };
  }

  return {
    criterionId: criterion.id,
    outcome: evidence.values.includes(criterion.comparison.required) ? 'pass' : 'fail',
    reason: null
  };
}

export function screenCandidates(request: CandidateScreenRequest): ScreeningResult {
  return {
    screeningId: request.id,
    subjectId: request.subjectId,
    operatingStateId: request.operatingStateId,
    candidates: request.selectedCandidates.map((candidate) => ({
      candidateId: candidate.id,
      label: candidate.label,
      comparisons: request.criteria.map((criterion): ScreenComparison => {
        if (criterion.applicability === 'not-applicable') {
          return { criterionId: criterion.id, outcome: 'not-applicable', reason: null };
        }

        const evidence = candidate.evidence[criterion.evidenceKey];
        if (!evidence) {
          return {
            criterionId: criterion.id,
            outcome: 'unevaluated',
            reason: 'missing-evidence'
          };
        }

        return evidence.kind === 'quantity'
          ? compareQuantity(criterion, evidence)
          : compareValues(criterion, evidence);
      })
    }))
  };
}
