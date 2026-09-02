import Decimal from 'decimal.js';

import type { SemanticQuantity, UnitId } from './unit-registry';

const EngineeringDecimal = Decimal.clone({
  precision: 34,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -100,
  toExpPos: 100
});

const decimalText = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const PI_WITH_GUARD_DIGITS = '3.1415926535897932384626433832795028841971693993751';

export type EngineeringQuantity = Readonly<{
  id: string;
  semantic: SemanticQuantity;
  decimal: string;
  unit: UnitId;
  applicability: string;
  uncertainty: Readonly<{ decimal: string; unit: UnitId }> | null;
  bounds: Readonly<{ lower: string; upper: string }> | null;
  origin: 'entered' | 'measured' | 'sourced' | 'assumed' | 'calculated';
  provenance: string;
}>;

export const ENGINEERING_DECIMAL_POLICY = Object.freeze({
  significantDigits: 34,
  rounding: 'half-even'
} as const);

function parseDecimal(value: string): Decimal {
  if (!decimalText.test(value)) throw new Error(`Decimal text is invalid; received ${value}`);
  const parsed = new EngineeringDecimal(value);
  if (!parsed.isFinite()) throw new Error(`Decimal value must be finite; received ${value}`);
  return parsed;
}

export function createEngineeringQuantity(input: EngineeringQuantity): EngineeringQuantity {
  if (!input.id.trim()) throw new Error('Engineering Quantity identity is required');
  parseDecimal(input.decimal);
  if (!input.applicability.trim()) {
    throw new Error('Engineering Quantity applicability is required');
  }
  if (!input.provenance.trim()) throw new Error('Engineering Quantity provenance is required');
  if (input.uncertainty) parseDecimal(input.uncertainty.decimal);
  if (input.bounds) {
    parseDecimal(input.bounds.lower);
    parseDecimal(input.bounds.upper);
    if (compareDecimals(input.bounds.upper, input.bounds.lower) < 0) {
      throw new Error('Engineering Quantity upper bound must not be below its lower bound');
    }
  }

  return Object.freeze({
    ...input,
    uncertainty: input.uncertainty ? Object.freeze({ ...input.uncertainty }) : null,
    bounds: input.bounds ? Object.freeze({ ...input.bounds }) : null
  });
}

export function normalizeDecimal(value: string): string {
  return parseDecimal(value).toString();
}

export function addDecimals(values: readonly string[]): string {
  if (values.length === 0) throw new Error('Decimal addition requires at least one value');
  return values
    .reduce((sum, value) => sum.plus(parseDecimal(value)), new EngineeringDecimal(0))
    .toString();
}

export function subtractDecimals(minuend: string, subtrahend: string): string {
  return parseDecimal(minuend).minus(parseDecimal(subtrahend)).toString();
}

export function multiplyDecimals(values: readonly string[]): string {
  if (values.length === 0) throw new Error('Decimal multiplication requires at least one value');
  return values
    .reduce((product, value) => product.times(parseDecimal(value)), new EngineeringDecimal(1))
    .toString();
}

export function divideDecimals(dividend: string, divisor: string): string {
  const parsedDivisor = parseDecimal(divisor);
  if (parsedDivisor.isZero()) throw new Error('Decimal division by zero is undefined');
  return parseDecimal(dividend).dividedBy(parsedDivisor).toString();
}

export function compareDecimals(left: string, right: string): number {
  return parseDecimal(left).comparedTo(parseDecimal(right));
}

export function squareRootDecimal(value: string): string {
  if (compareDecimals(value, '0') < 0)
    throw new Error('Decimal square root requires a nonnegative value');
  return parseDecimal(value).squareRoot().toString();
}

export function decimalPi(): string {
  return PI_WITH_GUARD_DIGITS;
}

export function presentDecimal(decimal: string, significantFigures: number) {
  if (!Number.isInteger(significantFigures) || significantFigures < 1 || significantFigures > 34) {
    throw new Error('Significant figures must be an integer between 1 and 34');
  }

  const unrounded = normalizeDecimal(decimal);
  return {
    display: parseDecimal(unrounded).toPrecision(significantFigures),
    unrounded,
    significantFigures
  } as const;
}
