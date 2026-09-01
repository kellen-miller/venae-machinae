import type { ProjectDocument } from '../../src/lib/persistence/project-document';

export type CapacityScale = 1 | 2 | 5;

export const CAPACITY_COUNTS = Object.freeze({
  1: { components: 300, ports: 1500, connections: 1200 },
  2: { components: 600, ports: 3000, connections: 2400 },
  5: { components: 1500, ports: 7500, connections: 6000 }
} as const);

export function generateCapacityProject(scale: CapacityScale): ProjectDocument {
  const counts = CAPACITY_COUNTS[scale];
  const components = Array.from({ length: counts.components }, (_, componentIndex) => ({
    id: `component-${scale}x-${componentIndex}`,
    label: `Component ${componentIndex + 1}`,
    kind: componentIndex % 2 === 0 ? ('electrical' as const) : ('fluid' as const),
    x: String((componentIndex % 30) * 180),
    y: String(Math.floor(componentIndex / 30) * 120),
    ports: Array.from({ length: 5 }, (_, localPortIndex) => ({
      id: `port-${scale}x-${componentIndex * 5 + localPortIndex}`,
      label: `P${localPortIndex + 1}`,
      domain: componentIndex % 2 === 0 ? ('electrical' as const) : ('fluid' as const)
    }))
  }));
  const connectionKinds = ['electrical-wire', 'fluid-hose', 'fluid-tube', 'fluid-pipe'] as const;
  const connections = Array.from({ length: counts.connections }, (_, connectionIndex) => ({
    id: `connection-${scale}x-${connectionIndex}`,
    sourcePortId: `port-${scale}x-${connectionIndex}`,
    targetPortId: `port-${scale}x-${(connectionIndex + 1) % counts.ports}`,
    kind: connectionKinds[connectionIndex % connectionKinds.length] ?? 'electrical-wire',
    routePoints: [
      { x: String(connectionIndex % 100), y: String(Math.floor(connectionIndex / 100)) }
    ]
  }));

  return {
    schemaVersion: 1,
    project: {
      id: `capacity-project-${scale}x`,
      name: `Capacity ${scale}x`,
      revision: 1,
      updatedAt: '2026-09-01T00:00:00Z'
    },
    topology: { components, connections },
    engineeringValues: [],
    operatingStates: [],
    results: [],
    settings: { unitSystem: 'metric' },
    assetHashes: []
  };
}
