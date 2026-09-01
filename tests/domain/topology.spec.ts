import { describe, expect, it } from 'vitest';

import { applyProjectAction } from '../../src/lib/project/apply-action';
import { createBlankProject } from '../../src/lib/project/project';

import type { ProjectAction } from '../../src/lib/project/action';
import type { ProjectSnapshot } from '../../src/lib/project/project';

function accept(snapshot: ProjectSnapshot, action: ProjectAction): ProjectSnapshot {
  const outcome = applyProjectAction(snapshot, action);
  expect(outcome.accepted).toBe(true);
  if (!outcome.accepted) throw new Error(outcome.rejection.message);
  return outcome.snapshot;
}

function component(input: {
  id: string;
  label: string;
  domain: 'electrical' | 'fluid';
  kind?: 'part' | 'junction';
  mediumId?: string | null;
}) {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind ?? ('part' as const),
    definitionId: null,
    predecessorId: null,
    successorId: null,
    position: { x: '0', y: '0' },
    ports: [
      {
        id: `${input.id}-port-a`,
        componentId: input.id,
        label: 'A',
        domain: input.domain,
        mediumId: input.mediumId ?? null,
        interfaceKey: null
      },
      {
        id: `${input.id}-port-b`,
        componentId: input.id,
        label: 'B',
        domain: input.domain,
        mediumId: input.mediumId ?? null,
        interfaceKey: null
      }
    ]
  } as const;
}

describe('MVP-MODEL-001 MVP-MODEL-002 MVP-MODEL-008 topology invariants', () => {
  it('owns one multi-medium Component across domain-homogeneous Systems', () => {
    let snapshot = createBlankProject({
      id: 'project-multi-medium',
      name: 'Multi-medium fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    for (const system of [
      {
        id: 'system-coolant',
        label: 'Coolant',
        domain: 'fluid' as const,
        mediumId: 'medium-coolant'
      },
      {
        id: 'system-oil',
        label: 'Oil',
        domain: 'fluid' as const,
        mediumId: 'medium-oil'
      }
    ]) {
      snapshot = accept(snapshot, {
        type: 'add-system',
        causationId: `cause-${system.id}`,
        system
      });
    }
    for (const value of [
      {
        id: 'component-heat-exchanger',
        label: 'Heat exchanger',
        kind: 'part' as const,
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '0', y: '0' },
        ports: [
          {
            id: 'cooler-coolant',
            componentId: 'component-heat-exchanger',
            label: 'Coolant',
            domain: 'fluid' as const,
            mediumId: 'medium-coolant',
            interfaceKey: null
          },
          {
            id: 'cooler-oil',
            componentId: 'component-heat-exchanger',
            label: 'Oil',
            domain: 'fluid' as const,
            mediumId: 'medium-oil',
            interfaceKey: null
          }
        ]
      },
      {
        id: 'component-radiator',
        label: 'Radiator',
        kind: 'part' as const,
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '0', y: '0' },
        ports: [
          {
            id: 'radiator-coolant',
            componentId: 'component-radiator',
            label: 'Coolant',
            domain: 'fluid' as const,
            mediumId: 'medium-coolant',
            interfaceKey: null
          }
        ]
      },
      {
        id: 'component-engine',
        label: 'Engine',
        kind: 'part' as const,
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '0', y: '0' },
        ports: [
          {
            id: 'engine-oil',
            componentId: 'component-engine',
            label: 'Oil',
            domain: 'fluid' as const,
            mediumId: 'medium-oil',
            interfaceKey: null
          }
        ]
      }
    ]) {
      snapshot = accept(snapshot, {
        type: 'add-component',
        causationId: `cause-${value.id}`,
        component: value
      });
    }
    for (const connection of [
      {
        id: 'connection-coolant',
        label: 'Coolant path',
        systemId: 'system-coolant',
        sourcePortId: 'radiator-coolant',
        targetPortId: 'cooler-coolant',
        domain: 'fluid' as const,
        mediumId: 'medium-coolant',
        kind: 'fluid-hose' as const,
        interfaceAssessment: 'unknown' as const,
        routeId: null
      },
      {
        id: 'connection-oil',
        label: 'Oil path',
        systemId: 'system-oil',
        sourcePortId: 'engine-oil',
        targetPortId: 'cooler-oil',
        domain: 'fluid' as const,
        mediumId: 'medium-oil',
        kind: 'fluid-hose' as const,
        interfaceAssessment: 'unknown' as const,
        routeId: null
      }
    ]) {
      snapshot = accept(snapshot, {
        type: 'add-connection',
        causationId: `cause-${connection.id}`,
        connection
      });
    }

    expect(snapshot.topology.components).toHaveLength(3);
    expect(snapshot.topology.connections.map((connection) => connection.systemId)).toEqual([
      'system-coolant',
      'system-oil'
    ]);
  });

  it('accepts evidenced same-domain intent and rejects impossible domain or medium mutations', () => {
    const initial = createBlankProject({
      id: 'project-topology',
      name: 'Topology fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    let snapshot = accept(initial, {
      type: 'add-system',
      causationId: 'cause-system-electrical',
      system: {
        id: 'system-electrical',
        label: 'Auxiliary power',
        domain: 'electrical',
        mediumId: null
      }
    });
    snapshot = accept(snapshot, {
      type: 'add-system',
      causationId: 'cause-system-coolant',
      system: {
        id: 'system-coolant',
        label: 'Coolant',
        domain: 'fluid',
        mediumId: 'medium-coolant'
      }
    });
    snapshot = accept(snapshot, {
      type: 'add-component',
      causationId: 'cause-source',
      component: component({ id: 'component-source', label: 'Source', domain: 'electrical' })
    });
    snapshot = accept(snapshot, {
      type: 'add-component',
      causationId: 'cause-load',
      component: component({ id: 'component-load', label: 'Load', domain: 'electrical' })
    });
    snapshot = accept(snapshot, {
      type: 'add-component',
      causationId: 'cause-radiator',
      component: component({
        id: 'component-radiator',
        label: 'Radiator',
        domain: 'fluid',
        mediumId: 'medium-coolant'
      })
    });

    const unknownInterface = applyProjectAction(snapshot, {
      type: 'add-connection',
      causationId: 'cause-wire',
      connection: {
        id: 'connection-wire',
        label: 'Power feed',
        systemId: 'system-electrical',
        sourcePortId: 'component-source-port-a',
        targetPortId: 'component-load-port-a',
        domain: 'electrical',
        mediumId: null,
        kind: 'electrical-wire',
        interfaceAssessment: 'unknown',
        routeId: null
      }
    });
    expect(unknownInterface).toMatchObject({
      accepted: true,
      changedSubjects: ['connection-wire'],
      undoLabel: 'Add Power feed'
    });
    if (!unknownInterface.accepted) throw new Error(unknownInterface.rejection.message);
    expect(snapshot.topology.connections).toEqual([]);
    snapshot = unknownInterface.snapshot;

    const crossDomain = applyProjectAction(snapshot, {
      type: 'add-connection',
      causationId: 'cause-invalid-domain',
      connection: {
        id: 'connection-invalid-domain',
        label: 'Impossible path',
        systemId: 'system-electrical',
        sourcePortId: 'component-source-port-b',
        targetPortId: 'component-radiator-port-a',
        domain: 'electrical',
        mediumId: null,
        kind: 'electrical-wire',
        interfaceAssessment: 'compatible',
        routeId: null
      }
    });
    expect(crossDomain).toMatchObject({
      accepted: false,
      rejection: { code: 'domain-mismatch' }
    });
    expect(crossDomain).not.toHaveProperty('snapshot');

    snapshot = accept(snapshot, {
      type: 'add-component',
      causationId: 'cause-oil-cooler',
      component: component({
        id: 'component-oil-cooler',
        label: 'Oil cooler',
        domain: 'fluid',
        mediumId: 'medium-oil'
      })
    });
    const crossMedium = applyProjectAction(snapshot, {
      type: 'add-connection',
      causationId: 'cause-invalid-medium',
      connection: {
        id: 'connection-invalid-medium',
        label: 'Mixed fluid',
        systemId: 'system-coolant',
        sourcePortId: 'component-radiator-port-a',
        targetPortId: 'component-oil-cooler-port-a',
        domain: 'fluid',
        mediumId: 'medium-coolant',
        kind: 'fluid-hose',
        interfaceAssessment: 'incompatible',
        routeId: null
      }
    });
    expect(crossMedium).toMatchObject({
      accepted: false,
      rejection: { code: 'medium-mismatch' }
    });
  });

  it('requires an explicit Junction instead of connecting a third endpoint to one Port', () => {
    let snapshot = createBlankProject({
      id: 'project-branch',
      name: 'Branch fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    snapshot = accept(snapshot, {
      type: 'add-system',
      causationId: 'cause-system',
      system: {
        id: 'system-power',
        label: 'Power',
        domain: 'electrical',
        mediumId: null
      }
    });
    for (const value of [
      component({ id: 'component-source', label: 'Source', domain: 'electrical' }),
      component({ id: 'component-load-a', label: 'Load', domain: 'electrical' }),
      component({ id: 'component-load-b', label: 'Load', domain: 'electrical' })
    ]) {
      snapshot = accept(snapshot, {
        type: 'add-component',
        causationId: `cause-${value.id}`,
        component: value
      });
    }
    snapshot = accept(snapshot, {
      type: 'add-connection',
      causationId: 'cause-first-wire',
      connection: {
        id: 'connection-first',
        label: 'First branch',
        systemId: 'system-power',
        sourcePortId: 'component-source-port-a',
        targetPortId: 'component-load-a-port-a',
        domain: 'electrical',
        mediumId: null,
        kind: 'electrical-wire',
        interfaceAssessment: 'compatible',
        routeId: null
      }
    });

    expect(
      applyProjectAction(snapshot, {
        type: 'add-connection',
        causationId: 'cause-illegal-branch',
        connection: {
          id: 'connection-illegal',
          label: 'Implicit third endpoint',
          systemId: 'system-power',
          sourcePortId: 'component-source-port-a',
          targetPortId: 'component-load-b-port-a',
          domain: 'electrical',
          mediumId: null,
          kind: 'electrical-wire',
          interfaceAssessment: 'compatible',
          routeId: null
        }
      })
    ).toMatchObject({ accepted: false, rejection: { code: 'port-already-connected' } });

    snapshot = accept(snapshot, {
      type: 'add-component',
      causationId: 'cause-junction',
      component: component({
        id: 'component-junction',
        label: 'Splice',
        domain: 'electrical',
        kind: 'junction'
      })
    });
    expect(snapshot.topology.components.at(-1)?.kind).toBe('junction');
  });
});

describe('MVP-MODEL-003 MVP-MODEL-006 topology projection identity', () => {
  it('allows duplicate labels and changes Route geometry without changing connectivity', () => {
    let snapshot = createBlankProject({
      id: 'project-route',
      name: 'Route fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    snapshot = accept(snapshot, {
      type: 'add-system',
      causationId: 'cause-system',
      system: {
        id: 'system-route',
        label: 'Harness',
        domain: 'electrical',
        mediumId: null
      }
    });
    for (const value of [
      component({ id: 'component-a', label: 'Connector', domain: 'electrical' }),
      component({ id: 'component-b', label: 'Connector', domain: 'electrical' })
    ]) {
      snapshot = accept(snapshot, {
        type: 'add-component',
        causationId: `cause-${value.id}`,
        component: value
      });
    }
    snapshot = accept(snapshot, {
      type: 'add-connection',
      causationId: 'cause-connection',
      connection: {
        id: 'connection-route',
        label: 'Feed',
        systemId: 'system-route',
        sourcePortId: 'component-a-port-a',
        targetPortId: 'component-b-port-a',
        domain: 'electrical',
        mediumId: null,
        kind: 'electrical-wire',
        interfaceAssessment: 'compatible',
        routeId: null
      }
    });
    const endpoints = snapshot.topology.connections[0];

    snapshot = accept(snapshot, {
      type: 'set-connection-route',
      causationId: 'cause-route',
      connectionId: 'connection-route',
      route: { id: 'route-feed', segmentIds: ['segment-shared'] },
      newSegments: [
        {
          id: 'segment-shared',
          label: 'Firewall path',
          start: { x: '10', y: '20' },
          end: { x: '30', y: '40' }
        }
      ]
    });

    expect(snapshot.topology.components.map((value) => value.label)).toEqual([
      'Connector',
      'Connector'
    ]);
    expect(snapshot.topology.connections[0]).toMatchObject({
      id: endpoints?.id,
      sourcePortId: endpoints?.sourcePortId,
      targetPortId: endpoints?.targetPortId,
      routeId: 'route-feed'
    });
    expect(snapshot.topology.routes).toEqual([
      { id: 'route-feed', segmentIds: ['segment-shared'] }
    ]);
  });
});
