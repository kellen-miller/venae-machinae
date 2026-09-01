<script lang="ts">
  import type { ProjectAction } from '../../../project/action';
  import type { ProjectSnapshot } from '../../../project/project';

  let {
    snapshot,
    canAuthor,
    onaction
  }: {
    snapshot: ProjectSnapshot;
    canAuthor: boolean;
    onaction: (action: ProjectAction) => boolean;
  } = $props();

  const routableConnections = $derived(
    snapshot.topology.connections.filter((connection) => connection.kind !== 'electrical-mate')
  );
  let connectionId = $state('');
  let segmentLabel = $state('Engine-bay trunk');
  let sharedSegmentId = $state('');
  let startX = $state('120');
  let startY = $state('120');
  let endX = $state('360');
  let endY = $state('120');

  function setRoute(): void {
    if (!connectionId || !segmentLabel.trim()) return;
    const segmentId = crypto.randomUUID();
    const segmentIds = sharedSegmentId ? [sharedSegmentId, segmentId] : [segmentId];
    onaction({
      type: 'set-connection-route',
      causationId: crypto.randomUUID(),
      connectionId,
      route: { id: crypto.randomUUID(), segmentIds },
      newSegments: [
        {
          id: segmentId,
          label: segmentLabel.trim(),
          start: { x: startX.trim(), y: startY.trim() },
          end: { x: endX.trim(), y: endY.trim() }
        }
      ]
    });
  }
</script>

<section class="routes-lens">
  <p>Connectivity stays independent from physical routing</p>
  <h2>Routes</h2>

  <div class="authoring-grid">
    <label>
      <span>Routed Connection</span>
      <select bind:value={connectionId} disabled={!canAuthor}>
        <option value="">Choose Connection</option>
        {#each routableConnections as connection (connection.id)}<option value={connection.id}
            >{connection.label} · {connection.kind}</option
          >{/each}
      </select>
    </label>
    <label
      ><span>New Segment label</span><input
        bind:value={segmentLabel}
        disabled={!canAuthor}
      /></label
    >
    <label>
      <span>Prepend shared Segment</span>
      <select bind:value={sharedSegmentId} disabled={!canAuthor}>
        <option value="">No shared Segment</option>
        {#each snapshot.topology.segments as segment (segment.id)}<option value={segment.id}
            >{segment.label}</option
          >{/each}
      </select>
    </label>
    <label
      ><span>Start X</span><input
        bind:value={startX}
        inputmode="decimal"
        disabled={!canAuthor}
      /></label
    >
    <label
      ><span>Start Y</span><input
        bind:value={startY}
        inputmode="decimal"
        disabled={!canAuthor}
      /></label
    >
    <label
      ><span>End X</span><input
        bind:value={endX}
        inputmode="decimal"
        disabled={!canAuthor}
      /></label
    >
    <label
      ><span>End Y</span><input
        bind:value={endY}
        inputmode="decimal"
        disabled={!canAuthor}
      /></label
    >
    <button type="button" disabled={!canAuthor || !connectionId} onclick={setRoute}
      >Set independent Route</button
    >
  </div>

  <ol>
    {#each snapshot.topology.routes as route (route.id)}
      {@const connection = snapshot.topology.connections.find(
        (candidate) => candidate.routeId === route.id
      )}
      {@const wire = snapshot.electrical.wires.find(
        (candidate) => candidate.connectionId === connection?.id
      )}
      {@const line = snapshot.fluid.lines.find(
        (candidate) => candidate.connectionId === connection?.id
      )}
      <li>
        <strong>{connection?.label ?? route.id}</strong>
        <span>{route.segmentIds.length} ordered Segments</span>
        <span
          >{wire?.routeLength?.decimal ?? line?.routeLength?.decimal ?? 'Unknown'}
          {wire?.routeLength?.unit ?? line?.routeLength?.unit ?? ''} Route ·
          {line
            ? `${line.hydraulicLength?.decimal ?? 'Unknown'} ${line.hydraulicLength?.unit ?? ''} Hydraulic · `
            : ''}{wire?.cutLength?.decimal ?? line?.cutLength?.decimal ?? 'Unknown'}
          {wire?.cutLength?.unit ?? line?.cutLength?.unit ?? ''} Cut</span
        >
      </li>
    {:else}
      <li><strong>No Routes</strong><span>Connections remain valid while unrouted.</span></li>
    {/each}
  </ol>
</section>

<style>
  .routes-lens > p,
  label span {
    margin: 0;
    color: #6b7c7a;
    font: 0.62rem var(--font-mono);
    text-transform: uppercase;
  }
  h2 {
    margin: 0.15rem 0 1rem;
    color: #173d3f;
    font: 2rem var(--font-display);
  }
  .authoring-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(8rem, 1fr));
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding: 0.75rem;
    border: 1px solid #cbd8d3;
    background: #f8faf7;
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  input,
  select,
  button {
    min-height: 2.75rem;
    border: 1px solid #9bb3ac;
    border-radius: 0.3rem;
  }
  input,
  select {
    width: 100%;
    padding: 0.42rem 0.5rem;
    background: #fff;
    color: #203e40;
  }
  button {
    padding: 0.42rem 0.65rem;
    background: #234d4c;
    color: #fff;
    cursor: pointer;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }
  ol {
    display: grid;
    gap: 0.45rem;
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: route;
  }
  li {
    display: grid;
    grid-template-columns: 2rem minmax(10rem, 1fr) auto auto;
    gap: 0.6rem;
    align-items: center;
    padding: 0.7rem;
    border-bottom: 1px solid #d2ddda;
    counter-increment: route;
  }
  li::before {
    content: counter(route, decimal-leading-zero);
    color: #a6532f;
    font: 0.62rem var(--font-mono);
  }
  li span {
    color: #687a79;
    font: 0.62rem var(--font-mono);
  }
  @media (max-width: 60rem) {
    .authoring-grid {
      grid-template-columns: 1fr 1fr;
    }
    li {
      grid-template-columns: 2rem 1fr;
    }
  }
</style>
