import { describe, expect, it } from 'vitest';

import {
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from '../../src/lib/persistence/project-document';
import { applyProjectAction } from '../../src/lib/project/apply-action';
import { createBlankProject } from '../../src/lib/project/project';
import { createOperatingState } from '../../src/lib/operating-state/operating-state';

import type { ProjectAction } from '../../src/lib/project/action';
import type { ProjectSnapshot } from '../../src/lib/project/project';
import type { Component, Port } from '../../src/lib/topology/topology';

function accept(snapshot: ProjectSnapshot, action: ProjectAction): ProjectSnapshot {
  const outcome = applyProjectAction(snapshot, action);
  expect(outcome.accepted).toBe(true);
  if (!outcome.accepted) throw new Error(outcome.rejection.message);
  return outcome.snapshot;
}

function fluidPort(componentId: string, id: string, label: string, mediumId: string): Port {
  return {
    id,
    componentId,
    label,
    domain: 'fluid',
    mediumId,
    interfaceKey: null
  };
}

function component(
  id: string,
  label: string,
  ports: readonly Port[],
  kind: Component['kind'] = 'part'
): Component {
  return {
    id,
    label,
    kind,
    definitionId: null,
    predecessorId: null,
    successorId: null,
    position: { x: '0', y: '0' },
    ports
  };
}

describe('MVP-FLUID-001 MVP-FLUID-003 MVP-FLUID-005 fluid systems and behaviors', () => {
  it('keeps media, purposes, multi-medium Ports, behaviors, and boundaries explicit', () => {
    let snapshot = createBlankProject({
      id: 'project-fluid',
      name: 'Fluid construction',
      createdAt: '2026-09-01T00:00:00Z'
    });

    const missingPurpose = applyProjectAction(snapshot, {
      type: 'add-system',
      causationId: 'cause-incomplete-fluid-system',
      system: {
        id: 'system-incomplete',
        label: 'Unspecified fluid work',
        domain: 'fluid',
        mediumId: 'medium-unspecified'
      }
    });
    expect(missingPurpose).toEqual({
      accepted: false,
      rejection: {
        code: 'invalid-fluid-reference',
        message: 'Fluid System system-incomplete needs one identified Medium and purpose'
      }
    });

    for (const fluidSystem of [
      {
        system: {
          id: 'system-coolant',
          label: 'Engine coolant',
          domain: 'fluid' as const,
          mediumId: 'medium-coolant'
        },
        medium: {
          id: 'medium-coolant',
          label: '50/50 coolant',
          composition: 'ethylene glycol and water, 50/50 by volume',
          provenance: 'builder entry'
        },
        purpose: 'engine heat transport'
      },
      {
        system: {
          id: 'system-oil',
          label: 'Thermostatic engine oil',
          domain: 'fluid' as const,
          mediumId: 'medium-oil'
        },
        medium: {
          id: 'medium-oil',
          label: 'Engine oil',
          composition: 'SAE 10W-40',
          provenance: 'builder entry'
        },
        purpose: 'external oil cooling'
      },
      {
        system: {
          id: 'system-fuel',
          label: 'Return fuel',
          domain: 'fluid' as const,
          mediumId: 'medium-fuel'
        },
        medium: {
          id: 'medium-fuel',
          label: 'Pump gasoline',
          composition: 'unverified local pump fuel',
          provenance: 'builder entry'
        },
        purpose: 'return-style delivery topology'
      }
    ]) {
      snapshot = accept(snapshot, {
        type: 'add-fluid-system',
        causationId: `cause-${fluidSystem.system.id}`,
        ...fluidSystem
      });
    }

    const cooler = component('component-cooler', 'Oil-to-coolant heat exchanger', [
      fluidPort('component-cooler', 'cooler-coolant-in', 'Coolant inlet', 'medium-coolant'),
      fluidPort('component-cooler', 'cooler-coolant-out', 'Coolant outlet', 'medium-coolant'),
      fluidPort('component-cooler', 'cooler-oil-in', 'Oil inlet', 'medium-oil'),
      fluidPort('component-cooler', 'cooler-oil-out', 'Oil outlet', 'medium-oil')
    ]);
    snapshot = accept(snapshot, {
      type: 'add-fluid-component',
      causationId: 'cause-cooler',
      component: cooler,
      role: 'heat-exchanger'
    });
    snapshot = accept(snapshot, {
      type: 'add-fluid-component',
      causationId: 'cause-oil-endpoint',
      component: component('component-oil-endpoint', 'Oil endpoint', [
        fluidPort('component-oil-endpoint', 'oil-endpoint-port', 'Oil', 'medium-oil')
      ]),
      role: 'endpoint'
    });
    snapshot = accept(snapshot, {
      type: 'configure-fluid-behavior',
      causationId: 'cause-cooler-behavior',
      behavior: {
        id: 'behavior-cooler',
        componentId: 'component-cooler',
        role: 'heat-exchanger',
        portIds: ['cooler-coolant-in', 'cooler-coolant-out', 'cooler-oil-in', 'cooler-oil-out'],
        mediumIds: ['medium-coolant', 'medium-oil'],
        description: 'Two independent wetted passages with cross-domain heat transfer evidence',
        provenance: 'builder entry'
      }
    });
    snapshot = accept(snapshot, {
      type: 'add-operating-state',
      causationId: 'cause-state',
      state: createOperatingState({
        id: 'state-warm-idle',
        name: 'Warm idle',
        description: 'Engine warm at idle'
      })
    });
    snapshot = accept(snapshot, {
      type: 'record-fluid-boundary-condition',
      causationId: 'cause-boundary',
      boundary: {
        id: 'boundary-coolant-inlet',
        behaviorId: 'behavior-cooler',
        subjectId: 'cooler-coolant-in',
        operatingStateId: 'state-warm-idle',
        quantity: 'temperature',
        value: '88',
        unit: 'degC',
        source: 'measured',
        provenance: 'thermocouple T1'
      }
    });

    expect(snapshot.fluid.systems).toEqual([
      {
        systemId: 'system-coolant',
        mediumId: 'medium-coolant',
        purpose: 'engine heat transport'
      },
      {
        systemId: 'system-oil',
        mediumId: 'medium-oil',
        purpose: 'external oil cooling'
      },
      {
        systemId: 'system-fuel',
        mediumId: 'medium-fuel',
        purpose: 'return-style delivery topology'
      }
    ]);
    expect(snapshot.fluid.behaviors).toEqual([
      {
        id: 'behavior-cooler',
        componentId: 'component-cooler',
        role: 'heat-exchanger',
        portIds: ['cooler-coolant-in', 'cooler-coolant-out', 'cooler-oil-in', 'cooler-oil-out'],
        mediumIds: ['medium-coolant', 'medium-oil'],
        description: 'Two independent wetted passages with cross-domain heat transfer evidence',
        provenance: 'builder entry'
      }
    ]);
    expect(snapshot.fluid.boundaryConditions).toEqual([
      {
        id: 'boundary-coolant-inlet',
        behaviorId: 'behavior-cooler',
        subjectId: 'cooler-coolant-in',
        operatingStateId: 'state-warm-idle',
        quantity: 'temperature',
        value: '88',
        unit: 'degC',
        source: 'measured',
        provenance: 'thermocouple T1'
      }
    ]);

    const mismatchedBehaviorMedium = applyProjectAction(snapshot, {
      type: 'configure-fluid-behavior',
      causationId: 'cause-invalid-behavior-medium',
      behavior: {
        id: 'behavior-invalid-medium',
        componentId: 'component-cooler',
        role: 'passage',
        portIds: ['cooler-coolant-in', 'cooler-coolant-out'],
        mediumIds: ['medium-oil'],
        description: 'Invalid oil behavior over coolant Ports',
        provenance: 'builder entry'
      }
    });
    expect(mismatchedBehaviorMedium).toEqual({
      accepted: false,
      rejection: {
        code: 'invalid-fluid-reference',
        message: 'Component Behavior behavior-invalid-medium has invalid fluid references'
      }
    });

    snapshot = accept(snapshot, {
      type: 'record-fluid-boundary-condition',
      causationId: 'cause-behavior-boundary',
      boundary: {
        id: 'boundary-cooler-operating-point',
        behaviorId: 'behavior-cooler',
        subjectId: 'behavior-cooler',
        operatingStateId: 'state-warm-idle',
        quantity: 'operating-point',
        value: 'idle heat exchange',
        unit: 'named point',
        source: 'assumed',
        provenance: 'builder assumption'
      }
    });
    expect(snapshot.fluid.boundaryConditions.at(-1)).toEqual({
      id: 'boundary-cooler-operating-point',
      behaviorId: 'behavior-cooler',
      subjectId: 'behavior-cooler',
      operatingStateId: 'state-warm-idle',
      quantity: 'operating-point',
      value: 'idle heat exchange',
      unit: 'named point',
      source: 'assumed',
      provenance: 'builder assumption'
    });

    const crossed = applyProjectAction(snapshot, {
      type: 'add-connection',
      causationId: 'cause-cross-medium',
      connection: {
        id: 'line-cross-medium',
        label: 'Invalid cross-medium passage',
        systemId: 'system-coolant',
        sourcePortId: 'cooler-coolant-out',
        targetPortId: 'oil-endpoint-port',
        domain: 'fluid',
        mediumId: 'medium-coolant',
        kind: 'fluid-hose',
        interfaceAssessment: 'unknown',
        routeId: null
      }
    });
    expect(crossed).toEqual({
      accepted: false,
      rejection: {
        code: 'medium-mismatch',
        message: 'Connection line-cross-medium crosses Fluid Media'
      }
    });
  });
});

describe('MVP-MODEL-007 MVP-FLUID-002 MVP-FLUID-004 fluid lines and routes', () => {
  it('uses explicit fitting topology and distinct hose/tube length evidence on shared Segments', () => {
    let snapshot = createBlankProject({
      id: 'project-coolant-line',
      name: 'Coolant line construction',
      createdAt: '2026-09-01T00:00:00Z'
    });
    snapshot = accept(snapshot, {
      type: 'add-fluid-system',
      causationId: 'cause-coolant',
      system: {
        id: 'system-coolant',
        label: 'Engine coolant',
        domain: 'fluid',
        mediumId: 'medium-coolant'
      },
      medium: {
        id: 'medium-coolant',
        label: '50/50 coolant',
        composition: 'ethylene glycol and water',
        provenance: 'builder entry'
      },
      purpose: 'engine heat transport'
    });

    for (const [role, value] of [
      [
        'endpoint',
        component('component-radiator', 'Radiator', [
          fluidPort('component-radiator', 'radiator-out', 'Outlet', 'medium-coolant')
        ])
      ],
      [
        'fitting',
        component('component-transition', 'Hose-to-tube union', [
          fluidPort('component-transition', 'transition-hose', 'Hose side', 'medium-coolant'),
          fluidPort('component-transition', 'transition-tube', 'Tube side', 'medium-coolant')
        ])
      ],
      [
        'pump',
        component('component-pump', 'Water pump', [
          fluidPort('component-pump', 'pump-in', 'Inlet', 'medium-coolant')
        ])
      ]
    ] as const) {
      snapshot = accept(snapshot, {
        type: 'add-fluid-component',
        causationId: `cause-${value.id}`,
        component: value,
        role
      });
    }

    for (const connection of [
      {
        id: 'line-hose',
        label: 'Radiator lower hose',
        sourcePortId: 'radiator-out',
        targetPortId: 'transition-hose',
        kind: 'fluid-hose' as const
      },
      {
        id: 'line-tube',
        label: 'Pump inlet tube',
        sourcePortId: 'transition-tube',
        targetPortId: 'pump-in',
        kind: 'fluid-tube' as const
      }
    ]) {
      snapshot = accept(snapshot, {
        type: 'add-connection',
        causationId: `cause-${connection.id}`,
        connection: {
          ...connection,
          systemId: 'system-coolant',
          domain: 'fluid',
          mediumId: 'medium-coolant',
          interfaceAssessment: 'unknown',
          routeId: null
        }
      });
    }

    snapshot = accept(snapshot, {
      type: 'set-connection-route',
      causationId: 'cause-route-hose',
      connectionId: 'line-hose',
      route: { id: 'route-hose', segmentIds: ['segment-shared', 'segment-hose'] },
      newSegments: [
        {
          id: 'segment-shared',
          label: 'Shared tunnel',
          start: { x: '0', y: '0' },
          end: { x: '500', y: '0' }
        },
        {
          id: 'segment-hose',
          label: 'Hose approach',
          start: { x: '500', y: '0' },
          end: { x: '700', y: '100' }
        }
      ]
    });
    snapshot = accept(snapshot, {
      type: 'set-connection-route',
      causationId: 'cause-route-tube',
      connectionId: 'line-tube',
      route: { id: 'route-tube', segmentIds: ['segment-shared', 'segment-tube'] },
      newSegments: [
        {
          id: 'segment-tube',
          label: 'Tube approach',
          start: { x: '500', y: '0' },
          end: { x: '900', y: '0' }
        }
      ]
    });

    const length = (
      decimal: string,
      source: 'estimated' | 'measured' | 'entered' | 'sourced',
      provenance: string
    ) => ({ decimal, unit: 'mm' as const, source, provenance });
    snapshot = accept(snapshot, {
      type: 'configure-fluid-line',
      causationId: 'cause-configure-hose',
      line: {
        connectionId: 'line-hose',
        partDefinitionId: null,
        construction: {
          kind: 'hose',
          reinforcement: 'textile braid',
          minimumBendRadius: length('90', 'sourced', 'hose datasheet')
        },
        routeLength: length('730', 'estimated', 'canvas route'),
        hydraulicLength: length('750', 'measured', 'wetted centerline measurement'),
        cutLength: length('790', 'entered', 'builder cut entry'),
        elevation: {
          start: '120',
          end: '80',
          unit: 'mm',
          source: 'measured',
          provenance: 'vehicle datum survey'
        },
        environment: 'engine bay lower',
        provenance: 'builder entry'
      }
    });
    snapshot = accept(snapshot, {
      type: 'configure-fluid-line',
      causationId: 'cause-configure-tube',
      line: {
        connectionId: 'line-tube',
        partDefinitionId: null,
        construction: {
          kind: 'tube',
          material: 'aluminum',
          wallThickness: length('1.5', 'sourced', 'tube specification')
        },
        routeLength: length('900', 'estimated', 'canvas route'),
        hydraulicLength: length('910', 'entered', 'builder entry'),
        cutLength: length('940', 'entered', 'builder cut entry'),
        elevation: null,
        environment: 'engine bay lower',
        provenance: 'builder entry'
      }
    });

    expect(snapshot.fluid.lines.map((line) => [line.connectionId, line.construction.kind])).toEqual(
      [
        ['line-hose', 'hose'],
        ['line-tube', 'tube']
      ]
    );
    expect(snapshot.topology.routes).toEqual([
      { id: 'route-hose', segmentIds: ['segment-shared', 'segment-hose'] },
      { id: 'route-tube', segmentIds: ['segment-shared', 'segment-tube'] }
    ]);
    expect(snapshot.fluid.lines[0]).toMatchObject({
      routeLength: { decimal: '730', source: 'estimated' },
      hydraulicLength: { decimal: '750', source: 'measured' },
      cutLength: { decimal: '790', source: 'entered' },
      elevation: { start: '120', end: '80' }
    });

    const mismatched = applyProjectAction(snapshot, {
      type: 'configure-fluid-line',
      causationId: 'cause-invalid-construction',
      line: {
        ...snapshot.fluid.lines[0]!,
        construction: {
          kind: 'pipe',
          material: 'steel',
          schedule: '40'
        }
      }
    });
    expect(mismatched).toEqual({
      accepted: false,
      rejection: {
        code: 'invalid-fluid-record',
        message: 'Fluid Line line-hose construction pipe does not match fluid-hose'
      }
    });

    const corruptedDocument = structuredClone(projectSnapshotToDocument(snapshot));
    corruptedDocument.fluid.lines[0]!.construction = {
      kind: 'pipe',
      material: 'steel',
      schedule: '40'
    };
    expect(() => projectDocumentToSnapshot(corruptedDocument)).toThrow(
      'Persisted Project fluid model is invalid: Fluid Line line-hose construction pipe does not match fluid-hose'
    );
  });
});
