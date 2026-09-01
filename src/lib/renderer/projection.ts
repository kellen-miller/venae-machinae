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
}>;

export type RendererOverlayMark = Readonly<{
  id: string;
  connectionId: string;
  channel:
    'selection' | 'potential' | 'current' | 'signal' | 'direction' | 'temperature' | 'finding';
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
