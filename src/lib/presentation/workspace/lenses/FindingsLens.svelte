<script lang="ts">
  import type { ProjectSnapshot } from '../../../project/project';
  let { snapshot }: { snapshot: ProjectSnapshot } = $props();
  const findings = $derived(
    snapshot.results.filter((result) => result.kind.startsWith('finding:'))
  );
</script>

<section>
  <p>Scoped observations from explicit validation rules</p>
  <h2>Findings</h2>
  <ul>
    {#each findings as finding (finding.id)}
      <li>
        <span aria-hidden="true">!</span>
        <div>
          <strong>{finding.kind.replace('finding:', '')}</strong>
          <p>{finding.status} at revision {finding.sourceRevision}</p>
        </div>
      </li>
    {:else}
      <li>
        <span aria-hidden="true">—</span>
        <div>
          <strong>No current Findings</strong>
          <p>This is not a safety or completeness claim.</p>
        </div>
      </li>
    {/each}
  </ul>
</section>

<style>
  section > p {
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
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    grid-template-columns: 2rem 1fr;
    gap: 0.65rem;
    padding: 0.75rem;
    border: 1px solid #e0c5cf;
    background: #fff9fb;
  }
  li > span {
    display: grid;
    place-items: center;
    color: #8f3d75;
    border: 2px solid #8f3d75;
    border-radius: 50%;
    font-weight: 800;
  }
  strong,
  li p {
    margin: 0;
  }
  li p {
    color: #687a79;
    font-size: 0.68rem;
  }
</style>
