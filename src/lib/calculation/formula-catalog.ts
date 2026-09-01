import { compareDecimals, multiplyDecimals } from './quantity';

export type FormulaId = 'electrical.voltage-drop.v1' | 'electrical.power.v1';

type FormulaInputs = Readonly<Record<string, string>>;
type BoundInput = Readonly<{ lower?: string; upper?: string }>;
type FormulaBoundInputs = Readonly<Record<string, BoundInput>>;

const FORMULA_CATALOG = {
  'electrical.voltage-drop.v1': {
    inputNames: ['current', 'resistance'],
    outputUnit: 'volt',
    supportsPositiveMonotonicBounds: true
  },
  'electrical.power.v1': {
    inputNames: ['voltage', 'current'],
    outputUnit: 'watt',
    supportsPositiveMonotonicBounds: false
  }
} as const;

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

export function evaluateFormula(formulaId: FormulaId, inputs: FormulaInputs) {
  const formula = FORMULA_CATALOG[formulaId];
  requireExactInputs(formula.inputNames, inputs);
  let decimal: string;
  if (formulaId === 'electrical.voltage-drop.v1') {
    decimal = multiplyDecimals([
      requireInput(inputs, 'current'),
      requireInput(inputs, 'resistance')
    ]);
  } else {
    decimal = multiplyDecimals([requireInput(inputs, 'voltage'), requireInput(inputs, 'current')]);
  }

  return {
    decimal,
    unit: formula.outputUnit
  } as const;
}

export function evaluateFormulaBounds(formulaId: FormulaId, inputs: FormulaBoundInputs) {
  const formula = FORMULA_CATALOG[formulaId];
  requireExactInputs(formula.inputNames, inputs);
  if (!formula.supportsPositiveMonotonicBounds) {
    return { status: 'unknown', reason: 'unsupported' } as const;
  }

  const orderedBounds = formula.inputNames.map((name) => inputs[name]);
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
