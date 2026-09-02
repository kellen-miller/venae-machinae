import { compareDecimals, multiplyDecimals } from './quantity';

import type { SemanticQuantity, UnitId } from './unit-registry';

export type FormulaId =
  | 'electrical.current.voltage-resistance.v1'
  | 'electrical.current.power-voltage.v1'
  | 'electrical.current.scenario-sum.v1'
  | 'electrical.conductor-resistance.v1'
  | 'electrical.voltage-drop.v1'
  | 'electrical.load-voltage.v1'
  | 'electrical.power.v1'
  | 'electrical.power-loss.v1'
  | 'electrical.drop-percent.v1'
  | 'fluid.circular-area.v1'
  | 'fluid.mean-velocity.v1'
  | 'fluid.volume-flow.v1'
  | 'fluid.mass-flow.v1'
  | 'fluid.minimum-diameter.v1'
  | 'fluid.reynolds.v1'
  | 'fluid.darcy-major-loss.v1'
  | 'fluid.minor-loss.v1'
  | 'fluid.total-pressure-loss.v1'
  | 'fluid.thermostat-region.v1'
  | 'fluid.sensible-heat.v1';

export type FormulaDefinition = Readonly<{
  id: FormulaId;
  revision: 1;
  domain: 'electrical' | 'fluid';
  inputs: readonly Readonly<{ name: string; semantic: SemanticQuantity }>[];
  variableInputPrefix: string | null;
  output: Readonly<{ semantic: SemanticQuantity; baseUnit: UnitId }> | null;
  applicability: readonly string[];
  supportsPositiveMonotonicBounds: boolean;
}>;

type FormulaInputs = Readonly<Record<string, string>>;
type BoundInput = Readonly<{ lower?: string; upper?: string }>;
type FormulaBoundInputs = Readonly<Record<string, BoundInput>>;

export const FORMULA_CATALOG_VERSION = 1 as const;

const FORMULA_CATALOG: Readonly<Record<FormulaId, FormulaDefinition>> = Object.freeze({
  'electrical.current.voltage-resistance.v1': {
    id: 'electrical.current.voltage-resistance.v1',
    revision: 1,
    domain: 'electrical',
    inputs: [
      { name: 'voltage', semantic: 'electric-potential' },
      { name: 'resistance', semantic: 'electrical-resistance' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'electric-current', baseUnit: 'ampere' },
    applicability: ['steady DC', 'at or below 60 V DC'],
    supportsPositiveMonotonicBounds: false
  },
  'electrical.current.power-voltage.v1': {
    id: 'electrical.current.power-voltage.v1',
    revision: 1,
    domain: 'electrical',
    inputs: [
      { name: 'electrical-input-power', semantic: 'power' },
      { name: 'voltage', semantic: 'electric-potential' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'electric-current', baseUnit: 'ampere' },
    applicability: ['steady DC', 'electrical input power at the stated operating point'],
    supportsPositiveMonotonicBounds: false
  },
  'electrical.current.scenario-sum.v1': {
    id: 'electrical.current.scenario-sum.v1',
    revision: 1,
    domain: 'electrical',
    inputs: [],
    variableInputPrefix: 'branch-current:',
    output: { semantic: 'electric-current', baseUnit: 'ampere' },
    applicability: ['explicitly named simultaneously active branches'],
    supportsPositiveMonotonicBounds: true
  },
  'electrical.conductor-resistance.v1': {
    id: 'electrical.conductor-resistance.v1',
    revision: 1,
    domain: 'electrical',
    inputs: [
      { name: 'resistance-per-length', semantic: 'resistance-per-length' },
      { name: 'length', semantic: 'length' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'electrical-resistance', baseUnit: 'ohm' },
    applicability: ['stated conductor and temperature'],
    supportsPositiveMonotonicBounds: true
  },
  'electrical.voltage-drop.v1': {
    id: 'electrical.voltage-drop.v1',
    revision: 1,
    domain: 'electrical',
    inputs: [
      { name: 'current', semantic: 'electric-current' },
      { name: 'resistance', semantic: 'electrical-resistance' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'electric-potential', baseUnit: 'volt' },
    applicability: ['steady DC', 'explicit current-carrying path'],
    supportsPositiveMonotonicBounds: true
  },
  'electrical.load-voltage.v1': {
    id: 'electrical.load-voltage.v1',
    revision: 1,
    domain: 'electrical',
    inputs: [
      { name: 'source-voltage', semantic: 'electric-potential' },
      { name: 'voltage-drop', semantic: 'electric-potential' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'electric-potential', baseUnit: 'volt' },
    applicability: ['steady DC', 'same stated operating point'],
    supportsPositiveMonotonicBounds: false
  },
  'electrical.power.v1': {
    id: 'electrical.power.v1',
    revision: 1,
    domain: 'electrical',
    inputs: [
      { name: 'voltage', semantic: 'electric-potential' },
      { name: 'current', semantic: 'electric-current' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'power', baseUnit: 'watt' },
    applicability: ['steady DC'],
    supportsPositiveMonotonicBounds: false
  },
  'electrical.power-loss.v1': {
    id: 'electrical.power-loss.v1',
    revision: 1,
    domain: 'electrical',
    inputs: [
      { name: 'current', semantic: 'electric-current' },
      { name: 'resistance', semantic: 'electrical-resistance' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'power', baseUnit: 'watt' },
    applicability: ['steady DC', 'explicit included resistance'],
    supportsPositiveMonotonicBounds: true
  },
  'electrical.drop-percent.v1': {
    id: 'electrical.drop-percent.v1',
    revision: 1,
    domain: 'electrical',
    inputs: [
      { name: 'voltage-drop', semantic: 'electric-potential' },
      { name: 'reference-voltage', semantic: 'electric-potential' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'dimensionless', baseUnit: 'percent' },
    applicability: ['explicit user or vehicle reference voltage'],
    supportsPositiveMonotonicBounds: false
  },
  'fluid.circular-area.v1': {
    id: 'fluid.circular-area.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [{ name: 'inside-diameter', semantic: 'length' }],
    variableInputPrefix: null,
    output: { semantic: 'area', baseUnit: 'square-metre' },
    applicability: ['circular passage', 'explicit actual inside diameter'],
    supportsPositiveMonotonicBounds: true
  },
  'fluid.mean-velocity.v1': {
    id: 'fluid.mean-velocity.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [
      { name: 'volume-flow', semantic: 'volumetric-flow' },
      { name: 'area', semantic: 'area' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'velocity', baseUnit: 'metre-per-second' },
    applicability: ['steady single-phase stream'],
    supportsPositiveMonotonicBounds: false
  },
  'fluid.volume-flow.v1': {
    id: 'fluid.volume-flow.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [
      { name: 'area', semantic: 'area' },
      { name: 'velocity', semantic: 'velocity' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'volumetric-flow', baseUnit: 'cubic-metre-per-second' },
    applicability: ['steady single-phase stream'],
    supportsPositiveMonotonicBounds: true
  },
  'fluid.mass-flow.v1': {
    id: 'fluid.mass-flow.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [
      { name: 'density', semantic: 'density' },
      { name: 'volume-flow', semantic: 'volumetric-flow' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'mass-flow', baseUnit: 'kilogram-per-second' },
    applicability: ['density at stated composition and temperature'],
    supportsPositiveMonotonicBounds: true
  },
  'fluid.minimum-diameter.v1': {
    id: 'fluid.minimum-diameter.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [
      { name: 'volume-flow', semantic: 'volumetric-flow' },
      { name: 'maximum-velocity', semantic: 'velocity' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'length', baseUnit: 'metre' },
    applicability: ['mathematical circular ID candidate', 'user-supplied velocity envelope'],
    supportsPositiveMonotonicBounds: false
  },
  'fluid.reynolds.v1': {
    id: 'fluid.reynolds.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [
      { name: 'density', semantic: 'density' },
      { name: 'velocity', semantic: 'velocity' },
      { name: 'inside-diameter', semantic: 'length' },
      { name: 'dynamic-viscosity', semantic: 'dynamic-viscosity' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'dimensionless', baseUnit: 'ratio' },
    applicability: ['steady single-phase flow'],
    supportsPositiveMonotonicBounds: false
  },
  'fluid.darcy-major-loss.v1': {
    id: 'fluid.darcy-major-loss.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [
      { name: 'density', semantic: 'density' },
      { name: 'velocity', semantic: 'velocity' },
      { name: 'inside-diameter', semantic: 'length' },
      { name: 'dynamic-viscosity', semantic: 'dynamic-viscosity' },
      { name: 'hydraulic-length', semantic: 'length' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'pressure-difference', baseUnit: 'pascal' },
    applicability: [
      'steady single-phase incompressible Newtonian circular passage',
      'laminar flow below Reynolds number 2000'
    ],
    supportsPositiveMonotonicBounds: false
  },
  'fluid.minor-loss.v1': {
    id: 'fluid.minor-loss.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [
      { name: 'loss-coefficient-sum', semantic: 'dimensionless' },
      { name: 'density', semantic: 'density' },
      { name: 'velocity', semantic: 'velocity' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'pressure-difference', baseUnit: 'pascal' },
    applicability: ['sourced K values at stated conditions'],
    supportsPositiveMonotonicBounds: true
  },
  'fluid.total-pressure-loss.v1': {
    id: 'fluid.total-pressure-loss.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [],
    variableInputPrefix: 'pressure-loss:',
    output: { semantic: 'pressure-difference', baseUnit: 'pascal' },
    applicability: ['explicit included pressure-loss terms'],
    supportsPositiveMonotonicBounds: true
  },
  'fluid.thermostat-region.v1': {
    id: 'fluid.thermostat-region.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [
      { name: 'measured-temperature', semantic: 'temperature-absolute' },
      { name: 'begin-open-lower', semantic: 'temperature-absolute' },
      { name: 'begin-open-upper', semantic: 'temperature-absolute' },
      { name: 'full-open-lower', semantic: 'temperature-absolute' },
      { name: 'full-open-upper', semantic: 'temperature-absolute' }
    ],
    variableInputPrefix: null,
    output: null,
    applicability: ['mechanical thermostat with sourced begin-open and full-open ranges'],
    supportsPositiveMonotonicBounds: false
  },
  'fluid.sensible-heat.v1': {
    id: 'fluid.sensible-heat.v1',
    revision: 1,
    domain: 'fluid',
    inputs: [
      { name: 'mass-flow', semantic: 'mass-flow' },
      { name: 'specific-heat', semantic: 'specific-heat-capacity' },
      { name: 'inlet-temperature', semantic: 'temperature-absolute' },
      { name: 'outlet-temperature', semantic: 'temperature-absolute' }
    ],
    variableInputPrefix: null,
    output: { semantic: 'power', baseUnit: 'watt' },
    applicability: [
      'same steady single-phase stream',
      'representative bulk temperatures',
      'heat carried by the stated stream, not radiator capacity'
    ],
    supportsPositiveMonotonicBounds: false
  }
});

export function getFormulaDefinition(formulaId: string): FormulaDefinition | null {
  return FORMULA_CATALOG[formulaId as FormulaId] ?? null;
}

export function listFormulaDefinitions(): readonly FormulaDefinition[] {
  return Object.values(FORMULA_CATALOG);
}

function requireExactInputs(
  expectedNames: readonly string[],
  inputs: Readonly<Record<string, unknown>>
) {
  const actualNames = Object.keys(inputs).sort();
  const requiredNames = [...expectedNames].sort();
  if (
    actualNames.length !== requiredNames.length ||
    actualNames.some((name, index) => name !== requiredNames[index])
  ) {
    throw new Error(
      `Expected inputs ${requiredNames.join(', ')}; received ${actualNames.join(', ')}`
    );
  }
}

function isCompleteBound(bound: BoundInput | undefined): bound is Required<BoundInput> {
  return bound?.lower !== undefined && bound.upper !== undefined;
}

function requireInput(inputs: FormulaInputs, name: string): string {
  const value = inputs[name];
  if (value === undefined) throw new Error(`Formula input ${name} is absent`);
  return value;
}

export function evaluateFormula(
  formulaId: 'electrical.voltage-drop.v1' | 'electrical.power.v1',
  inputs: FormulaInputs
) {
  const formula = FORMULA_CATALOG[formulaId];
  requireExactInputs(
    formula.inputs.map((input) => input.name),
    inputs
  );
  const decimal =
    formulaId === 'electrical.voltage-drop.v1'
      ? multiplyDecimals([requireInput(inputs, 'current'), requireInput(inputs, 'resistance')])
      : multiplyDecimals([requireInput(inputs, 'voltage'), requireInput(inputs, 'current')]);

  return {
    decimal,
    unit: formula.output?.baseUnit ?? 'ratio'
  } as const;
}

export function evaluateFormulaBounds(
  formulaId: 'electrical.voltage-drop.v1' | 'electrical.power.v1',
  inputs: FormulaBoundInputs
) {
  const formula = FORMULA_CATALOG[formulaId];
  requireExactInputs(
    formula.inputs.map((input) => input.name),
    inputs
  );
  if (!formula.supportsPositiveMonotonicBounds) {
    return { status: 'unknown', reason: 'unsupported' } as const;
  }

  const orderedBounds = formula.inputs.map((input) => inputs[input.name]);
  if (!orderedBounds.every(isCompleteBound)) {
    return { status: 'unknown', reason: 'missing-bound' } as const;
  }

  if (
    orderedBounds.some(
      (bound) =>
        compareDecimals(bound.lower, '0') < 0 || compareDecimals(bound.upper, bound.lower) < 0
    )
  ) {
    return { status: 'unknown', reason: 'unsupported' } as const;
  }

  return {
    status: 'complete',
    lower: multiplyDecimals(orderedBounds.map((bound) => bound.lower)),
    upper: multiplyDecimals(orderedBounds.map((bound) => bound.upper)),
    method: 'input-bound envelope'
  } as const;
}
