<script lang="ts">
  import type { ProjectSnapshot } from '../../../project/project';
  import type { ProjectAction } from '../../../project/action';

  let {
    snapshot,
    selectionId,
    canAuthor,
    onaction,
    onpreview,
    onselect
  }: {
    snapshot: ProjectSnapshot;
    selectionId: string | null;
    canAuthor: boolean;
    onaction: (action: ProjectAction) => boolean;
    onpreview: (componentId: string) => void;
    onselect: (componentId: string) => void;
  } = $props();

  let systemLabel = $state('Auxiliary cooling power');
  let fluidSystemLabel = $state('Engine coolant');
  let fluidMediumLabel = $state('50/50 coolant');
  let fluidComposition = $state('ethylene glycol and water, 50/50 by volume');
  let fluidPurpose = $state('engine heat transport');

  function addElectricalSystem(): void {
    if (
      onaction({
        type: 'add-system',
        causationId: crypto.randomUUID(),
        system: {
          id: crypto.randomUUID(),
          label: systemLabel.trim(),
          domain: 'electrical',
          mediumId: null
        }
      })
    ) {
      systemLabel = '';
    }
  }

  function addFluidSystem(): void {
    if (
      !fluidSystemLabel.trim() ||
      !fluidMediumLabel.trim() ||
      !fluidComposition.trim() ||
      !fluidPurpose.trim()
    ) {
      return;
    }

    const mediumId = crypto.randomUUID();
    if (
      onaction({
        type: 'add-fluid-system',
        causationId: crypto.randomUUID(),
        system: {
          id: crypto.randomUUID(),
          label: fluidSystemLabel.trim(),
          domain: 'fluid',
          mediumId
        },
        medium: {
          id: mediumId,
          label: fluidMediumLabel.trim(),
          composition: fluidComposition.trim(),
          provenance: 'user-entered Fluid Medium'
        },
        purpose: fluidPurpose.trim()
      })
    ) {
      fluidSystemLabel = '';
      fluidMediumLabel = '';
      fluidComposition = '';
      fluidPurpose = '';
    }
  }
</script>

<section class="systems-lens">
  <header>
    <p>Topology register</p>
    <h2>Systems</h2>
    <span
      >{snapshot.topology.systems.length} Systems · {snapshot.topology.components.length} Components</span
    >
  </header>

  <div class="system-grid">
    {#each snapshot.topology.systems as system (system.id)}
      {@const fluidRecord = snapshot.fluid.systems.find((record) => record.systemId === system.id)}
      {@const medium = snapshot.fluid.media.find(
        (candidate) => candidate.id === fluidRecord?.mediumId
      )}
      <article>
        <div>
          <span class={`domain-key domain-key--${system.domain}`} aria-hidden="true"></span>
          <div>
            <h3>{system.label}</h3>
            <p>
              {system.domain}{medium ? ` · ${medium.label}` : ''}
              {fluidRecord ? ` · ${fluidRecord.purpose}` : ''}
            </p>
          </div>
        </div>
        <strong
          >{snapshot.topology.connections.filter((connection) => connection.systemId === system.id)
            .length}</strong
        >
      </article>
    {/each}
  </div>

  <form class="system-authoring" onsubmit={(event) => event.preventDefault()}>
    <label>
      <span>Electrical System label</span>
      <input bind:value={systemLabel} disabled={!canAuthor} />
    </label>
    <button
      type="button"
      disabled={!canAuthor || systemLabel.trim().length === 0}
      onclick={addElectricalSystem}
    >
      Add electrical System
    </button>
  </form>

  <form class="system-authoring fluid-authoring" onsubmit={(event) => event.preventDefault()}>
    <label>
      <span>Fluid System label</span>
      <input bind:value={fluidSystemLabel} disabled={!canAuthor} />
    </label>
    <label>
      <span>Fluid Medium</span>
      <input bind:value={fluidMediumLabel} disabled={!canAuthor} />
    </label>
    <label>
      <span>Medium composition</span>
      <input bind:value={fluidComposition} disabled={!canAuthor} />
    </label>
    <label>
      <span>System purpose</span>
      <input bind:value={fluidPurpose} disabled={!canAuthor} />
    </label>
    <button
      type="button"
      disabled={!canAuthor ||
        !fluidSystemLabel.trim() ||
        !fluidMediumLabel.trim() ||
        !fluidComposition.trim() ||
        !fluidPurpose.trim()}
      onclick={addFluidSystem}
    >
      Add Fluid System
    </button>
  </form>

  <table>
    <thead>
      <tr><th>Component</th><th>Ports</th><th>Definition</th><th>Projection</th></tr>
    </thead>
    <tbody>
      {#each snapshot.topology.components as component (component.id)}
        <tr
          data-lens-subject={component.id}
          data-selected={selectionId === component.id ? 'true' : 'false'}
        >
          <th scope="row">
            <button type="button" onclick={() => onselect(component.id)}>{component.label}</button>
            <small>{component.id}</small>
          </th>
          <td>{component.ports.length}</td>
          <td>{component.definitionId ?? 'Project-owned'}</td>
          <td>
            <button
              type="button"
              aria-label={`Preview ${component.label}`}
              onclick={() => onpreview(component.id)}
            >
              Preview
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  header {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    margin-bottom: 1rem;
  }

  header p,
  header span,
  small {
    margin: 0;
    color: #6d7d7c;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0.12rem 0 0;
    color: #173d3f;
    font-family: var(--font-display);
    font-size: 2rem;
  }

  header p,
  h2 {
    grid-column: 1;
  }

  header span {
    grid-column: 2;
    grid-row: 1 / 3;
  }

  .system-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.45rem;
    margin-bottom: 1rem;
  }

  .system-authoring {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) auto;
    gap: 0.5rem;
    align-items: end;
    margin-bottom: 1rem;
    padding: 0.75rem;
    border: 1px solid #cbd8d3;
    background: #edf4f0;
  }

  .fluid-authoring {
    grid-template-columns: repeat(2, minmax(12rem, 1fr));
  }

  .fluid-authoring button {
    grid-column: span 2;
  }

  .system-authoring label {
    display: grid;
    gap: 0.25rem;
  }

  .system-authoring label span {
    color: #596e6d;
    font: 0.58rem var(--font-mono);
    text-transform: uppercase;
  }

  .system-authoring input,
  .system-authoring button {
    min-height: 2.75rem;
    border: 1px solid #9bb3ac;
    border-radius: 0.3rem;
  }

  .system-authoring input {
    padding: 0.45rem 0.55rem;
    background: #fff;
  }

  .system-authoring button {
    padding: 0.45rem 0.7rem;
    background: #234d4c;
    color: #fff;
    cursor: pointer;
  }

  .system-authoring button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  article,
  article > div {
    display: flex;
    align-items: center;
  }

  article {
    justify-content: space-between;
    gap: 0.7rem;
    padding: 0.65rem;
    border: 1px solid #cbd8d3;
    border-radius: 0.55rem 0.2rem 0.55rem 0.2rem;
    background: #f9faf7;
  }

  article > div {
    gap: 0.55rem;
  }

  article h3,
  article p {
    margin: 0;
  }

  article h3 {
    font-family: var(--font-display);
    font-size: 0.9rem;
  }

  article p {
    color: #667978;
    font-size: 0.62rem;
  }

  article strong {
    color: #a6532f;
    font-family: var(--font-mono);
  }

  .domain-key {
    width: 0.72rem;
    height: 0.72rem;
    border: 2px solid #ad5f34;
    border-radius: 50%;
  }

  .domain-key--fluid {
    border-color: #377f87;
    border-radius: 2px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.72rem;
  }

  th,
  td {
    padding: 0.55rem 0.5rem;
    border-bottom: 1px solid #d8e1dd;
    text-align: left;
  }

  thead th {
    color: #687a79;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  tbody tr[data-selected='true'] {
    background: #fff1e8;
    box-shadow: inset 3px 0 #d1743f;
  }

  tbody th button {
    display: block;
    padding: 0;
    border: 0;
    background: transparent;
    color: #193d40;
    font-family: var(--font-display);
    font-size: 0.84rem;
    cursor: pointer;
  }

  td button {
    min-height: 2rem;
    padding: 0.28rem 0.5rem;
    border: 1px solid #9bb3ac;
    border-radius: 0.3rem;
    background: #edf4f0;
    color: #234d4c;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }

  @media (max-width: 43.75rem) {
    .system-authoring {
      grid-template-columns: 1fr;
    }

    .fluid-authoring button {
      grid-column: auto;
    }
  }
</style>
