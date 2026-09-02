import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { validateRendererProjection } from '../../src/lib/renderer/projection';
import { createSVGModel } from '../../src/lib/renderer/svg/adapter';
import { rendererGateProjection } from '../fixtures/renderer-projection';

describe('MVP-UX-005 MVP-ARCH-010 MVP-GATE-001 renderer fit', () => {
  it('maps app-owned Ports, route points, physical language, and additive Overlays', () => {
    expect(validateRendererProjection(rendererGateProjection)).toBe(rendererGateProjection);

    const model = createSVGModel(rendererGateProjection, 'author');

    expect(
      model.nodes.map((node) => ({
        id: node.node.id,
        position: node.node.position,
        width: node.node.width,
        height: node.node.height,
        selected: node.node.selected,
        portCenters: node.portCenters.map((port) => ({ id: port.port.id, center: port.center }))
      }))
    ).toEqual([
      {
        id: 'fuel-pump',
        position: { x: 80, y: 110 },
        width: 220,
        height: 150,
        selected: true,
        portCenters: [
          { id: 'pump-power', center: { x: 80, y: 162.5 } },
          { id: 'pump-outlet', center: { x: 300, y: 207.5 } }
        ]
      },
      {
        id: 'fuel-rail',
        position: { x: 590, y: 145 },
        width: 210,
        height: 130,
        selected: false,
        portCenters: [{ id: 'rail-inlet', center: { x: 590, y: 210 } }]
      },
      {
        id: 'fuse-panel',
        position: { x: 75, y: 390 },
        width: 210,
        height: 130,
        selected: false,
        portCenters: [{ id: 'fuse-output', center: { x: 285, y: 455 } }]
      }
    ]);
    expect(
      model.connections.map((connection) => ({
        id: connection.connection.id,
        sourcePort: connection.source.port.id,
        targetPort: connection.target.port.id,
        sourceCenter: connection.source.center,
        targetCenter: connection.target.center,
        physicalKind: connection.connection.physical.kind,
        routePointIds: connection.connection.routePoints.map((point) => point.id),
        overlayChannels: connection.overlayMarks.map((mark) => mark.channel)
      }))
    ).toEqual([
      {
        id: 'fuel-feed',
        sourcePort: 'pump-outlet',
        targetPort: 'rail-inlet',
        sourceCenter: { x: 300, y: 207.5 },
        targetCenter: { x: 590, y: 210 },
        physicalKind: 'hose',
        routePointIds: ['fuel-feed-route-1', 'fuel-feed-route-2'],
        overlayChannels: ['direction', 'temperature']
      },
      {
        id: 'pump-supply',
        sourcePort: 'fuse-output',
        targetPort: 'pump-power',
        sourceCenter: { x: 285, y: 455 },
        targetCenter: { x: 80, y: 162.5 },
        physicalKind: 'wire',
        routePointIds: ['pump-supply-route-1'],
        overlayChannels: ['potential', 'selection']
      }
    ]);
  });

  it('rejects domain-invalid physical connections at the renderer boundary', () => {
    const invalid = {
      ...rendererGateProjection,
      connections: [
        {
          ...rendererGateProjection.connections[0],
          physical: { ...rendererGateProjection.connections[0].physical, kind: 'wire' as const }
        },
        rendererGateProjection.connections[1]
      ]
    } as const;

    expect(() => validateRendererProjection(invalid)).toThrow(
      'Connection fuel-feed uses wire between non-electrical Ports'
    );
  });

  it('keeps the provisional dependency inside one concrete adapter', () => {
    const adapterDirectories = ['canvas', 'svg', 'xyflow'].filter((candidate) =>
      existsSync(`src/lib/renderer/${candidate}`)
    );
    const appOwnedSources = [
      'src/lib/renderer/projection.ts',
      'src/lib/renderer/intent.ts',
      'src/lib/renderer/TopologyRenderer.svelte'
    ].map((path) => readFileSync(path, 'utf8'));

    expect(adapterDirectories).toEqual(['svg']);
    expect(appOwnedSources.every((source) => !source.includes('@xyflow/svelte'))).toBe(true);
    expect(readFileSync('src/lib/renderer/TopologyRenderer.svelte', 'utf8')).toContain(
      './svg/SVGRenderer.svelte'
    );
    expect(readFileSync('package.json', 'utf8')).not.toContain('@xyflow/svelte');
  });
});
