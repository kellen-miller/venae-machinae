import {
  projectDocumentSchema,
  type ProjectDocument
} from '../../src/lib/persistence/project-document';

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
    kind: 'part' as const,
    definitionId: null,
    predecessorId: null,
    successorId: null,
    position: {
      x: String((componentIndex % 30) * 180),
      y: String(Math.floor(componentIndex / 30) * 120)
    },
    ports: Array.from({ length: 5 }, (_, localPortIndex) => ({
      id: `port-${scale}x-${componentIndex * 5 + localPortIndex}`,
      componentId: `component-${scale}x-${componentIndex}`,
      label: `P${localPortIndex + 1}`,
      domain: componentIndex % 2 === 0 ? ('electrical' as const) : ('fluid' as const),
      mediumId: componentIndex % 2 === 0 ? null : 'medium-capacity-fluid',
      interfaceKey: null
    }))
  }));
  const connectionKinds = ['electrical-wire', 'fluid-hose', 'fluid-tube', 'fluid-pipe'] as const;
  const connections = Array.from({ length: counts.connections }, (_, connectionIndex) => {
    const kind = connectionKinds[connectionIndex % connectionKinds.length] ?? 'electrical-wire';
    const domain = kind === 'electrical-wire' ? ('electrical' as const) : ('fluid' as const);
    return {
      id: `connection-${scale}x-${connectionIndex}`,
      label: `Connection ${connectionIndex + 1}`,
      systemId: domain === 'electrical' ? 'system-capacity-power' : 'system-capacity-fluid',
      sourcePortId: `port-${scale}x-${connectionIndex}`,
      targetPortId: `port-${scale}x-${(connectionIndex + 1) % counts.ports}`,
      domain,
      mediumId: domain === 'electrical' ? null : 'medium-capacity-fluid',
      kind,
      interfaceAssessment: 'unknown' as const,
      routeId: null
    };
  });

  return projectDocumentSchema.parse({
    schemaVersion: 4,
    project: {
      id: `capacity-project-${scale}x`,
      name: `Capacity ${scale}x`,
      revision: 1,
      createdAt: '2026-09-01T00:00:00Z'
    },
    topology: {
      systems: [
        {
          id: 'system-capacity-power',
          label: 'Capacity power',
          domain: 'electrical',
          mediumId: null
        },
        {
          id: 'system-capacity-fluid',
          label: 'Capacity fluid',
          domain: 'fluid',
          mediumId: 'medium-capacity-fluid'
        }
      ],
      components,
      connections,
      routes: [],
      segments: []
    },
    electrical: {
      components: [],
      wires: [],
      circuits: [],
      connectors: [],
      harnesses: [],
      bundles: [],
      cableSpecifications: []
    },
    partDefinitions: [],
    partRequirements: [],
    evidence: [],
    engineeringValues: [],
    operatingStates: [],
    results: [],
    tombstones: [],
    settings: { unitSystem: 'metric' },
    assetHashes: [],
    vehicleBackground: null
  });
}
