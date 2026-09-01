<script lang="ts">
  import type { ProjectSnapshot } from '../../../project/project';
  let { snapshot }: { snapshot: ProjectSnapshot } = $props();
</script>

<section>
  <p>Bounded evidence-bearing outcomes</p>
  <h2>Calculations</h2>
  <ul>
    {#each snapshot.results as result (result.id)}
      <li>
        <strong>{result.kind}</strong><span>{result.status} · revision {result.sourceRevision}</span
        >
      </li>
    {:else}
      <li><strong>No calculation results</strong><span>Missing inputs remain Unknown.</span></li>
    {/each}
  </ul>
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
  ul {
    display: grid;
    gap: 0.45rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem;
    border: 1px solid #cfdbd7;
  }
  span {
    color: #687a79;
    font: 0.65rem var(--font-mono);
  }
</style>
