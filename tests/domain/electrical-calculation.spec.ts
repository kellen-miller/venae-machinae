import { describe, expect, it } from 'vitest';

import { evaluateElectricalCalculation } from '../../src/lib/calculation/electrical-calculation';
import { createEngineeringQuantity } from '../../src/lib/calculation/quantity';
import { screenCandidates } from '../../src/lib/calculation/screen-candidates';

import type { EngineeringQuantity } from '../../src/lib/calculation/quantity';

const evaluatedAt = '2026-09-01T23:31:00Z';

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
    applicability: 'Run Hot / Fan On; steady DC',
    uncertainty: null,
    bounds: null,
    origin: 'sourced',
    provenance: 'independent electrical fixture'
  });
}

function request(
  formulaId: string,
  inputs: readonly { name: string; quantity: EngineeringQuantity }[]
) {
  return {
    id: `calculation-${formulaId}`,
    subjectId: 'circuit-auxiliary-cooling',
    operatingStateId: 'state-run-hot',
    formulaId,
    pathId: 'route-positive-and-return',
    inputs,
    assumptions: ['steady DC', 'explicit positive and return path'],
    conditions: { currentClass: 'continuous' },
    omissions: [],
    desiredOutputUnit: 'ampere' as const
  };
}

describe('MVP-ELEC-010 MVP-CALC-008 bounded electrical calculations', () => {
  it('calculates steady current and names its explicit scenario class', () => {
    const result = evaluateElectricalCalculation(
      request('electrical.current.voltage-resistance.v1', [
        {
          name: 'voltage',
          quantity: quantity('value-source-voltage', 'electric-potential', '12.8', 'volt')
        },
        {
          name: 'resistance',
          quantity: quantity('value-loop-resistance', 'electrical-resistance', '2', 'ohm')
        }
      ]),
      evaluatedAt
    );

    expect(result).toMatchObject({
      status: 'calculated',
      completeness: 'complete-for-stated-model',
      output: {
        kind: 'quantity',
        semantic: 'electric-current',
        decimal: '6.4',
        unit: 'ampere'
      },
      trace: {
        formulaId: 'electrical.current.voltage-resistance.v1',
        formulaRevision: 1,
        conditions: { currentClass: 'continuous' }
      }
    });
  });

  it('stops outside 60 V DC and rejects transient authority', () => {
    expect(
      evaluateElectricalCalculation(
        request('electrical.current.voltage-resistance.v1', [
          {
            name: 'voltage',
            quantity: quantity('value-source-voltage', 'electric-potential', '60.0001', 'volt')
          },
          {
            name: 'resistance',
            quantity: quantity('value-loop-resistance', 'electrical-resistance', '2', 'ohm')
          }
        ]),
        evaluatedAt
      )
    ).toMatchObject({ status: 'unsupported', reason: 'outside-low-voltage-envelope' });

    expect(
      evaluateElectricalCalculation(request('electrical.transient-current.v1', []), evaluatedAt)
    ).toMatchObject({ status: 'unsupported', reason: 'formula-not-in-catalog' });
  });

  it('keeps omitted connection resistance visible as a conductor-only subtotal', () => {
    const result = evaluateElectricalCalculation(
      {
        ...request('electrical.voltage-drop.v1', [
          {
            name: 'current',
            quantity: quantity('value-current', 'electric-current', '12.5', 'ampere')
          },
          {
            name: 'resistance',
            quantity: quantity(
              'value-conductor-resistance',
              'electrical-resistance',
              '0.032',
              'ohm'
            )
          }
        ]),
        omissions: ['connector and fuse-contact resistance'],
        desiredOutputUnit: 'volt'
      },
      evaluatedAt
    );

    expect(result).toMatchObject({
      status: 'calculated',
      completeness: 'known-subtotal',
      output: { decimal: '0.4', unit: 'volt' },
      omissions: ['connector and fuse-contact resistance']
    });
  });

  it('sums only explicitly named simultaneously active branch currents', () => {
    const result = evaluateElectricalCalculation(
      request('electrical.current.scenario-sum.v1', [
        {
          name: 'branch-current:fan',
          quantity: quantity('value-fan-current', 'electric-current', '12.5', 'ampere')
        },
        {
          name: 'branch-current:pump',
          quantity: quantity('value-pump-current', 'electric-current', '4.25', 'ampere')
        }
      ]),
      evaluatedAt
    );

    expect(result).toMatchObject({
      status: 'calculated',
      output: { decimal: '16.75', unit: 'ampere' },
      trace: { inputIds: ['value-fan-current', 'value-pump-current'] }
    });
  });

  it.each([
    {
      formulaId: 'electrical.current.power-voltage.v1',
      inputs: [
        {
          name: 'electrical-input-power',
          quantity: quantity('value-input-power', 'power', '120', 'watt')
        },
        {
          name: 'voltage',
          quantity: quantity('value-source-voltage', 'electric-potential', '12', 'volt')
        }
      ],
      desiredOutputUnit: 'ampere',
      expected: '10'
    },
    {
      formulaId: 'electrical.conductor-resistance.v1',
      inputs: [
        {
          name: 'resistance-per-length',
          quantity: quantity(
            'value-resistance-per-length',
            'resistance-per-length',
            '0.02',
            'ohm-per-metre'
          )
        },
        {
          name: 'length',
          quantity: quantity('value-loop-length', 'length', '3', 'metre')
        }
      ],
      desiredOutputUnit: 'ohm',
      expected: '0.06'
    },
    {
      formulaId: 'electrical.load-voltage.v1',
      inputs: [
        {
          name: 'source-voltage',
          quantity: quantity('value-source-voltage', 'electric-potential', '12.8', 'volt')
        },
        {
          name: 'voltage-drop',
          quantity: quantity('value-voltage-drop', 'electric-potential', '0.4', 'volt')
        }
      ],
      desiredOutputUnit: 'volt',
      expected: '12.4'
    },
    {
      formulaId: 'electrical.power.v1',
      inputs: [
        {
          name: 'voltage',
          quantity: quantity('value-load-voltage', 'electric-potential', '12', 'volt')
        },
        {
          name: 'current',
          quantity: quantity('value-load-current', 'electric-current', '5', 'ampere')
        }
      ],
      desiredOutputUnit: 'watt',
      expected: '60'
    },
    {
      formulaId: 'electrical.power-loss.v1',
      inputs: [
        {
          name: 'current',
          quantity: quantity('value-load-current', 'electric-current', '5', 'ampere')
        },
        {
          name: 'resistance',
          quantity: quantity('value-loop-resistance', 'electrical-resistance', '0.02', 'ohm')
        }
      ],
      desiredOutputUnit: 'watt',
      expected: '0.5'
    },
    {
      formulaId: 'electrical.drop-percent.v1',
      inputs: [
        {
          name: 'voltage-drop',
          quantity: quantity('value-voltage-drop', 'electric-potential', '0.4', 'volt')
        },
        {
          name: 'reference-voltage',
          quantity: quantity('value-reference-voltage', 'electric-potential', '12.8', 'volt')
        }
      ],
      desiredOutputUnit: 'percent',
      expected: '3.125'
    }
  ] as const)(
    'evaluates the accepted $formulaId relationship',
    ({ formulaId, inputs, desiredOutputUnit, expected }) => {
      expect(
        evaluateElectricalCalculation(
          { ...request(formulaId, inputs), desiredOutputUnit },
          evaluatedAt
        )
      ).toMatchObject({
        status: 'calculated',
        output: { decimal: expected, unit: desiredOutputUnit }
      });
    }
  );
});

describe('MVP-ELEC-011 MVP-ELEC-012 explicit electrical screening evidence', () => {
  it('keeps operating-point classes distinct without deriving suitability', () => {
    for (const currentClass of [
      'continuous',
      'intermittent',
      'startup',
      'stall',
      'measured-operating-point'
    ]) {
      const outcome = evaluateElectricalCalculation(
        {
          ...request('electrical.current.voltage-resistance.v1', [
            {
              name: 'voltage',
              quantity: quantity(
                `value-${currentClass}-voltage`,
                'electric-potential',
                '12',
                'volt'
              )
            },
            {
              name: 'resistance',
              quantity: quantity(
                `value-${currentClass}-resistance`,
                'electrical-resistance',
                '2',
                'ohm'
              )
            }
          ]),
          conditions: { currentClass }
        },
        evaluatedAt
      );
      expect(outcome.trace.conditions).toEqual({ currentClass });
      expect(outcome).not.toHaveProperty('suitability');
    }
  });

  it('compares selected fuse candidates without inferring a recommendation', () => {
    const result = screenCandidates({
      id: 'screen-selected-fuses',
      subjectId: 'circuit-auxiliary-cooling',
      operatingStateId: 'state-run-hot',
      criteria: [
        {
          id: 'criterion-continuous-current',
          label: 'Sourced continuous current at stated conditions',
          evidenceKey: 'continuous-current',
          applicability: 'applicable',
          comparison: {
            kind: 'at-least',
            limit: quantity('limit-continuous-current', 'electric-current', '15', 'ampere')
          }
        },
        {
          id: 'criterion-time-current',
          label: 'Exact time-current evidence',
          evidenceKey: 'time-current-source',
          applicability: 'applicable',
          comparison: { kind: 'includes', required: 'exact-family-curve' }
        }
      ],
      selectedCandidates: [
        {
          id: 'fuse-a',
          label: 'Fuse A',
          evidence: {
            'continuous-current': {
              kind: 'quantity',
              quantity: quantity('fuse-a-current', 'electric-current', '20', 'ampere')
            },
            'time-current-source': {
              kind: 'values',
              state: 'known',
              values: ['exact-family-curve']
            }
          }
        },
        {
          id: 'fuse-b',
          label: 'Fuse B',
          evidence: {
            'continuous-current': {
              kind: 'quantity',
              quantity: {
                ...quantity('fuse-b-current', 'electric-current', '15', 'ampere'),
                bounds: { lower: '14', upper: '16' }
              }
            },
            'time-current-source': null
          }
        }
      ]
    });

    expect(result.candidates).toEqual([
      {
        candidateId: 'fuse-a',
        label: 'Fuse A',
        comparisons: [
          { criterionId: 'criterion-continuous-current', outcome: 'pass', reason: null },
          { criterionId: 'criterion-time-current', outcome: 'pass', reason: null }
        ]
      },
      {
        candidateId: 'fuse-b',
        label: 'Fuse B',
        comparisons: [
          {
            criterionId: 'criterion-continuous-current',
            outcome: 'indeterminate',
            reason: 'bound-overlap'
          },
          {
            criterionId: 'criterion-time-current',
            outcome: 'unevaluated',
            reason: 'missing-evidence'
          }
        ]
      }
    ]);
    expect(result).not.toHaveProperty('recommendation');
    expect(result).not.toHaveProperty('ranking');
  });
});
