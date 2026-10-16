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
  import { createSVGModel, cullSVGModel, fitRendererProjection } from './adapter';

  let {
    projection,
    viewport,
    capability,
    onintent,
    motionPaused = true
  }: {
    projection: RendererProjection;
    viewport: RendererViewport;
    capability: RendererCapabilityMode;
    onintent: RendererIntentHandler;
    motionPaused?: boolean;
  } = $props();

  const schematicSymbols: Record<string, string> = {
    pump: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M9 7l8 5-8 5z',
    'heat-exchanger': 'M4 4h16v16H4zM8 4v16m4-16v16m4-16v16M1 8h3m16 8h3',
    volume: 'M5 5h14v13q0 3-7 3t-7-3zM5 12q4-3 7 0t7 0M10 1h4v4',
    manifold: 'M3 6h7v12H3m7-6h11M16 6v12',
    'heat-source': 'M5 6h14v12H5zM2 9h3m14 6h3M9 3v3m6 12v3M11 9l-2 4h5l-2 3',
    valve: 'M3 5l9 7-9 7zm18 0l-9 7 9 7zM12 2v10',
    restriction: 'M2 6l8 6-8 6m20-12l-8 6 8 6M10 12h4'
  };
  const rendererId = $props.id();
  let drag = $state<{
    componentId: string;
    pointerId: number;
    startPointer: RendererPoint;
    startPosition: RendererPoint;
    position: RendererPoint;
  } | null>(null);
  const displayProjection = $derived(
    drag
      ? {
          ...projection,
          nodes: projection.nodes.map((node) =>
            node.id === drag?.componentId ? { ...node, position: drag.position } : node
          )
        }
      : projection
  );
  // Selection and overlays update without rebuilding route geometry.
  const geometryKey = $derived(
    JSON.stringify({
      ...displayProjection,
      revision: 0,
      nodes: displayProjection.nodes.map((node) => ({
        ...node,
        selected: false,
        previewed: false
      })),
      connections: displayProjection.connections.map((connection) => ({
        ...connection,
        selected: false,
        previewed: false
      })),
      overlayMarks: []
    })
  );
  const geometry = $derived(
    createSVGModel(JSON.parse(geometryKey) as RendererProjection, capability)
  );
  const model = $derived.by(() => {
    const nodes = new Map(displayProjection.nodes.map((node) => [node.id, node]));
    const connections = new Map(
      displayProjection.connections.map((connection) => [connection.id, connection])
    );
    const overlays: Record<string, (typeof projection.overlayMarks)[number][]> =
      Object.create(null);
    for (const mark of projection.overlayMarks) {
      (overlays[mark.connectionId] ??= []).push(mark);
    }

    return {
      nodes: geometry.nodes.map((mapped) => ({ ...mapped, node: nodes.get(mapped.node.id)! })),
      connections: geometry.connections.map((mapped) => ({
        ...mapped,
        connection: connections.get(mapped.connection.id)!,
        overlayMarks: overlays[mapped.connection.id] ?? []
      }))
    };
  });
  let liveViewport = $derived({ ...viewport });
  const visibleModel = $derived(cullSVGModel(model, liveViewport));
  let svgElement: SVGSVGElement;
  let contentElement: SVGGElement;
  let pendingSourcePortId = $state<string | null>(null);
  let hoveredNodeId = $state<string | null>(null);
  let hoveredConnectionId = $state<string | null>(null);
  const focus = $derived.by(() => {
    const connectionId =
      hoveredConnectionId ?? projection.connections.find((connection) => connection.selected)?.id;
    const nodeId = hoveredNodeId ?? projection.nodes.find((node) => node.selected)?.id;
    const ports = new Set(
      projection.nodes.find((node) => node.id === nodeId)?.ports.map((port) => port.id)
    );
    const connections = model.connections.filter((mapped) =>
      connectionId
        ? mapped.connection.id === connectionId
        : ports.has(mapped.source.port.id) || ports.has(mapped.target.port.id)
    );
    return {
      active: Boolean(connectionId || nodeId),
      connections: new Set(connections.map((mapped) => mapped.connection.id)),
      nodes: new Set(
        connections
          .flatMap((mapped) => [mapped.source.node.id, mapped.target.node.id])
          .concat(nodeId ? [nodeId] : [])
      )
    };
  });
  const mediumLegend = $derived([
    ...new Map(
      projection.connections
        .filter((connection) => connection.physical.kind !== 'wire')
        .map((connection) => [
          connection.physical.mediumLabel ?? connection.physical.medium ?? 'Fluid',
          connection.physical.mediumColor ?? '#78b9b0'
        ])
    ).entries()
  ]);
  let pan = $state<{
    pointerId: number;
    clientX: number;
    clientY: number;
    viewport: RendererViewport;
  } | null>(null);

  function attachSVG(element: SVGSVGElement): () => void {
    svgElement = element;
    element.addEventListener('wheel', changeZoom, { passive: false });
    return () => element.removeEventListener('wheel', changeZoom);
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
    onintent({ type: 'select', target: 'node', id: node.id });
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
        x: pan.viewport.x + (event.clientX - pan.clientX) / (svgElement.getScreenCTM()?.a ?? 1),
        y: pan.viewport.y + (event.clientY - pan.clientY) / (svgElement.getScreenCTM()?.d ?? 1)
      };
    }
  }

  function finishPointerInteraction(event: PointerEvent): void {
    if (drag?.pointerId === event.pointerId) {
      if (drag.position.x !== drag.startPosition.x || drag.position.y !== drag.startPosition.y) {
        onintent({
          type: 'move-component',
          componentId: drag.componentId,
          position: drag.position
        });
      }
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
    event.preventDefault();
    const matrix = svgElement.getScreenCTM();
    if (!matrix) return;

    const anchor = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    zoomAt(Math.exp(-event.deltaY * 0.0015), anchor);
  }

  function zoomAt(factor: number, anchor: RendererPoint = { x: 470, y: 300 }): void {
    const zoom = Math.min(3.5, Math.max(0.08, liveViewport.zoom * factor));
    liveViewport = {
      x: anchor.x - ((anchor.x - liveViewport.x) * zoom) / liveViewport.zoom,
      y: anchor.y - ((anchor.y - liveViewport.y) * zoom) / liveViewport.zoom,
      zoom
    };
    onintent({ type: 'viewport-changed', viewport: liveViewport });
  }

  function fitCanvas(): void {
    liveViewport = fitRendererProjection(projection);
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
  class:overview={liveViewport.zoom < 0.65}
  class:tracing={focus.active}
>
  <svg
    {@attach attachSVG}
    viewBox="0 0 940 600"
    role="application"
    aria-label="Topology canvas"
    onpointermove={handlePointerMove}
    onpointerup={finishPointerInteraction}
    onpointercancel={finishPointerInteraction}
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
      <g
        class="connection-layer"
        class:tidied={projection.connections.some((edge) => edge.diagramRoute)}
      >
        {#each visibleModel.connections as mapped (mapped.connection.id)}
          {@const physical = mapped.connection.physical}
          {@const isWire = physical.kind === 'wire'}
          {@const innerWidth = isWire
            ? Math.max(3, (physical.conductorScale ?? 12) / 2)
            : mapped.strokeWidth}
          {@const outerWidth = innerWidth + 4}
          <g
            class:selected={mapped.connection.selected}
            class:trace-active={focus.connections.has(mapped.connection.id)}
            class:trace-muted={focus.active && !focus.connections.has(mapped.connection.id)}
            style:--connection-color={physical.mediumColor ?? fluidColor(physical.medium)}
            data-renderer-connection={mapped.connection.id}
            data-physical-kind={physical.kind}
            data-direction={physical.direction ?? 'unknown'}
            data-nominal-size={physical.nominalDashSize ?? 'unknown'}
            data-source-port={mapped.source.port.id}
            data-target-port={mapped.target.port.id}
            role="button"
            tabindex="0"
            aria-label={`${mapped.connection.label}, ${physical.kind}${physical.sizeLabel ? `, ${physical.sizeLabel}` : ''}`}
            onpointerenter={() => (hoveredConnectionId = mapped.connection.id)}
            onpointerleave={() => (hoveredConnectionId = null)}
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
              stroke={isWire
                ? (physical.conductorColor ?? '#b34d3d')
                : (physical.mediumColor ?? fluidColor(physical.medium))}
              stroke-width={innerWidth}
              data-physical-layer="medium"
            />
            {#if !isWire && physical.kind === 'hose'}
              <path d={mapped.path} class="hose-braid" stroke-width={innerWidth} />
            {/if}
            {#if physical.direction === 'forward' || physical.direction === 'reverse'}
              <path
                d={mapped.path}
                class="flow-cue"
                class:flowing={!motionPaused && physical.directionCurrent !== false}
                class:reverse={physical.direction === 'reverse'}
                stroke-width="2"
                aria-hidden="true"
              />
            {/if}
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
            {#if !isWire && ((physical.sizeStatus === 'known' && liveViewport.zoom >= 0.55) || focus.connections.has(mapped.connection.id))}
              <g
                class="line-badge"
                transform={`translate(${mapped.labelPoint.x} ${mapped.labelPoint.y}) scale(${mapped.connection.diagramRoute ? 1 : 1 / liveViewport.zoom})`}
                aria-hidden="true"
              >
                <rect
                  x="-58"
                  y={mapped.connection.diagramRoute ? -12 : -29}
                  width="116"
                  height="23"
                  rx="6"
                />
                <text y={mapped.connection.diagramRoute ? 2 : -15} text-anchor="middle"
                  >{physical.sizeLabel ?? 'Size unknown'}
                  <tspan>{physical.kind.toUpperCase()}</tspan></text
                >
              </g>
            {/if}
          </g>
        {/each}
      </g>

      <g class="node-layer">
        {#each visibleModel.nodes as mapped (mapped.node.id)}
          {@const position = renderedNodePosition(mapped.node)}
          <g
            role="group"
            aria-label={`${mapped.node.label} component`}
            class="system-node"
            class:selected={mapped.node.selected}
            class:previewed={mapped.node.previewed}
            class:dragging={drag?.componentId === mapped.node.id}
            class:trace-muted={focus.active && !focus.nodes.has(mapped.node.id)}
            class:trace-active={focus.nodes.has(mapped.node.id)}
            style:--node-accent={mapped.node.accentColor ?? '#8cbfc7'}
            onpointerenter={() => (hoveredNodeId = mapped.node.id)}
            onpointerleave={() => (hoveredNodeId = null)}
            transform={`translate(${position.x} ${position.y})`}
            data-renderer-node={mapped.node.id}
            data-selected={mapped.node.selected}
            data-previewed={mapped.node.previewed ? 'true' : 'false'}
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
            {#if mapped.node.role && schematicSymbols[mapped.node.role]}
              <svg
                x={mapped.node.width - 32}
                y="7"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                class="part-symbol"
                aria-hidden="true"><path d={schematicSymbols[mapped.node.role]} /></svg
              >
            {/if}
            <rect class="node-accent" y="45" width={mapped.node.width} height="3" />
            <text class="node-kind" x="14" y="18"
              >{mapped.node.role === 'volume'
                ? 'Reservoir'
                : mapped.node.role === 'heat-source'
                  ? 'Engine / turbo'
                  : mapped.node.role === 'heat-exchanger'
                    ? 'Cooler'
                    : mapped.node.role === 'manifold'
                      ? 'Junction'
                      : (mapped.node.role ?? mapped.node.kind).replaceAll('-', ' ')}</text
            >
            <text
              class="node-label"
              x="14"
              y="38"
              textLength={mapped.node.label.length > 23 ? mapped.node.width - 28 : undefined}
              lengthAdjust="spacingAndGlyphs">{mapped.node.label}</text
            >
            {#each mapped.node.ports as port (port.id)}
              <text
                class="port-label"
                x={port.side === 'right' ? mapped.node.width - 13 : 13}
                text-anchor={port.side === 'right' ? 'end' : 'start'}
                y={mapped.node.height * port.offset + 3}>{port.label}</text
              >
            {/each}
            {#each mapped.portCenters as mappedPort (mappedPort.port.id)}
              <circle
                cx={mappedPort.center.x - mapped.node.position.x}
                cy={mappedPort.center.y - mapped.node.position.y}
                r="4.5"
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
        <g class="route-layer" role="group" aria-label="Editable route points">
          {#each visibleModel.connections.filter((mapped) => mapped.connection.selected) as mapped (mapped.connection.id)}
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
  <div class="canvas-navigation" aria-label="Canvas navigation">
    <button type="button" aria-label="Zoom out" onclick={() => zoomAt(1 / 1.2)}>−</button>
    <output aria-label="Canvas zoom">{Math.round(liveViewport.zoom * 100)}%</output>
    <button type="button" aria-label="Zoom in" onclick={() => zoomAt(1.2)}>+</button>
    <button type="button" class="fit-button" onclick={fitCanvas}>Fit view</button>
  </div>
  <div class="canvas-key" aria-label="Connection visual key">
    <div class="medium-key">
      {#each mediumLegend as [label, color] (label)}<span
          ><i style:background={color}></i>{label}</span
        >{/each}
    </div>
    <div class="size-key">
      <span class="size-sample six"></span><span>-6AN</span><span class="size-sample eight"
      ></span><span>-8AN</span><small>Line width shows size</small>
    </div>
  </div>
</div>

<style>
  .svg-frame {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 30rem;
    overflow: hidden;
    background: #0e151d;
    border: 1px solid #293844;
    border-radius: 12px;
  }

  .svg-frame > svg {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 30rem;
    touch-action: none;
  }

  .part-symbol {
    fill: none;
    stroke: var(--node-accent);
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.8;
  }

  .grid-dot {
    fill: #31404d;
  }

  .pan-surface {
    cursor: grab;
  }

  .connection-layer path {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .connection-layer.tidied path:not(.hit-area) {
    vector-effect: none;
  }

  .connection-layer > g,
  .system-node {
    transition: opacity 180ms ease;
  }

  .trace-muted {
    opacity: 0.17;
  }

  .wire-outer,
  .fluid-outer {
    stroke: #080e14;
  }

  .physical-inner {
    opacity: 0.86;
  }

  .trace-active .physical-inner,
  .selected .physical-inner {
    opacity: 1;
  }

  .trace-active .fluid-outer,
  .selected .fluid-outer {
    stroke: #c3e0e5;
    stroke-opacity: 0.32;
    filter: drop-shadow(0 0 5px var(--connection-color));
  }

  .hose-braid {
    stroke: #09131b;
    stroke-dasharray: 1 6;
    stroke-opacity: 0.36;
    pointer-events: none;
  }

  [data-physical-kind='tube'] .fluid-outer {
    stroke: #8cabb4;
    stroke-opacity: 0.27;
  }

  [data-physical-kind='pipe'] .physical-inner {
    stroke-dasharray: 24 2;
    stroke-linecap: butt;
  }

  .conductor-stripe {
    stroke-dasharray: 10 7;
  }

  .flow-cue {
    stroke: #efffff;
    stroke-dasharray: 2 22;
    opacity: 0.7;
    pointer-events: none;
  }

  .flow-cue.flowing {
    animation: flow 1.5s linear infinite;
  }

  .flow-cue.reverse {
    animation-direction: reverse;
  }

  @keyframes flow {
    to {
      stroke-dashoffset: -48;
    }
  }

  .overlay {
    pointer-events: none;
    stroke-width: 1.5;
    opacity: 0.55;
  }

  .overlay--direction {
    stroke: #e4fbff;
    stroke-dasharray: 2 30;
  }

  [data-direction='unknown'] .overlay--direction {
    stroke: transparent;
  }

  .overlay--temperature {
    stroke: #f09178;
    stroke-dasharray: 2 28;
  }

  .overlay--potential {
    stroke: #f4d35e;
    stroke-dasharray: 5 12;
  }

  .overlay--current {
    stroke: #f1a84b;
    stroke-dasharray: 2 9;
  }

  .overlay--signal {
    stroke: #77c9b3;
    stroke-dasharray: 7 7;
  }

  .overlay--finding {
    stroke: #ef9275;
    stroke-dasharray: 2 24;
  }

  .overlay--selection {
    stroke: #e1f5f8;
    stroke-dasharray: 12 6;
    opacity: 0.45;
  }

  .overlay--provenance {
    stroke: #b4d5dc;
    stroke-dasharray: 1 40;
    opacity: 0.35;
  }

  .overlay--unknown {
    stroke: #9db4bf;
    stroke-dasharray: 1 18;
    opacity: 0.3;
  }

  .overlay--conflict {
    stroke: #ff8fae;
    stroke-dasharray: 6 5;
  }

  .hit-area {
    pointer-events: stroke;
    stroke: transparent;
    stroke-width: 28;
    cursor: pointer;
  }

  .connection-layer > g:focus-visible,
  .node-shell:focus-visible,
  .renderer-port:focus-visible,
  .route-point:focus-visible {
    outline: none;
    filter: drop-shadow(0 0 5px #a9e6ed);
  }

  .node-shadow {
    fill: #03090e;
    opacity: 0.35;
  }

  .node-shadow,
  .node-heading,
  .node-accent,
  .node-layer text {
    pointer-events: none;
  }

  .node-shell {
    fill: #17232d;
    stroke: #344957;
    stroke-width: 1;
    transition:
      stroke 150ms,
      fill 150ms;
  }

  .system-node.selected .node-shell,
  .system-node.trace-active .node-shell {
    stroke: var(--node-accent);
    fill: #1b2c37;
    stroke-width: 1.5;
  }

  .system-node.previewed .node-shell {
    stroke: #79d0bf;
    stroke-dasharray: 5 3;
    stroke-width: 2;
  }

  .system-node.dragging {
    opacity: 0.92;
  }

  .node-heading {
    fill: #1b2b36;
  }

  .node-accent {
    fill: var(--node-accent);
    opacity: 0.6;
  }

  .node-kind {
    fill: var(--node-accent);
    font:
      8px ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  .node-label {
    fill: #eff7f6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
    font-weight: 600;
  }

  .port-label {
    fill: #a4bac8;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 9px;
  }

  .overview .port-label {
    opacity: 0;
  }

  .renderer-port {
    fill: #14222d;
    stroke: #c1abdd;
    stroke-width: 2;
    cursor: crosshair;
    vector-effect: non-scaling-stroke;
  }

  .renderer-port.fluid-port {
    stroke: var(--node-accent);
  }

  .renderer-port.compatible {
    fill: #9bdaca;
    stroke-width: 3;
  }

  .renderer-port.pending {
    fill: #e7eff4;
    stroke: #8cdae1;
  }

  .route-point {
    fill: #14232d;
    stroke: #b1dce4;
    stroke-width: 2;
    cursor: move;
  }

  .line-badge {
    pointer-events: none;
  }

  .line-badge rect {
    fill: #14212c;
    stroke: var(--connection-color);
    stroke-opacity: 0.45;
    stroke-width: 1;
  }

  .line-badge text {
    fill: #e2eef1;
    font:
      10px ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
  }

  .line-badge tspan {
    fill: #93a9b8;
    font-size: 8px;
  }

  .canvas-navigation {
    position: absolute;
    z-index: 6;
    right: 18px;
    bottom: 18px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px;
    border: 1px solid #344854;
    border-radius: 9px;
    background: #16242eed;
    box-shadow: 0 8px 30px #0004;
  }

  .canvas-navigation button {
    display: grid;
    place-items: center;
    min-width: 30px;
    height: 30px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: #c3d7df;
    font-size: 19px;
    cursor: pointer;
  }

  .canvas-navigation button:hover {
    background: #2c414e;
    color: #fff;
  }

  .canvas-navigation .fit-button {
    min-width: 64px;
    margin-left: 4px;
    border-left: 1px solid #344854;
    border-radius: 0 5px 5px 0;
    font-size: 11px;
  }

  .canvas-navigation output {
    min-width: 42px;
    text-align: center;
    font:
      10px ui-monospace,
      monospace;
    color: #b4cbd5;
  }

  .canvas-key {
    position: absolute;
    left: 5.5rem;
    bottom: 18px;
    z-index: 5;
    display: grid;
    gap: 10px;
    max-width: calc(100% - 26rem);
    padding: 12px 15px;
    border: 1px solid #2e414f;
    border-radius: 8px;
    background: #14212bd9;
    backdrop-filter: blur(12px);
    color: #aabfcd;
    font-size: 10px;
  }

  .medium-key,
  .size-key {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .medium-key:empty {
    display: none;
  }

  .medium-key span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .medium-key i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .size-key {
    gap: 7px;
    font-family: ui-monospace, monospace;
  }

  .size-key small {
    color: #91a8b8;
    font:
      9px -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
    margin-left: 6px;
  }

  .size-sample {
    display: block;
    width: 22px;
    background: #9ebac8;
    border-radius: 3px;
  }

  .six {
    height: 5px;
  }

  .eight {
    height: 7px;
    margin-left: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .flow-cue.flowing {
      animation: none;
    }
    .connection-layer > g,
    .system-node {
      transition: none;
    }
  }

  @media (max-width: 700px) {
    .canvas-key {
      display: none;
    }
    .canvas-navigation {
      top: 12px;
      bottom: auto;
      right: 12px;
    }
  }
</style>
