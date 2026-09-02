import { describe, expect, it } from 'vitest';

import { evaluateCalculation } from '../../src/lib/calculation/evaluate-calculation';
import {
  createEngineeringQuantity,
  divideDecimals,
  presentDecimal
} from '../../src/lib/calculation/quantity';
import { screenCandidates } from '../../src/lib/calculation/screen-candidates';
import { convertDecimal } from '../../src/lib/calculation/unit-registry';
import {
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from '../../src/lib/persistence/project-document';
import { applyProjectAction } from '../../src/lib/project/apply-action';
import { createBlankProject } from '../../src/lib/project/project';

import type { EngineeringQuantity } from '../../src/lib/calculation/quantity';

const evaluatedAt = '2026-09-01T23:30:00Z';

function quantity(
  id: string,
  semantic: EngineeringQuantity['semantic'],
  decimal: string,
  unit: EngineeringQuantity['unit'],
  bounds: EngineeringQuantity['bounds'] = null
): EngineeringQuantity {
  return createEngineeringQuantity({
    id,
    semantic,
    decimal,
    unit,
    applicability: 'Run Hot / Fan On',
    uncertainty: null,
    bounds,
    origin: 'entered',
    provenance: 'independent calculation fixture'
  });
}

describe('MVP-CALC-001 MVP-CALC-004 MVP-CALC-006 MVP-CALC-007 calculation core', () => {
  it('uses 34 significant digits and half-even rounding while preserving entered text', () => {
    const entered = quantity('value-current', 'electric-current', '12.500', 'ampere', {
      lower: '12.400',
      upper: '12.600'
    });

    expect(divideDecimals('1', '3')).toBe('0.3333333333333333333333333333333333');
    expect(presentDecimal('2.5', 1)).toEqual({
      display: '2',
      unrounded: '2.5',
      significantFigures: 1
    });
    expect(presentDecimal('3.5', 1).display).toBe('4');
    expect(entered).toEqual({
      id: 'value-current',
      semantic: 'electric-current',
      decimal: '12.500',
      unit: 'ampere',
      applicability: 'Run Hot / Fan On',
      uncertainty: null,
      bounds: { lower: '12.400', upper: '12.600' },
      origin: 'entered',
      provenance: 'independent calculation fixture'
    });
  });

  it('distinguishes absolute and difference temperature plus absolute and gauge pressure', () => {
    expect(convertDecimal('20', 'celsius-absolute', 'kelvin-absolute')).toBe('293.15');
    expect(convertDecimal('68', 'fahrenheit-absolute', 'celsius-absolute')).toBe('20');
    expect(convertDecimal('18', 'celsius-difference', 'fahrenheit-difference')).toBe('32.4');
    expect(() => convertDecimal('20', 'celsius-absolute', 'celsius-difference')).toThrow(
      'quantities differ'
    );
    expect(() => convertDecimal('100', 'kilopascal-absolute', 'kilopascal-gauge')).toThrow(
      'quantities differ'
    );
  });

  it('retains versioned formula trace and propagates an explicit input-bound envelope', () => {
    const result = evaluateCalculation(
      {
        id: 'calculation-voltage-drop',
        subjectId: 'wire-fan-feed',
        operatingStateId: 'state-run-hot',
        formulaId: 'electrical.voltage-drop.v1',
        pathId: 'route-fan-feed',
        inputs: [
          {
            name: 'current',
            quantity: quantity('value-current', 'electric-current', '12.5', 'ampere', {
              lower: '10',
              upper: '15'
            })
          },
          {
            name: 'resistance',
            quantity: quantity('value-resistance', 'electrical-resistance', '0.032', 'ohm', {
              lower: '0.02',
              upper: '0.04'
            })
          }
        ],
        assumptions: ['steady DC'],
        conditions: { voltageSystem: '12 V DC' },
        omissions: [],
        desiredOutputUnit: 'volt'
      },
      evaluatedAt
    );

    expect(result).toMatchObject({
      status: 'calculated',
      completeness: 'complete-for-stated-model',
      output: {
        kind: 'quantity',
        semantic: 'electric-potential',
        decimal: '0.4',
        unit: 'volt'
      },
      bounds: { lower: '0.2', upper: '0.6', method: 'input-bound envelope' },
      reason: null,
      omissions: [],
      trace: {
        calculationId: 'calculation-voltage-drop',
        subjectId: 'wire-fan-feed',
        operatingStateId: 'state-run-hot',
        pathId: 'route-fan-feed',
        formulaId: 'electrical.voltage-drop.v1',
        formulaRevision: 1,
        inputIds: ['value-current', 'value-resistance'],
        assumptions: ['steady DC'],
        calculatedAt: evaluatedAt
      }
    });
  });

  it('returns Unknown instead of dropping incomplete or unsupported bound propagation', () => {
    const incomplete = evaluateCalculation(
      {
        id: 'calculation-incomplete-bounds',
        subjectId: 'wire-fan-feed',
        operatingStateId: 'state-run-hot',
        formulaId: 'electrical.voltage-drop.v1',
        pathId: null,
        inputs: [
          {
            name: 'current',
            quantity: quantity('value-current-bounded', 'electric-current', '12.5', 'ampere', {
              lower: '10',
              upper: '15'
            })
          },
          {
            name: 'resistance',
            quantity: quantity(
              'value-resistance-unbounded',
              'electrical-resistance',
              '0.032',
              'ohm'
            )
          }
        ],
        assumptions: ['steady DC'],
        conditions: {},
        omissions: [],
        desiredOutputUnit: 'volt'
      },
      evaluatedAt
    );
    expect(incomplete).toMatchObject({
      status: 'unknown',
      completeness: 'unknown',
      output: null,
      reason: 'missing-input-bound'
    });

    const unsupported = evaluateCalculation(
      {
        id: 'calculation-nonmonotonic-bounds',
        subjectId: 'circuit-fan',
        operatingStateId: 'state-run-hot',
        formulaId: 'electrical.current.voltage-resistance.v1',
        pathId: null,
        inputs: [
          {
            name: 'voltage',
            quantity: quantity('value-voltage', 'electric-potential', '12', 'volt', {
              lower: '11',
              upper: '13'
            })
          },
          {
            name: 'resistance',
            quantity: quantity('value-resistance', 'electrical-resistance', '2', 'ohm', {
              lower: '1.5',
              upper: '2.5'
            })
          }
        ],
        assumptions: ['steady DC'],
        conditions: {},
        omissions: [],
        desiredOutputUnit: 'ampere'
      },
      evaluatedAt
    );
    expect(unsupported).toMatchObject({
      status: 'unknown',
      completeness: 'unknown',
      output: null,
      reason: 'unsupported-bound-propagation'
    });
  });

  it('requires explicit selection when the same formula input has conflicting alternatives', () => {
    const request = {
      id: 'calculation-conflicting-current',
      subjectId: 'wire-fan-feed',
      operatingStateId: 'state-run-hot',
      formulaId: 'electrical.voltage-drop.v1',
      pathId: null,
      inputs: [
        {
          name: 'current',
          quantity: quantity('value-current-measured', 'electric-current', '12.5', 'ampere')
        },
        {
          name: 'current',
          quantity: quantity('value-current-sourced', 'electric-current', '14', 'ampere')
        },
        {
          name: 'resistance',
          quantity: quantity('value-resistance', 'electrical-resistance', '0.032', 'ohm')
        }
      ],
      assumptions: ['steady DC'],
      conditions: {},
      omissions: [],
      desiredOutputUnit: 'volt' as const
    };

    expect(evaluateCalculation(request, evaluatedAt)).toMatchObject({
      status: 'unknown',
      reason: 'ambiguous-input: current',
      trace: {
        inputIds: ['value-current-measured', 'value-current-sourced', 'value-resistance']
      }
    });
    expect(
      evaluateCalculation(
        { ...request, inputs: [request.inputs[0]!, request.inputs[2]!] },
        evaluatedAt
      )
    ).toMatchObject({ status: 'calculated', output: { decimal: '0.4' } });
  });

  it('returns explicit Unknown and Unsupported outcomes without executing unknown formulas', () => {
    const base = {
      id: 'calculation-unknown',
      subjectId: 'wire-fan-feed',
      operatingStateId: 'state-run-hot',
      pathId: null,
      inputs: [
        {
          name: 'current',
          quantity: quantity('value-current', 'electric-current', '12.5', 'ampere')
        }
      ],
      assumptions: ['steady DC'],
      conditions: {},
      omissions: [],
      desiredOutputUnit: 'volt' as const
    };

    expect(
      evaluateCalculation({ ...base, formulaId: 'electrical.voltage-drop.v1' }, evaluatedAt)
    ).toMatchObject({
      status: 'unknown',
      completeness: 'unknown',
      output: null,
      reason: 'missing-input: resistance'
    });
    expect(
      evaluateCalculation({ ...base, formulaId: 'user.equation.v1' }, evaluatedAt)
    ).toMatchObject({
      status: 'unsupported',
      completeness: 'unsupported',
      output: null,
      reason: 'formula-not-in-catalog'
    });
  });
});

describe('MVP-CALC-010 neutral candidate screening', () => {
  it('compares selected candidates independently without ranking or aggregate suitability', () => {
    const result = screenCandidates({
      id: 'screen-hose-working-pressure',
      subjectId: 'line-coolant-feed',
      operatingStateId: 'state-run-hot',
      criteria: [
        {
          id: 'criterion-working-pressure',
          label: 'Working pressure at stated temperature',
          evidenceKey: 'working-pressure',
          applicability: 'applicable',
          comparison: {
            kind: 'at-least',
            limit: quantity('limit-working-pressure', 'pressure-gauge', '150', 'kilopascal-gauge')
          }
        },
        {
          id: 'criterion-medium',
          label: 'Coolant compatibility',
          evidenceKey: 'compatible-media',
          applicability: 'applicable',
          comparison: { kind: 'includes', required: 'ethylene-glycol-50-50' }
        },
        {
          id: 'criterion-standard',
          label: 'Named standard evidence',
          evidenceKey: 'standard',
          applicability: 'not-applicable',
          comparison: { kind: 'includes', required: 'owner-selected-standard' }
        }
      ],
      selectedCandidates: [
        {
          id: 'candidate-a',
          label: 'Candidate A',
          evidence: {
            'working-pressure': {
              kind: 'quantity',
              quantity: quantity(
                'candidate-a-working-pressure',
                'pressure-gauge',
                '200',
                'kilopascal-gauge'
              )
            },
            'compatible-media': {
              kind: 'values',
              state: 'known',
              values: ['ethylene-glycol-50-50']
            }
          }
        },
        {
          id: 'candidate-b',
          label: 'Candidate B',
          evidence: {
            'working-pressure': {
              kind: 'quantity',
              quantity: quantity(
                'candidate-b-working-pressure',
                'pressure-gauge',
                '145',
                'kilopascal-gauge',
                { lower: '140', upper: '160' }
              )
            },
            'compatible-media': null
          }
        }
      ]
    });

    expect(result.candidates).toEqual([
      {
        candidateId: 'candidate-a',
        label: 'Candidate A',
        comparisons: [
          { criterionId: 'criterion-working-pressure', outcome: 'pass', reason: null },
          { criterionId: 'criterion-medium', outcome: 'pass', reason: null },
          { criterionId: 'criterion-standard', outcome: 'not-applicable', reason: null }
        ]
      },
      {
        candidateId: 'candidate-b',
        label: 'Candidate B',
        comparisons: [
          {
            criterionId: 'criterion-working-pressure',
            outcome: 'indeterminate',
            reason: 'bound-overlap'
          },
          {
            criterionId: 'criterion-medium',
            outcome: 'unevaluated',
            reason: 'missing-evidence'
          },
          { criterionId: 'criterion-standard', outcome: 'not-applicable', reason: null }
        ]
      }
    ]);
    expect(result).not.toHaveProperty('ranking');
    expect(result).not.toHaveProperty('recommendation');
    expect(result.candidates[0]).not.toHaveProperty('outcome');
  });
});

describe('MVP-CALC-002 calculation configuration lifecycle', () => {
  it('persists an explicit subject, state, formula, inputs, assumptions, path, and output', () => {
    let snapshot = createBlankProject({
      id: 'project-calculation',
      name: 'Calculation project',
      createdAt: '2026-09-01T00:00:00Z'
    });
    const state = applyProjectAction(snapshot, {
      type: 'add-operating-state',
      causationId: 'cause-state',
      state: { id: 'state-run-hot', name: 'Run Hot / Fan On', description: 'Static fixture' }
    });
    if (!state.accepted) throw new Error(state.rejection.message);
    snapshot = state.snapshot;

    const configured = applyProjectAction(snapshot, {
      type: 'configure-calculation',
      causationId: 'cause-calculation',
      calculation: {
        id: 'calculation-voltage-drop',
        subjectId: snapshot.id,
        operatingStateId: 'state-run-hot',
        formulaId: 'electrical.voltage-drop.v1',
        pathId: null,
        inputs: [
          {
            name: 'current',
            quantity: quantity('value-current', 'electric-current', '12.5', 'ampere')
          },
          {
            name: 'resistance',
            quantity: quantity('value-resistance', 'electrical-resistance', '0.032', 'ohm')
          }
        ],
        assumptions: ['steady DC'],
        conditions: { voltageSystem: '12 V DC' },
        omissions: ['connector resistance'],
        desiredOutputUnit: 'volt'
      }
    });
    if (!configured.accepted) throw new Error(configured.rejection.message);

    const document = projectSnapshotToDocument(configured.snapshot);
    const reopened = projectDocumentToSnapshot(document);
    expect(reopened.calculations).toEqual(configured.snapshot.calculations);
    expect(reopened.calculations[0]).toMatchObject({
      subjectId: 'project-calculation',
      operatingStateId: 'state-run-hot',
      formulaId: 'electrical.voltage-drop.v1',
      inputs: [{ name: 'current' }, { name: 'resistance' }],
      assumptions: ['steady DC'],
      pathId: null,
      desiredOutputUnit: 'volt'
    });

    const missingStateDocument = structuredClone(document);
    missingStateDocument.operatingStates = [];
    expect(() => projectDocumentToSnapshot(missingStateDocument)).toThrow(
      'Persisted Project calculation model is invalid: Calculation calculation-voltage-drop references an absent Operating State'
    );
  });

  it('persists only explicit selected Part Definitions in a neutral screen', () => {
    let snapshot = createBlankProject({
      id: 'project-screening',
      name: 'Screening project',
      createdAt: '2026-09-01T00:00:00Z'
    });
    for (const action of [
      {
        type: 'add-operating-state' as const,
        causationId: 'cause-screen-state',
        state: { id: 'state-screen', name: 'Run Hot', description: 'Static fixture' }
      },
      {
        type: 'add-part-definition' as const,
        causationId: 'cause-part-a',
        definition: {
          id: 'candidate-screen-a',
          label: 'Candidate A',
          revision: 1,
          provenance: 'independent catalog fixture'
        }
      },
      {
        type: 'add-part-definition' as const,
        causationId: 'cause-part-b',
        definition: {
          id: 'candidate-screen-b',
          label: 'Candidate B',
          revision: 1,
          provenance: 'independent catalog fixture'
        }
      }
    ]) {
      const outcome = applyProjectAction(snapshot, action);
      if (!outcome.accepted) throw new Error(outcome.rejection.message);
      snapshot = outcome.snapshot;
    }

    const configured = applyProjectAction(snapshot, {
      type: 'configure-screening',
      causationId: 'cause-screen',
      screening: {
        id: 'screen-working-pressure',
        subjectId: snapshot.id,
        operatingStateId: 'state-screen',
        criteria: [
          {
            id: 'criterion-pressure',
            label: 'Minimum working pressure',
            evidenceKey: 'working-pressure',
            applicability: 'applicable',
            comparison: {
              kind: 'at-least',
              limit: quantity('limit-working-pressure', 'pressure-gauge', '150', 'kilopascal-gauge')
            }
          }
        ],
        selectedCandidates: [
          {
            id: 'candidate-screen-a',
            label: 'Candidate A',
            evidence: {
              'working-pressure': {
                kind: 'quantity',
                quantity: quantity(
                  'candidate-a-pressure',
                  'pressure-gauge',
                  '200',
                  'kilopascal-gauge'
                )
              }
            }
          }
        ]
      }
    });
    if (!configured.accepted) throw new Error(configured.rejection.message);

    const document = projectSnapshotToDocument(configured.snapshot);
    expect(projectDocumentToSnapshot(document).screenings[0]).toMatchObject({
      id: 'screen-working-pressure',
      selectedCandidates: [{ id: 'candidate-screen-a' }]
    });
    const absentCandidateDocument = structuredClone(document);
    absentCandidateDocument.screenings[0]!.selectedCandidates[0]!.id = 'absent-candidate';
    expect(() => projectDocumentToSnapshot(absentCandidateDocument)).toThrow(
      'Persisted Project calculation model is invalid: Screening screen-working-pressure references absent Part Definition absent-candidate'
    );
  });

  it('rejects an executable formula outside the application-owned catalog', () => {
    const snapshot = createBlankProject({
      id: 'project-user-formula',
      name: 'User formula boundary',
      createdAt: '2026-09-01T00:00:00Z'
    });

    expect(
      applyProjectAction(snapshot, {
        type: 'configure-calculation',
        causationId: 'cause-user-formula',
        calculation: {
          id: 'calculation-user-formula',
          subjectId: snapshot.id,
          operatingStateId: 'missing-state',
          formulaId: 'user.equation.v1',
          pathId: null,
          inputs: [],
          assumptions: [],
          conditions: {},
          omissions: [],
          desiredOutputUnit: null
        }
      })
    ).toMatchObject({
      accepted: false,
      rejection: {
        code: 'invalid-calculation',
        message: 'Formula user.equation.v1 is not executable'
      }
    });
  });
});
