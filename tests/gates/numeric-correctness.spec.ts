import { describe, expect, it } from 'vitest';

import { evaluateFormula, evaluateFormulaBounds } from '../../src/lib/calculation/formula-catalog';
import { presentDecimal } from '../../src/lib/calculation/quantity';
import { convertDecimal } from '../../src/lib/calculation/unit-registry';
import { NUMERIC_GOLDENS } from '../fixtures/numeric-goldens';

describe('MVP-GATE-007 numeric correctness', () => {
  it.each(NUMERIC_GOLDENS.conversions)(
    'converts $decimal $from to $to exactly',
    ({ decimal, from, to, expected }) => {
      expect(convertDecimal(decimal, from, to)).toBe(expected);
    }
  );

  it('evaluates an application-owned voltage-drop formula without intermediate rounding', () => {
    expect(
      evaluateFormula(NUMERIC_GOLDENS.voltageDrop.formulaId, NUMERIC_GOLDENS.voltageDrop.inputs)
    ).toEqual(NUMERIC_GOLDENS.voltageDrop.expected);
  });

  it('propagates explicit monotonic bounds as an input-bound envelope', () => {
    expect(
      evaluateFormulaBounds(
        NUMERIC_GOLDENS.voltageDropBounds.formulaId,
        NUMERIC_GOLDENS.voltageDropBounds.inputs
      )
    ).toEqual(NUMERIC_GOLDENS.voltageDropBounds.expected);
  });

  it('returns Unknown for unsupported and incomplete bound propagation', () => {
    expect(
      evaluateFormulaBounds(
        NUMERIC_GOLDENS.unsupportedBounds.formulaId,
        NUMERIC_GOLDENS.unsupportedBounds.inputs
      )
    ).toEqual(NUMERIC_GOLDENS.unsupportedBounds.expected);
    expect(
      evaluateFormulaBounds(
        NUMERIC_GOLDENS.missingBounds.formulaId,
        NUMERIC_GOLDENS.missingBounds.inputs
      )
    ).toEqual(NUMERIC_GOLDENS.missingBounds.expected);
  });

  it('rounds only for presentation and discloses the applied precision', () => {
    expect(
      presentDecimal(
        NUMERIC_GOLDENS.presentation.decimal,
        NUMERIC_GOLDENS.presentation.significantFigures
      )
    ).toEqual(NUMERIC_GOLDENS.presentation.expected);
  });
});
