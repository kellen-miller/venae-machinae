import { describe, expect, it } from 'vitest';

import {
  createOperatingState,
  createReferenceOperatingStates,
  selectOverlayChannel,
  validateOperatingStateModel
} from '../../src/lib/operating-state/operating-state';
import {
  compareOperatingStateOverlays,
  evaluateOperatingStateOverlay
} from '../../src/lib/operating-state/evaluate-overlay';
import { applyProjectAction } from '../../src/lib/project/apply-action';
import { createBlankProject } from '../../src/lib/project/project';

import type {
  OperatingState,
  OverlayChannel,
  StateBinding
} from '../../src/lib/operating-state/operating-state';
import type { ProjectSnapshot } from '../../src/lib/project/project';

const fingerprint = 'a'.repeat(64);

function knownBinding(
  input: Partial<StateBinding> & Pick<StateBinding, 'id' | 'subjectId' | 'systemId' | 'channel'>
): StateBinding {
  const { id, subjectId, systemId, channel, ...overrides } = input;
  return {
    id,
    subjectId,
    systemId,
    channel,
    evidenceState: 'known',
    value: '12',
    unit: input.channel === 'temperature' ? 'degC' : 'V',
    direction: null,
    referenceSubjectId: null,
    pathConnectionIds: [input.subjectId],
    behavior: null,
    calculationResultId: null,
    evidenceIds: [],
    assumptions: [],
    omissions: [],
    applicability: 'reference fixture',
    uncertainty: null,
    conflictValues: [],
    provenance: ['fixture'],
    ...overrides
  };
}

function overlayProject(states: readonly OperatingState[]): ProjectSnapshot {
  return {
    ...createBlankProject({
      id: 'project-overlay',
      name: 'Overlay fixture',
      createdAt: '2026-09-02T00:00:00.000Z'
    }),
    revision: 17,
    topology: {
      systems: [
        { id: 'system-electrical', label: 'Electrical', domain: 'electrical', mediumId: null },
        { id: 'system-coolant', label: 'Coolant', domain: 'fluid', mediumId: 'medium-coolant' }
      ],
      components: [
        {
          id: 'source',
          label: 'Source',
          kind: 'part',
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: '0', y: '0' },
          ports: [
            {
              id: 'source-port',
              componentId: 'source',
              label: 'Source',
              domain: 'electrical',
              mediumId: null,
              interfaceKey: null
            },
            {
              id: 'source-return',
              componentId: 'source',
              label: 'Source return',
              domain: 'electrical',
              mediumId: null,
              interfaceKey: null
            },
            {
              id: 'coolant-source',
              componentId: 'source',
              label: 'Coolant source',
              domain: 'fluid',
              mediumId: 'medium-coolant',
              interfaceKey: null
            }
          ]
        },
        {
          id: 'load',
          label: 'Load',
          kind: 'part',
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: '200', y: '0' },
          ports: [
            {
              id: 'load-port',
              componentId: 'load',
              label: 'Load',
              domain: 'electrical',
              mediumId: null,
              interfaceKey: null
            },
            {
              id: 'load-return',
              componentId: 'load',
              label: 'Load return',
              domain: 'electrical',
              mediumId: null,
              interfaceKey: null
            },
            {
              id: 'coolant-load',
              componentId: 'load',
              label: 'Coolant load',
              domain: 'fluid',
              mediumId: 'medium-coolant',
              interfaceKey: null
            }
          ]
        }
      ],
      connections: [
        {
          id: 'wire-supply',
          label: 'Supply',
          systemId: 'system-electrical',
          sourcePortId: 'source-port',
          targetPortId: 'load-port',
          domain: 'electrical',
          mediumId: null,
          kind: 'electrical-wire',
          interfaceAssessment: 'unknown',
          routeId: null
        },
        {
          id: 'hose-feed',
          label: 'Feed',
          systemId: 'system-coolant',
          sourcePortId: 'coolant-source',
          targetPortId: 'coolant-load',
          domain: 'fluid',
          mediumId: 'medium-coolant',
          kind: 'fluid-hose',
          interfaceAssessment: 'unknown',
          routeId: null
        },
        {
          id: 'wire-return',
          label: 'Return',
          systemId: 'system-electrical',
          sourcePortId: 'load-return',
          targetPortId: 'source-return',
          domain: 'electrical',
          mediumId: null,
          kind: 'electrical-wire',
          interfaceAssessment: 'unknown',
          routeId: null
        }
      ],
      routes: [],
      segments: []
    },
    electrical: {
      ...createBlankProject({
        id: 'electrical-empty',
        name: 'Electrical empty',
        createdAt: '2026-09-02T00:00:00.000Z'
      }).electrical,
      circuits: [
        {
          id: 'circuit-supply-return',
          label: 'Supply and return',
          systemId: 'system-electrical',
          connectionIds: ['wire-supply', 'wire-return'],
          componentIds: ['source', 'load'],
          protectionComponentIds: []
        }
      ]
    },
    fluid: {
      media: [
        {
          id: 'medium-coolant',
          label: 'Coolant',
          composition: '50/50 water glycol',
          provenance: 'fixture'
        }
      ],
      systems: [{ systemId: 'system-coolant', mediumId: 'medium-coolant', purpose: 'cooling' }],
      components: [],
      lines: [],
      behaviors: [],
      boundaryConditions: []
    },
    evidence: [
      {
        id: 'evidence-electrical',
        subjectId: 'wire-supply',
        label: 'Electrical measurement',
        state: 'known',
        value: '12',
        unit: 'V',
        provenance: 'logged electrical measurement',
        conflictValues: []
      },
      {
        id: 'evidence-temperature',
        subjectId: 'hose-feed',
        label: 'Bulk coolant temperature',
        state: 'known',
        value: '88',
        unit: 'degC',
        provenance: 'logged measurement',
        conflictValues: []
      }
    ],
    operatingStates: states
  };
}

describe('Operating States and Overlays', () => {
  it('creates five independent static reference states and supports create/clone/edit/delete', () => {
    const reference = createReferenceOperatingStates((name) => `state-${name}`);
    expect(reference.map((state) => state.name)).toEqual([
      'Key Off / Cold',
      'Fuel Prime',
      'Run Cold',
      'Run Hot / Fan On',
      'Heat Soak / Key Off'
    ]);
    expect(reference.every((state) => state.bindings.length === 0)).toBe(true);
    expect(reference[0]!.commands).not.toBe(reference[1]!.commands);

    let snapshot = createBlankProject({
      id: 'project-state-lifecycle',
      name: 'State lifecycle',
      createdAt: '2026-09-02T00:00:00.000Z'
    });
    const added = applyProjectAction(snapshot, {
      type: 'add-operating-state',
      causationId: 'add-state',
      state: reference[0]!
    });
    expect(added.accepted).toBe(true);
    if (!added.accepted) return;
    snapshot = added.snapshot;

    const cloned = applyProjectAction(snapshot, {
      type: 'clone-operating-state',
      causationId: 'clone-state',
      stateId: reference[0]!.id,
      cloneId: 'state-clone',
      cloneName: 'Cold service check'
    });
    expect(cloned.accepted).toBe(true);
    if (!cloned.accepted) return;
    expect(cloned.snapshot.operatingStates[1]).toEqual({
      ...reference[0],
      id: 'state-clone',
      name: 'Cold service check'
    });
    expect(cloned.snapshot.operatingStates[1]!.bindings).not.toBe(reference[0]!.bindings);

    const edited = applyProjectAction(cloned.snapshot, {
      type: 'update-operating-state',
      causationId: 'edit-state',
      state: {
        ...cloned.snapshot.operatingStates[1]!,
        description: 'Independent static service scenario.'
      }
    });
    expect(edited.accepted).toBe(true);
    if (!edited.accepted) return;
    expect(edited.snapshot.operatingStates[0]!.description).toBe(reference[0]!.description);

    const deleted = applyProjectAction(edited.snapshot, {
      type: 'delete-operating-state',
      causationId: 'delete-state',
      stateId: 'state-clone'
    });
    expect(deleted.accepted).toBe(true);
    if (!deleted.accepted) return;
    expect(deleted.snapshot.operatingStates.map((state) => state.id)).toEqual([reference[0]!.id]);
  });

  it('retains explicit unknown and conflicting bindings while rejecting implicit channel semantics', () => {
    const state = createOperatingState({
      id: 'state-hot',
      name: 'Run Hot / Fan On',
      description: 'Static hot-running evidence review.'
    });
    const unknown = knownBinding({
      id: 'binding-flow-unknown',
      subjectId: 'hose-feed',
      systemId: 'system-coolant',
      channel: 'fluid-direction',
      evidenceState: 'unknown',
      value: null,
      unit: null,
      direction: 'unknown',
      provenance: []
    });
    const conflicting = knownBinding({
      id: 'binding-temperature-conflict',
      subjectId: 'hose-feed',
      systemId: 'system-coolant',
      channel: 'temperature',
      evidenceState: 'conflicting',
      value: null,
      unit: 'degC',
      direction: null,
      evidenceIds: ['evidence-temperature'],
      conflictValues: ['86', '92']
    });
    const snapshot = overlayProject([{ ...state, bindings: [unknown, conflicting] }]);
    expect(validateOperatingStateModel(snapshot)).toBeNull();

    const implicitCurrent = knownBinding({
      id: 'binding-current-invalid',
      subjectId: 'wire-supply',
      systemId: 'system-electrical',
      channel: 'current',
      direction: null,
      calculationResultId: null,
      evidenceIds: []
    });
    expect(
      validateOperatingStateModel({
        ...snapshot,
        operatingStates: [{ ...state, bindings: [implicitCurrent] }]
      })
    ).toMatchObject({ code: 'invalid-state-binding' });
  });

  it('requires sourced potential and a Circuit-owned complete current path', () => {
    const state = createOperatingState({
      id: 'state-electrical',
      name: 'Electrical state',
      description: 'Explicit electrical path review.'
    });
    const potentialWithoutSource = knownBinding({
      id: 'binding-potential-unsourced',
      subjectId: 'wire-supply',
      systemId: 'system-electrical',
      channel: 'potential',
      referenceSubjectId: 'source',
      evidenceIds: []
    });
    expect(
      validateOperatingStateModel(
        overlayProject([{ ...state, bindings: [potentialWithoutSource] }])
      )
    ).toMatchObject({ code: 'invalid-state-binding' });

    const incompleteCurrent = knownBinding({
      id: 'binding-current-incomplete',
      subjectId: 'wire-supply',
      systemId: 'system-electrical',
      channel: 'current',
      unit: 'ampere',
      direction: 'source-to-load',
      evidenceIds: ['evidence-electrical']
    });
    expect(
      validateOperatingStateModel(overlayProject([{ ...state, bindings: [incompleteCurrent] }]))
    ).toMatchObject({ code: 'invalid-state-binding' });

    const completeCurrent = {
      ...incompleteCurrent,
      id: 'binding-current-complete',
      pathConnectionIds: ['wire-supply', 'wire-return']
    };
    expect(
      validateOperatingStateModel(overlayProject([{ ...state, bindings: [completeCurrent] }]))
    ).toBeNull();
  });

  it('enforces channel combinations and evaluates complete trace without interpolating gaps', () => {
    let channels: readonly OverlayChannel[] = [];
    channels = selectOverlayChannel(channels, 'potential', true);
    channels = selectOverlayChannel(channels, 'current', true);
    channels = selectOverlayChannel(channels, 'fluid-direction', true);
    channels = selectOverlayChannel(channels, 'temperature', true);
    channels = selectOverlayChannel(channels, 'finding', true);
    expect(channels).toEqual(['current', 'fluid-direction', 'temperature', 'finding']);

    const state = createOperatingState({
      id: 'state-hot',
      name: 'Run Hot / Fan On',
      description: 'Static hot-running evidence review.'
    });
    const potential = knownBinding({
      id: 'binding-potential',
      subjectId: 'wire-supply',
      systemId: 'system-electrical',
      channel: 'potential',
      referenceSubjectId: 'load',
      pathConnectionIds: ['wire-supply'],
      evidenceIds: ['evidence-electrical'],
      assumptions: ['steady source'],
      omissions: ['load current'],
      uncertainty: '±0.1 V'
    });
    const direction = knownBinding({
      id: 'binding-flow',
      subjectId: 'hose-feed',
      systemId: 'system-coolant',
      channel: 'fluid-direction',
      value: null,
      unit: null,
      direction: 'forward',
      behavior: {
        id: 'behavior-passage',
        componentId: 'source',
        description: 'Explicit source-to-load passage',
        provenance: 'fixture behavior'
      }
    });
    const temperature = knownBinding({
      id: 'binding-temperature',
      subjectId: 'hose-feed',
      systemId: 'system-coolant',
      channel: 'temperature',
      value: '88',
      unit: 'degC',
      pathConnectionIds: ['hose-feed'],
      evidenceIds: ['evidence-temperature']
    });
    const snapshot = overlayProject([{ ...state, bindings: [potential, direction, temperature] }]);

    const overlay = evaluateOperatingStateOverlay(snapshot, 'state-hot', fingerprint);
    expect(overlay.status).toBe('current');
    expect(overlay.sourceRevision).toBe(17);
    expect(overlay.inputFingerprint).toBe(fingerprint);
    expect(overlay.marks.map((mark) => [mark.channel, mark.connectionId, mark.status])).toEqual([
      ['potential', 'wire-supply', 'available'],
      ['fluid-direction', 'hose-feed', 'available'],
      ['temperature', 'hose-feed', 'available']
    ]);
    expect(overlay.marks[0]!.label).toContain('relative to load');
    expect(overlay.marks[0]!.label).not.toMatch(/current/i);
    expect(overlay.marks[1]!.staticCue).toBe('→ forward');
    expect(overlay.marks[2]!.trace).toEqual(
      expect.objectContaining({
        physicalConnectionId: 'hose-feed',
        stateBindingId: 'binding-temperature',
        pathConnectionIds: ['hose-feed'],
        evidenceIds: ['evidence-temperature'],
        assumptions: [],
        omissions: [],
        applicability: 'reference fixture',
        uncertainty: null,
        conflicts: []
      })
    );
    expect(overlay.marks.filter((mark) => mark.channel === 'temperature')).toHaveLength(1);
  });

  it('does not infer zero flow from a pump-off command without an explicit Binding', () => {
    const state = {
      ...createOperatingState({
        id: 'state-pump-off',
        name: 'Pump off',
        description: 'Command-only fixture.'
      }),
      commands: [
        {
          id: 'statement-pump-off',
          subjectId: 'source',
          label: 'Pump command',
          value: 'off',
          unit: null,
          provenance: 'fixture command'
        }
      ]
    };
    expect(
      evaluateOperatingStateOverlay(overlayProject([state]), state.id, fingerprint).marks
    ).toEqual([]);
  });

  it('rekeys populated state contents when cloning', () => {
    const source = {
      ...createOperatingState({
        id: 'state-populated',
        name: 'Populated',
        description: 'Contains independent nested state data.'
      }),
      commands: [
        {
          id: 'statement-source',
          subjectId: 'source',
          label: 'Command',
          value: 'on',
          unit: null,
          provenance: 'fixture'
        }
      ],
      bindings: [
        knownBinding({
          id: 'binding-source',
          subjectId: 'hose-feed',
          systemId: 'system-coolant',
          channel: 'temperature',
          value: '88',
          unit: 'degC',
          evidenceIds: ['evidence-temperature'],
          behavior: {
            id: 'behavior-source',
            componentId: 'source',
            description: 'Nested behavior',
            provenance: 'fixture'
          }
        })
      ]
    };
    const cloned = applyProjectAction(overlayProject([source]), {
      type: 'clone-operating-state',
      causationId: 'clone-populated-state',
      stateId: source.id,
      cloneId: 'state-populated-copy',
      cloneName: 'Populated copy'
    });
    expect(cloned.accepted).toBe(true);
    if (!cloned.accepted) return;
    const copy = cloned.snapshot.operatingStates[1]!;
    expect(copy.commands[0]!.id).not.toBe(source.commands[0]!.id);
    expect(copy.bindings[0]!.id).not.toBe(source.bindings[0]!.id);
    expect(copy.bindings[0]!.behavior?.id).not.toBe(source.bindings[0]!.behavior?.id);
  });

  it('propagates stale status into retained Overlay and channel details', () => {
    const state = createOperatingState({
      id: 'state-stale',
      name: 'Stale state',
      description: 'Retained overlay fixture.'
    });
    const snapshot = overlayProject([
      {
        ...state,
        bindings: [
          knownBinding({
            id: 'binding-stale-temperature',
            subjectId: 'hose-feed',
            systemId: 'system-coolant',
            channel: 'temperature',
            value: '88',
            unit: 'degC',
            evidenceIds: ['evidence-temperature']
          })
        ]
      }
    ]);
    const withOverlay: ProjectSnapshot = {
      ...snapshot,
      results: [
        {
          id: 'result-overlay-stale',
          sourceRevision: snapshot.revision,
          status: 'current',
          kind: 'overlay',
          detail: {
            type: 'overlay',
            overlay: evaluateOperatingStateOverlay(snapshot, state.id, fingerprint)
          }
        }
      ]
    };
    const failed = applyProjectAction(withOverlay, {
      type: 'publish-evaluation',
      causationId: 'failed-overlay-replacement',
      sourceRevision: withOverlay.revision,
      results: [
        {
          id: 'result-evaluation-summary',
          sourceRevision: withOverlay.revision,
          status: 'failed',
          kind: 'evaluation-summary',
          detail: null
        }
      ]
    });
    expect(failed.accepted).toBe(true);
    if (!failed.accepted) return;
    expect(failed.snapshot.results[0]).toMatchObject({
      status: 'stale',
      detail: {
        type: 'overlay',
        overlay: {
          status: 'stale',
          systems: [{ channels: [{ evaluationStatus: 'stale' }] }]
        }
      }
    });
  });

  it('classifies State Compare differences without causality', () => {
    const cold = createOperatingState({
      id: 'state-cold',
      name: 'Run Cold',
      description: 'Cold running state.'
    });
    const hot = createOperatingState({
      id: 'state-hot',
      name: 'Run Hot / Fan On',
      description: 'Hot running state.'
    });
    const coldDirection = knownBinding({
      id: 'binding-cold-flow',
      subjectId: 'hose-feed',
      systemId: 'system-coolant',
      channel: 'fluid-direction',
      evidenceState: 'unknown',
      value: null,
      unit: null,
      direction: 'unknown',
      provenance: []
    });
    const hotDirection = knownBinding({
      id: 'binding-hot-flow',
      subjectId: 'hose-feed',
      systemId: 'system-coolant',
      channel: 'fluid-direction',
      value: null,
      unit: null,
      direction: 'forward',
      behavior: {
        id: 'behavior-hot-flow',
        componentId: 'source',
        description: 'Explicit hot-running passage',
        provenance: 'fixture behavior'
      }
    });
    const snapshot = overlayProject([
      { ...cold, bindings: [coldDirection] },
      { ...hot, bindings: [hotDirection] }
    ]);
    const differences = compareOperatingStateOverlays(
      evaluateOperatingStateOverlay(snapshot, 'state-cold', fingerprint),
      evaluateOperatingStateOverlay(snapshot, 'state-hot', fingerprint)
    );

    expect(differences).toEqual([
      expect.objectContaining({
        connectionId: 'hose-feed',
        channel: 'fluid-direction',
        classification: 'status-changed'
      })
    ]);
    expect(differences[0]).not.toHaveProperty('cause');
  });
});
