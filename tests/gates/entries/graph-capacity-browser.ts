import { mount, tick, unmount } from 'svelte';

import type { RendererIntent } from '../../../src/lib/renderer/intent';
import type { RendererPoint, RendererProjection } from '../../../src/lib/renderer/projection';
import {
  generateRendererCapacityProject,
  projectRendererCapacityDocument
} from '../../fixtures/renderer-capacity';
import type { CapacityScale } from '../../fixtures/capacity-project';
import CapacityGateHarness from './CapacityGateHarness.svelte';

type CapacityHarness = Readonly<{
  readProjection(): RendererProjection;
}>;

type CapacityState = Readonly<{
  identityFingerprint: string;
  nodeCount: number;
  portCount: number;
  connectionCount: number;
  overlayCount: number;
  selectedNodeIds: readonly string[];
  firstNodePosition: RendererPoint;
  firstRoutePointPosition: RendererPoint;
  intentCount: number;
}>;

let harness: CapacityHarness | undefined;
let intentLog: RendererIntent[] = [];

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function identityFingerprint(projection: RendererProjection): string {
  let hash = 2_166_136_261;
  const update = (value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }
  };
  for (const node of projection.nodes) {
    update(`${node.id}|${node.kind}|`);
    for (const port of node.ports) update(`${port.id}|${port.nodeId}|${port.domain}|`);
  }
  for (const connection of projection.connections) {
    update(
      `${connection.id}|${connection.sourcePortId}|${connection.targetPortId}|${connection.physical.kind}|`
    );
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function currentProjection(): RendererProjection {
  if (!harness) throw new Error('Capacity harness is not mounted');
  return harness.readProjection();
}

export async function mountCapacityGate(scale: CapacityScale): Promise<{
  scale: CapacityScale;
  initialPaintMs: number;
  snapshotToInteractiveMs: number;
  state: CapacityState;
}> {
  if (harness) await unmount(harness);
  document.body.replaceChildren();
  intentLog = [];

  const projectDocument = generateRendererCapacityProject(scale);
  const snapshotReturnedAt = performance.now();
  const projection = projectRendererCapacityDocument(projectDocument);
  const initialPaintStartedAt = performance.now();
  const target = document.createElement('div');
  document.body.append(target);
  harness = mount(CapacityGateHarness, {
    target,
    props: {
      projection,
      recordIntent(intent) {
        intentLog.push(intent);
      }
    }
  }) as CapacityHarness;
  await tick();
  await nextFrame();
  await nextFrame();
  const interactiveAt = performance.now();

  return {
    scale,
    initialPaintMs: interactiveAt - initialPaintStartedAt,
    snapshotToInteractiveMs: interactiveAt - snapshotReturnedAt,
    state: readCapacityGateState()
  };
}

export function readCapacityGateState(): CapacityState {
  const projection = currentProjection();
  const firstNode = projection.nodes[0];
  const firstRoutePoint = projection.connections[0]?.routePoints[0];
  if (!firstNode || !firstRoutePoint) throw new Error('Capacity projection is empty');

  return {
    identityFingerprint: identityFingerprint(projection),
    nodeCount: projection.nodes.length,
    portCount: projection.nodes.reduce((count, node) => count + node.ports.length, 0),
    connectionCount: projection.connections.length,
    overlayCount: projection.overlayMarks.length,
    selectedNodeIds: projection.nodes.filter((node) => node.selected).map((node) => node.id),
    firstNodePosition: { ...firstNode.position },
    firstRoutePointPosition: { ...firstRoutePoint.position },
    intentCount: intentLog.length
  };
}
