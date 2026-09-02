<script lang="ts">
  import type { ProjectSnapshot } from '../../../project/project';
  let { snapshot }: { snapshot: ProjectSnapshot } = $props();
</script>

<section>
  <p>Known, Unknown, and conflicting evidence coexist</p>
  <h2>Evidence</h2>
  <table>
    <thead><tr><th>Evidence</th><th>State</th><th>Value</th><th>Provenance</th></tr></thead>
    <tbody>
      {#each snapshot.evidence as evidence (evidence.id)}
        <tr data-evidence-state={evidence.state}
          ><th>{evidence.label}</th><td>{evidence.state}</td><td
            >{evidence.value ?? '—'} {evidence.unit ?? ''}</td
          ><td>{evidence.provenance ?? 'Not recorded'}</td></tr
        >
      {/each}
    </tbody>
  </table>
</section>

<style>
  p {
    margin: 0;
    color: #5d716f;
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
    font-size: 0.7rem;
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
  tbody tr[data-evidence-state='unknown'] {
    background: #edf0ee;
  }
  tbody tr[data-evidence-state='conflicting'] {
    background: #f8edf5;
    box-shadow: inset 3px 0 #8f3d75;
  }
</style>
