<script lang="ts">
  import type { ProjectSnapshot } from '../../../project/project';
  let { snapshot }: { snapshot: ProjectSnapshot } = $props();
</script>

<section>
  <p>Demand derives from explicit project records</p>
  <h2>BOM</h2>
  <ul>
    {#each snapshot.partRequirements as requirement (requirement.id)}
      <li><strong>{requirement.label}</strong><span>× {requirement.quantity}</span></li>
    {:else}
      <li><strong>No Part Requirements</strong><span>No hidden catalog demand.</span></li>
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
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    justify-content: space-between;
    padding: 0.7rem;
    border-bottom: 1px solid #d5dfdb;
  }
  span {
    color: #a6532f;
    font: 0.72rem var(--font-mono);
  }
</style>
