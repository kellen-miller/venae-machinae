import { describe, expect, it } from 'vitest';

import { evaluateFluidCalculation } from '../../src/lib/calculation/fluid-calculation';
import { createEngineeringQuantity } from '../../src/lib/calculation/quantity';
import { screenCandidates } from '../../src/lib/calculation/screen-candidates';

import type { EngineeringQuantity } from '../../src/lib/calculation/quantity';

const evaluatedAt = '2026-09-01T23:32:00Z';

function quantity(
  id: string,
  semantic: EngineeringQuantity['semantic'],
  decimal: string,
  unit: EngineeringQuantity['unit']
): EngineeringQuantity {
  return createEngineeringQuantity({
    id,
    semantic,
    decimal,
    unit,
    applicability: 'Run Hot / Fan On; coolant at 90 C',
    uncertainty: null,
    bounds: null,
    origin: 'sourced',
    provenance: 'independent fluid fixture'
  });
}

function request(
  formulaId: string,
  inputs: readonly { name: string; quantity: EngineeringQuantity }[]
) {
  return {
    id: `calculation-${formulaId}`,
    subjectId: 'line-coolant-feed',
    operatingStateId: 'state-run-hot',
    formulaId,
    pathId: 'route-coolant-feed',
    inputs,
    assumptions: ['steady', 'single-phase', 'incompressible', 'Newtonian'],
    conditions: {
      steady: 'true',
      phase: 'single',
      compressibility: 'incompressible',
      fluidBehavior: 'Newtonian'
    },
    omissions: [],
    desiredOutputUnit: 'square-metre' as const
  };
}

describe('MVP-FLUID-007 MVP-FLUID-008 MVP-CALC-009 bounded fluid calculations', () => {
  it('calculates circular area only from explicit actual inside diameter', () => {
    const result = evaluateFluidCalculation(
      request('fluid.circular-area.v1', [
        {
          name: 'inside-diameter',
          quantity: quantity('value-actual-id', 'length', '10', 'millimetre')
        }
      ]),
      evaluatedAt
    );

    expect(result).toMatchObject({
      status: 'calculated',
      completeness: 'complete-for-stated-model',
      output: {
        kind: 'quantity',
        semantic: 'area',
        decimal: '0.00007853981633974483096156608458198757',
        unit: 'square-metre'
      }
    });

    expect(
      evaluateFluidCalculation(
        request('fluid.circular-area.v1', [
          {
            name: 'nominal-diameter',
            quantity: quantity('value-dash-size', 'length', '10', 'millimetre')
          }
        ]),
        evaluatedAt
      )
    ).toMatchObject({ status: 'unknown', reason: 'missing-input: inside-diameter' });
  });

  it('propagates positive actual-ID bounds through circular area', () => {
    const actualId = quantity('value-actual-id', 'length', '10', 'millimetre');
    const result = evaluateFluidCalculation(
      request('fluid.circular-area.v1', [
        {
          name: 'inside-diameter',
          quantity: { ...actualId, bounds: { lower: '9', upper: '11' } }
        }
      ]),
      evaluatedAt
    );

    expect(result).toMatchObject({
      status: 'calculated',
      bounds: {
        lower: '0.00006361725123519331307886852851140993',
        upper: '0.00009503317777109124546349496234420496',
        method: 'input-bound envelope'
      }
    });
  });

  it('calculates laminar Darcy major loss and returns Unknown in transition', () => {
    const inputs = [
      {
        name: 'density',
        quantity: quantity('value-density', 'density', '1000', 'kilogram-per-cubic-metre')
      },
      {
        name: 'velocity',
        quantity: quantity('value-velocity', 'velocity', '0.01', 'metre-per-second')
      },
      {
        name: 'inside-diameter',
        quantity: quantity('value-id', 'length', '0.01', 'metre')
      },
      {
        name: 'dynamic-viscosity',
        quantity: quantity('value-viscosity', 'dynamic-viscosity', '0.001', 'pascal-second')
      },
      {
        name: 'hydraulic-length',
        quantity: quantity('value-length', 'length', '1', 'metre')
      }
    ] as const;

    expect(
      evaluateFluidCalculation(
        { ...request('fluid.darcy-major-loss.v1', inputs), desiredOutputUnit: 'pascal' },
        evaluatedAt
      )
    ).toMatchObject({
      status: 'calculated',
      output: { semantic: 'pressure-difference', decimal: '3.2', unit: 'pascal' },
      trace: { applicability: expect.arrayContaining(['Reynolds number 100']) }
    });

    const transitional = inputs.map((input) =>
      input.name === 'velocity'
        ? {
            ...input,
            quantity: quantity('value-velocity', 'velocity', '0.25', 'metre-per-second')
          }
        : input
    );
    expect(
      evaluateFluidCalculation(
        {
          ...request('fluid.darcy-major-loss.v1', transitional),
          desiredOutputUnit: 'pascal'
        },
        evaluatedAt
      )
    ).toMatchObject({ status: 'unknown', reason: 'transitional-flow' });

    expect(
      evaluateFluidCalculation(
        {
          ...request('fluid.darcy-major-loss.v1', inputs),
          desiredOutputUnit: 'pascal',
          omissions: ['fitting, entrance, exit, valve, and restriction losses']
        },
        evaluatedAt
      )
    ).toMatchObject({
      status: 'calculated',
      completeness: 'known-subtotal',
      output: { decimal: '3.2', unit: 'pascal' },
      omissions: ['fitting, entrance, exit, valve, and restriction losses']
    });
  });

  it('returns Unsupported for a two-phase request', () => {
    expect(
      evaluateFluidCalculation(
        {
          ...request('fluid.circular-area.v1', [
            {
              name: 'inside-diameter',
              quantity: quantity('value-id', 'length', '10', 'millimetre')
            }
          ]),
          conditions: {
            steady: 'true',
            phase: 'two-phase',
            compressibility: 'incompressible',
            fluidBehavior: 'Newtonian'
          }
        },
        evaluatedAt
      )
    ).toMatchObject({ status: 'unsupported', reason: 'outside-single-phase-envelope' });
  });

  it.each([
    {
      formulaId: 'fluid.mean-velocity.v1',
      inputs: [
        {
          name: 'volume-flow',
          quantity: quantity(
            'value-volume-flow',
            'volumetric-flow',
            '0.002',
            'cubic-metre-per-second'
          )
        },
        {
          name: 'area',
          quantity: quantity('value-area', 'area', '0.01', 'square-metre')
        }
      ],
      outputUnit: 'metre-per-second',
      expected: '0.2'
    },
    {
      formulaId: 'fluid.volume-flow.v1',
      inputs: [
        {
          name: 'area',
          quantity: quantity('value-area', 'area', '0.01', 'square-metre')
        },
        {
          name: 'velocity',
          quantity: quantity('value-velocity', 'velocity', '0.2', 'metre-per-second')
        }
      ],
      outputUnit: 'cubic-metre-per-second',
      expected: '0.002'
    },
    {
      formulaId: 'fluid.mass-flow.v1',
      inputs: [
        {
          name: 'density',
          quantity: quantity('value-density', 'density', '1000', 'kilogram-per-cubic-metre')
        },
        {
          name: 'volume-flow',
          quantity: quantity(
            'value-volume-flow',
            'volumetric-flow',
            '0.002',
            'cubic-metre-per-second'
          )
        }
      ],
      outputUnit: 'kilogram-per-second',
      expected: '2'
    },
    {
      formulaId: 'fluid.minimum-diameter.v1',
      inputs: [
        {
          name: 'volume-flow',
          quantity: quantity(
            'value-volume-flow',
            'volumetric-flow',
            '0.001',
            'cubic-metre-per-second'
          )
        },
        {
          name: 'maximum-velocity',
          quantity: quantity('value-velocity-limit', 'velocity', '2', 'metre-per-second')
        }
      ],
      outputUnit: 'metre',
      expected: '0.02523132522020160048247149522365684'
    },
    {
      formulaId: 'fluid.reynolds.v1',
      inputs: [
        {
          name: 'density',
          quantity: quantity('value-density', 'density', '1000', 'kilogram-per-cubic-metre')
        },
        {
          name: 'velocity',
          quantity: quantity('value-velocity', 'velocity', '0.2', 'metre-per-second')
        },
        {
          name: 'inside-diameter',
          quantity: quantity('value-id', 'length', '0.01', 'metre')
        },
        {
          name: 'dynamic-viscosity',
          quantity: quantity('value-viscosity', 'dynamic-viscosity', '0.001', 'pascal-second')
        }
      ],
      outputUnit: 'ratio',
      expected: '2000'
    },
    {
      formulaId: 'fluid.minor-loss.v1',
      inputs: [
        {
          name: 'loss-coefficient-sum',
          quantity: quantity('value-k-sum', 'dimensionless', '2', 'ratio')
        },
        {
          name: 'density',
          quantity: quantity('value-density', 'density', '1000', 'kilogram-per-cubic-metre')
        },
        {
          name: 'velocity',
          quantity: quantity('value-velocity', 'velocity', '0.2', 'metre-per-second')
        }
      ],
      outputUnit: 'pascal',
      expected: '40'
    },
    {
      formulaId: 'fluid.total-pressure-loss.v1',
      inputs: [
        {
          name: 'pressure-loss:major',
          quantity: quantity('value-major-loss', 'pressure-difference', '3.2', 'pascal')
        },
        {
          name: 'pressure-loss:minor',
          quantity: quantity('value-minor-loss', 'pressure-difference', '40', 'pascal')
        }
      ],
      outputUnit: 'pascal',
      expected: '43.2'
    }
  ] as const)(
    'evaluates the accepted $formulaId relationship',
    ({ formulaId, inputs, outputUnit, expected }) => {
      expect(
        evaluateFluidCalculation(
          { ...request(formulaId, inputs), desiredOutputUnit: outputUnit },
          evaluatedAt
        )
      ).toMatchObject({
        status: 'calculated',
        output: { decimal: expected, unit: outputUnit }
      });
    }
  );
});

describe('MVP-FLUID-011 MVP-FLUID-012 thermal calculations', () => {
  it('reports only the expected thermostat thermal region', () => {
    const result = evaluateFluidCalculation(
      {
        ...request('fluid.thermostat-region.v1', [
          {
            name: 'measured-temperature',
            quantity: quantity(
              'value-thermostat-temperature',
              'temperature-absolute',
              '70',
              'celsius-absolute'
            )
          },
          {
            name: 'begin-open-lower',
            quantity: quantity(
              'value-begin-open-lower',
              'temperature-absolute',
              '80',
              'celsius-absolute'
            )
          },
          {
            name: 'begin-open-upper',
            quantity: quantity(
              'value-begin-open-upper',
              'temperature-absolute',
              '82',
              'celsius-absolute'
            )
          },
          {
            name: 'full-open-lower',
            quantity: quantity(
              'value-full-open-lower',
              'temperature-absolute',
              '92',
              'celsius-absolute'
            )
          },
          {
            name: 'full-open-upper',
            quantity: quantity(
              'value-full-open-upper',
              'temperature-absolute',
              '95',
              'celsius-absolute'
            )
          }
        ]),
        desiredOutputUnit: null
      },
      evaluatedAt
    );

    expect(result).toMatchObject({
      status: 'calculated',
      output: { kind: 'classification', value: 'expected below opening range' },
      trace: { applicability: expect.arrayContaining(['actual valve position remains unknown']) }
    });
  });

  it('keeps transition, above-range, and insufficient thermostat evidence distinct', () => {
    const thermostatInputs = (measured: string) => [
      {
        name: 'measured-temperature',
        quantity: quantity(
          `value-measured-${measured}`,
          'temperature-absolute',
          measured,
          'celsius-absolute'
        )
      },
      {
        name: 'begin-open-lower',
        quantity: quantity('value-begin-lower', 'temperature-absolute', '80', 'celsius-absolute')
      },
      {
        name: 'begin-open-upper',
        quantity: quantity('value-begin-upper', 'temperature-absolute', '82', 'celsius-absolute')
      },
      {
        name: 'full-open-lower',
        quantity: quantity('value-full-lower', 'temperature-absolute', '92', 'celsius-absolute')
      },
      {
        name: 'full-open-upper',
        quantity: quantity('value-full-upper', 'temperature-absolute', '95', 'celsius-absolute')
      }
    ];
    const thermostatRequest = (measured: string) => ({
      ...request('fluid.thermostat-region.v1', thermostatInputs(measured)),
      desiredOutputUnit: null
    });

    expect(evaluateFluidCalculation(thermostatRequest('90'), evaluatedAt)).toMatchObject({
      status: 'calculated',
      output: { kind: 'classification', value: 'transition/indeterminate' }
    });
    expect(evaluateFluidCalculation(thermostatRequest('100'), evaluatedAt)).toMatchObject({
      status: 'calculated',
      output: { kind: 'classification', value: 'expected at or above full-open range' }
    });
    expect(
      evaluateFluidCalculation(
        {
          ...thermostatRequest('90'),
          inputs: thermostatInputs('90').slice(0, 3)
        },
        evaluatedAt
      )
    ).toMatchObject({ status: 'unknown', reason: 'missing-input: full-open-lower' });
  });

  it('calculates sensible heat carried by one evidenced stream, not radiator capacity', () => {
    const result = evaluateFluidCalculation(
      {
        ...request('fluid.sensible-heat.v1', [
          {
            name: 'mass-flow',
            quantity: quantity('value-mass-flow', 'mass-flow', '0.1', 'kilogram-per-second')
          },
          {
            name: 'specific-heat',
            quantity: quantity(
              'value-specific-heat',
              'specific-heat-capacity',
              '4000',
              'joule-per-kilogram-kelvin'
            )
          },
          {
            name: 'inlet-temperature',
            quantity: quantity(
              'value-inlet-temperature',
              'temperature-absolute',
              '80',
              'celsius-absolute'
            )
          },
          {
            name: 'outlet-temperature',
            quantity: quantity(
              'value-outlet-temperature',
              'temperature-absolute',
              '90',
              'celsius-absolute'
            )
          }
        ]),
        desiredOutputUnit: 'watt'
      },
      evaluatedAt
    );

    expect(result).toMatchObject({
      status: 'calculated',
      output: { semantic: 'power', decimal: '4000', unit: 'watt' },
      trace: {
        applicability: expect.arrayContaining([
          'heat carried by the stated stream, not radiator capacity'
        ])
      }
    });
  });
});

describe('MVP-FLUID-013 explicit selected-candidate screens', () => {
  it('keeps constituent working-pressure evidence separate and never substitutes burst pressure', () => {
    const pressure = (id: string, decimal: string) =>
      quantity(id, 'pressure-gauge', decimal, 'kilopascal-gauge');
    const result = screenCandidates({
      id: 'screen-line-pressure',
      subjectId: 'line-coolant-feed',
      operatingStateId: 'state-run-hot',
      criteria: [
        {
          id: 'criterion-hose-working-pressure',
          label: 'Hose working pressure',
          evidenceKey: 'hose-working-pressure',
          applicability: 'applicable',
          comparison: {
            kind: 'at-least',
            limit: pressure('limit-hose-pressure', '150')
          }
        },
        {
          id: 'criterion-coupling-working-pressure',
          label: 'Coupling working pressure',
          evidenceKey: 'coupling-working-pressure',
          applicability: 'applicable',
          comparison: {
            kind: 'at-least',
            limit: pressure('limit-coupling-pressure', '150')
          }
        }
      ],
      selectedCandidates: [
        {
          id: 'assembly-a',
          label: 'Assembly A',
          evidence: {
            'hose-working-pressure': {
              kind: 'quantity',
              quantity: pressure('assembly-a-hose-pressure', '220')
            },
            'coupling-working-pressure': {
              kind: 'quantity',
              quantity: pressure('assembly-a-coupling-pressure', '180')
            }
          }
        },
        {
          id: 'assembly-b',
          label: 'Assembly B',
          evidence: {
            'burst-pressure': {
              kind: 'quantity',
              quantity: pressure('assembly-b-burst-pressure', '600')
            }
          }
        }
      ]
    });

    expect(result.candidates[0]?.comparisons.map((comparison) => comparison.outcome)).toEqual([
      'pass',
      'pass'
    ]);
    expect(result.candidates[1]?.comparisons).toEqual([
      {
        criterionId: 'criterion-hose-working-pressure',
        outcome: 'unevaluated',
        reason: 'missing-evidence'
      },
      {
        criterionId: 'criterion-coupling-working-pressure',
        outcome: 'unevaluated',
        reason: 'missing-evidence'
      }
    ]);
    expect(result).not.toHaveProperty('recommendation');
  });
});
