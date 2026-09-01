<script lang="ts">
  import type { ProjectSnapshot } from '../../../project/project';
  let { snapshot }: { snapshot: ProjectSnapshot } = $props();
</script>

<section>
  <p>Functional and physical paths remain distinct</p>
  <h2>Circuits & Lines</h2>
  <ul>
    {#each snapshot.topology.connections as connection (connection.id)}
      <li>
        <strong>{connection.label}</strong><span
          >{connection.kind} · {connection.interfaceAssessment}</span
        >
      </li>
    {:else}
      <li><strong>No Connections</strong><span>Add explicit two-Port topology first.</span></li>
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
    gap: 1rem;
    padding: 0.7rem;
    border: 1px solid #cfdbd7;
    background: #fafbf8;
  }
  strong {
    font-family: var(--font-display);
  }
  span {
    color: #687a79;
    font: 0.65rem var(--font-mono);
  }
</style>
