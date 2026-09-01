<script lang="ts">
  import TopologyRenderer from '../../../src/lib/renderer/TopologyRenderer.svelte';
  import type { RendererIntent } from '../../../src/lib/renderer/intent';
  import type { RendererProjection } from '../../../src/lib/renderer/projection';

  let {
    projection = $bindable(),
    recordIntent
  }: {
    projection: RendererProjection;
    recordIntent: (intent: RendererIntent) => void;
  } = $props();

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

    if (intent.type === 'move-component') {
      projection = {
        ...projection,
        nodes: projection.nodes.map((node) =>
          node.id === intent.componentId ? { ...node, position: intent.position } : node
        )
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

  export function readProjection(): RendererProjection {
    return projection;
  }
</script>

<main data-capacity-gate-ready="true">
  <header>
    <p>MVP Gate 002 · Raw SVG</p>
    <h1>Graph capacity probe</h1>
    <span>{projection.nodes.length} components · {projection.connections.length} paths</span>
  </header>
  <TopologyRenderer
    {projection}
    viewport={{ x: 0, y: 0, zoom: 1 }}
    capability="author"
    onintent={handleIntent}
  />
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
    background: #e8eeea;
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
    gap: 0.75rem;
    width: min(100%, 1440px);
    margin: 0 auto;
    padding: 0.75rem;
  }

  header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 0.15rem 1rem;
    padding: 0.75rem 0.9rem;
    color: #f9faf7;
    background: linear-gradient(115deg, #132f32, #315f60);
    border-left: 5px solid #d1743f;
    border-radius: 4px 14px 4px 14px;
  }

  header p,
  header h1,
  header span {
    margin: 0;
  }

  header p,
  header span {
    color: #cbdcd8;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  header h1 {
    grid-row: 2;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.5rem;
  }

  header span {
    grid-row: 1 / span 2;
  }
</style>
