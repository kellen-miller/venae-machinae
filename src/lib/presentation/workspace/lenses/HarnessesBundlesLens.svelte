<script lang="ts">
  import type { ProjectSnapshot } from '../../../project/project';
  let { snapshot }: { snapshot: ProjectSnapshot } = $props();
  const electricalConnections = $derived(
    snapshot.topology.connections.filter((connection) => connection.domain === 'electrical')
  );
</script>

<section>
  <p>Physical wire construction without inferred consumption</p>
  <h2>Harnesses & Bundles</h2>
  <div class="boundary">
    <strong>{electricalConnections.length}</strong><span>Wires available for explicit grouping</span
    >
  </div>
  <p class="empty">
    No Harness or Bundle record yet. Grouping never changes electrical continuity.
  </p>
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
  .boundary {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    padding: 1rem;
    border: 1px solid #cbd8d3;
    background: #f9faf7;
  }
  .boundary strong {
    color: #a6532f;
    font: 2rem var(--font-display);
  }
  .boundary span {
    color: #526866;
  }
  .empty {
    margin-top: 0.8rem;
    padding: 0.8rem;
    border-left: 3px solid #9db4ad;
    line-height: 1.5;
    text-transform: none;
  }
</style>
