<script lang="ts">
  import type { ProjectSnapshot } from '../../../project/project';
  let { snapshot }: { snapshot: ProjectSnapshot } = $props();
</script>

<section>
  <p>Connectivity stays independent from physical routing</p>
  <h2>Routes</h2>
  <ol>
    {#each snapshot.topology.routes as route (route.id)}
      <li><strong>{route.id}</strong><span>{route.segmentIds.length} ordered Segments</span></li>
    {:else}
      <li><strong>No Routes</strong><span>Connections remain valid while unrouted.</span></li>
    {/each}
  </ol>
</section>

<style>
  p {
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
    grid-template-columns: 2rem 1fr auto;
    gap: 0.6rem;
    padding: 0.7rem;
    border-bottom: 1px solid #d2ddda;
    counter-increment: route;
  }
  li::before {
    content: counter(route, decimal-leading-zero);
    color: #a6532f;
    font: 0.62rem var(--font-mono);
  }
  span {
    color: #687a79;
    font: 0.65rem var(--font-mono);
  }
</style>
