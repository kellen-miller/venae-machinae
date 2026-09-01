import { describe, expect, it } from 'vitest';

import { projectDocumentSchema } from '../../src/lib/persistence/project-document';
import { validateRendererProjection } from '../../src/lib/renderer/projection';
import { createSVGModel, cullSVGModel } from '../../src/lib/renderer/svg/adapter';
import {
  generateRendererCapacityProject,
  projectRendererCapacityDocument
} from '../fixtures/renderer-capacity';

const cases = [
  { scale: 1 as const, components: 300, ports: 1_500, connections: 1_200, overlays: 120 },
  { scale: 2 as const, components: 600, ports: 3_000, connections: 2_400, overlays: 240 },
  { scale: 5 as const, components: 1_500, ports: 7_500, connections: 6_000, overlays: 600 }
];

describe('MVP-GATE-002 graph capacity', () => {
  for (const fixture of cases) {
    it(`preserves the exact ${fixture.scale}x project through the selected renderer`, () => {
      const document = generateRendererCapacityProject(fixture.scale);
      const parsed = projectDocumentSchema.parse(document);
      const projection = projectRendererCapacityDocument(parsed);
      const model = createSVGModel(projection, 'author');
      const documentPortIds = parsed.topology.components.flatMap((component) =>
        component.ports.map((port) => port.id)
      );

      expect({
        components: parsed.topology.components.length,
        ports: documentPortIds.length,
        connections: parsed.topology.connections.length,
        overlays: projection.overlayMarks.length
      }).toEqual({
        components: fixture.components,
        ports: fixture.ports,
        connections: fixture.connections,
        overlays: fixture.overlays
      });
      expect(validateRendererProjection(projection)).toBe(projection);
      expect(model.nodes.map(({ node }) => node.id)).toEqual(
        parsed.topology.components.map((component) => component.id)
      );
      expect(model.nodes.flatMap(({ node }) => node.ports.map((port) => port.id))).toEqual(
        documentPortIds
      );
      expect(
        model.connections.map(({ connection }) => ({
          id: connection.id,
          sourcePortId: connection.sourcePortId,
          targetPortId: connection.targetPortId
        }))
      ).toEqual(
        parsed.topology.connections.map((connection) => ({
          id: connection.id,
          sourcePortId: connection.sourcePortId,
          targetPortId: connection.targetPortId
        }))
      );
      expect(new Set(model.connections.map(({ connection }) => connection.physical.kind))).toEqual(
        new Set(['wire', 'hose', 'tube', 'pipe'])
      );
      expect(model.connections.every(({ connection }) => connection.routePoints.length === 1)).toBe(
        true
      );
    });
  }

  it('culls only the SVG viewport while preserving the complete app-owned projection', () => {
    const document = generateRendererCapacityProject(5);
    const projection = projectRendererCapacityDocument(document);
    const completeModel = createSVGModel(projection, 'author');
    const visibleModel = cullSVGModel(completeModel, { x: 0, y: 0, zoom: 1 });

    expect({
      completeNodes: completeModel.nodes.length,
      completeConnections: completeModel.connections.length,
      visibleNodes: visibleModel.nodes.length,
      visibleConnections: visibleModel.connections.length,
      firstNodeVisible: visibleModel.nodes.some(({ node }) => node.id === 'renderer-component-5x-0')
    }).toEqual({
      completeNodes: 1_500,
      completeConnections: 6_000,
      visibleNodes: 20,
      visibleConnections: 94,
      firstNodeVisible: true
    });
  });
});
