<script lang="ts">
  import type { ProjectSnapshot } from '../../../project/project';
  let { snapshot }: { snapshot: ProjectSnapshot } = $props();
  const ports = $derived(snapshot.topology.components.flatMap((component) => component.ports));
</script>

<section>
  <p>Explicit typed connection targets</p>
  <h2>Interfaces</h2>
  <table>
    <thead><tr><th>Port</th><th>Domain</th><th>Medium</th><th>Interface</th></tr></thead>
    <tbody>
      {#each ports as port (port.id)}
        <tr
          ><th>{port.label}<small>{port.id}</small></th><td>{port.domain}</td><td
            >{port.mediumId ?? '—'}</td
          ><td>{port.interfaceKey ?? 'Unknown'}</td></tr
        >
      {/each}
    </tbody>
  </table>
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
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.72rem;
  }
  th,
  td {
    padding: 0.6rem;
    border-bottom: 1px solid #d5dfdb;
    text-align: left;
  }
  thead {
    color: #697a79;
    font: 0.58rem var(--font-mono);
    text-transform: uppercase;
  }
  tbody th {
    font-family: var(--font-display);
  }
  small {
    display: block;
    color: #7c8b89;
    font: 0.55rem var(--font-mono);
  }
</style>
