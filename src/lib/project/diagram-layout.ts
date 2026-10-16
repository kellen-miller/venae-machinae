import { z } from 'zod';
import type { Topology } from '../topology/topology';

const diagramCoordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const diagramPoint = z.strictObject({ x: diagramCoordinate, y: diagramCoordinate });

export const diagramLayoutSchema = z.strictObject({
  engine: z.literal('elk-layered'),
  nodes: z.array(
    z.strictObject({
      id: z.string().min(1).max(160),
      x: diagramCoordinate,
      y: diagramCoordinate,
      width: diagramCoordinate.positive(),
      height: diagramCoordinate.positive(),
      ports: z.array(
        z.strictObject({
          id: z.string().min(1).max(160),
          side: z.enum(['left', 'right']),
          offset: z.number().gt(0).lt(1)
        })
      )
    })
  ),
  edges: z.array(
    z.strictObject({
      id: z.string().min(1).max(160),
      points: z.array(diagramPoint).min(2).max(1000),
      label: diagramPoint.nullable()
    })
  )
});

export type DiagramLayout = z.infer<typeof diagramLayoutSchema>;

/** Shared reference/geometry boundary for commands, local storage and imports. */
export function validateDiagramLayout(
  layout: DiagramLayout | null,
  topology: Topology
): string | null {
  if (!layout) return null;
  const components = new Map(topology.components.map((component) => [component.id, component]));
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  const ports = new Map<string, { x: number; y: number }>();
  if (
    nodes.size !== layout.nodes.length ||
    new Set(layout.edges.map((edge) => edge.id)).size !== layout.edges.length
  ) {
    return 'Diagram contains duplicate parts or lines';
  }

  for (const node of layout.nodes) {
    const component = components.get(node.id);
    if (
      !component ||
      node.ports.length !== component.ports.length ||
      node.ports.some((port) => !component.ports.some((candidate) => candidate.id === port.id))
    ) {
      return 'Diagram references changed parts or ports';
    }

    for (const port of node.ports) {
      if (ports.has(port.id)) return 'Diagram contains duplicate ports';
      ports.set(port.id, {
        x: Number(component.position.x) + (port.side === 'right' ? node.width : 0),
        y: Number(component.position.y) + node.height * port.offset
      });
    }
  }

  const connections = new Map(topology.connections.map((edge) => [edge.id, edge]));
  for (const edge of layout.edges) {
    const connection = connections.get(edge.id);
    const source = connection ? ports.get(connection.sourcePortId) : undefined;
    const target = connection ? ports.get(connection.targetPortId) : undefined;
    const first = edge.points[0],
      last = edge.points.at(-1);
    if (
      !source ||
      !target ||
      !first ||
      !last ||
      Math.abs(first.x - source.x) > 0.001 ||
      Math.abs(first.y - source.y) > 0.001 ||
      Math.abs(last.x - target.x) > 0.001 ||
      Math.abs(last.y - target.y) > 0.001
    ) {
      return 'Diagram line endpoints do not match their ports';
    }

    if (
      edge.points
        .slice(1)
        .some(
          (point, index) => point.x !== edge.points[index]!.x && point.y !== edge.points[index]!.y
        )
    ) {
      return 'Diagram contains diagonal automatic lines';
    }
  }

  return null;
}
