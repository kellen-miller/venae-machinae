import {
  validateRendererProjection,
  type RendererCapabilityMode,
  type RendererConnection,
  type RendererNode,
  type RendererOverlayMark,
  type RendererPoint,
  type RendererPort,
  type RendererProjection
} from '../projection';

export type RendererSVGPort = Readonly<{
  node: RendererNode;
  port: RendererPort;
  center: RendererPoint;
}>;

export type RendererSVGNode = Readonly<{
  node: RendererNode;
  portCenters: readonly RendererSVGPort[];
  capability: RendererCapabilityMode;
}>;

export type RendererSVGConnection = Readonly<{
  connection: RendererConnection;
  source: RendererSVGPort;
  target: RendererSVGPort;
  points: readonly RendererPoint[];
  path: string;
  overlayMarks: readonly RendererOverlayMark[];
}>;

export type RendererSVGModel = Readonly<{
  nodes: readonly RendererSVGNode[];
  connections: readonly RendererSVGConnection[];
}>;

const VIEWBOX_WIDTH = 940;
const VIEWBOX_HEIGHT = 600;
const VIEWPORT_OVERSCAN = 160;

export function rendererPortCenter(node: RendererNode, port: RendererPort): RendererPoint {
  if (port.side === 'left') {
    return { x: node.position.x, y: node.position.y + node.height * port.offset };
  }
  if (port.side === 'right') {
    return { x: node.position.x + node.width, y: node.position.y + node.height * port.offset };
  }
  if (port.side === 'top') {
    return { x: node.position.x + node.width * port.offset, y: node.position.y };
  }

  return { x: node.position.x + node.width * port.offset, y: node.position.y + node.height };
}

export function createSVGModel(
  projection: RendererProjection,
  capability: RendererCapabilityMode
): RendererSVGModel {
  validateRendererProjection(projection);
  const ports = new Map<string, RendererSVGPort>();
  const nodes = projection.nodes.map((node) => {
    const portCenters = node.ports.map((port) => {
      const mapped = { node, port, center: rendererPortCenter(node, port) };
      ports.set(port.id, mapped);
      return mapped;
    });

    return { node, portCenters, capability };
  });
  const overlayMarks = new Map<string, RendererOverlayMark[]>();
  for (const mark of projection.overlayMarks) {
    const connectionMarks = overlayMarks.get(mark.connectionId) ?? [];
    connectionMarks.push(mark);
    overlayMarks.set(mark.connectionId, connectionMarks);
  }

  const connections = projection.connections.map((connection) => {
    const source = ports.get(connection.sourcePortId);
    const target = ports.get(connection.targetPortId);
    if (!source || !target)
      throw new Error(`Connection ${connection.id} references an absent Port`);
    const points = [
      source.center,
      ...connection.routePoints.map((point) => point.position),
      target.center
    ];
    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    return {
      connection,
      source,
      target,
      points,
      path,
      overlayMarks: overlayMarks.get(connection.id) ?? []
    };
  });

  return { nodes, connections };
}

export function cullSVGModel(
  model: RendererSVGModel,
  viewport: Readonly<{ x: number; y: number; zoom: number }>
): RendererSVGModel {
  const minX = -viewport.x / viewport.zoom - VIEWPORT_OVERSCAN;
  const minY = -viewport.y / viewport.zoom - VIEWPORT_OVERSCAN;
  const maxX = (VIEWBOX_WIDTH - viewport.x) / viewport.zoom + VIEWPORT_OVERSCAN;
  const maxY = (VIEWBOX_HEIGHT - viewport.y) / viewport.zoom + VIEWPORT_OVERSCAN;
  const nodes = model.nodes.filter(({ node }) => {
    const nodeMaxX = node.position.x + node.width;
    const nodeMaxY = node.position.y + node.height;
    return (
      node.position.x <= maxX && nodeMaxX >= minX && node.position.y <= maxY && nodeMaxY >= minY
    );
  });
  const connections = model.connections.filter(({ points }) => {
    let connectionMinX = Number.POSITIVE_INFINITY;
    let connectionMinY = Number.POSITIVE_INFINITY;
    let connectionMaxX = Number.NEGATIVE_INFINITY;
    let connectionMaxY = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      connectionMinX = Math.min(connectionMinX, point.x);
      connectionMinY = Math.min(connectionMinY, point.y);
      connectionMaxX = Math.max(connectionMaxX, point.x);
      connectionMaxY = Math.max(connectionMaxY, point.y);
    }

    return (
      connectionMinX <= maxX &&
      connectionMaxX >= minX &&
      connectionMinY <= maxY &&
      connectionMaxY >= minY
    );
  });

  return { nodes, connections };
}
