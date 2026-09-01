import type { ProjectSnapshot } from '../project/project';

export type RendererPoint = Readonly<{
  x: number;
  y: number;
}>;

export type RendererPort = Readonly<{
  id: string;
  nodeId: string;
  label: string;
  domain: 'electrical' | 'fluid';
  direction: 'input' | 'output' | 'bidirectional';
  side: 'left' | 'right' | 'top' | 'bottom';
  offset: number;
  compatibility: 'idle' | 'compatible' | 'blocked';
}>;

export type RendererNode = Readonly<{
  id: string;
  label: string;
  kind: string;
  position: RendererPoint;
  width: number;
  height: number;
  selected: boolean;
  previewed?: boolean;
  ports: readonly RendererPort[];
}>;

export type RendererRoutePoint = Readonly<{
  id: string;
  position: RendererPoint;
}>;

export type RendererPhysicalConnection = Readonly<{
  kind: 'wire' | 'hose' | 'tube' | 'pipe';
  conductorColor?: string;
  conductorStripe?: string;
  conductorScale?: number;
  medium?: string;
  temperature?: string;
  direction?: 'forward' | 'reverse' | 'bidirectional' | 'unknown';
}>;

export type RendererConnection = Readonly<{
  id: string;
  label: string;
  sourcePortId: string;
  targetPortId: string;
  physical: RendererPhysicalConnection;
  routePoints: readonly RendererRoutePoint[];
  selected: boolean;
  previewed?: boolean;
}>;

export type RendererOverlayMark = Readonly<{
  id: string;
  connectionId: string;
  channel:
    | 'selection'
    | 'potential'
    | 'current'
    | 'signal'
    | 'direction'
    | 'temperature'
    | 'provenance'
    | 'unknown'
    | 'conflict'
    | 'finding';
  label: string;
}>;

export type RendererViewport = Readonly<{
  x: number;
  y: number;
  zoom: number;
}>;

export type RendererProjection = Readonly<{
  revision: number;
  nodes: readonly RendererNode[];
  connections: readonly RendererConnection[];
  overlayMarks: readonly RendererOverlayMark[];
}>;

export type ProjectProjectionOptions = Readonly<{
  selectedSubjectId?: string | null;
  previewSubjectId?: string | null;
  previewSourcePortId?: string | null;
  domainFilter?: 'all' | 'electrical' | 'fluid';
  systemFilterId?: string | null;
}>;

export type RendererCapabilityMode = 'author' | 'review' | 'mobile-review';

export function validateRendererProjection(projection: RendererProjection): RendererProjection {
  if (!Number.isSafeInteger(projection.revision) || projection.revision < 0) {
    throw new Error('Renderer projection revision must be a nonnegative safe integer');
  }

  const nodes = new Set<string>();
  const ports = new Map<string, RendererPort>();
  for (const node of projection.nodes) {
    if (nodes.has(node.id)) throw new Error(`Duplicate Renderer Node ${node.id}`);
    if (!(node.width > 0) || !(node.height > 0)) {
      throw new Error(`Renderer Node ${node.id} must have positive dimensions`);
    }

    nodes.add(node.id);
    for (const port of node.ports) {
      if (port.nodeId !== node.id) {
        throw new Error(`Renderer Port ${port.id} belongs to ${port.nodeId}, not ${node.id}`);
      }
      if (ports.has(port.id)) throw new Error(`Duplicate Renderer Port ${port.id}`);
      if (!(port.offset > 0 && port.offset < 1)) {
        throw new Error(`Renderer Port ${port.id} offset must be between zero and one`);
      }

      ports.set(port.id, port);
    }
  }

  const connections = new Set<string>();
  const routePoints = new Set<string>();
  for (const connection of projection.connections) {
    if (connections.has(connection.id)) {
      throw new Error(`Duplicate Renderer Connection ${connection.id}`);
    }

    const source = ports.get(connection.sourcePortId);
    const target = ports.get(connection.targetPortId);
    if (!source || !target) {
      throw new Error(`Connection ${connection.id} references an absent Renderer Port`);
    }
    if (connection.physical.kind === 'wire') {
      if (source.domain !== 'electrical' || target.domain !== 'electrical') {
        throw new Error(`Connection ${connection.id} uses wire between non-electrical Ports`);
      }
    } else if (source.domain !== 'fluid' || target.domain !== 'fluid') {
      throw new Error(
        `Connection ${connection.id} uses ${connection.physical.kind} between non-fluid Ports`
      );
    }

    connections.add(connection.id);
    for (const routePoint of connection.routePoints) {
      if (routePoints.has(routePoint.id)) {
        throw new Error(`Duplicate Renderer Route Point ${routePoint.id}`);
      }

      routePoints.add(routePoint.id);
    }
  }

  const overlayMarks = new Set<string>();
  for (const mark of projection.overlayMarks) {
    if (overlayMarks.has(mark.id)) throw new Error(`Duplicate Renderer Overlay Mark ${mark.id}`);
    if (!connections.has(mark.connectionId)) {
      throw new Error(`Renderer Overlay Mark ${mark.id} references absent Connection`);
    }

    overlayMarks.add(mark.id);
  }

  return projection;
}

export function rendererPortsCanConnect(
  projection: RendererProjection,
  sourcePortId: string,
  targetPortId: string
): boolean {
  let source: RendererPort | undefined;
  let target: RendererPort | undefined;
  for (const node of projection.nodes) {
    for (const port of node.ports) {
      if (port.id === sourcePortId) source = port;
      if (port.id === targetPortId) target = port;
    }
  }

  if (!source || !target || source.nodeId === target.nodeId || source.domain !== target.domain) {
    return false;
  }

  return (
    (source.direction === 'output' || source.direction === 'bidirectional') &&
    (target.direction === 'input' || target.direction === 'bidirectional')
  );
}

export function projectSnapshotToRendererProjection(
  snapshot: ProjectSnapshot,
  options: ProjectProjectionOptions = {}
): RendererProjection {
  const previewSource = snapshot.topology.components
    .flatMap((component) => component.ports)
    .find((port) => port.id === options.previewSourcePortId);
  const filteredConnections = snapshot.topology.connections.filter(
    (connection) =>
      (options.domainFilter === undefined ||
        options.domainFilter === 'all' ||
        connection.domain === options.domainFilter) &&
      (!options.systemFilterId || connection.systemId === options.systemFilterId)
  );
  const filteredConnectionPortIds = new Set(
    filteredConnections.flatMap((connection) => [connection.sourcePortId, connection.targetPortId])
  );
  const filteredComponents = snapshot.topology.components.filter((component) => {
    if (options.systemFilterId) {
      return component.ports.some((port) => filteredConnectionPortIds.has(port.id));
    }
    if (options.domainFilter && options.domainFilter !== 'all') {
      return component.ports.some((port) => port.domain === options.domainFilter);
    }
    return true;
  });
  const visiblePortIds = new Set(
    filteredComponents.flatMap((component) => component.ports.map((port) => port.id))
  );
  const nodes: RendererNode[] = filteredComponents.map((component) => ({
    id: component.id,
    label: component.label,
    kind: component.kind,
    position: { x: Number(component.position.x), y: Number(component.position.y) },
    width: 176,
    height: Math.max(96, 64 + component.ports.length * 24),
    selected: options.selectedSubjectId === component.id,
    previewed: options.previewSubjectId === component.id,
    ports: component.ports.map((port, index) => ({
      id: port.id,
      nodeId: component.id,
      label: port.label,
      domain: port.domain,
      direction: 'bidirectional',
      side: index % 2 === 0 ? 'left' : 'right',
      offset: (index + 1) / (component.ports.length + 1),
      compatibility:
        previewSource?.id === port.id
          ? 'compatible'
          : previewSource
            ? previewSource.componentId !== port.componentId &&
              previewSource.domain === port.domain &&
              previewSource.mediumId === port.mediumId &&
              (previewSource.interfaceKey === null ||
                port.interfaceKey === null ||
                previewSource.interfaceKey === port.interfaceKey)
              ? 'compatible'
              : 'blocked'
            : 'idle'
    }))
  }));
  const connections: RendererConnection[] = filteredConnections
    .filter(
      (connection) =>
        visiblePortIds.has(connection.sourcePortId) && visiblePortIds.has(connection.targetPortId)
    )
    .map((connection) => {
      const route = snapshot.topology.routes.find(
        (candidate) => candidate.id === connection.routeId
      );
      return {
        id: connection.id,
        label: connection.label,
        sourcePortId: connection.sourcePortId,
        targetPortId: connection.targetPortId,
        physical:
          connection.kind === 'electrical-wire'
            ? {
                kind: 'wire',
                conductorColor: '#b4483d',
                conductorStripe: '#f3d48a',
                conductorScale: 12,
                direction: 'unknown'
              }
            : {
                kind: connection.kind.replace('fluid-', '') as 'hose' | 'tube' | 'pipe',
                ...(connection.mediumId ? { medium: connection.mediumId } : {}),
                direction: 'unknown'
              },
        routePoints:
          route?.segmentIds.flatMap((segmentId) => {
            const segment = snapshot.topology.segments.find(
              (candidate) => candidate.id === segmentId
            );
            return segment
              ? [
                  {
                    id: `${connection.id}:${segment.id}`,
                    position: { x: Number(segment.end.x), y: Number(segment.end.y) }
                  }
                ]
              : [];
          }) ?? [],
        selected: options.selectedSubjectId === connection.id,
        previewed: options.previewSubjectId === connection.id
      };
    });

  const visibleConnectionIds = new Set(connections.map((connection) => connection.id));
  const overlayMarks: RendererOverlayMark[] = [];
  for (const connection of snapshot.topology.connections) {
    if (!visibleConnectionIds.has(connection.id)) continue;
    if (options.selectedSubjectId === connection.id) {
      overlayMarks.push({
        id: `selection:${connection.id}`,
        connectionId: connection.id,
        channel: 'selection',
        label: `Selected ${connection.label}`
      });
    }
    if (connection.domain === 'fluid') {
      overlayMarks.push({
        id: `direction:${connection.id}`,
        connectionId: connection.id,
        channel: 'direction',
        label: `Direction unknown for ${connection.label}`
      });
    }
    for (const evidence of snapshot.evidence.filter(
      (candidate) => candidate.subjectId === connection.id
    )) {
      if (evidence.provenance) {
        overlayMarks.push({
          id: `provenance:${evidence.id}`,
          connectionId: connection.id,
          channel: 'provenance',
          label: `${evidence.label} provenance recorded`
        });
      }
      if (evidence.state === 'unknown') {
        overlayMarks.push({
          id: `unknown:${evidence.id}`,
          connectionId: connection.id,
          channel: 'unknown',
          label: `${evidence.label} unknown`
        });
      }
      if (evidence.state === 'conflicting') {
        overlayMarks.push({
          id: `conflict:${evidence.id}`,
          connectionId: connection.id,
          channel: 'conflict',
          label: `${evidence.label} conflicting`
        });
      }
      if (evidence.label.toLowerCase().includes('temperature')) {
        overlayMarks.push({
          id: `temperature:${evidence.id}`,
          connectionId: connection.id,
          channel: 'temperature',
          label: `${evidence.value ?? 'Unknown'} ${evidence.unit ?? ''}`.trim()
        });
      }
    }
    if (
      snapshot.results.some(
        (result) => result.status === 'current' && result.kind === `finding:${connection.id}`
      )
    ) {
      overlayMarks.push({
        id: `finding:${connection.id}`,
        connectionId: connection.id,
        channel: 'finding',
        label: `Finding attached to ${connection.label}`
      });
    }
  }

  return validateRendererProjection({
    revision: snapshot.revision,
    nodes,
    connections,
    overlayMarks
  });
}
