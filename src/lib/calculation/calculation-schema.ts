import { z } from 'zod';

import { getFormulaDefinition } from './formula-catalog';
import { isSemanticQuantity, isUnitId } from './unit-registry';

import type { SemanticQuantity, UnitId } from './unit-registry';

const decimalString = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const identity = z.string().min(1).max(160);
const unitId = z.custom<UnitId>(isUnitId, { error: 'Unknown unit identity' });
const semanticQuantity = z.custom<SemanticQuantity>(isSemanticQuantity, {
  error: 'Unknown semantic quantity'
});

export const engineeringQuantitySchema = z.strictObject({
  id: identity,
  semantic: semanticQuantity,
  decimal: decimalString,
  unit: unitId,
  applicability: z.string().min(1),
  uncertainty: z.strictObject({ decimal: decimalString, unit: unitId }).nullable(),
  bounds: z.strictObject({ lower: decimalString, upper: decimalString }).nullable(),
  origin: z.enum(['entered', 'measured', 'sourced', 'assumed', 'calculated']),
  provenance: z.string().min(1)
});

export const calculationRequestSchema = z.strictObject({
  id: identity,
  subjectId: identity,
  operatingStateId: identity,
  formulaId: z
    .string()
    .min(1)
    .refine((formulaId) => getFormulaDefinition(formulaId) !== null, {
      error: 'Formula is not in the application-owned catalog'
    }),
  pathId: identity.nullable(),
  inputs: z.array(z.strictObject({ name: z.string().min(1), quantity: engineeringQuantitySchema })),
  assumptions: z.array(z.string().min(1)),
  conditions: z.record(z.string(), z.string()),
  omissions: z.array(z.string().min(1)),
  desiredOutputUnit: unitId.nullable()
});

const calculationTraceSchema = z.strictObject({
  calculationId: identity,
  subjectId: identity,
  operatingStateId: identity,
  pathId: identity.nullable(),
  formulaId: z.string().min(1),
  formulaRevision: z.number().int().positive().nullable(),
  inputIds: z.array(identity),
  assumptions: z.array(z.string()),
  conditions: z.record(z.string(), z.string()),
  applicability: z.array(z.string()),
  calculatedAt: z.iso.datetime({ offset: true })
});

const calculationOutputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('quantity'),
    semantic: semanticQuantity,
    decimal: decimalString,
    unit: unitId
  }),
  z.strictObject({ kind: z.literal('classification'), value: z.string().min(1) })
]);

export const calculationOutcomeSchema = z.strictObject({
  status: z.enum(['calculated', 'unknown', 'unsupported']),
  completeness: z.enum(['complete-for-stated-model', 'known-subtotal', 'unknown', 'unsupported']),
  output: calculationOutputSchema.nullable(),
  bounds: z
    .strictObject({
      lower: decimalString,
      upper: decimalString,
      method: z.literal('input-bound envelope')
    })
    .nullable(),
  reason: z.string().nullable(),
  omissions: z.array(z.string()),
  trace: calculationTraceSchema
});

const screenEvidenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('quantity'), quantity: engineeringQuantitySchema }),
  z.strictObject({
    kind: z.literal('values'),
    state: z.enum(['known', 'conflicting']),
    values: z.array(z.string())
  })
]);

export const candidateScreenRequestSchema = z.strictObject({
  id: identity,
  subjectId: identity,
  operatingStateId: identity,
  criteria: z.array(
    z.strictObject({
      id: identity,
      label: z.string().min(1),
      evidenceKey: z.string().min(1),
      applicability: z.enum(['applicable', 'not-applicable']),
      comparison: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('at-least'), limit: engineeringQuantitySchema }),
        z.strictObject({ kind: z.literal('at-most'), limit: engineeringQuantitySchema }),
        z.strictObject({ kind: z.literal('includes'), required: z.string().min(1) })
      ])
    })
  ),
  selectedCandidates: z.array(
    z.strictObject({
      id: identity,
      label: z.string().min(1),
      evidence: z.record(z.string(), screenEvidenceSchema.nullable())
    })
  )
});

const screenComparisonSchema = z.strictObject({
  criterionId: identity,
  outcome: z.enum(['pass', 'fail', 'indeterminate', 'unevaluated', 'not-applicable']),
  reason: z
    .enum(['bound-overlap', 'missing-evidence', 'conflicting-evidence', 'quantity-mismatch'])
    .nullable()
});

export const screeningResultSchema = z.strictObject({
  screeningId: identity,
  subjectId: identity,
  operatingStateId: identity,
  candidates: z.array(
    z.strictObject({
      candidateId: identity,
      label: z.string().min(1),
      comparisons: z.array(screenComparisonSchema)
    })
  )
});
