import { describe, expect, it } from 'vitest';

import { FLUID_NOMINAL_SIZE_LABEL, fluidLineNominalSize } from '../../src/lib/fluid/fluid';
import {
  projectDocumentSchema,
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from '../../src/lib/persistence/project-document';
import { applyProjectAction } from '../../src/lib/project/apply-action';
import stockExample from '../../static/examples/rx7-fd-stock.v1.venae.json';
import { projectSnapshotToRendererProjection } from '../../src/lib/renderer/projection';
import { createSVGModel, fitRendererProjection } from '../../src/lib/renderer/svg/adapter';
import { rendererGateProjection } from '../fixtures/renderer-projection';

const stock = projectDocumentToSnapshot(projectDocumentSchema.parse(stockExample.payload));
const connectionId = stock.topology.connections[0]!.id;
const sizeAction = {
  type: 'configure-fluid-line-size' as const,
  causationId: 'set-size',
  connectionId,
  evidenceId: 'line-size',
  dashSize: 6,
  provenance: 'Illustrative user entry'
};

describe('fluid line sizes and schematic geometry', () => {
  it('keeps the stock example unsized and persists nominal size without changing hydraulic data', () => {
    expect(
      stock.topology.connections.every(
        (line) => fluidLineNominalSize(stock.evidence, line.id).status === 'unknown'
      )
    ).toBe(true);
    const six = applyProjectAction(stock, sizeAction);
    if (!six.accepted) throw new Error(six.rejection.message);

    const eight = applyProjectAction(six.snapshot, { ...sizeAction, dashSize: 8 });
    if (!eight.accepted) throw new Error(eight.rejection.message);

    expect(eight.snapshot.fluid).toEqual(stock.fluid);
    expect(eight.snapshot.evidence.filter((record) => record.id === 'line-size')).toHaveLength(1);
    const reloaded = projectDocumentToSnapshot(projectSnapshotToDocument(eight.snapshot));
    expect(fluidLineNominalSize(reloaded.evidence, connectionId)).toEqual({
      dashSize: 8,
      status: 'known',
      label: '-8AN'
    });
    const width = (snapshot: typeof stock) =>
      createSVGModel(projectSnapshotToRendererProjection(snapshot), 'author').connections.find(
        (line) => line.connection.id === connectionId
      )!.strokeWidth;
    expect(width(eight.snapshot)).toBeGreaterThan(width(six.snapshot));

    const cleared = applyProjectAction(eight.snapshot, { ...sizeAction, dashSize: null });
    if (!cleared.accepted) throw new Error(cleared.rejection.message);

    expect(fluidLineNominalSize(cleared.snapshot.evidence, connectionId).status).toBe('unknown');
  });

  it('rejects invalid sizes and ownership collisions', () => {
    for (const dashSize of [0, 65, -6, 6.5, NaN, Infinity]) {
      expect(applyProjectAction(stock, { ...sizeAction, dashSize }).accepted).toBe(false);
    }

    for (const evidenceId of ['', stock.id, stock.evidence[0]!.id, 'x'.repeat(161)]) {
      expect(applyProjectAction(stock, { ...sizeAction, evidenceId }).accepted).toBe(false);
    }

    expect(applyProjectAction(stock, { ...sizeAction, provenance: ' ' }).accepted).toBe(false);
  });

  it('keeps contradictory evidence visible instead of choosing a size', () => {
    const record = {
      id: 'size-a',
      subjectId: connectionId,
      label: FLUID_NOMINAL_SIZE_LABEL,
      state: 'known' as const,
      value: '-6AN',
      unit: 'AN',
      provenance: 'A',
      conflictValues: []
    };
    expect(fluidLineNominalSize([record], connectionId).dashSize).toBe(6);
    expect(
      fluidLineNominalSize([record, { ...record, id: 'size-b', value: '8' }], connectionId).status
    ).toBe('conflicting');
    expect(fluidLineNominalSize([{ ...record, unit: 'mm' }], connectionId).status).toBe('unknown');
  });

  it('routes around an intervening part while keeping endpoints attached', () => {
    const blocker = {
      ...rendererGateProjection.nodes[2],
      id: 'blocker',
      ports: [],
      position: { x: 390, y: 140 },
      width: 70,
      height: 180
    };
    const projection = {
      ...rendererGateProjection,
      nodes: [rendererGateProjection.nodes[0], rendererGateProjection.nodes[1], blocker],
      connections: [{ ...rendererGateProjection.connections[0], routePoints: [] }],
      overlayMarks: []
    };
    const line = createSVGModel(projection, 'author').connections[0]!;
    expect(line.points[0]).toEqual(line.source.center);
    expect(line.points.at(-1)).toEqual(line.target.center);
    expect(line.path).toContain(' Q ');
    for (let index = 1; index < line.points.length; index++) {
      const a = line.points[index - 1]!,
        b = line.points[index]!;
      const crosses =
        a.y === b.y
          ? a.y > 140 && a.y < 320 && Math.min(a.x, b.x) < 460 && Math.max(a.x, b.x) > 390
          : a.x > 390 && a.x < 460 && Math.min(a.y, b.y) < 320 && Math.max(a.y, b.y) > 140;
      expect(crosses).toBe(false);
    }
  });

  it('fits distant authored routes as well as parts', () => {
    const projection = {
      ...rendererGateProjection,
      overlayMarks: [],
      connections: [
        {
          ...rendererGateProjection.connections[0],
          routePoints: [{ id: 'far', position: { x: 1800, y: 1600 } }]
        }
      ]
    };
    const viewport = fitRendererProjection(projection);
    expect(1800 * viewport.zoom + viewport.x).toBeLessThan(940);
    expect(1600 * viewport.zoom + viewport.y).toBeLessThan(600);
  });
});
