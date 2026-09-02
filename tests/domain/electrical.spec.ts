import { describe, expect, it } from 'vitest';

import { deriveCircuitNetIds, deriveElectricalNets } from '../../src/lib/electrical/electrical';
import { applyProjectAction } from '../../src/lib/project/apply-action';
import { createBlankProject } from '../../src/lib/project/project';
import {
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from '../../src/lib/persistence/project-document';

import type { ProjectAction } from '../../src/lib/project/action';
import type { ProjectSnapshot } from '../../src/lib/project/project';

function accept(snapshot: ProjectSnapshot, action: ProjectAction): ProjectSnapshot {
  const outcome = applyProjectAction(snapshot, action);
  expect(outcome.accepted).toBe(true);
  if (!outcome.accepted) throw new Error(outcome.rejection.message);
  return outcome.snapshot;
}

describe('MVP-ELEC-001 MVP-ELEC-002 MVP-ELEC-003 MVP-ELEC-006 electrical authoring', () => {
  it('keeps source, protection, load, return, and Grounds explicit while deriving Nets', () => {
    let snapshot = createBlankProject({
      id: 'project-aux-cooling',
      name: 'Auxiliary cooling',
      createdAt: '2026-09-01T00:00:00Z'
    });
    snapshot = accept(snapshot, {
      type: 'add-system',
      causationId: 'cause-system',
      system: {
        id: 'system-cooling-power',
        label: 'Auxiliary cooling power',
        domain: 'electrical',
        mediumId: null
      }
    });

    const components = [
      {
        role: 'source' as const,
        component: {
          id: 'component-battery',
          label: 'Battery source',
          kind: 'part' as const,
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: '0', y: '0' },
          ports: [
            {
              id: 'battery-positive',
              componentId: 'component-battery',
              label: 'Positive',
              domain: 'electrical' as const,
              mediumId: null,
              interfaceKey: null
            }
          ]
        }
      },
      {
        role: 'fuse' as const,
        component: {
          id: 'component-fuse',
          label: 'Cooling fuse',
          kind: 'part' as const,
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: '180', y: '0' },
          ports: [
            {
              id: 'fuse-line',
              componentId: 'component-fuse',
              label: 'Line',
              domain: 'electrical' as const,
              mediumId: null,
              interfaceKey: null
            },
            {
              id: 'fuse-load',
              componentId: 'component-fuse',
              label: 'Load',
              domain: 'electrical' as const,
              mediumId: null,
              interfaceKey: null
            }
          ]
        }
      },
      {
        role: 'load' as const,
        component: {
          id: 'component-fan',
          label: 'Cooling fan',
          kind: 'part' as const,
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: '360', y: '0' },
          ports: [
            {
              id: 'fan-power',
              componentId: 'component-fan',
              label: 'Power',
              domain: 'electrical' as const,
              mediumId: null,
              interfaceKey: null
            },
            {
              id: 'fan-return',
              componentId: 'component-fan',
              label: 'Return',
              domain: 'electrical' as const,
              mediumId: null,
              interfaceKey: null
            }
          ]
        }
      },
      ...['a', 'b'].map((suffix, index) => ({
        role: 'ground' as const,
        component: {
          id: `component-ground-${suffix}`,
          label: `Ground point ${suffix.toUpperCase()}`,
          kind: 'part' as const,
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: String(360 + index * 180), y: '180' },
          ports: [
            {
              id: `ground-${suffix}`,
              componentId: `component-ground-${suffix}`,
              label: 'Attachment',
              domain: 'electrical' as const,
              mediumId: null,
              interfaceKey: null
            }
          ]
        }
      }))
    ];
    for (const [index, value] of components.entries()) {
      snapshot = accept(snapshot, {
        type: 'add-electrical-component',
        causationId: `cause-component-${index}`,
        component: value.component,
        role: value.role
      });
    }

    const connections = [
      {
        id: 'wire-source',
        label: 'Source feed',
        sourcePortId: 'battery-positive',
        targetPortId: 'fuse-line'
      },
      {
        id: 'wire-positive',
        label: 'Protected fan feed',
        sourcePortId: 'fuse-load',
        targetPortId: 'fan-power'
      },
      {
        id: 'wire-return',
        label: 'Fan return',
        sourcePortId: 'fan-return',
        targetPortId: 'ground-a'
      }
    ];
    for (const connection of connections) {
      snapshot = accept(snapshot, {
        type: 'add-connection',
        causationId: `cause-${connection.id}`,
        connection: {
          ...connection,
          systemId: 'system-cooling-power',
          domain: 'electrical',
          mediumId: null,
          kind: 'electrical-wire',
          interfaceAssessment: 'unknown',
          routeId: null
        }
      });
    }

    for (const wire of [
      {
        connectionId: 'wire-source',
        partDefinitionId: null,
        role: 'power' as const,
        routeLength: null,
        cutLength: null,
        serviceAllowance: null,
        environment: 'engine bay',
        protocol: null
      },
      {
        connectionId: 'wire-positive',
        partDefinitionId: null,
        role: 'power' as const,
        routeLength: {
          decimal: '1.40',
          unit: 'm' as const,
          source: 'measured' as const,
          provenance: 'bench route measurement'
        },
        cutLength: {
          decimal: '1.55',
          unit: 'm' as const,
          source: 'entered' as const,
          provenance: 'builder entry'
        },
        serviceAllowance: {
          decimal: '0.15',
          unit: 'm' as const,
          source: 'entered' as const,
          provenance: 'builder entry'
        },
        environment: 'engine bay',
        protocol: null
      },
      {
        connectionId: 'wire-return',
        partDefinitionId: null,
        role: 'return' as const,
        routeLength: {
          decimal: '1.10',
          unit: 'm' as const,
          source: 'measured' as const,
          provenance: 'bench route measurement'
        },
        cutLength: {
          decimal: '1.22',
          unit: 'm' as const,
          source: 'sourced' as const,
          provenance: 'harness drawing A'
        },
        serviceAllowance: {
          decimal: '0.12',
          unit: 'm' as const,
          source: 'sourced' as const,
          provenance: 'harness drawing A'
        },
        environment: 'engine bay',
        protocol: null
      }
    ]) {
      snapshot = accept(snapshot, {
        type: 'configure-electrical-wire',
        causationId: `cause-configure-${wire.connectionId}`,
        wire
      });
    }

    snapshot = accept(snapshot, {
      type: 'add-electrical-circuit',
      causationId: 'cause-circuit',
      circuit: {
        id: 'circuit-cooling-fan',
        label: 'Cooling fan power',
        systemId: 'system-cooling-power',
        connectionIds: ['wire-source', 'wire-positive', 'wire-return'],
        componentIds: [
          'component-battery',
          'component-fuse',
          'component-fan',
          'component-ground-a'
        ],
        protectionComponentIds: ['component-fuse']
      }
    });

    const nets = deriveElectricalNets(snapshot.topology);
    expect(nets).toEqual([
      {
        id: 'electrical-net:system-cooling-power:battery-positive',
        systemId: 'system-cooling-power',
        portIds: ['battery-positive', 'fuse-line'],
        connectionIds: ['wire-source']
      },
      {
        id: 'electrical-net:system-cooling-power:fan-power',
        systemId: 'system-cooling-power',
        portIds: ['fan-power', 'fuse-load'],
        connectionIds: ['wire-positive']
      },
      {
        id: 'electrical-net:system-cooling-power:fan-return',
        systemId: 'system-cooling-power',
        portIds: ['fan-return', 'ground-a'],
        connectionIds: ['wire-return']
      },
      {
        id: 'electrical-net:unassigned:ground-b',
        systemId: null,
        portIds: ['ground-b'],
        connectionIds: []
      }
    ]);
    expect(deriveCircuitNetIds(snapshot.electrical.circuits[0]!, nets)).toEqual([
      'electrical-net:system-cooling-power:battery-positive',
      'electrical-net:system-cooling-power:fan-power',
      'electrical-net:system-cooling-power:fan-return'
    ]);
    expect(snapshot.electrical.components).toEqual([
      { componentId: 'component-battery', role: 'source' },
      { componentId: 'component-fuse', role: 'fuse' },
      { componentId: 'component-fan', role: 'load' },
      { componentId: 'component-ground-a', role: 'ground' },
      { componentId: 'component-ground-b', role: 'ground' }
    ]);
    expect(snapshot.electrical.wires).toMatchObject([
      { connectionId: 'wire-source', role: 'power' },
      {
        connectionId: 'wire-positive',
        role: 'power',
        routeLength: { decimal: '1.40' },
        cutLength: { decimal: '1.55', source: 'entered' }
      },
      {
        connectionId: 'wire-return',
        role: 'return',
        routeLength: { decimal: '1.10' },
        cutLength: { decimal: '1.22', source: 'sourced' }
      }
    ]);
  });
});

describe('MVP-ELEC-005 MVP-ELEC-007 MVP-ELEC-008 MVP-ELEC-009 MVP-ELEC-013 construction records', () => {
  it('bulk maps Connector cavities and preserves entered Harness and cable evidence', () => {
    let snapshot = createBlankProject({
      id: 'project-connector-harness',
      name: 'Connector harness',
      createdAt: '2026-09-01T00:00:00Z'
    });
    snapshot = accept(snapshot, {
      type: 'add-system',
      causationId: 'cause-system',
      system: {
        id: 'system-harness',
        label: 'Harness',
        domain: 'electrical',
        mediumId: null
      }
    });
    for (const definition of [
      { id: 'part-cable', label: 'TXL cable', revision: 1, provenance: 'supplier sheet' },
      { id: 'part-terminal', label: 'Terminal', revision: 1, provenance: 'supplier sheet' },
      { id: 'part-seal', label: 'Seal', revision: 1, provenance: 'supplier sheet' },
      { id: 'part-plug', label: 'Cavity plug', revision: 1, provenance: 'supplier sheet' },
      { id: 'part-covering', label: 'Sleeve', revision: 1, provenance: 'supplier sheet' }
    ]) {
      snapshot = accept(snapshot, {
        type: 'add-part-definition',
        causationId: `cause-${definition.id}`,
        definition
      });
    }

    const components = [
      {
        role: 'source' as const,
        component: {
          id: 'source',
          label: 'Source',
          kind: 'part' as const,
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: '0', y: '0' },
          ports: [
            {
              id: 'source-out',
              componentId: 'source',
              label: 'Output',
              domain: 'electrical' as const,
              mediumId: null,
              interfaceKey: null
            }
          ]
        }
      },
      ...['a', 'b'].map((suffix, index) => ({
        role: 'connector' as const,
        component: {
          id: `connector-${suffix}`,
          label: `Connector ${suffix.toUpperCase()}`,
          kind: 'part' as const,
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: String(160 + index * 160), y: '0' },
          ports: [1, 2].map((cavity) => ({
            id: `${suffix}-${cavity}`,
            componentId: `connector-${suffix}`,
            label: `Cavity ${cavity}`,
            domain: 'electrical' as const,
            mediumId: null,
            interfaceKey: null
          }))
        }
      })),
      {
        role: 'load' as const,
        component: {
          id: 'load',
          label: 'Load',
          kind: 'part' as const,
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: '480', y: '0' },
          ports: [
            {
              id: 'load-in',
              componentId: 'load',
              label: 'Input',
              domain: 'electrical' as const,
              mediumId: null,
              interfaceKey: null
            }
          ]
        }
      }
    ];
    for (const [index, value] of components.entries()) {
      snapshot = accept(snapshot, {
        type: 'add-electrical-component',
        causationId: `cause-component-${index}`,
        component: value.component,
        role: value.role
      });
    }

    for (const connection of [
      {
        id: 'wire-in',
        label: 'Source to connector',
        sourcePortId: 'source-out',
        targetPortId: 'a-1',
        kind: 'electrical-wire' as const
      },
      {
        id: 'mate-a-b',
        label: 'Connector mate',
        sourcePortId: 'a-1',
        targetPortId: 'b-1',
        kind: 'electrical-mate' as const
      },
      {
        id: 'wire-out',
        label: 'Connector to load',
        sourcePortId: 'b-1',
        targetPortId: 'load-in',
        kind: 'electrical-wire' as const
      }
    ]) {
      snapshot = accept(snapshot, {
        type: 'add-connection',
        causationId: `cause-${connection.id}`,
        connection: {
          ...connection,
          systemId: 'system-harness',
          domain: 'electrical',
          mediumId: null,
          interfaceAssessment: 'unknown',
          routeId: null
        }
      });
    }

    snapshot = accept(snapshot, {
      type: 'configure-electrical-connector',
      causationId: 'cause-connector-a',
      connector: {
        componentId: 'connector-a',
        cavities: [
          {
            portId: 'a-1',
            cavityName: 'A1',
            pinMapping: 'battery feed',
            mateConnectionId: 'mate-a-b',
            wireConnectionId: 'wire-in',
            terminalPartDefinitionId: 'part-terminal',
            sealPartDefinitionId: 'part-seal',
            plugPartDefinitionId: null,
            unusedRequirement: 'occupied'
          },
          {
            portId: 'a-2',
            cavityName: 'A2',
            pinMapping: null,
            mateConnectionId: null,
            wireConnectionId: null,
            terminalPartDefinitionId: null,
            sealPartDefinitionId: null,
            plugPartDefinitionId: 'part-plug',
            unusedRequirement: 'cavity-plug-required'
          }
        ]
      }
    });
    snapshot = accept(snapshot, {
      type: 'configure-electrical-connector',
      causationId: 'cause-connector-b',
      connector: {
        componentId: 'connector-b',
        cavities: [
          {
            portId: 'b-1',
            cavityName: 'B1',
            pinMapping: 'fan feed',
            mateConnectionId: 'mate-a-b',
            wireConnectionId: 'wire-out',
            terminalPartDefinitionId: 'part-terminal',
            sealPartDefinitionId: 'part-seal',
            plugPartDefinitionId: null,
            unusedRequirement: 'occupied'
          },
          {
            portId: 'b-2',
            cavityName: 'B2',
            pinMapping: null,
            mateConnectionId: null,
            wireConnectionId: null,
            terminalPartDefinitionId: null,
            sealPartDefinitionId: null,
            plugPartDefinitionId: null,
            unusedRequirement: 'seal-required'
          }
        ]
      }
    });

    const sharedSegment = {
      id: 'segment-shared',
      label: 'Shared sleeve',
      start: { x: '160', y: '0' },
      end: { x: '320', y: '0' }
    };
    snapshot = accept(snapshot, {
      type: 'set-connection-route',
      causationId: 'cause-route-in',
      connectionId: 'wire-in',
      route: { id: 'route-in', segmentIds: ['segment-in', 'segment-shared'] },
      newSegments: [
        {
          id: 'segment-in',
          label: 'Source lead',
          start: { x: '0', y: '0' },
          end: { x: '160', y: '0' }
        },
        sharedSegment
      ]
    });
    snapshot = accept(snapshot, {
      type: 'set-connection-route',
      causationId: 'cause-route-out',
      connectionId: 'wire-out',
      route: { id: 'route-out', segmentIds: ['segment-shared', 'segment-out'] },
      newSegments: [
        sharedSegment,
        {
          id: 'segment-out',
          label: 'Load lead',
          start: { x: '320', y: '0' },
          end: { x: '480', y: '0' }
        }
      ]
    });

    for (const [connectionId, role, protocol, routeLength] of [
      ['wire-in', 'power', null, '0.52'],
      ['wire-out', 'data', 'LIN metadata only', '0.44']
    ] as const) {
      snapshot = accept(snapshot, {
        type: 'configure-electrical-wire',
        causationId: `cause-configure-${connectionId}`,
        wire: {
          connectionId,
          partDefinitionId: 'part-cable',
          role,
          protocol,
          routeLength: {
            decimal: routeLength,
            unit: 'm',
            source: 'measured',
            provenance: 'fixture route measurement'
          },
          cutLength: {
            decimal: role === 'power' ? '0.60' : '0.51',
            unit: 'm',
            source: 'entered',
            provenance: 'builder entry'
          },
          serviceAllowance: {
            decimal: '0.08',
            unit: 'm',
            source: 'entered',
            provenance: 'builder entry'
          },
          environment: 'engine bay'
        }
      });
    }
    snapshot = accept(snapshot, {
      type: 'configure-electrical-harness',
      causationId: 'cause-harness',
      harness: {
        id: 'harness-cooling',
        label: 'Cooling harness',
        componentIds: ['connector-a', 'connector-b'],
        wireConnectionIds: ['wire-in', 'wire-out']
      }
    });
    snapshot = accept(snapshot, {
      type: 'configure-electrical-bundle',
      causationId: 'cause-bundle',
      bundle: {
        id: 'bundle-cooling',
        harnessId: 'harness-cooling',
        label: 'Cooling trunk',
        wireConnectionIds: ['wire-in', 'wire-out'],
        segmentIds: ['segment-shared'],
        transitions: [{ segmentId: 'segment-shared', kind: 'split' }],
        coverings: [
          {
            segmentId: 'segment-shared',
            description: 'Braided sleeve',
            partDefinitionId: 'part-covering'
          }
        ],
        twistedPairs: [
          {
            id: 'twist-cooling-control',
            wireConnectionIds: ['wire-in', 'wire-out'],
            shield: 'foil',
            drainWireConnectionId: null,
            cutLengthAllowance: {
              decimal: '0.04',
              unit: 'm',
              source: 'sourced',
              provenance: 'construction drawing'
            },
            notes: 'Maintain pair through trunk'
          }
        ],
        concentric: {
          layers: [
            { order: 1, wireConnectionIds: ['wire-in'] },
            { order: 2, wireConnectionIds: ['wire-out'] }
          ],
          pitch: {
            decimal: '45',
            unit: 'mm',
            source: 'sourced',
            provenance: 'construction drawing'
          },
          layDirection: 'right',
          cutLengthAllowance: {
            decimal: '0.03',
            unit: 'm',
            source: 'entered',
            provenance: 'builder entry'
          },
          notes: 'Two-layer concentric record'
        },
        notes: 'Split after shared sleeve'
      }
    });

    const unknown = {
      state: 'unknown' as const,
      value: null,
      unit: null,
      provenance: null,
      conflictValues: []
    };
    snapshot = accept(snapshot, {
      type: 'record-electrical-cable-specification',
      causationId: 'cause-cable',
      specification: {
        partDefinitionId: 'part-cable',
        conductorAreaOrGauge: {
          state: 'known',
          value: '18',
          unit: 'AWG',
          provenance: 'supplier sheet section 2',
          conflictValues: []
        },
        material: {
          state: 'known',
          value: 'copper',
          unit: null,
          provenance: 'supplier sheet section 2',
          conflictValues: []
        },
        strandConstruction: unknown,
        insulation: unknown,
        color: unknown,
        stripe: unknown,
        minimumTemperature: unknown,
        maximumTemperature: unknown,
        resistancePerLength: unknown,
        applicableCurrentData: unknown
      }
    });

    expect(
      snapshot.topology.connections.find((connection) => connection.id === 'mate-a-b')
    ).toMatchObject({
      sourcePortId: 'a-1',
      targetPortId: 'b-1',
      kind: 'electrical-mate'
    });
    expect(snapshot.electrical.connectors[0]?.cavities).toMatchObject([
      { cavityName: 'A1', wireConnectionId: 'wire-in', mateConnectionId: 'mate-a-b' },
      {
        cavityName: 'A2',
        unusedRequirement: 'cavity-plug-required',
        plugPartDefinitionId: 'part-plug'
      }
    ]);
    expect(snapshot.electrical.wires).toMatchObject([
      { connectionId: 'wire-in', partDefinitionId: 'part-cable', role: 'power' },
      { connectionId: 'wire-out', role: 'data', protocol: 'LIN metadata only' }
    ]);
    expect(snapshot.electrical.bundles[0]).toMatchObject({
      id: 'bundle-cooling',
      coverings: [{ segmentId: 'segment-shared', partDefinitionId: 'part-covering' }],
      twistedPairs: [
        {
          id: 'twist-cooling-control',
          shield: 'foil',
          cutLengthAllowance: { decimal: '0.04', source: 'sourced' }
        }
      ],
      concentric: {
        layDirection: 'right',
        cutLengthAllowance: { decimal: '0.03', source: 'entered' }
      }
    });
    expect(snapshot.electrical.bundles[0]).not.toHaveProperty('inferredLayConsumption');
    expect(snapshot.electrical.cableSpecifications[0]).toMatchObject({
      conductorAreaOrGauge: { state: 'known', value: '18', unit: 'AWG' },
      strandConstruction: { state: 'unknown', value: null }
    });
  });
});

describe('MVP-ELEC-004 electrical branch replacement', () => {
  it('previews and commits a Junction with two-ended replacement Wires and Route transfer', () => {
    let snapshot = createBlankProject({
      id: 'project-branch',
      name: 'Branch fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    snapshot = accept(snapshot, {
      type: 'add-system',
      causationId: 'cause-system',
      system: { id: 'system-power', label: 'Power', domain: 'electrical', mediumId: null }
    });
    for (const [index, value] of [
      ['source', 'Source', 'source-out', 'source'],
      ['load-main', 'Main load', 'main-in', 'load'],
      ['load-branch', 'Branch load', 'branch-in', 'load']
    ].entries()) {
      const [id, label, portId, role] = value as [string, string, string, 'source' | 'load'];
      snapshot = accept(snapshot, {
        type: 'add-electrical-component',
        causationId: `cause-component-${index}`,
        role,
        component: {
          id,
          label,
          kind: 'part',
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: String(index * 200), y: '0' },
          ports: [
            {
              id: portId,
              componentId: id,
              label: 'Terminal',
              domain: 'electrical',
              mediumId: null,
              interfaceKey: null
            }
          ]
        }
      });
    }
    snapshot = accept(snapshot, {
      type: 'add-connection',
      causationId: 'cause-wire',
      connection: {
        id: 'wire-main',
        label: 'Main feed',
        systemId: 'system-power',
        sourcePortId: 'source-out',
        targetPortId: 'main-in',
        domain: 'electrical',
        mediumId: null,
        kind: 'electrical-wire',
        interfaceAssessment: 'unknown',
        routeId: null
      }
    });
    snapshot = accept(snapshot, {
      type: 'set-connection-route',
      causationId: 'cause-route',
      connectionId: 'wire-main',
      route: { id: 'route-main', segmentIds: ['segment-main'] },
      newSegments: [
        {
          id: 'segment-main',
          label: 'Main route',
          start: { x: '0', y: '0' },
          end: { x: '200', y: '0' }
        }
      ]
    });
    snapshot = accept(snapshot, {
      type: 'configure-electrical-wire',
      causationId: 'cause-configure',
      wire: {
        connectionId: 'wire-main',
        partDefinitionId: null,
        role: 'power',
        protocol: null,
        routeLength: {
          decimal: '1.0',
          unit: 'm',
          source: 'measured',
          provenance: 'bench measurement'
        },
        cutLength: null,
        serviceAllowance: null,
        environment: 'engine bay'
      }
    });
    snapshot = accept(snapshot, {
      type: 'add-electrical-circuit',
      causationId: 'cause-circuit',
      circuit: {
        id: 'circuit-main',
        label: 'Main circuit',
        systemId: 'system-power',
        connectionIds: ['wire-main'],
        componentIds: ['source', 'load-main'],
        protectionComponentIds: []
      }
    });
    snapshot = accept(snapshot, {
      type: 'record-evidence',
      causationId: 'cause-evidence',
      evidence: {
        id: 'evidence-wire-main',
        subjectId: 'wire-main',
        label: 'Wire observation',
        state: 'known',
        value: 'installed',
        unit: null,
        provenance: 'fixture observation',
        conflictValues: []
      }
    });

    const branch = {
      type: 'insert-electrical-branch' as const,
      causationId: 'cause-branch',
      connectionId: 'wire-main',
      junction: {
        id: 'splice-main',
        label: 'Main splice',
        kind: 'junction' as const,
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '100', y: '0' },
        ports: [
          {
            id: 'splice-upstream',
            componentId: 'splice-main',
            label: 'Upstream',
            domain: 'electrical' as const,
            mediumId: null,
            interfaceKey: null
          },
          {
            id: 'splice-main-load',
            componentId: 'splice-main',
            label: 'Main load',
            domain: 'electrical' as const,
            mediumId: null,
            interfaceKey: null
          },
          {
            id: 'splice-branch-load',
            componentId: 'splice-main',
            label: 'Branch load',
            domain: 'electrical' as const,
            mediumId: null,
            interfaceKey: null
          }
        ]
      },
      role: 'splice' as const,
      replacementConnections: [
        {
          id: 'wire-upstream',
          label: 'Source to splice',
          systemId: 'system-power',
          sourcePortId: 'source-out',
          targetPortId: 'splice-upstream',
          domain: 'electrical' as const,
          mediumId: null,
          kind: 'electrical-wire' as const,
          interfaceAssessment: 'unknown' as const,
          routeId: null
        },
        {
          id: 'wire-main-load',
          label: 'Splice to main load',
          systemId: 'system-power',
          sourcePortId: 'splice-main-load',
          targetPortId: 'main-in',
          domain: 'electrical' as const,
          mediumId: null,
          kind: 'electrical-wire' as const,
          interfaceAssessment: 'unknown' as const,
          routeId: null
        },
        {
          id: 'wire-branch-load',
          label: 'Splice to branch load',
          systemId: 'system-power',
          sourcePortId: 'splice-branch-load',
          targetPortId: 'branch-in',
          domain: 'electrical' as const,
          mediumId: null,
          kind: 'electrical-wire' as const,
          interfaceAssessment: 'unknown' as const,
          routeId: null
        }
      ],
      replacementWires: ['wire-upstream', 'wire-main-load', 'wire-branch-load'].map(
        (connectionId) => ({
          connectionId,
          partDefinitionId: null,
          role: 'power' as const,
          protocol: null,
          routeLength: null,
          cutLength: null,
          serviceAllowance: null,
          environment: 'engine bay'
        })
      ),
      routeTransferConnectionId: 'wire-upstream',
      confirmedImpactSubjectIds: [] as string[]
    };
    const previewed = applyProjectAction(snapshot, branch);
    expect(previewed).toEqual({
      accepted: false,
      rejection: {
        code: 'confirmation-required',
        message: 'Electrical branch insertion requires confirmation of every affected subject',
        impact: {
          subjectIds: ['wire-main', 'circuit-main', 'route-main', 'evidence-wire-main'],
          replacementConnections: [
            { id: 'wire-upstream', label: 'Source to splice' },
            { id: 'wire-main-load', label: 'Splice to main load' },
            { id: 'wire-branch-load', label: 'Splice to branch load' }
          ],
          evidenceIds: ['evidence-wire-main'],
          routeTransfer: { routeId: 'route-main', connectionId: 'wire-upstream' }
        }
      }
    });
    if (previewed.accepted) throw new Error('Expected confirmation preview');

    const committed = applyProjectAction(snapshot, {
      ...branch,
      confirmedImpactSubjectIds: previewed.rejection.impact!.subjectIds
    });
    expect(committed.accepted).toBe(true);
    if (!committed.accepted) throw new Error(committed.rejection.message);
    expect(committed.snapshot.topology.connections).toMatchObject([
      { id: 'wire-upstream', routeId: 'route-main' },
      { id: 'wire-main-load', routeId: null },
      { id: 'wire-branch-load', routeId: null }
    ]);
    expect(committed.snapshot.electrical.circuits[0]).toMatchObject({
      connectionIds: ['wire-upstream', 'wire-main-load', 'wire-branch-load'],
      componentIds: ['source', 'load-main', 'splice-main', 'load-branch']
    });
    expect(committed.snapshot.electrical.components).toContainEqual({
      componentId: 'splice-main',
      role: 'splice'
    });
    expect(committed.snapshot.tombstones).toContainEqual({
      subjectId: 'wire-main',
      subjectKind: 'connection',
      successorId: 'wire-upstream'
    });
    expect(committed.snapshot.evidence).toContainEqual(
      expect.objectContaining({ id: 'evidence-wire-main', subjectId: 'wire-main' })
    );
    expect(
      committed.snapshot.topology.connections.every(
        (connection) => connection.sourcePortId !== connection.targetPortId
      )
    ).toBe(true);
  });
});

describe('persisted electrical aggregate validation', () => {
  it('rejects structurally valid documents whose electrical records reference absent topology', () => {
    const document = projectSnapshotToDocument(
      createBlankProject({
        id: 'project-invalid-electrical-document',
        name: 'Invalid electrical document',
        createdAt: '2026-09-01T00:00:00Z'
      })
    );

    expect(() =>
      projectDocumentToSnapshot({
        ...document,
        electrical: {
          ...document.electrical,
          components: [{ componentId: 'absent-component', role: 'source' }]
        }
      })
    ).toThrow(
      'Persisted Project electrical model is invalid: Electrical role references absent Component absent-component'
    );
  });
});
