import { describe, expect, it } from 'vitest';
import ELK from 'elkjs/lib/elk.bundled';
import stock from '../../static/examples/rx7-fd-stock.v1.venae.json';
import { migrateProjectDocument } from '../../src/lib/exchange/project-document-migration';
import {
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from '../../src/lib/persistence/project-document';
import { projectSnapshotToRendererProjection } from '../../src/lib/renderer/projection';
import {
  createDiagramGraph,
  diagramLayoutFromGraph,
  assertDiagramClearance
} from '../../src/lib/renderer/diagram-layout';
import { createSVGModel } from '../../src/lib/renderer/svg/adapter';
import { applyProjectAction } from '../../src/lib/project/apply-action';

const migrated = migrateProjectDocument(stock.payload);
if (!migrated.migrated) throw new Error('Stock fixture cannot migrate');
const snapshot = projectDocumentToSnapshot(migrated.document);
const elk = new ELK({ algorithms: ['layered'] });

describe('coordinated ELK diagram layout', () => {
  for (const system of [{ id: null, label: 'All systems' }, ...snapshot.topology.systems]) {
    it(`arranges ${system.label} on grid with clear cards and attached orthogonal lines`, async () => {
      const projection = projectSnapshotToRendererProjection(snapshot, {
        systemFilterId: system.id
      });
      const graph = createDiagramGraph(projection);
      const layout = diagramLayoutFromGraph(await elk.layout(graph));
      expect(layout.nodes).toHaveLength(projection.nodes.length);
      expect(layout.edges).toHaveLength(projection.connections.length);
      for (const node of layout.nodes) {
        expect(node.x % 8).toBe(0);
        expect(node.y % 8).toBe(0);
      }
      for (const edge of layout.edges)
        for (const point of edge.points) {
          expect(point.x % 8).toBe(0);
          expect(point.y % 8).toBe(0);
        }
      const result = applyProjectAction(snapshot, {
        type: 'tidy-diagram',
        layout,
        causationId: 'tidy-test'
      });
      expect(result.accepted).toBe(true);
      if (!result.accepted) return;
      expect(result.undoLabel).toBe('Tidy diagram');
      expect(result.snapshot.fluid).toEqual(snapshot.fluid);
      expect(result.snapshot.topology.connections).toEqual(snapshot.topology.connections);
      const reloaded = projectDocumentToSnapshot(projectSnapshotToDocument(result.snapshot));
      expect(reloaded.diagramLayout?.nodes).toEqual(expect.arrayContaining(layout.nodes));
      expect(reloaded.diagramLayout?.edges).toEqual(expect.arrayContaining(layout.edges));
      const model = createSVGModel(
        projectSnapshotToRendererProjection(reloaded, { systemFilterId: system.id }),
        'author'
      );
      for (const edge of model.connections) {
        expect(edge.points).toEqual(
          layout.edges.find((saved) => saved.id === edge.connection.id)?.points
        );
        expect(edge.points[0]).toEqual(edge.source.center);
        expect(edge.points.at(-1)).toEqual(edge.target.center);
      }
    });
  }
  it('reserves known and unknown badges with wide lines, long labels and cycles', async () => {
    const input = projectSnapshotToRendererProjection(snapshot);
    const projection = {
      ...input,
      nodes: input.nodes.map((node) => ({ ...node, label: `Long component title: ${node.label}` })),
      connections: input.connections.map((edge, index) => ({
        ...edge,
        physical: {
          ...edge.physical,
          sizeStatus: 'known' as const,
          sizeLabel: index % 2 ? '-6AN' : '-20AN',
          nominalDashSize: index % 2 ? 6 : 20
        }
      }))
    };
    const graph = createDiagramGraph(projection);
    const layout = diagramLayoutFromGraph(await elk.layout(graph));
    expect(layout.edges.every((edge) => edge.label !== null)).toBe(true);
    expect(() => assertDiagramClearance(layout)).not.toThrow();
    expect(diagramLayoutFromGraph(await elk.layout(createDiagramGraph(projection)))).toEqual(
      layout
    );
  });

  it('permits shared port stubs but rejects overlapping later segments', () => {
    const shared = {
      engine: 'elk-layered' as const,
      nodes: [],
      edges: [
        {
          id: 'a',
          points: [
            { x: 0, y: 0 },
            { x: 64, y: 0 },
            { x: 64, y: 96 },
            { x: 256, y: 96 },
            { x: 256, y: 192 }
          ],
          label: null
        },
        {
          id: 'b',
          points: [
            { x: 0, y: 0 },
            { x: 96, y: 0 },
            { x: 96, y: 96 },
            { x: 192, y: 96 },
            { x: 192, y: 256 }
          ],
          label: null
        }
      ]
    };
    expect(() => assertDiagramClearance(shared)).toThrow('separate every line');
    shared.edges[1]!.points = [
      { x: 0, y: 0 },
      { x: 128, y: 0 },
      { x: 128, y: -96 },
      { x: 320, y: -96 }
    ];
    expect(() => assertDiagramClearance(shared)).not.toThrow();
  });

  it('rejects detached imported paths and clears generated paths after a manual move', () => {
    const moved = applyProjectAction(snapshot, {
      type: 'move-component',
      componentId: snapshot.topology.components[0]!.id,
      position: { x: '800', y: '800' },
      causationId: 'move'
    });
    expect(moved.accepted).toBe(true);
    if (moved.accepted) expect(moved.snapshot.diagramLayout?.edges).toEqual([]);
    const malformed = structuredClone(snapshot.diagramLayout!);
    malformed.edges[0]!.points[0]!.x += 8;
    expect(
      applyProjectAction(snapshot, {
        type: 'tidy-diagram',
        layout: malformed,
        causationId: 'invalid'
      })
    ).toMatchObject({ accepted: false, rejection: { code: 'invalid-diagram-layout' } });
    const document = projectSnapshotToDocument(snapshot);
    document.diagramLayout = malformed;
    expect(() => projectDocumentToSnapshot(document)).toThrow('endpoints');
  });

  it('checks endpoint exit corridors and unrelated card obstacles', () => {
    const layout = {
      engine: 'elk-layered' as const,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 100, ports: [] }],
      edges: [
        {
          id: 'edge',
          points: [
            { x: 100, y: 50 },
            { x: -100, y: 50 }
          ],
          label: null
        }
      ]
    };
    expect(() => assertDiagramClearance(layout)).toThrow('clear');
    layout.edges[0]!.points = [
      { x: -100, y: 50 },
      { x: 200, y: 50 }
    ];
    expect(() => assertDiagramClearance(layout)).toThrow('clear');
    layout.edges[0]!.points = [
      { x: -100, y: -100 },
      { x: 200, y: 50 }
    ];
    expect(() => assertDiagramClearance(layout)).toThrow('diagonal');
  });

  it('rejects colliding and diagonal geometry', () => {
    expect(() =>
      assertDiagramClearance({
        engine: 'elk-layered',
        nodes: [
          { id: 'a', x: 0, y: 0, width: 100, height: 100, ports: [] },
          { id: 'b', x: 50, y: 0, width: 100, height: 100, ports: [] }
        ],
        edges: []
      })
    ).toThrow('separate');
  });
});
