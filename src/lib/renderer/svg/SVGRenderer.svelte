<script lang="ts">
  import type { RendererIntentHandler } from '../intent';
  import {
    rendererPortsCanConnect,
    type RendererCapabilityMode,
    type RendererNode,
    type RendererPoint,
    type RendererPort,
    type RendererProjection,
    type RendererViewport
  } from '../projection';
  import { createSVGModel, cullSVGModel } from './adapter';

  let {
    projection,
    viewport,
    capability,
    onintent
  }: {
    projection: RendererProjection;
    viewport: RendererViewport;
    capability: RendererCapabilityMode;
    onintent: RendererIntentHandler;
  } = $props();

  const rendererId = $props.id();
  const model = $derived(createSVGModel(projection, capability));
  let liveViewport = $derived({ ...viewport });
  const cullViewportX = $derived(Math.round(liveViewport.x / 120) * 120);
  const cullViewportY = $derived(Math.round(liveViewport.y / 120) * 120);
  const cullViewportZoom = $derived(Math.max(0.25, Math.round(liveViewport.zoom * 4) / 4));
  const visibleModel = $derived(
    cullSVGModel(model, {
      x: cullViewportX,
      y: cullViewportY,
      zoom: cullViewportZoom
    })
  );
  let svgElement: SVGSVGElement;
  let contentElement: SVGGElement;
  let pendingSourcePortId = $state<string | null>(null);
  let drag = $state<{
    componentId: string;
    pointerId: number;
    startPointer: RendererPoint;
    startPosition: RendererPoint;
    position: RendererPoint;
  } | null>(null);
  let pan = $state<{
    pointerId: number;
    clientX: number;
    clientY: number;
    viewport: RendererViewport;
  } | null>(null);

  function attachSVG(element: SVGSVGElement): void {
    svgElement = element;
  }

  function attachContent(element: SVGGElement): void {
    contentElement = element;
  }

  function diagramPoint(event: PointerEvent): RendererPoint {
    const matrix = contentElement.getScreenCTM();
    if (!matrix) return { x: event.clientX, y: event.clientY };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function renderedNodePosition(node: RendererNode): RendererPoint {
    return drag?.componentId === node.id ? drag.position : node.position;
  }

  function startNodeDrag(event: PointerEvent, node: RendererNode): void {
    if (capability !== 'author' || event.button !== 0) return;
    event.stopPropagation();
    svgElement.setPointerCapture(event.pointerId);
    drag = {
      componentId: node.id,
      pointerId: event.pointerId,
      startPointer: diagramPoint(event),
      startPosition: node.position,
      position: node.position
    };
  }

  function startPan(event: PointerEvent): void {
    if (event.button !== 0) return;
    svgElement.setPointerCapture(event.pointerId);
    pan = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewport: liveViewport
    };
  }

  function handlePointerMove(event: PointerEvent): void {
    if (drag?.pointerId === event.pointerId) {
      const pointer = diagramPoint(event);
      drag = {
        ...drag,
        position: {
          x: Math.round((drag.startPosition.x + pointer.x - drag.startPointer.x) / 8) * 8,
          y: Math.round((drag.startPosition.y + pointer.y - drag.startPointer.y) / 8) * 8
        }
      };
      return;
    }

    if (pan?.pointerId === event.pointerId) {
      liveViewport = {
        ...pan.viewport,
        x: pan.viewport.x + (event.clientX - pan.clientX) / pan.viewport.zoom,
        y: pan.viewport.y + (event.clientY - pan.clientY) / pan.viewport.zoom
      };
    }
  }

  function finishPointerInteraction(event: PointerEvent): void {
    if (drag?.pointerId === event.pointerId) {
      onintent({
        type: 'move-component',
        componentId: drag.componentId,
        position: drag.position
      });
      drag = null;
    }

    if (pan?.pointerId === event.pointerId) {
      onintent({ type: 'viewport-changed', viewport: liveViewport });
      pan = null;
    }

    if (svgElement.hasPointerCapture(event.pointerId))
      svgElement.releasePointerCapture(event.pointerId);
  }

  function changeZoom(event: WheelEvent): void {
    const zoom = Math.min(2.25, Math.max(0.35, liveViewport.zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
    liveViewport = { ...liveViewport, zoom };
    onintent({ type: 'viewport-changed', viewport: liveViewport });
  }

  function activatePort(port: RendererPort): void {
    if (capability !== 'author') return;
    if (!pendingSourcePortId) {
      if (port.direction === 'input') return;
      pendingSourcePortId = port.id;
      onintent({ type: 'preview', sourcePortId: port.id, targetPortId: null });
      return;
    }

    if (pendingSourcePortId === port.id) {
      pendingSourcePortId = null;
      onintent({ type: 'preview', sourcePortId: null, targetPortId: null });
      return;
    }

    if (rendererPortsCanConnect(projection, pendingSourcePortId, port.id)) {
      onintent({
        type: 'connect-ports',
        sourcePortId: pendingSourcePortId,
        targetPortId: port.id
      });
      pendingSourcePortId = null;
      onintent({ type: 'preview', sourcePortId: null, targetPortId: null });
      return;
    }

    onintent({ type: 'preview', sourcePortId: pendingSourcePortId, targetPortId: port.id });
  }

  function activateWithKeyboard(event: KeyboardEvent, action: () => void): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  }

  function fluidColor(medium: string | undefined): string {
    if (medium === 'gasoline') return '#c79b3b';
    if (medium === 'coolant') return '#4b8f9a';
    if (medium === 'oil') return '#8a6444';
    if (medium === 'air') return '#86a6aa';
    return '#6b8a83';
  }
</script>

<div
  class="svg-frame"
  data-renderer-adapter="svg"
  data-renderer-id={rendererId}
  data-rendered-node-count={visibleModel.nodes.length}
  data-rendered-connection-count={visibleModel.connections.length}
>
  <svg
    {@attach attachSVG}
    viewBox="0 0 940 600"
    role="application"
    aria-label="Topology canvas"
    onpointermove={handlePointerMove}
    onpointerup={finishPointerInteraction}
    onpointercancel={finishPointerInteraction}
    onwheel={changeZoom}
  >
    <defs>
      <pattern id={`${rendererId}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" class="grid-dot" />
      </pattern>
    </defs>
    <rect
      class="pan-surface"
      width="940"
      height="600"
      fill={`url(#${rendererId}-grid)`}
      data-pan-surface
      role="presentation"
      onpointerdown={startPan}
    />

    <g
      {@attach attachContent}
      transform={`translate(${liveViewport.x} ${liveViewport.y}) scale(${liveViewport.zoom})`}
    >
      <g class="connection-layer">
        {#each visibleModel.connections as mapped (mapped.connection.id)}
          {@const physical = mapped.connection.physical}
          {@const isWire = physical.kind === 'wire'}
          {@const outerWidth = isWire ? Math.max(5, (physical.conductorScale ?? 12) / 2) : 13}
          {@const innerWidth = isWire ? Math.max(2, outerWidth - 3) : 7}
          <g
            class:selected={mapped.connection.selected}
            data-renderer-connection={mapped.connection.id}
            data-physical-kind={physical.kind}
            data-source-port={mapped.source.port.id}
            data-target-port={mapped.target.port.id}
            role="button"
            tabindex="0"
            aria-label={`${mapped.connection.label}, ${physical.kind}`}
            onclick={() =>
              onintent({ type: 'select', target: 'connection', id: mapped.connection.id })}
            onkeydown={(event) =>
              activateWithKeyboard(event, () =>
                onintent({ type: 'select', target: 'connection', id: mapped.connection.id })
              )}
          >
            <path
              d={mapped.path}
              class:wire-outer={isWire}
              class:fluid-outer={!isWire}
              stroke-width={outerWidth}
              data-physical-layer="outer"
            />
            <path
              d={mapped.path}
              class="physical-inner"
              stroke={isWire ? (physical.conductorColor ?? '#b34d3d') : fluidColor(physical.medium)}
              stroke-width={innerWidth}
              data-physical-layer="medium"
            />
            {#if physical.conductorStripe}
              <path
                d={mapped.path}
                class="conductor-stripe"
                stroke={physical.conductorStripe}
                stroke-width={Math.max(1, innerWidth / 3)}
                data-physical-layer="stripe"
              />
            {/if}
            {#each mapped.overlayMarks as mark (mark.id)}
              <path
                d={mapped.path}
                class={`overlay overlay--${mark.channel}`}
                data-overlay-mark={mark.id}
                data-overlay-channel={mark.channel}
                aria-label={mark.label}
              />
            {/each}
            <path
              d={mapped.path}
              class="hit-area"
              data-connection-hit-area={mapped.connection.id}
            />
          </g>
        {/each}
      </g>

      <g class="node-layer">
        {#each visibleModel.nodes as mapped (mapped.node.id)}
          {@const position = renderedNodePosition(mapped.node)}
          <g
            class="system-node"
            class:selected={mapped.node.selected}
            class:dragging={drag?.componentId === mapped.node.id}
            transform={`translate(${position.x} ${position.y})`}
            data-renderer-node={mapped.node.id}
            data-selected={mapped.node.selected}
          >
            <rect
              class="node-shadow"
              x="4"
              y="7"
              width={mapped.node.width}
              height={mapped.node.height}
              rx="10"
            />
            <rect
              class="node-shell"
              width={mapped.node.width}
              height={mapped.node.height}
              rx="10"
              role="button"
              tabindex="0"
              aria-label={`${mapped.node.label}, ${mapped.node.kind}`}
              onpointerdown={(event) => startNodeDrag(event, mapped.node)}
              onclick={() => onintent({ type: 'select', target: 'node', id: mapped.node.id })}
              onkeydown={(event) =>
                activateWithKeyboard(event, () =>
                  onintent({ type: 'select', target: 'node', id: mapped.node.id })
                )}
            />
            <path
              class="node-heading"
              d={`M 0 10 Q 0 0 10 0 H ${mapped.node.width - 10} Q ${mapped.node.width} 0 ${mapped.node.width} 10 V 48 H 0 Z`}
            />
            <rect class="node-accent" y="45" width={mapped.node.width} height="3" />
            <text class="node-kind" x="14" y="17">{mapped.node.kind.toUpperCase()}</text>
            <text class="node-label" x="14" y="37">{mapped.node.label}</text>
            {#each mapped.node.ports as port, index (port.id)}
              <text class="port-label" x="14" y={70 + index * 23}>{port.label}</text>
              <text class="port-domain" x={mapped.node.width - 14} y={70 + index * 23}>
                {port.domain}
              </text>
            {/each}
            {#each mapped.portCenters as mappedPort (mappedPort.port.id)}
              <circle
                cx={mappedPort.center.x - mapped.node.position.x}
                cy={mappedPort.center.y - mapped.node.position.y}
                r="9"
                class="renderer-port"
                class:fluid-port={mappedPort.port.domain === 'fluid'}
                class:compatible={mappedPort.port.compatibility === 'compatible'}
                class:pending={pendingSourcePortId === mappedPort.port.id}
                data-renderer-port={mappedPort.port.id}
                data-port-domain={mappedPort.port.domain}
                data-port-direction={mappedPort.port.direction}
                role="button"
                tabindex={capability === 'author' ? 0 : -1}
                aria-label={`${mappedPort.port.label}, ${mappedPort.port.domain} ${mappedPort.port.direction} Port`}
                onclick={(event) => {
                  event.stopPropagation();
                  activatePort(mappedPort.port);
                }}
                onkeydown={(event) =>
                  activateWithKeyboard(event, () => activatePort(mappedPort.port))}
              >
                <title
                  >{mappedPort.port.label} · {mappedPort.port.domain}
                  {mappedPort.port.direction}</title
                >
              </circle>
            {/each}
          </g>
        {/each}
      </g>

      {#if capability === 'author'}
        <g class="route-layer" aria-label="Editable route points">
          {#each visibleModel.connections as mapped (mapped.connection.id)}
            {#each mapped.connection.routePoints as point, index (point.id)}
              <circle
                cx={point.position.x}
                cy={point.position.y}
                r="7"
                class="route-point"
                data-renderer-route-point={point.id}
                role="button"
                tabindex="0"
                aria-label={`Route point ${index + 1} for ${mapped.connection.label}`}
                onclick={() => onintent({ type: 'select', target: 'route-point', id: point.id })}
                onkeydown={(event) => {
                  const movement = {
                    ArrowLeft: { x: -8, y: 0 },
                    ArrowRight: { x: 8, y: 0 },
                    ArrowUp: { x: 0, y: -8 },
                    ArrowDown: { x: 0, y: 8 }
                  }[event.key];
                  if (!movement) return;
                  event.preventDefault();
                  onintent({
                    type: 'move-route-point',
                    connectionId: mapped.connection.id,
                    routePointId: point.id,
                    position: {
                      x: point.position.x + movement.x,
                      y: point.position.y + movement.y
                    }
                  });
                }}
              />
            {/each}
          {/each}
        </g>
      {/if}
    </g>
  </svg>
</div>

<style>
  .svg-frame {
    width: 100%;
    height: 100%;
    min-height: 30rem;
    overflow: hidden;
    background:
      radial-gradient(circle at 18% 14%, rgb(255 255 255 / 86%), transparent 28%), #dfe8e4;
    border: 1px solid #a9bab5;
    border-radius: 16px 5px 16px 5px;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 70%);
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 30rem;
    touch-action: none;
  }

  .grid-dot {
    fill: #adc0ba;
  }

  .pan-surface {
    fill: #dfe8e4;
    cursor: grab;
  }

  .connection-layer path {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .wire-outer {
    stroke: #253538;
  }

  .fluid-outer {
    stroke: #f4f0e7;
  }

  .physical-inner {
    opacity: 0.96;
  }

  .conductor-stripe {
    stroke-dasharray: 10 7;
  }

  .overlay {
    pointer-events: none;
  }

  .overlay--direction {
    stroke: #fff8d6;
    stroke-dasharray: 2 15;
    stroke-width: 4;
  }

  .overlay--temperature {
    stroke: #b43f3f;
    stroke-dasharray: 1 26;
    stroke-width: 7;
  }

  .overlay--potential {
    stroke: #f4d35e;
    stroke-dasharray: 5 12;
    stroke-width: 2;
  }

  .overlay--current {
    stroke: #f1a84b;
    stroke-dasharray: 2 9;
    stroke-width: 3;
  }

  .overlay--signal {
    stroke: #77c9b3;
    stroke-dasharray: 7 7;
    stroke-width: 2;
  }

  .overlay--finding {
    stroke: #dc4c64;
    stroke-dasharray: 1 8;
    stroke-width: 6;
  }

  .overlay--selection {
    stroke: #e4793c;
    stroke-dasharray: 12 6;
    stroke-width: 10;
    opacity: 0.45;
  }

  .hit-area {
    pointer-events: stroke;
    stroke: transparent;
    stroke-width: 24;
  }

  .connection-layer > g:focus-visible,
  .node-shell:focus-visible,
  .renderer-port:focus-visible,
  .route-point:focus-visible {
    outline: none;
    filter: drop-shadow(0 0 5px #d3612f);
  }

  .node-shadow {
    fill: rgb(18 37 40 / 18%);
  }

  .node-shell {
    fill: #f4f7f3;
    stroke: #24494d;
    stroke-width: 2;
  }

  .system-node.selected .node-shell {
    stroke: #d16b38;
    stroke-width: 4;
  }

  .system-node.dragging {
    opacity: 0.88;
  }

  .node-heading {
    fill: #1d474a;
  }

  .node-accent {
    fill: #d58b56;
  }

  .node-kind,
  .port-domain {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    text-transform: uppercase;
  }

  .node-kind {
    fill: #f0c9a9;
    font-size: 9px;
    font-weight: 750;
    letter-spacing: 1.2px;
  }

  .node-label {
    fill: #f8faf7;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 16px;
    font-weight: 700;
  }

  .port-label {
    fill: #294043;
    font-size: 11px;
  }

  .port-domain {
    fill: #687679;
    font-size: 8px;
    text-anchor: end;
  }

  .node-layer text {
    pointer-events: none;
  }

  .renderer-port {
    fill: #f7f9f6;
    stroke: #ad5f34;
    stroke-width: 3;
    cursor: crosshair;
  }

  .renderer-port.fluid-port {
    stroke: #377f87;
  }

  .renderer-port.compatible {
    stroke-width: 5;
  }

  .renderer-port.pending {
    fill: #d1743f;
    stroke: #fff8ed;
  }

  .route-point {
    fill: #fff8ed;
    stroke: #d1743f;
    stroke-width: 3;
    cursor: move;
  }

  @media (max-width: 700px) {
    .svg-frame,
    svg {
      min-height: 21rem;
    }

    .svg-frame {
      border-radius: 12px 4px 12px 4px;
    }
  }
</style>
