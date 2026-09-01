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
const CONNECTION_KINDS = ['electrical-wire', 'fluid-hose', 'fluid-tube', 'fluid-pipe'] as const;
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
  const componentsPerDomain = counts.components / 2;
  const components = Array.from({ length: counts.components }, (_, componentIndex) => {
    const position = componentPosition(componentIndex);
    const domain = componentIndex % 2 === 0 ? ('electrical' as const) : ('fluid' as const);

    return {
      id: `renderer-component-${scale}x-${componentIndex}`,
      label: `Capacity component ${componentIndex + 1}`,
      kind: domain,
      x: String(position.x),
      y: String(position.y),
      ports: Array.from({ length: 5 }, (_, localPortIndex) => ({
        id: portId(scale, componentIndex, localPortIndex),
        label: `P${localPortIndex + 1}`,
        domain
      }))
    };
  });
  const connections = Array.from({ length: counts.connections }, (_, connectionIndex) => {
    const kind = CONNECTION_KINDS[connectionIndex % CONNECTION_KINDS.length];
    const domainOffset = kind === 'electrical-wire' ? 0 : 1;
    const sourceDomainIndex =
      Math.floor(connectionIndex / CONNECTION_KINDS.length) % componentsPerDomain;
    const targetDomainIndex = (sourceDomainIndex + 1) % componentsPerDomain;
    const sourceComponentIndex = sourceDomainIndex * 2 + domainOffset;
    const targetComponentIndex = targetDomainIndex * 2 + domainOffset;
    const sourceLocalPortIndex = connectionIndex % 3;
    const targetLocalPortIndex = 3 + (connectionIndex % 2);
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

    return {
      id: `renderer-connection-${scale}x-${connectionIndex}`,
      sourcePortId: portId(scale, sourceComponentIndex, sourceLocalPortIndex),
      targetPortId: portId(scale, targetComponentIndex, targetLocalPortIndex),
      kind,
      routePoints: [
        {
          x: String((sourceCenter.x + targetCenter.x) / 2),
          y: String((sourceCenter.y + targetCenter.y) / 2 + ((connectionIndex % 3) - 1) * 24)
        }
      ]
    };
  });

  return projectDocumentSchema.parse({
    schemaVersion: 1,
    project: {
      id: `renderer-capacity-project-${scale}x`,
      name: `Renderer capacity ${scale}x`,
      revision: 1,
      updatedAt: '2026-09-01T00:00:00Z'
    },
    topology: { components, connections },
    engineeringValues: [],
    operatingStates: [],
    results: [],
    settings: { unitSystem: 'metric' },
    assetHashes: []
  });
}

function physicalConnection(
  kind: ProjectDocument['topology']['connections'][number]['kind'],
  connectionIndex: number
): RendererPhysicalConnection {
  if (kind === 'electrical-wire') {
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
    position: { x: Number(component.x), y: Number(component.y) },
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
    (connection, connectionIndex) => ({
      id: connection.id,
      label: `Capacity path ${connectionIndex + 1}`,
      sourcePortId: connection.sourcePortId,
      targetPortId: connection.targetPortId,
      physical: physicalConnection(connection.kind, connectionIndex),
      routePoints: connection.routePoints.map((point, routePointIndex) => ({
        id: `${connection.id}-route-${routePointIndex + 1}`,
        position: { x: Number(point.x), y: Number(point.y) }
      })),
      selected: false
    })
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
