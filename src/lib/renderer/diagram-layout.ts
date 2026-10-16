import type { ElkNode } from 'elkjs/lib/elk-api';
import type { DiagramLayout } from '../project/project';
import type { RendererProjection } from './projection';

export const DIAGRAM_GRID = 8;

/** ELK receives actual card/port/line-label envelopes, not zero-size vertices. */
export function createDiagramGraph(projection: RendererProjection): ElkNode {
  if (projection.nodes.length > 500 || projection.connections.length > 1000) {
    throw new Error('Tidy supports up to 500 parts and 1,000 lines. Choose a smaller system.');
  }

  const sources = new Set(projection.connections.map((edge) => edge.sourcePortId));
  const targets = new Set(projection.connections.map((edge) => edge.targetPortId));
  return {
    id: 'diagram',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.randomSeed': '1',
      'elk.spacing.nodeNode': '48',
      'elk.spacing.edgeEdge': '32',
      'elk.spacing.edgeNode': '32',
      'elk.layered.spacing.nodeNodeBetweenLayers': '96',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '32',
      'elk.layered.spacing.edgeNodeBetweenLayers': '32',
      'elk.layered.mergeEdges': 'false',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.padding': '[top=64,left=64,bottom=64,right=64]',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '80'
    },
    children: projection.nodes.map((node) => {
      const left = node.ports.filter((port) => targets.has(port.id) && !sources.has(port.id));
      const right = node.ports.filter((port) => !left.includes(port));
      const width =
        Math.ceil(
          Math.max(
            192,
            node.label.length * 7 + 48,
            Math.max(0, ...left.map((port) => port.label.length * 7)) +
              Math.max(0, ...right.map((port) => port.label.length * 7)) +
              48
          ) / 8
        ) * 8;
      const height = Math.max(128, 80 + Math.max(left.length, right.length) * 32);
      return {
        id: node.id,
        width,
        height,
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
        ports: [
          ...left.map((port, index) => ({
            id: port.id,
            x: 0,
            y: 80 + index * 32,
            width: 0,
            height: 0,
            layoutOptions: { 'elk.port.side': 'WEST' }
          })),
          ...right.map((port, index) => ({
            id: port.id,
            x: width,
            y: 80 + index * 32,
            width: 0,
            height: 0,
            layoutOptions: { 'elk.port.side': 'EAST' }
          }))
        ]
      };
    }),
    edges: projection.connections.map((edge) => ({
      id: edge.id,
      sources: [edge.sourcePortId],
      targets: [edge.targetPortId],
      // Reserve the exact badge envelope, including its offset from the line.
      ...(edge.physical.kind !== 'wire'
        ? {
            labels: [
              {
                id: `${edge.id}:size`,
                text: edge.physical.sizeLabel ?? '',
                width: 120,
                height: 40,
                layoutOptions: { 'elk.edgeLabels.placement': 'CENTER' }
              }
            ]
          }
        : {})
    }))
  };
}

/** Expand coordinate gaps onto the grid. Never independently round bends/cards:
 * that can shrink clearances and introduce intersections in an ELK result. */
export function diagramLayoutFromGraph(graph: ElkNode): DiagramLayout {
  const xs = new Set<number>(),
    ys = new Set<number>();
  const collect = (x: number | undefined, y: number | undefined) => {
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('Layout returned incomplete coordinates.');
    }

    xs.add(x);
    ys.add(y);
  };
  for (const node of graph.children ?? []) {
    const x = node.x!,
      y = node.y!;
    collect(x, y);
    collect(x + node.width!, y + node.height!);
    for (const port of node.ports ?? []) collect(x + port.x!, y + port.y!);
  }

  for (const edge of graph.edges ?? []) {
    if (edge.sections?.length !== 1) throw new Error('Layout returned an unsupported split line.');
    const section = edge.sections[0]!;
    for (const point of [section.startPoint, ...(section.bendPoints ?? []), section.endPoint])
      collect(point.x, point.y);
    for (const label of edge.labels ?? []) {
      collect(label.x, label.y);
      collect(label.x! + label.width!, label.y! + label.height!);
    }
  }

  const expand = (values: Set<number>) => {
    const sorted = [...values].sort((a, b) => a - b),
      mapped = new Map<number, number>();
    let previous = sorted[0] ?? 0,
      position = Math.ceil(previous / DIAGRAM_GRID) * DIAGRAM_GRID;
    for (const value of sorted) {
      position += Math.ceil(Math.max(0, value - previous - 0.000001) / DIAGRAM_GRID) * DIAGRAM_GRID;
      mapped.set(value, position);
      previous = value;
    }

    return (value: number) => mapped.get(value)!;
  };
  const x = expand(xs),
    y = expand(ys);
  const layout: DiagramLayout = {
    engine: 'elk-layered',
    nodes: (graph.children ?? []).map((node) => ({
      id: node.id,
      x: x(node.x!),
      y: y(node.y!),
      width: x(node.x! + node.width!) - x(node.x!),
      height: y(node.y! + node.height!) - y(node.y!),
      ports: (node.ports ?? []).map((port) => ({
        id: port.id,
        side: port.x === 0 ? 'left' : 'right',
        offset: (y(node.y! + port.y!) - y(node.y!)) / (y(node.y! + node.height!) - y(node.y!))
      }))
    })),
    edges: (graph.edges ?? []).map((edge) => {
      const section = edge.sections![0]!,
        label = edge.labels?.[0];
      return {
        id: edge.id,
        points: [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(
          (point) => ({ x: x(point.x), y: y(point.y) })
        ),
        label: label
          ? {
              x: (x(label.x!) + x(label.x! + label.width!)) / 2,
              y: (y(label.y!) + y(label.y! + label.height!)) / 2
            }
          : null
      };
    })
  };
  assertDiagramClearance(layout);
  return layout;
}

/** Independent acceptance check. Crossings are allowed; overlapping cards and
 * lines through unrelated cards are not. A failed result never replaces work. */
export function assertDiagramClearance(layout: DiagramLayout): void {
  const labels = layout.edges.flatMap((edge) =>
    edge.label
      ? [{ edgeId: edge.id, x: edge.label.x - 60, y: edge.label.y - 16, width: 120, height: 32 }]
      : []
  );
  for (let index = 0; index < labels.length; index++) {
    const label = labels[index]!;
    for (const box of [...labels.slice(index + 1), ...layout.nodes]) {
      if (
        label.x < box.x + box.width + 4 &&
        label.x + label.width + 4 > box.x &&
        label.y < box.y + box.height + 4 &&
        label.y + label.height + 4 > box.y
      ) {
        throw new Error('Layout could not separate every label. Choose a smaller system.');
      }
    }
  }

  for (const label of labels) {
    for (const edge of layout.edges) {
      if (edge.id === label.edgeId) continue;
      for (let segment = 1; segment < edge.points.length; segment++) {
        const p = edge.points[segment - 1]!,
          q = edge.points[segment]!;
        if (
          Math.max(p.x, q.x) > label.x - 16 &&
          Math.min(p.x, q.x) < label.x + label.width + 16 &&
          Math.max(p.y, q.y) > label.y - 16 &&
          Math.min(p.y, q.y) < label.y + label.height + 16
        ) {
          throw new Error('Layout could not clear every label. Choose a smaller system.');
        }
      }
    }
  }

  for (let index = 0; index < layout.edges.length; index++) {
    const a = layout.edges[index]!;
    for (const b of layout.edges.slice(index + 1)) {
      const sharedPorts = [a.points[0]!, a.points.at(-1)!].filter((point) =>
        [b.points[0]!, b.points.at(-1)!].some((other) => point.x === other.x && point.y === other.y)
      );
      for (let ai = 1; ai < a.points.length; ai++) {
        const p = a.points[ai - 1]!,
          q = a.points[ai]!;
        for (let bi = 1; bi < b.points.length; bi++) {
          const r = b.points[bi - 1]!,
            t = b.points[bi]!;
          // Only the incident segments at a shared port may share a stub.
          if (
            sharedPorts.some(
              (port) =>
                ((ai === 1 && p.x === port.x && p.y === port.y) ||
                  (ai === a.points.length - 1 && q.x === port.x && q.y === port.y)) &&
                ((bi === 1 && r.x === port.x && r.y === port.y) ||
                  (bi === b.points.length - 1 && t.x === port.x && t.y === port.y))
            )
          )
            continue;
          const horizontal =
            p.y === q.y &&
            r.y === t.y &&
            Math.abs(p.y - r.y) < 32 &&
            Math.max(Math.min(p.x, q.x), Math.min(r.x, t.x)) <
              Math.min(Math.max(p.x, q.x), Math.max(r.x, t.x));
          const vertical =
            p.x === q.x &&
            r.x === t.x &&
            Math.abs(p.x - r.x) < 32 &&
            Math.max(Math.min(p.y, q.y), Math.min(r.y, t.y)) <
              Math.min(Math.max(p.y, q.y), Math.max(r.y, t.y));
          if (horizontal || vertical)
            throw new Error('Layout could not separate every line. Choose a smaller system.');
        }
      }
    }
  }

  for (let index = 0; index < layout.nodes.length; index++) {
    const a = layout.nodes[index]!;
    for (const b of layout.nodes.slice(index + 1)) {
      if (
        a.x < b.x + b.width + 24 &&
        a.x + a.width + 24 > b.x &&
        a.y < b.y + b.height + 24 &&
        a.y + a.height + 24 > b.y
      ) {
        throw new Error('Layout could not separate every part. Choose a smaller system.');
      }
    }

    for (const edge of layout.edges) {
      const first = edge.points[0]!,
        last = edge.points.at(-1)!;
      const onNode = (point: { x: number; y: number }) =>
        (point.x === a.x || point.x === a.x + a.width) && point.y > a.y && point.y < a.y + a.height;
      for (let segment = 1; segment < edge.points.length; segment++) {
        const p = edge.points[segment - 1]!,
          q = edge.points[segment]!;
        if (p.x !== q.x && p.y !== q.y) throw new Error('Layout returned a diagonal line.');
        if (
          (segment === 1 &&
            onNode(first) &&
            p.y === q.y &&
            (first.x === a.x ? q.x <= p.x : q.x >= p.x)) ||
          (segment === edge.points.length - 1 &&
            onNode(last) &&
            p.y === q.y &&
            (last.x === a.x ? p.x <= q.x : p.x >= q.x))
        )
          continue;
        if (
          Math.max(p.x, q.x) > a.x - 24 &&
          Math.min(p.x, q.x) < a.x + a.width + 24 &&
          Math.max(p.y, q.y) > a.y - 24 &&
          Math.min(p.y, q.y) < a.y + a.height + 24
        ) {
          throw new Error('Layout could not clear every part. Choose a smaller system.');
        }
      }
    }
  }
}
