import Decimal from 'decimal.js';

const EngineeringDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -100,
  toExpPos: 100
});

function parseDecimal(value: string): Decimal {
  const parsed = new EngineeringDecimal(value);
  if (!parsed.isFinite()) throw new Error(`Decimal value must be finite; received ${value}`);
  return parsed;
}

export function normalizeDecimal(value: string): string {
  return parseDecimal(value).toString();
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

export function presentDecimal(decimal: string, significantFigures: number) {
  if (!Number.isInteger(significantFigures) || significantFigures < 1 || significantFigures > 40) {
    throw new Error('Significant figures must be an integer between 1 and 40');
  }

  const unrounded = normalizeDecimal(decimal);
  return {
    display: parseDecimal(unrounded).toPrecision(significantFigures),
    unrounded,
    significantFigures
  } as const;
}
