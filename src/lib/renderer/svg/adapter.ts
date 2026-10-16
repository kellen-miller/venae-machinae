import {
  validateRendererProjection,
  type RendererCapabilityMode,
  type RendererConnection,
  type RendererNode,
  type RendererOverlayMark,
  type RendererPoint,
  type RendererPort,
  type RendererProjection,
  type RendererViewport
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
  labelPoint: RendererPoint;
  strokeWidth: number;
  overlayMarks: readonly RendererOverlayMark[];
}>;

export type RendererSVGModel = Readonly<{
  nodes: readonly RendererSVGNode[];
  connections: readonly RendererSVGConnection[];
}>;

const VIEWBOX_WIDTH = 940;
const VIEWBOX_HEIGHT = 600;
const VIEWPORT_OVERSCAN = 160;

function routeCrossesNode(points: readonly RendererPoint[], node: RendererNode): boolean {
  const left = node.position.x - 10;
  const right = node.position.x + node.width + 10;
  const top = node.position.y - 10;
  const bottom = node.position.y + node.height + 10;
  return points.slice(1).some((point, index) => {
    const previous = points[index]!;
    return point.x === previous.x
      ? point.x > left &&
          point.x < right &&
          Math.max(point.y, previous.y) > top &&
          Math.min(point.y, previous.y) < bottom
      : point.y > top &&
          point.y < bottom &&
          Math.max(point.x, previous.x) > left &&
          Math.min(point.x, previous.x) < right;
  });
}

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

  const routingCells = new Map<string, RendererNode[]>();
  const unindexedNodes: RendererNode[] = [];
  const cellSize = 256;
  for (const node of projection.nodes) {
    const left = Math.floor((node.position.x - 10) / cellSize);
    const top = Math.floor((node.position.y - 10) / cellSize);
    const columns = Math.floor((node.position.x + node.width + 10) / cellSize) - left + 1;
    const rows = Math.floor((node.position.y + node.height + 10) / cellSize) - top + 1;
    if (!Number.isSafeInteger(left) || !Number.isSafeInteger(top) || columns * rows > 64) {
      unindexedNodes.push(node);
      continue;
    }

    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const key = `${left + column}:${top + row}`;
        const cell = routingCells.get(key) ?? [];
        cell.push(node);
        routingCells.set(key, cell);
      }
    }
  }

  function obstaclesOnRoute(
    points: readonly RendererPoint[],
    sourceId: string,
    targetId: string
  ): RendererNode[] {
    const nearby = new Set<RendererNode>(unindexedNodes);
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1]!,
        b = points[index]!;
      const left = Math.floor(Math.min(a.x, b.x) / cellSize);
      const top = Math.floor(Math.min(a.y, b.y) / cellSize);
      const columns = Math.floor(Math.max(a.x, b.x) / cellSize) - left + 1;
      const rows = Math.floor(Math.max(a.y, b.y) / cellSize) - top + 1;
      if (!Number.isSafeInteger(left) || !Number.isSafeInteger(top) || columns * rows > 4096) {
        return projection.nodes.filter(
          (node) => node.id !== sourceId && node.id !== targetId && routeCrossesNode(points, node)
        );
      }

      for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows; row++) {
          for (const node of routingCells.get(`${left + column}:${top + row}`) ?? [])
            nearby.add(node);
        }
      }
    }

    return [...nearby].filter(
      (node) => node.id !== sourceId && node.id !== targetId && routeCrossesNode(points, node)
    );
  }

  const connections = projection.connections.map((connection, connectionIndex) => {
    const source = ports.get(connection.sourcePortId);
    const target = ports.get(connection.targetPortId);
    if (!source || !target)
      throw new Error(`Connection ${connection.id} references an absent Port`);
    let points = [
      source.center,
      ...connection.routePoints.map((point) => point.position),
      target.center
    ];
    if (connection.routePoints.length === 0) {
      const midpoint =
        source.port.side === 'left' && target.port.side === 'left'
          ? Math.min(source.node.position.x, target.node.position.x) - 44
          : source.port.side === 'right' && target.port.side === 'right'
            ? Math.max(
                source.node.position.x + source.node.width,
                target.node.position.x + target.node.width
              ) + 44
            : (source.center.x + target.center.x) / 2;
      points = [
        source.center,
        { x: midpoint, y: source.center.y },
        { x: midpoint, y: target.center.y },
        target.center
      ];
      const crossed = new Set(obstaclesOnRoute(points, source.node.id, target.node.id));
      for (let attempt = 0; attempt < 3 && crossed.size > 0; attempt++) {
        const clearance = 32 + (connectionIndex % 4) * 12;
        const bounds = [source.node, target.node, ...crossed];
        const lanes = [
          Math.min(...bounds.map((node) => node.position.y)) - clearance,
          Math.max(...bounds.map((node) => node.position.y + node.height)) + clearance
        ];
        const candidates = lanes.map((y) => [
          source.center,
          { x: source.center.x + (source.port.side === 'left' ? -24 : 24), y: source.center.y },
          { x: source.center.x + (source.port.side === 'left' ? -24 : 24), y },
          { x: target.center.x + (target.port.side === 'left' ? -24 : 24), y },
          { x: target.center.x + (target.port.side === 'left' ? -24 : 24), y: target.center.y },
          target.center
        ]);
        points = candidates.sort((a, b) => {
          const collisions =
            obstaclesOnRoute(a, source.node.id, target.node.id).length -
            obstaclesOnRoute(b, source.node.id, target.node.id).length;
          const length = (route: RendererPoint[]) =>
            route
              .slice(1)
              .reduce(
                (sum, point, index) =>
                  sum + Math.hypot(point.x - route[index]!.x, point.y - route[index]!.y),
                0
              );
          return collisions || length(a) - length(b);
        })[0]!;
        const remaining = obstaclesOnRoute(points, source.node.id, target.node.id);
        if (remaining.length === 0) break;

        for (const node of remaining) crossed.add(node);
      }
    }

    let path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
    if (connection.routePoints.length === 0) {
      path = `M ${points[0]!.x} ${points[0]!.y}`;
      for (let index = 1; index < points.length - 1; index++) {
        const previous = points[index - 1]!,
          corner = points[index]!,
          next = points[index + 1]!;
        const before = Math.hypot(corner.x - previous.x, corner.y - previous.y);
        const after = Math.hypot(next.x - corner.x, next.y - corner.y);
        const radius = Math.min(16, before / 2, after / 2);
        if (radius === 0) continue;

        const entry = {
          x: corner.x + ((previous.x - corner.x) * radius) / before,
          y: corner.y + ((previous.y - corner.y) * radius) / before
        };
        const exit = {
          x: corner.x + ((next.x - corner.x) * radius) / after,
          y: corner.y + ((next.y - corner.y) * radius) / after
        };
        path += ` L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`;
      }

      path += ` L ${target.center.x} ${target.center.y}`;
    }

    let longest = -1;
    let labelPoint = source.center;
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1]!,
        b = points[index]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length > longest) {
        longest = length;
        labelPoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    }

    const nominal = connection.physical.nominalDashSize;

    return {
      connection,
      source,
      target,
      points,
      path,
      labelPoint,
      strokeWidth: nominal ? Math.min(26, Math.max(4, nominal * 1.4)) : 6,
      overlayMarks: overlayMarks.get(connection.id) ?? []
    };
  });

  return { nodes, connections };
}

export function fitRendererProjection(projection: RendererProjection): RendererViewport {
  if (projection.nodes.length === 0) return { x: 0, y: 0, zoom: 1 };

  const routePoints = createSVGModel(projection, 'review').connections.flatMap(
    (connection) => connection.points
  );
  const minX = Math.min(
    ...projection.nodes.map((node) => node.position.x),
    ...routePoints.map((point) => point.x)
  );
  const minY = Math.min(
    ...projection.nodes.map((node) => node.position.y),
    ...routePoints.map((point) => point.y)
  );
  const maxX = Math.max(
    ...projection.nodes.map((node) => node.position.x + node.width),
    ...routePoints.map((point) => point.x)
  );
  const maxY = Math.max(
    ...projection.nodes.map((node) => node.position.y + node.height),
    ...routePoints.map((point) => point.y)
  );
  const zoom = Math.max(
    0.08,
    Math.min(1.35, (VIEWBOX_WIDTH - 160) / (maxX - minX), (VIEWBOX_HEIGHT - 160) / (maxY - minY))
  );
  return {
    x: (VIEWBOX_WIDTH - (minX + maxX) * zoom) / 2,
    y: (VIEWBOX_HEIGHT - (minY + maxY) * zoom) / 2,
    zoom
  };
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
