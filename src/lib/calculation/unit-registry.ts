import { divideDecimals, multiplyDecimals } from './quantity';

const UNIT_DEFINITIONS = {
  ampere: { dimension: 'current', baseScale: '1' },
  milliampere: { dimension: 'current', baseScale: '0.001' },
  volt: { dimension: 'potential', baseScale: '1' },
  millivolt: { dimension: 'potential', baseScale: '0.001' },
  ohm: { dimension: 'resistance', baseScale: '1' },
  milliohm: { dimension: 'resistance', baseScale: '0.001' },
  metre: { dimension: 'length', baseScale: '1' },
  millimetre: { dimension: 'length', baseScale: '0.001' },
  inch: { dimension: 'length', baseScale: '0.0254' },
  pascal: { dimension: 'pressure', baseScale: '1' },
  kilopascal: { dimension: 'pressure', baseScale: '1000' }
} as const;

export type UnitId = keyof typeof UNIT_DEFINITIONS;

export function convertDecimal(decimal: string, from: UnitId, to: UnitId): string {
  const source = UNIT_DEFINITIONS[from];
  const target = UNIT_DEFINITIONS[to];
  if (source.dimension !== target.dimension) {
    throw new Error(`Cannot convert ${from} to ${to}: dimensions differ`);
  }

  return divideDecimals(multiplyDecimals([decimal, source.baseScale]), target.baseScale);
}
