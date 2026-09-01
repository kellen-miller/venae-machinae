<script lang="ts">
  import TopologyRenderer from '../../../src/lib/renderer/TopologyRenderer.svelte';
  import type { RendererIntent } from '../../../src/lib/renderer/intent';
  import type {
    RendererCapabilityMode,
    RendererProjection
  } from '../../../src/lib/renderer/projection';
  import { rendererGateProjection } from '../../fixtures/renderer-projection';

  let { recordIntent }: { recordIntent: (intent: RendererIntent) => void } = $props();

  let projection = $state.raw<RendererProjection>(rendererGateProjection);
  let viewportWidth = $state(window.innerWidth);
  const authorCapability = $derived<RendererCapabilityMode>(
    viewportWidth <= 700 ? 'mobile-review' : 'author'
  );
  const authorViewport = { x: 0, y: 0, zoom: 1 } as const;
  const reviewViewport = { x: 40, y: 45, zoom: 0.72 } as const;

  function handleIntent(intent: RendererIntent): void {
    recordIntent(intent);
    if (intent.type === 'select') {
      projection = {
        ...projection,
        nodes: projection.nodes.map((node) => ({
          ...node,
          selected: intent.target === 'node' && node.id === intent.id
        })),
        connections: projection.connections.map((connection) => ({
          ...connection,
          selected: intent.target === 'connection' && connection.id === intent.id
        }))
      };
      return;
    }

    if (intent.type === 'move-route-point') {
      projection = {
        ...projection,
        connections: projection.connections.map((connection) =>
          connection.id === intent.connectionId
            ? {
                ...connection,
                routePoints: connection.routePoints.map((point) =>
                  point.id === intent.routePointId ? { ...point, position: intent.position } : point
                )
              }
            : connection
        )
      };
    }
  }
</script>

<svelte:window onresize={() => (viewportWidth = window.innerWidth)} />

<main data-renderer-gate-ready="true">
  <header class="gate-heading">
    <p>MVP Gate 001 · Candidate B · Raw SVG</p>
    <h1>Physical topology renderer fit</h1>
    <span>One projection. Two synchronized lenses. App-owned intent boundary.</span>
  </header>

  <section data-lens="author" aria-label="Author topology lens">
    <TopologyRenderer
      {projection}
      viewport={authorViewport}
      capability={authorCapability}
      onintent={handleIntent}
    />
  </section>

  <section class="review-lens" data-lens="review" aria-label="Synchronized review topology lens">
    <div class="lens-divider">
      <span>Synchronized lens</span>
      <strong>Read-only review</strong>
    </div>
    <TopologyRenderer
      {projection}
      viewport={reviewViewport}
      capability="review"
      onintent={handleIntent}
    />
  </section>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(html) {
    min-width: 320px;
    color-scheme: light;
    background: #e8eeea;
  }

  :global(body) {
    min-width: 320px;
    margin: 0;
    color: #17282a;
    background: linear-gradient(135deg, rgb(255 255 255 / 60%), transparent 45%), #e8eeea;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
  }

  main {
    display: grid;
    gap: 1.1rem;
    width: min(100%, 1440px);
    margin: 0 auto;
    padding: 1rem;
  }

  .gate-heading {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 0.25rem 1.5rem;
    padding: 1rem 1.15rem;
    color: #f9faf7;
    background: linear-gradient(115deg, #132f32, #285356 68%, #315f60);
    border-left: 6px solid #d1743f;
    border-radius: 4px 16px 4px 16px;
    box-shadow: 0 12px 34px rgb(20 45 48 / 16%);
  }

  .gate-heading p,
  .gate-heading h1,
  .gate-heading span {
    margin: 0;
  }

  .gate-heading p,
  .gate-heading span,
  .lens-divider span {
    color: #cbdcd8;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .gate-heading h1 {
    grid-row: 2;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(1.45rem, 3vw, 2.25rem);
    font-weight: 650;
    letter-spacing: -0.025em;
  }

  .gate-heading span {
    grid-row: 1 / span 2;
    max-width: 25rem;
    line-height: 1.6;
    text-align: right;
  }

  .review-lens {
    display: grid;
    gap: 0.5rem;
    padding-top: 0.4rem;
    border-top: 1px solid #b5c4bf;
  }

  .lens-divider {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0 0.25rem;
  }

  .lens-divider span {
    color: #627477;
  }

  .lens-divider strong {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1rem;
  }

  @media (max-width: 700px) {
    main {
      padding: 0.6rem;
    }

    .gate-heading {
      grid-template-columns: 1fr;
    }

    .gate-heading h1,
    .gate-heading span {
      grid-row: auto;
    }

    .gate-heading span {
      text-align: left;
    }
  }
</style>
