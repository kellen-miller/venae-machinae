import {
  addDecimals,
  divideDecimals,
  multiplyDecimals,
  normalizeDecimal,
  subtractDecimals
} from './quantity';

export type SemanticQuantity =
  | 'electric-current'
  | 'electric-potential'
  | 'electrical-resistance'
  | 'resistance-per-length'
  | 'length'
  | 'area'
  | 'power'
  | 'pressure-difference'
  | 'pressure-absolute'
  | 'pressure-gauge'
  | 'temperature-absolute'
  | 'temperature-difference'
  | 'volumetric-flow'
  | 'mass-flow'
  | 'velocity'
  | 'density'
  | 'dynamic-viscosity'
  | 'specific-heat-capacity'
  | 'dimensionless';

type UnitDefinition = Readonly<{
  semantic: SemanticQuantity;
  numerator: string;
  denominator: string;
}>;

const UNIT_DEFINITIONS = {
  ampere: { semantic: 'electric-current', numerator: '1', denominator: '1' },
  milliampere: { semantic: 'electric-current', numerator: '0.001', denominator: '1' },
  volt: { semantic: 'electric-potential', numerator: '1', denominator: '1' },
  millivolt: { semantic: 'electric-potential', numerator: '0.001', denominator: '1' },
  ohm: { semantic: 'electrical-resistance', numerator: '1', denominator: '1' },
  milliohm: { semantic: 'electrical-resistance', numerator: '0.001', denominator: '1' },
  'ohm-per-metre': { semantic: 'resistance-per-length', numerator: '1', denominator: '1' },
  metre: { semantic: 'length', numerator: '1', denominator: '1' },
  millimetre: { semantic: 'length', numerator: '0.001', denominator: '1' },
  centimetre: { semantic: 'length', numerator: '0.01', denominator: '1' },
  inch: { semantic: 'length', numerator: '0.0254', denominator: '1' },
  foot: { semantic: 'length', numerator: '0.3048', denominator: '1' },
  'square-metre': { semantic: 'area', numerator: '1', denominator: '1' },
  'square-millimetre': { semantic: 'area', numerator: '0.000001', denominator: '1' },
  watt: { semantic: 'power', numerator: '1', denominator: '1' },
  kilowatt: { semantic: 'power', numerator: '1000', denominator: '1' },
  pascal: { semantic: 'pressure-difference', numerator: '1', denominator: '1' },
  kilopascal: { semantic: 'pressure-difference', numerator: '1000', denominator: '1' },
  'pascal-absolute': { semantic: 'pressure-absolute', numerator: '1', denominator: '1' },
  'kilopascal-absolute': {
    semantic: 'pressure-absolute',
    numerator: '1000',
    denominator: '1'
  },
  'pascal-gauge': { semantic: 'pressure-gauge', numerator: '1', denominator: '1' },
  'kilopascal-gauge': {
    semantic: 'pressure-gauge',
    numerator: '1000',
    denominator: '1'
  },
  'kelvin-absolute': { semantic: 'temperature-absolute', numerator: '1', denominator: '1' },
  'celsius-absolute': { semantic: 'temperature-absolute', numerator: '1', denominator: '1' },
  'fahrenheit-absolute': {
    semantic: 'temperature-absolute',
    numerator: '5',
    denominator: '9'
  },
  'kelvin-difference': {
    semantic: 'temperature-difference',
    numerator: '1',
    denominator: '1'
  },
  'celsius-difference': {
    semantic: 'temperature-difference',
    numerator: '1',
    denominator: '1'
  },
  'fahrenheit-difference': {
    semantic: 'temperature-difference',
    numerator: '5',
    denominator: '9'
  },
  'cubic-metre-per-second': {
    semantic: 'volumetric-flow',
    numerator: '1',
    denominator: '1'
  },
  'litre-per-minute': {
    semantic: 'volumetric-flow',
    numerator: '0.001',
    denominator: '60'
  },
  'kilogram-per-second': { semantic: 'mass-flow', numerator: '1', denominator: '1' },
  'metre-per-second': { semantic: 'velocity', numerator: '1', denominator: '1' },
  'kilogram-per-cubic-metre': { semantic: 'density', numerator: '1', denominator: '1' },
  'pascal-second': { semantic: 'dynamic-viscosity', numerator: '1', denominator: '1' },
  'joule-per-kilogram-kelvin': {
    semantic: 'specific-heat-capacity',
    numerator: '1',
    denominator: '1'
  },
  ratio: { semantic: 'dimensionless', numerator: '1', denominator: '1' },
  percent: { semantic: 'dimensionless', numerator: '0.01', denominator: '1' }
} as const satisfies Readonly<Record<string, UnitDefinition>>;

export type UnitId = keyof typeof UNIT_DEFINITIONS;

export function isUnitId(value: unknown): value is UnitId {
  return typeof value === 'string' && value in UNIT_DEFINITIONS;
}

const BASE_UNITS: Readonly<Record<SemanticQuantity, UnitId>> = Object.freeze({
  'electric-current': 'ampere',
  'electric-potential': 'volt',
  'electrical-resistance': 'ohm',
  'resistance-per-length': 'ohm-per-metre',
  length: 'metre',
  area: 'square-metre',
  power: 'watt',
  'pressure-difference': 'pascal',
  'pressure-absolute': 'pascal-absolute',
  'pressure-gauge': 'pascal-gauge',
  'temperature-absolute': 'kelvin-absolute',
  'temperature-difference': 'kelvin-difference',
  'volumetric-flow': 'cubic-metre-per-second',
  'mass-flow': 'kilogram-per-second',
  velocity: 'metre-per-second',
  density: 'kilogram-per-cubic-metre',
  'dynamic-viscosity': 'pascal-second',
  'specific-heat-capacity': 'joule-per-kilogram-kelvin',
  dimensionless: 'ratio'
});

export function baseUnitForSemantic(semantic: SemanticQuantity): UnitId {
  return BASE_UNITS[semantic];
}

export function isSemanticQuantity(value: unknown): value is SemanticQuantity {
  return typeof value === 'string' && value in BASE_UNITS;
}

export function unitSemantic(unit: UnitId): SemanticQuantity {
  return UNIT_DEFINITIONS[unit].semantic;
}

export function unitsForSemantic(semantic: SemanticQuantity): readonly UnitId[] {
  return (Object.keys(UNIT_DEFINITIONS) as UnitId[]).filter(
    (unit) => UNIT_DEFINITIONS[unit].semantic === semantic
  );
}

export function assertUnitMatchesSemantic(unit: UnitId, semantic: SemanticQuantity): void {
  if (unitSemantic(unit) !== semantic) {
    throw new Error(`Unit ${unit} does not represent ${semantic}`);
  }
}

function toBase(decimal: string, unit: UnitId): string {
  if (unit === 'celsius-absolute') return addDecimals([decimal, '273.15']);
  if (unit === 'fahrenheit-absolute') {
    return addDecimals([divideDecimals(subtractDecimals(decimal, '32'), '1.8'), '273.15']);
  }

  const definition = UNIT_DEFINITIONS[unit];
  return divideDecimals(multiplyDecimals([decimal, definition.numerator]), definition.denominator);
}

function fromBase(decimal: string, unit: UnitId): string {
  if (unit === 'celsius-absolute') return subtractDecimals(decimal, '273.15');
  if (unit === 'fahrenheit-absolute') {
    return addDecimals([multiplyDecimals([subtractDecimals(decimal, '273.15'), '1.8']), '32']);
  }

  const definition = UNIT_DEFINITIONS[unit];
  return divideDecimals(multiplyDecimals([decimal, definition.denominator]), definition.numerator);
}

export function convertDecimal(decimal: string, from: UnitId, to: UnitId): string {
  const source = UNIT_DEFINITIONS[from];
  const target = UNIT_DEFINITIONS[to];
  if (source.semantic !== target.semantic) {
    throw new Error(`Cannot convert ${from} to ${to}: quantities differ`);
  }
  if (from === to) return normalizeDecimal(decimal);

  return fromBase(toBase(decimal, from), to);
}
