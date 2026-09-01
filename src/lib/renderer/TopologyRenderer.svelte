<script lang="ts">
  import type { RendererIntentHandler } from './intent';
  import {
    rendererPortsCanConnect,
    type RendererCapabilityMode,
    type RendererConnection,
    type RendererPort,
    type RendererProjection,
    type RendererRoutePoint,
    type RendererViewport
  } from './projection';
  import SVGRenderer from './svg/SVGRenderer.svelte';

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

  const semanticId = $props.id();
  const componentPageSize = 40;
  const connectionPageSize = 60;
  let pendingSourcePortId = $state<string | null>(null);
  let connectionStatus = $state('No keyboard connection in progress.');
  let componentPage = $state(0);
  let connectionPage = $state(0);
  const componentPageCount = $derived(
    Math.max(1, Math.ceil(projection.nodes.length / componentPageSize))
  );
  const connectionPageCount = $derived(
    Math.max(1, Math.ceil(projection.connections.length / connectionPageSize))
  );
  const semanticNodes = $derived(
    projection.nodes.slice(
      componentPage * componentPageSize,
      (componentPage + 1) * componentPageSize
    )
  );
  const semanticConnections = $derived(
    projection.connections.slice(
      connectionPage * connectionPageSize,
      (connectionPage + 1) * connectionPageSize
    )
  );
  const overlayMarksByConnection = $derived.by(() => {
    const grouped: Record<string, RendererProjection['overlayMarks']> = {};
    for (const mark of projection.overlayMarks) {
      grouped[mark.connectionId] = [...(grouped[mark.connectionId] ?? []), mark];
    }

    return grouped;
  });

  function activatePort(port: RendererPort): void {
    if (capability !== 'author') return;
    if (!pendingSourcePortId) {
      if (port.direction === 'input') return;
      pendingSourcePortId = port.id;
      connectionStatus = `Connecting from ${port.label}. Choose a compatible input Port.`;
      onintent({ type: 'preview', sourcePortId: port.id, targetPortId: null });
      return;
    }

    if (pendingSourcePortId === port.id) {
      pendingSourcePortId = null;
      connectionStatus = 'Keyboard connection canceled.';
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
      connectionStatus = `Connection requested to ${port.label}.`;
      onintent({ type: 'preview', sourcePortId: null, targetPortId: null });
      return;
    }

    connectionStatus = `${port.label} is not compatible with the selected source Port.`;
    onintent({ type: 'preview', sourcePortId: pendingSourcePortId, targetPortId: port.id });
  }

  function portActionLabel(port: RendererPort): string {
    if (!pendingSourcePortId) return `Start connection from ${port.label}`;
    if (pendingSourcePortId === port.id) return `Cancel connection from ${port.label}`;

    const source = projection.nodes
      .flatMap((node) => node.ports)
      .find((candidate) => candidate.id === pendingSourcePortId);
    return rendererPortsCanConnect(projection, pendingSourcePortId, port.id)
      ? `Connect ${source?.label ?? 'selected Port'} to ${port.label}`
      : `${port.label} is incompatible`;
  }

  function canActivatePort(port: RendererPort): boolean {
    if (capability !== 'author') return false;
    if (!pendingSourcePortId) return port.direction !== 'input';
    if (pendingSourcePortId === port.id) return true;
    return rendererPortsCanConnect(projection, pendingSourcePortId, port.id);
  }

  function moveRoutePoint(
    event: KeyboardEvent,
    connection: RendererConnection,
    point: RendererRoutePoint
  ): void {
    if (capability !== 'author') return;
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
      connectionId: connection.id,
      routePointId: point.id,
      position: { x: point.position.x + movement.x, y: point.position.y + movement.y }
    });
  }
</script>

<section
  class="renderer-shell"
  data-capability={capability}
  data-projection-revision={projection.revision}
>
  <div class="canvas-lens" aria-label="Visual topology lens">
    <div class="canvas-heading" aria-hidden="true">
      <span>Topology</span>
      <strong>Revision {projection.revision}</strong>
      <em>{capability === 'author' ? 'Authoring' : 'Review'}</em>
    </div>
    <SVGRenderer {projection} {viewport} {capability} {onintent} />
  </div>

  <aside class="semantic-lens" aria-label="Topology semantic map">
    <header>
      <p>Semantic lens</p>
      <h2>Components and paths</h2>
      <span>{projection.nodes.length} components · {projection.connections.length} connections</span
      >
    </header>

    <div class="semantic-scroll">
      <section aria-labelledby={`${semanticId}-components-heading`}>
        <div class="section-heading">
          <h3 id={`${semanticId}-components-heading`}>Components</h3>
          <span>
            {componentPage * componentPageSize + 1}–{Math.min(
              (componentPage + 1) * componentPageSize,
              projection.nodes.length
            )} of {projection.nodes.length}
          </span>
        </div>
        <ul class="component-list" data-semantic-component-count={semanticNodes.length}>
          {#each semanticNodes as node (node.id)}
            <li class:selected={node.selected}>
              <button
                class="select-button"
                type="button"
                aria-pressed={node.selected}
                onclick={() => onintent({ type: 'select', target: 'node', id: node.id })}
              >
                <span>{node.label}</span>
                <small>{node.kind}</small>
              </button>
              <ul class="port-list" aria-label={`${node.label} Ports`}>
                {#each node.ports as port (port.id)}
                  <li>
                    {#if capability === 'author'}
                      <button
                        class="port-button"
                        class:pending={pendingSourcePortId === port.id}
                        type="button"
                        disabled={!canActivatePort(port)}
                        onclick={() => activatePort(port)}
                      >
                        <span class={`port-symbol port-symbol--${port.domain}`} aria-hidden="true"
                        ></span>
                        <span>{portActionLabel(port)}</span>
                      </button>
                    {:else}
                      <span class="port-readout">
                        <span class={`port-symbol port-symbol--${port.domain}`} aria-hidden="true"
                        ></span>
                        <span>{port.label}</span>
                      </span>
                    {/if}
                    <small>{port.domain} · {port.direction}</small>
                  </li>
                {/each}
              </ul>
            </li>
          {/each}
        </ul>
        {#if componentPageCount > 1}
          <nav class="semantic-pagination" aria-label="Component pages">
            <div>
              <button
                type="button"
                disabled={componentPage === 0}
                onclick={() => (componentPage = 0)}>First</button
              >
              <button
                type="button"
                disabled={componentPage === 0}
                onclick={() => (componentPage -= 1)}>Previous</button
              >
            </div>
            <span>Page {componentPage + 1} of {componentPageCount}</span>
            <div>
              <button
                type="button"
                disabled={componentPage === componentPageCount - 1}
                onclick={() => (componentPage += 1)}>Next</button
              >
              <button
                type="button"
                disabled={componentPage === componentPageCount - 1}
                onclick={() => (componentPage = componentPageCount - 1)}>Last</button
              >
            </div>
          </nav>
        {/if}
      </section>

      <section aria-labelledby={`${semanticId}-connections-heading`}>
        <div class="section-heading">
          <h3 id={`${semanticId}-connections-heading`}>Connections</h3>
          <span>
            {connectionPage * connectionPageSize + 1}–{Math.min(
              (connectionPage + 1) * connectionPageSize,
              projection.connections.length
            )} of {projection.connections.length}
          </span>
        </div>
        <ul class="connection-list" data-semantic-connection-count={semanticConnections.length}>
          {#each semanticConnections as connection (connection.id)}
            <li>
              <button
                class="select-button"
                type="button"
                aria-pressed={connection.selected}
                onclick={() =>
                  onintent({ type: 'select', target: 'connection', id: connection.id })}
              >
                <span>{connection.label}</span>
                <small>{connection.physical.kind}</small>
              </button>
              <p>
                {connection.physical.medium ?? 'electrical conductor'}
                {#if connection.physical.temperature}
                  · {connection.physical.temperature}
                {/if}
              </p>
              {#if connection.routePoints.length}
                <ul class="route-list" aria-label={`${connection.label} route points`}>
                  {#each connection.routePoints as point, index (point.id)}
                    <li>
                      <button
                        type="button"
                        disabled={capability !== 'author'}
                        aria-label={`Move route point ${index + 1} for ${connection.label}. Use arrow keys.`}
                        onkeydown={(event) => moveRoutePoint(event, connection, point)}
                        onclick={() =>
                          onintent({ type: 'select', target: 'route-point', id: point.id })}
                      >
                        Route {index + 1}: {point.position.x}, {point.position.y}
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
              <ul class="overlay-list" aria-label={`${connection.label} Overlay channels`}>
                {#each overlayMarksByConnection[connection.id] ?? [] as mark (mark.id)}
                  <li>
                    <span class={`overlay-key overlay-key--${mark.channel}`}></span>{mark.label}
                  </li>
                {/each}
              </ul>
            </li>
          {/each}
        </ul>
        {#if connectionPageCount > 1}
          <nav class="semantic-pagination" aria-label="Connection pages">
            <div>
              <button
                type="button"
                disabled={connectionPage === 0}
                onclick={() => (connectionPage = 0)}>First</button
              >
              <button
                type="button"
                disabled={connectionPage === 0}
                onclick={() => (connectionPage -= 1)}>Previous</button
              >
            </div>
            <span>Page {connectionPage + 1} of {connectionPageCount}</span>
            <div>
              <button
                type="button"
                disabled={connectionPage === connectionPageCount - 1}
                onclick={() => (connectionPage += 1)}>Next</button
              >
              <button
                type="button"
                disabled={connectionPage === connectionPageCount - 1}
                onclick={() => (connectionPage = connectionPageCount - 1)}>Last</button
              >
            </div>
          </nav>
        {/if}
      </section>
    </div>

    <p class="connection-status" aria-live="polite">{connectionStatus}</p>
  </aside>
</section>

<style>
  .renderer-shell {
    --ink: #17282a;
    --muted: #617174;
    --line: #b7c5c1;
    display: grid;
    grid-template-columns: minmax(0, 2.25fr) minmax(18rem, 1fr);
    gap: 0.9rem;
    min-width: 0;
    color: var(--ink);
  }

  .canvas-lens,
  .semantic-lens {
    min-width: 0;
  }

  .canvas-lens {
    position: relative;
  }

  .canvas-heading {
    position: absolute;
    z-index: 5;
    top: 0.72rem;
    left: 0.72rem;
    display: grid;
    gap: 0.05rem;
    min-width: 9.5rem;
    padding: 0.52rem 0.68rem;
    color: #f8faf7;
    background: rgb(21 55 58 / 91%);
    border-left: 4px solid #d1743f;
    border-radius: 3px 10px 3px 10px;
    box-shadow: 0 6px 16px rgb(22 43 45 / 20%);
    pointer-events: none;
  }

  .canvas-heading span,
  .canvas-heading em {
    color: #c9dbd7;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.57rem;
    font-style: normal;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .canvas-heading strong {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1rem;
  }

  .semantic-lens {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    max-height: 32rem;
    overflow: hidden;
    background: #f7f5ef;
    border: 1px solid var(--line);
    border-radius: 5px 16px 5px 16px;
    box-shadow: 0 12px 30px rgb(22 43 45 / 11%);
  }

  header {
    padding: 0.95rem 1rem 0.82rem;
    color: #f8faf7;
    background: linear-gradient(115deg, #193d40, #315f60);
    border-bottom: 3px solid #d1743f;
  }

  header p,
  header h2,
  header span {
    margin: 0;
  }

  header p,
  header span {
    color: #c6d8d4;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  header h2 {
    margin: 0.2rem 0 0.28rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.25rem;
    font-weight: 650;
  }

  .semantic-scroll {
    overflow: auto;
    padding: 0.42rem 0.7rem 1rem;
  }

  h3 {
    margin: 0.82rem 0 0.42rem;
    color: #536568;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.64rem;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .section-heading,
  .semantic-pagination {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.7rem;
  }

  .section-heading span,
  .semantic-pagination span {
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.58rem;
    text-transform: uppercase;
  }

  .semantic-pagination {
    margin-top: 0.52rem;
    padding: 0.38rem 0.45rem;
    background: #e9efeb;
    border: 1px solid #c7d2cf;
    border-radius: 4px;
  }

  .semantic-pagination button {
    padding: 0.25rem 0.42rem;
    background: #fffefb;
    border: 1px solid #aebfba;
    border-radius: 3px;
    cursor: pointer;
  }

  .semantic-pagination div {
    display: flex;
    gap: 0.25rem;
  }

  .semantic-pagination button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .component-list,
  .connection-list {
    display: grid;
    gap: 0.5rem;
  }

  .component-list > li,
  .connection-list > li {
    overflow: hidden;
    background: #fffefb;
    border: 1px solid #d4dcda;
    border-radius: 8px 3px 8px 3px;
  }

  .component-list > li.selected,
  .connection-list > li:has(.select-button[aria-pressed='true']) {
    border-color: #d1743f;
    box-shadow: inset 3px 0 #d1743f;
  }

  button {
    color: inherit;
    font: inherit;
  }

  button:focus-visible {
    outline: 3px solid #d3612f;
    outline-offset: 2px;
  }

  .select-button {
    display: flex;
    width: 100%;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.8rem;
    padding: 0.58rem 0.68rem;
    text-align: left;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .select-button span {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.96rem;
    font-weight: 700;
  }

  small {
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.58rem;
    text-transform: uppercase;
  }

  .port-list {
    padding: 0 0.58rem 0.52rem;
  }

  .port-list li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.4rem;
    padding: 0.26rem 0;
    border-top: 1px solid #edf0ed;
  }

  .port-button,
  .port-readout {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.42rem;
    padding: 0.23rem 0.3rem;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
  }

  .port-button {
    cursor: pointer;
  }

  .port-button:hover:not(:disabled),
  .port-button.pending {
    background: #eef4f0;
    border-color: #9eb8af;
  }

  .port-button:disabled {
    cursor: not-allowed;
    opacity: 0.56;
  }

  .port-symbol {
    flex: 0 0 auto;
    width: 0.68rem;
    height: 0.68rem;
    background: #f9faf7;
    border: 2px solid #ad5f34;
    border-radius: 50%;
  }

  .port-symbol--fluid {
    border-color: #377f87;
    border-radius: 2px;
  }

  .connection-list p {
    margin: -0.28rem 0.68rem 0.5rem;
    color: var(--muted);
    font-size: 0.68rem;
  }

  .route-list,
  .overlay-list {
    display: grid;
    gap: 0.25rem;
    margin: 0 0.58rem 0.5rem;
  }

  .route-list button {
    width: 100%;
    padding: 0.3rem 0.44rem;
    text-align: left;
    background: #f3f1ea;
    border: 1px solid #d8d7d0;
    border-radius: 3px;
  }

  .overlay-list li {
    display: flex;
    align-items: center;
    gap: 0.42rem;
    color: #526467;
    font-size: 0.66rem;
  }

  .overlay-key {
    width: 1rem;
    height: 0.25rem;
    background: repeating-linear-gradient(90deg, #4d8079 0 3px, transparent 3px 5px);
    border: 1px solid #345552;
  }

  .overlay-key--selection {
    background: #d1743f;
    border-radius: 1rem;
  }

  .overlay-key--potential {
    background: repeating-linear-gradient(90deg, #d19d22 0 5px, transparent 5px 8px);
  }

  .overlay-key--temperature {
    background: repeating-linear-gradient(90deg, #b43f3f 0 2px, transparent 2px 6px);
  }

  .connection-status {
    margin: 0;
    padding: 0.6rem 0.8rem;
    color: #506164;
    background: #e9efeb;
    border-top: 1px solid #c7d2cf;
    font-size: 0.68rem;
  }

  @media (max-width: 980px) {
    .renderer-shell {
      grid-template-columns: minmax(0, 1.7fr) minmax(16rem, 1fr);
    }

    .semantic-lens {
      max-height: 30rem;
    }
  }

  @media (max-width: 700px) {
    .renderer-shell {
      grid-template-columns: 1fr;
    }

    .canvas-heading {
      top: 0.5rem;
      left: 0.5rem;
    }

    .semantic-lens {
      max-height: none;
    }

    .semantic-scroll {
      max-height: 28rem;
    }
  }
</style>
