import {
  projectDocumentSchema,
  type ProjectDocument
} from '../../src/lib/persistence/project-document';
import {
  validateRendererProjection,
  type RendererConnection,
  type RendererOverlayMark,
  type RendererPhysicalConnection,
  type RendererProjection
} from '../../src/lib/renderer/projection';
import { CAPACITY_COUNTS, type CapacityScale } from './capacity-project';

const COMPONENT_WIDTH = 170;
const COMPONENT_HEIGHT = 168;
const COMPONENT_COLUMNS = 30;
const COMPONENT_COLUMN_GAP = 210;
const COMPONENT_ROW_GAP = 205;
const PORT_OFFSETS = [0.3, 0.5, 0.7, 0.4, 0.65] as const;
const FLUID_CONNECTION_KINDS = ['fluid-hose', 'fluid-tube', 'fluid-pipe'] as const;
const OVERLAY_CHANNELS = [
  'potential',
  'current',
  'signal',
  'direction',
  'temperature',
  'finding'
] as const;

function componentPosition(componentIndex: number): { x: number; y: number } {
  return {
    x: 80 + (componentIndex % COMPONENT_COLUMNS) * COMPONENT_COLUMN_GAP,
    y: 80 + Math.floor(componentIndex / COMPONENT_COLUMNS) * COMPONENT_ROW_GAP
  };
}

function portId(scale: CapacityScale, componentIndex: number, localPortIndex: number): string {
  return `renderer-port-${scale}x-${componentIndex * 5 + localPortIndex}`;
}

export function generateRendererCapacityProject(scale: CapacityScale): ProjectDocument {
  const counts = CAPACITY_COUNTS[scale];
  const electricalComponentCount = (counts.components * 4) / 5;
  const components = Array.from({ length: counts.components }, (_, componentIndex) => {
    const position = componentPosition(componentIndex);
    const domain =
      componentIndex < electricalComponentCount ? ('electrical' as const) : ('fluid' as const);

    return {
      id: `renderer-component-${scale}x-${componentIndex}`,
      label: `Capacity component ${componentIndex + 1}`,
      kind: 'part' as const,
      definitionId: null,
      predecessorId: null,
      successorId: null,
      position: { x: String(position.x), y: String(position.y) },
      ports: Array.from({ length: 5 }, (_, localPortIndex) => ({
        id: portId(scale, componentIndex, localPortIndex),
        componentId: `renderer-component-${scale}x-${componentIndex}`,
        label: `P${localPortIndex + 1}`,
        domain,
        mediumId: domain === 'electrical' ? null : 'medium-renderer-fluid',
        interfaceKey: null
      }))
    };
  });
  const electricalEndpointCount = electricalComponentCount * 5;
  const fluidEndpointCount = (counts.components - electricalComponentCount) * 5;
  const wireConnectionCount = electricalEndpointCount / 2;
  const fluidConnectionCount = fluidEndpointCount / 2;
  const mateConnectionCount = counts.connections - wireConnectionCount - fluidConnectionCount;
  const descriptors = [
    ...Array.from({ length: wireConnectionCount }, (_, index) => ({
      kind: 'electrical-wire' as const,
      sourceComponentIndex: Math.floor(index / 5),
      sourceLocalPortIndex: index % 5,
      targetComponentIndex: Math.floor((index + wireConnectionCount) / 5),
      targetLocalPortIndex: (index + wireConnectionCount) % 5
    })),
    ...Array.from({ length: mateConnectionCount }, (_, index) => ({
      kind: 'electrical-mate' as const,
      sourceComponentIndex: Math.floor(index / 5),
      sourceLocalPortIndex: index % 5,
      targetComponentIndex: Math.floor((index + mateConnectionCount) / 5),
      targetLocalPortIndex: (index + mateConnectionCount) % 5
    })),
    ...Array.from({ length: fluidConnectionCount }, (_, index) => ({
      kind: FLUID_CONNECTION_KINDS[index % FLUID_CONNECTION_KINDS.length] ?? 'fluid-hose',
      sourceComponentIndex: electricalComponentCount + Math.floor(index / 5),
      sourceLocalPortIndex: index % 5,
      targetComponentIndex:
        electricalComponentCount + Math.floor((index + fluidConnectionCount) / 5),
      targetLocalPortIndex: (index + fluidConnectionCount) % 5
    }))
  ];
  const routedConnections = descriptors.map((descriptor, connectionIndex) => {
    const {
      kind,
      sourceComponentIndex,
      sourceLocalPortIndex,
      targetComponentIndex,
      targetLocalPortIndex
    } = descriptor;
    const domain = kind.startsWith('fluid-') ? ('fluid' as const) : ('electrical' as const);
    const sourcePosition = componentPosition(sourceComponentIndex);
    const targetPosition = componentPosition(targetComponentIndex);
    const sourceOffset = PORT_OFFSETS[sourceLocalPortIndex] ?? 0.5;
    const targetOffset = PORT_OFFSETS[targetLocalPortIndex] ?? 0.5;
    const sourceCenter = {
      x: sourcePosition.x + COMPONENT_WIDTH,
      y: sourcePosition.y + COMPONENT_HEIGHT * sourceOffset
    };
    const targetCenter = {
      x: targetPosition.x,
      y: targetPosition.y + COMPONENT_HEIGHT * targetOffset
    };

    const connectionId = `renderer-connection-${scale}x-${connectionIndex}`;
    const routeId = `renderer-route-${scale}x-${connectionIndex}`;
    const segmentId = `renderer-segment-${scale}x-${connectionIndex}`;
    const routed = kind !== 'electrical-mate';
    return {
      connection: {
        id: connectionId,
        label: `Capacity path ${connectionIndex + 1}`,
        systemId: domain === 'electrical' ? 'system-renderer-power' : 'system-renderer-fluid',
        sourcePortId: portId(scale, sourceComponentIndex, sourceLocalPortIndex),
        targetPortId: portId(scale, targetComponentIndex, targetLocalPortIndex),
        domain,
        mediumId: domain === 'electrical' ? null : 'medium-renderer-fluid',
        kind,
        interfaceAssessment: 'unknown' as const,
        routeId: routed ? routeId : null
      },
      route: routed ? { id: routeId, segmentIds: [segmentId] } : null,
      segment: routed
        ? {
            id: segmentId,
            label: `Capacity route ${connectionIndex + 1}`,
            start: { x: String(sourceCenter.x), y: String(sourceCenter.y) },
            end: {
              x: String((sourceCenter.x + targetCenter.x) / 2),
              y: String((sourceCenter.y + targetCenter.y) / 2 + ((connectionIndex % 3) - 1) * 24)
            }
          }
        : null
    };
  });
  const connections = routedConnections.map((entry) => entry.connection);

  return projectDocumentSchema.parse({
    schemaVersion: 8,
    project: {
      id: `renderer-capacity-project-${scale}x`,
      name: `Renderer capacity ${scale}x`,
      revision: 1,
      createdAt: '2026-09-01T00:00:00Z'
    },
    topology: {
      systems: [
        {
          id: 'system-renderer-power',
          label: 'Renderer power',
          domain: 'electrical',
          mediumId: null
        },
        {
          id: 'system-renderer-fluid',
          label: 'Renderer fluid',
          domain: 'fluid',
          mediumId: 'medium-renderer-fluid'
        }
      ],
      components,
      connections,
      routes: routedConnections.flatMap((entry) => (entry.route ? [entry.route] : [])),
      segments: routedConnections.flatMap((entry) => (entry.segment ? [entry.segment] : []))
    },
    electrical: {
      components: components
        .slice(0, electricalComponentCount)
        .map((component) => ({ componentId: component.id, role: 'connector' as const })),
      wires: [],
      circuits: [],
      connectors: [],
      harnesses: [],
      bundles: [],
      cableSpecifications: []
    },
    fluid: {
      media: [
        {
          id: 'medium-renderer-fluid',
          label: 'Renderer fixture fluid',
          composition: 'synthetic renderer fixture composition',
          provenance: 'independent renderer fixture'
        }
      ],
      systems: [
        {
          systemId: 'system-renderer-fluid',
          mediumId: 'medium-renderer-fluid',
          purpose: 'renderer-boundary topology'
        }
      ],
      components: [],
      lines: [],
      behaviors: [],
      boundaryConditions: []
    },
    calculations: [],
    screenings: [],
    partDefinitions: [],
    partRequirements: [],
    evidence: [],
    engineeringValues: [],
    operatingStates: [],
    results: [],
    validationApplicabilityDecisions: [],
    tombstones: [],
    settings: { unitSystem: 'metric' },
    assetHashes: [],
    vehicleBackground: null
  });
}

function physicalConnection(
  kind: ProjectDocument['topology']['connections'][number]['kind'],
  connectionIndex: number
): RendererPhysicalConnection {
  if (kind === 'electrical-wire' || kind === 'electrical-mate') {
    return {
      kind: 'wire',
      conductorColor: connectionIndex % 2 === 0 ? '#b34d3d' : '#2d4950',
      ...(connectionIndex % 5 === 0 ? { conductorStripe: '#f1c75b' } : {}),
      conductorScale: 12,
      direction: 'forward'
    };
  }

  if (kind === 'fluid-hose') {
    return { kind: 'hose', medium: 'gasoline', temperature: 'warm', direction: 'forward' };
  }
  if (kind === 'fluid-tube') {
    return { kind: 'tube', medium: 'coolant', temperature: 'hot', direction: 'forward' };
  }

  return { kind: 'pipe', medium: 'oil', temperature: 'warm', direction: 'forward' };
}

export function projectRendererCapacityDocument(document: ProjectDocument): RendererProjection {
  const parsed = projectDocumentSchema.parse(document);
  const nodes = parsed.topology.components.map((component) => ({
    id: component.id,
    label: component.label,
    kind: component.kind,
    position: { x: Number(component.position.x), y: Number(component.position.y) },
    width: COMPONENT_WIDTH,
    height: COMPONENT_HEIGHT,
    selected: false,
    ports: component.ports.map((port, localPortIndex) => ({
      id: port.id,
      nodeId: component.id,
      label: port.label,
      domain: port.domain,
      direction: localPortIndex < 3 ? ('output' as const) : ('input' as const),
      side: localPortIndex < 3 ? ('right' as const) : ('left' as const),
      offset: PORT_OFFSETS[localPortIndex] ?? 0.5,
      compatibility: 'idle' as const
    }))
  }));
  const connections: RendererConnection[] = parsed.topology.connections.map(
    (connection, connectionIndex) => {
      const route = parsed.topology.routes.find((candidate) => candidate.id === connection.routeId);
      return {
        id: connection.id,
        label: connection.label,
        sourcePortId: connection.sourcePortId,
        targetPortId: connection.targetPortId,
        physical: physicalConnection(connection.kind, connectionIndex),
        routePoints:
          route?.segmentIds.flatMap((segmentId) => {
            const segment = parsed.topology.segments.find(
              (candidate) => candidate.id === segmentId
            );
            return segment
              ? [
                  {
                    id: segment.id,
                    position: { x: Number(segment.end.x), y: Number(segment.end.y) }
                  }
                ]
              : [];
          }) ?? [],
        selected: false
      };
    }
  );
  const overlayMarks: RendererOverlayMark[] = [];
  for (let connectionIndex = 0; connectionIndex < connections.length; connectionIndex += 10) {
    const connection = connections[connectionIndex];
    if (!connection) continue;
    const channel = OVERLAY_CHANNELS[(connectionIndex / 10) % OVERLAY_CHANNELS.length];
    if (!channel) continue;
    overlayMarks.push({
      id: `${connection.id}-overlay`,
      connectionId: connection.id,
      channel,
      label: `Capacity ${channel}`
    });
  }

  return validateRendererProjection({
    revision: parsed.project.revision,
    nodes,
    connections,
    overlayMarks
  });
}
