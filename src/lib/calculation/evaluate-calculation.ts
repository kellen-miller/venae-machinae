import { getFormulaDefinition } from './formula-catalog';
import {
  addDecimals,
  compareDecimals,
  decimalPi,
  divideDecimals,
  multiplyDecimals,
  squareRootDecimal,
  subtractDecimals
} from './quantity';
import {
  assertUnitMatchesSemantic,
  baseUnitForSemantic,
  convertDecimal,
  unitSemantic
} from './unit-registry';

import type { FormulaDefinition } from './formula-catalog';
import type { EngineeringQuantity } from './quantity';
import type { SemanticQuantity, UnitId } from './unit-registry';

export type CalculationRequest = Readonly<{
  id: string;
  subjectId: string;
  operatingStateId: string;
  formulaId: string;
  pathId: string | null;
  inputs: readonly Readonly<{ name: string; quantity: EngineeringQuantity }>[];
  assumptions: readonly string[];
  conditions: Readonly<Record<string, string>>;
  omissions: readonly string[];
  desiredOutputUnit: UnitId | null;
}>;

export type CalculationTrace = Readonly<{
  calculationId: string;
  subjectId: string;
  operatingStateId: string;
  pathId: string | null;
  formulaId: string;
  formulaRevision: number | null;
  inputIds: readonly string[];
  assumptions: readonly string[];
  conditions: Readonly<Record<string, string>>;
  applicability: readonly string[];
  calculatedAt: string;
}>;

export type CalculationOutput =
  | Readonly<{
      kind: 'quantity';
      semantic: SemanticQuantity;
      decimal: string;
      unit: UnitId;
    }>
  | Readonly<{ kind: 'classification'; value: string }>;

export type CalculationOutcome = Readonly<{
  status: 'calculated' | 'unknown' | 'unsupported';
  completeness: 'complete-for-stated-model' | 'known-subtotal' | 'unknown' | 'unsupported';
  output: CalculationOutput | null;
  bounds: Readonly<{
    lower: string;
    upper: string;
    method: 'input-bound envelope';
  }> | null;
  reason: string | null;
  omissions: readonly string[];
  trace: CalculationTrace;
}>;

function trace(
  request: CalculationRequest,
  definition: FormulaDefinition | null,
  calculatedAt: string,
  applicability: readonly string[] = []
): CalculationTrace {
  return {
    calculationId: request.id,
    subjectId: request.subjectId,
    operatingStateId: request.operatingStateId,
    pathId: request.pathId,
    formulaId: request.formulaId,
    formulaRevision: definition?.revision ?? null,
    inputIds: request.inputs.map((input) => input.quantity.id),
    assumptions: [...request.assumptions],
    conditions: { ...request.conditions },
    applicability: [...(definition?.applicability ?? []), ...applicability],
    calculatedAt
  };
}

function unresolved(
  request: CalculationRequest,
  definition: FormulaDefinition | null,
  calculatedAt: string,
  status: 'unknown' | 'unsupported',
  reason: string,
  applicability: readonly string[] = []
): CalculationOutcome {
  return {
    status,
    completeness: status,
    output: null,
    bounds: null,
    reason,
    omissions: [...request.omissions],
    trace: trace(request, definition, calculatedAt, applicability)
  };
}

function inputFor(
  request: CalculationRequest,
  name: string,
  semantic: SemanticQuantity
): EngineeringQuantity | null | 'ambiguous' | 'invalid' {
  const matches = request.inputs.filter((input) => input.name === name);
  if (matches.length === 0) return null;
  if (matches.length > 1) return 'ambiguous';
  const quantity = matches[0]?.quantity;
  if (!quantity || quantity.semantic !== semantic || unitSemantic(quantity.unit) !== semantic) {
    return 'invalid';
  }

  return quantity;
}

function baseDecimal(quantity: EngineeringQuantity): string {
  assertUnitMatchesSemantic(quantity.unit, quantity.semantic);
  return convertDecimal(quantity.decimal, quantity.unit, baseUnitForSemantic(quantity.semantic));
}

function outputQuantity(
  request: CalculationRequest,
  definition: FormulaDefinition,
  baseDecimalValue: string
): CalculationOutput {
  if (!definition.output) throw new Error(`Formula ${definition.id} has no quantity output`);
  const unit = request.desiredOutputUnit ?? definition.output.baseUnit;
  assertUnitMatchesSemantic(unit, definition.output.semantic);
  return {
    kind: 'quantity',
    semantic: definition.output.semantic,
    decimal: convertDecimal(baseDecimalValue, definition.output.baseUnit, unit),
    unit
  };
}

function calculated(
  request: CalculationRequest,
  definition: FormulaDefinition,
  calculatedAt: string,
  output: CalculationOutput,
  bounds: CalculationOutcome['bounds'] = null,
  applicability: readonly string[] = []
): CalculationOutcome {
  return {
    status: 'calculated',
    completeness: request.omissions.length > 0 ? 'known-subtotal' : 'complete-for-stated-model',
    output,
    bounds,
    reason: null,
    omissions: [...request.omissions],
    trace: trace(request, definition, calculatedAt, applicability)
  };
}

function requiredInputs(
  request: CalculationRequest,
  definition: FormulaDefinition,
  calculatedAt: string
):
  | Readonly<{ resolved: true; inputs: Readonly<Record<string, EngineeringQuantity>> }>
  | Readonly<{ resolved: false; outcome: CalculationOutcome }> {
  const expectedNames = new Set(definition.inputs.map((input) => input.name));
  const inputs: Record<string, EngineeringQuantity> = {};
  for (const expected of definition.inputs) {
    const quantity = inputFor(request, expected.name, expected.semantic);
    if (quantity === null) {
      return {
        resolved: false,
        outcome: unresolved(
          request,
          definition,
          calculatedAt,
          'unknown',
          `missing-input: ${expected.name}`
        )
      };
    }
    if (quantity === 'ambiguous') {
      return {
        resolved: false,
        outcome: unresolved(
          request,
          definition,
          calculatedAt,
          'unknown',
          `ambiguous-input: ${expected.name}`
        )
      };
    }
    if (quantity === 'invalid') {
      return {
        resolved: false,
        outcome: unresolved(
          request,
          definition,
          calculatedAt,
          'unknown',
          `invalid-input: ${expected.name}`
        )
      };
    }

    inputs[expected.name] = quantity;
  }

  const unexpected = request.inputs.find(
    (input) =>
      !expectedNames.has(input.name) &&
      !(definition.variableInputPrefix && input.name.startsWith(definition.variableInputPrefix))
  );
  if (unexpected) {
    return {
      resolved: false,
      outcome: unresolved(
        request,
        definition,
        calculatedAt,
        'unknown',
        `unexpected-input: ${unexpected.name}`
      )
    };
  }

  return { resolved: true, inputs };
}

function electricalOutcome(
  request: CalculationRequest,
  definition: FormulaDefinition,
  inputs: Readonly<Record<string, EngineeringQuantity>>,
  calculatedAt: string
): CalculationOutcome {
  const voltageInput = request.inputs.find(
    (input) => input.quantity.semantic === 'electric-potential'
  );
  if (voltageInput && compareDecimals(baseDecimal(voltageInput.quantity), '60') > 0) {
    return unresolved(
      request,
      definition,
      calculatedAt,
      'unsupported',
      'outside-low-voltage-envelope'
    );
  }

  let decimal: string;
  if (definition.id === 'electrical.current.scenario-sum.v1') {
    const branches = request.inputs.filter((input) => input.name.startsWith('branch-current:'));
    if (branches.length === 0) {
      return unresolved(
        request,
        definition,
        calculatedAt,
        'unknown',
        'missing-input: branch-current:*'
      );
    }
    if (
      branches.some(
        (input) =>
          input.quantity.semantic !== 'electric-current' ||
          unitSemantic(input.quantity.unit) !== 'electric-current'
      )
    ) {
      return unresolved(
        request,
        definition,
        calculatedAt,
        'unknown',
        'invalid-input: branch-current:*'
      );
    }
    decimal = addDecimals(branches.map((input) => baseDecimal(input.quantity)));
  } else if (definition.id === 'electrical.current.voltage-resistance.v1') {
    decimal = divideDecimals(baseDecimal(inputs.voltage!), baseDecimal(inputs.resistance!));
  } else if (definition.id === 'electrical.current.power-voltage.v1') {
    decimal = divideDecimals(
      baseDecimal(inputs['electrical-input-power']!),
      baseDecimal(inputs.voltage!)
    );
  } else if (definition.id === 'electrical.conductor-resistance.v1') {
    decimal = multiplyDecimals([
      baseDecimal(inputs['resistance-per-length']!),
      baseDecimal(inputs.length!)
    ]);
  } else if (definition.id === 'electrical.voltage-drop.v1') {
    decimal = multiplyDecimals([baseDecimal(inputs.current!), baseDecimal(inputs.resistance!)]);
  } else if (definition.id === 'electrical.load-voltage.v1') {
    decimal = subtractDecimals(
      baseDecimal(inputs['source-voltage']!),
      baseDecimal(inputs['voltage-drop']!)
    );
  } else if (definition.id === 'electrical.power.v1') {
    decimal = multiplyDecimals([baseDecimal(inputs.voltage!), baseDecimal(inputs.current!)]);
  } else if (definition.id === 'electrical.power-loss.v1') {
    const current = baseDecimal(inputs.current!);
    decimal = multiplyDecimals([current, current, baseDecimal(inputs.resistance!)]);
  } else if (definition.id === 'electrical.drop-percent.v1') {
    decimal = multiplyDecimals([
      '100',
      divideDecimals(
        baseDecimal(inputs['voltage-drop']!),
        baseDecimal(inputs['reference-voltage']!)
      )
    ]);
  } else {
    return unresolved(
      request,
      definition,
      calculatedAt,
      'unsupported',
      'formula-not-in-electrical-envelope'
    );
  }

  return calculated(
    request,
    definition,
    calculatedAt,
    outputQuantity(request, definition, decimal)
  );
}

function fluidEnvelopeRejection(
  request: CalculationRequest,
  definition: FormulaDefinition,
  calculatedAt: string
): CalculationOutcome | null {
  if (request.conditions.phase && request.conditions.phase !== 'single') {
    return unresolved(
      request,
      definition,
      calculatedAt,
      'unsupported',
      'outside-single-phase-envelope'
    );
  }
  if (request.conditions.steady && request.conditions.steady !== 'true') {
    return unresolved(request, definition, calculatedAt, 'unsupported', 'outside-steady-envelope');
  }
  if (
    request.conditions.compressibility &&
    request.conditions.compressibility !== 'incompressible'
  ) {
    return unresolved(
      request,
      definition,
      calculatedAt,
      'unsupported',
      'outside-incompressible-envelope'
    );
  }
  if (request.conditions.fluidBehavior && request.conditions.fluidBehavior !== 'Newtonian') {
    return unresolved(
      request,
      definition,
      calculatedAt,
      'unsupported',
      'outside-newtonian-envelope'
    );
  }

  return null;
}

function fluidOutcome(
  request: CalculationRequest,
  definition: FormulaDefinition,
  inputs: Readonly<Record<string, EngineeringQuantity>>,
  calculatedAt: string
): CalculationOutcome {
  const envelopeRejection = fluidEnvelopeRejection(request, definition, calculatedAt);
  if (envelopeRejection) return envelopeRejection;

  let decimal: string;
  let applicability: readonly string[] = [];
  if (definition.id === 'fluid.circular-area.v1') {
    const diameter = baseDecimal(inputs['inside-diameter']!);
    decimal = multiplyDecimals([
      divideDecimals(multiplyDecimals([diameter, diameter]), '4'),
      decimalPi()
    ]);
  } else if (definition.id === 'fluid.mean-velocity.v1') {
    decimal = divideDecimals(baseDecimal(inputs['volume-flow']!), baseDecimal(inputs.area!));
  } else if (definition.id === 'fluid.volume-flow.v1') {
    decimal = multiplyDecimals([baseDecimal(inputs.area!), baseDecimal(inputs.velocity!)]);
  } else if (definition.id === 'fluid.mass-flow.v1') {
    decimal = multiplyDecimals([baseDecimal(inputs.density!), baseDecimal(inputs['volume-flow']!)]);
  } else if (definition.id === 'fluid.minimum-diameter.v1') {
    decimal = squareRootDecimal(
      divideDecimals(
        multiplyDecimals(['4', baseDecimal(inputs['volume-flow']!)]),
        multiplyDecimals([decimalPi(), baseDecimal(inputs['maximum-velocity']!)])
      )
    );
  } else if (definition.id === 'fluid.reynolds.v1') {
    decimal = divideDecimals(
      multiplyDecimals([
        baseDecimal(inputs.density!),
        baseDecimal(inputs.velocity!),
        baseDecimal(inputs['inside-diameter']!)
      ]),
      baseDecimal(inputs['dynamic-viscosity']!)
    );
  } else if (definition.id === 'fluid.darcy-major-loss.v1') {
    const density = baseDecimal(inputs.density!);
    const velocity = baseDecimal(inputs.velocity!);
    const diameter = baseDecimal(inputs['inside-diameter']!);
    const reynolds = divideDecimals(
      multiplyDecimals([density, velocity, diameter]),
      baseDecimal(inputs['dynamic-viscosity']!)
    );
    if (compareDecimals(reynolds, '2000') >= 0 && compareDecimals(reynolds, '3500') <= 0) {
      return unresolved(request, definition, calculatedAt, 'unknown', 'transitional-flow', [
        `Reynolds number ${reynolds}`
      ]);
    }
    if (compareDecimals(reynolds, '3500') > 0) {
      return unresolved(
        request,
        definition,
        calculatedAt,
        'unsupported',
        'turbulent-correlation-required',
        [`Reynolds number ${reynolds}`]
      );
    }
    if (compareDecimals(reynolds, '0') <= 0) {
      return unresolved(
        request,
        definition,
        calculatedAt,
        'unknown',
        'nonpositive-reynolds-number'
      );
    }
    const frictionFactor = divideDecimals('64', reynolds);
    decimal = multiplyDecimals([
      frictionFactor,
      divideDecimals(baseDecimal(inputs['hydraulic-length']!), diameter),
      divideDecimals(multiplyDecimals([density, velocity, velocity]), '2')
    ]);
    applicability = [`Reynolds number ${reynolds}`];
  } else if (definition.id === 'fluid.minor-loss.v1') {
    const velocity = baseDecimal(inputs.velocity!);
    decimal = multiplyDecimals([
      baseDecimal(inputs['loss-coefficient-sum']!),
      divideDecimals(multiplyDecimals([baseDecimal(inputs.density!), velocity, velocity]), '2')
    ]);
  } else if (definition.id === 'fluid.total-pressure-loss.v1') {
    const terms = request.inputs.filter((input) => input.name.startsWith('pressure-loss:'));
    if (terms.length === 0) {
      return unresolved(
        request,
        definition,
        calculatedAt,
        'unknown',
        'missing-input: pressure-loss:*'
      );
    }
    if (
      terms.some(
        (input) =>
          input.quantity.semantic !== 'pressure-difference' ||
          unitSemantic(input.quantity.unit) !== 'pressure-difference'
      )
    ) {
      return unresolved(
        request,
        definition,
        calculatedAt,
        'unknown',
        'invalid-input: pressure-loss:*'
      );
    }
    decimal = addDecimals(terms.map((input) => baseDecimal(input.quantity)));
  } else if (definition.id === 'fluid.thermostat-region.v1') {
    const measured = baseDecimal(inputs['measured-temperature']!);
    const beginLower = baseDecimal(inputs['begin-open-lower']!);
    const fullUpper = baseDecimal(inputs['full-open-upper']!);
    const value =
      compareDecimals(measured, beginLower) < 0
        ? 'expected below opening range'
        : compareDecimals(measured, fullUpper) > 0
          ? 'expected at or above full-open range'
          : 'transition/indeterminate';
    return calculated(request, definition, calculatedAt, { kind: 'classification', value }, null, [
      'actual valve position remains unknown'
    ]);
  } else if (definition.id === 'fluid.sensible-heat.v1') {
    const temperatureDifference = subtractDecimals(
      baseDecimal(inputs['outlet-temperature']!),
      baseDecimal(inputs['inlet-temperature']!)
    );
    decimal = multiplyDecimals([
      baseDecimal(inputs['mass-flow']!),
      baseDecimal(inputs['specific-heat']!),
      temperatureDifference
    ]);
  } else {
    return unresolved(
      request,
      definition,
      calculatedAt,
      'unsupported',
      'formula-not-in-fluid-envelope'
    );
  }

  return calculated(
    request,
    definition,
    calculatedAt,
    outputQuantity(request, definition, decimal),
    null,
    applicability
  );
}

function evaluatePoint(
  request: CalculationRequest,
  definition: FormulaDefinition,
  calculatedAt: string
): CalculationOutcome {
  const resolved = requiredInputs(request, definition, calculatedAt);
  if (!resolved.resolved) return resolved.outcome;

  return definition.domain === 'electrical'
    ? electricalOutcome(request, definition, resolved.inputs, calculatedAt)
    : fluidOutcome(request, definition, resolved.inputs, calculatedAt);
}

function propagateInputBounds(
  request: CalculationRequest,
  definition: FormulaDefinition,
  calculatedAt: string,
  point: CalculationOutcome
): CalculationOutcome {
  if (point.status !== 'calculated' || point.output?.kind !== 'quantity') return point;
  const hasAnyBound = request.inputs.some((input) => input.quantity.bounds !== null);
  if (!hasAnyBound) return point;
  if (!definition.supportsPositiveMonotonicBounds) {
    return unresolved(
      request,
      definition,
      calculatedAt,
      'unknown',
      'unsupported-bound-propagation'
    );
  }
  if (request.inputs.some((input) => input.quantity.bounds === null)) {
    return unresolved(request, definition, calculatedAt, 'unknown', 'missing-input-bound');
  }
  if (
    request.inputs.some((input) => {
      const bounds = input.quantity.bounds;
      if (!bounds) return true;
      const baseUnit = baseUnitForSemantic(input.quantity.semantic);
      const lower = convertDecimal(bounds.lower, input.quantity.unit, baseUnit);
      const upper = convertDecimal(bounds.upper, input.quantity.unit, baseUnit);
      return compareDecimals(lower, '0') < 0 || compareDecimals(upper, lower) < 0;
    })
  ) {
    return unresolved(
      request,
      definition,
      calculatedAt,
      'unknown',
      'unsupported-bound-propagation'
    );
  }

  const requestAt = (endpoint: 'lower' | 'upper'): CalculationRequest => ({
    ...request,
    inputs: request.inputs.map((input) => ({
      ...input,
      quantity: {
        ...input.quantity,
        decimal: input.quantity.bounds![endpoint],
        bounds: null
      }
    }))
  });
  const lower = evaluatePoint(requestAt('lower'), definition, calculatedAt);
  const upper = evaluatePoint(requestAt('upper'), definition, calculatedAt);
  if (
    lower.status !== 'calculated' ||
    lower.output?.kind !== 'quantity' ||
    upper.status !== 'calculated' ||
    upper.output?.kind !== 'quantity' ||
    compareDecimals(upper.output.decimal, lower.output.decimal) < 0
  ) {
    return unresolved(
      request,
      definition,
      calculatedAt,
      'unknown',
      'unsupported-bound-propagation'
    );
  }

  return {
    ...point,
    bounds: {
      lower: lower.output.decimal,
      upper: upper.output.decimal,
      method: 'input-bound envelope'
    }
  };
}

export function evaluateCalculation(
  request: CalculationRequest,
  calculatedAt: string
): CalculationOutcome {
  const definition = getFormulaDefinition(request.formulaId);
  if (!definition) {
    return unresolved(request, null, calculatedAt, 'unsupported', 'formula-not-in-catalog');
  }

  try {
    const point = evaluatePoint(request, definition, calculatedAt);
    return propagateInputBounds(request, definition, calculatedAt, point);
  } catch (error) {
    return unresolved(
      request,
      definition,
      calculatedAt,
      'unknown',
      error instanceof Error ? `evaluation-error: ${error.message}` : 'evaluation-error'
    );
  }
}
