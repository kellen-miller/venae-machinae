<script lang="ts">
  import type { ProjectAction } from '../../../project/action';
  import type { ProjectSnapshot } from '../../../project/project';

  let {
    snapshot,
    canAuthor,
    onaction
  }: {
    snapshot: ProjectSnapshot;
    canAuthor: boolean;
    onaction: (action: ProjectAction) => boolean;
  } = $props();

  const ports = $derived(snapshot.topology.components.flatMap((component) => component.ports));
  const connectorComponents = $derived(
    snapshot.electrical.components
      .filter((record) => record.role === 'connector')
      .flatMap((record) => {
        const component = snapshot.topology.components.find(
          (candidate) => candidate.id === record.componentId
        );
        return component ? [component] : [];
      })
  );
  let definitionLabel = $state('');
  let definitionProvenance = $state('supplier evidence');
  let connectorComponentId = $state('');
  let cavityPrefix = $state('Cavity ');
  let pinMappingPrefix = $state('Pin ');
  let terminalPartDefinitionId = $state('');
  let sealPartDefinitionId = $state('');
  let plugPartDefinitionId = $state('');
  let unusedRequirement = $state<'cavity-plug-required' | 'seal-required' | 'open-allowed'>(
    'open-allowed'
  );

  function addPartDefinition(): void {
    if (!definitionLabel.trim() || !definitionProvenance.trim()) return;
    if (
      onaction({
        type: 'add-part-definition',
        causationId: crypto.randomUUID(),
        definition: {
          id: crypto.randomUUID(),
          label: definitionLabel.trim(),
          revision: 1,
          provenance: definitionProvenance.trim()
        }
      })
    ) {
      definitionLabel = '';
    }
  }

  function configureConnector(): void {
    const component = connectorComponents.find(
      (candidate) => candidate.id === connectorComponentId
    );
    if (!component || !cavityPrefix.trim()) return;
    onaction({
      type: 'configure-electrical-connector',
      causationId: crypto.randomUUID(),
      connector: {
        componentId: component.id,
        cavities: component.ports.map((port, index) => {
          const wire = snapshot.topology.connections.find(
            (connection) =>
              connection.kind === 'electrical-wire' &&
              (connection.sourcePortId === port.id || connection.targetPortId === port.id)
          );
          const mate = snapshot.topology.connections.find(
            (connection) =>
              connection.kind === 'electrical-mate' &&
              (connection.sourcePortId === port.id || connection.targetPortId === port.id)
          );
          const occupied = Boolean(wire || mate);
          return {
            portId: port.id,
            cavityName: `${cavityPrefix.trim()}${index + 1}`,
            pinMapping: pinMappingPrefix.trim() ? `${pinMappingPrefix.trim()}${index + 1}` : null,
            mateConnectionId: mate?.id ?? null,
            wireConnectionId: wire?.id ?? null,
            terminalPartDefinitionId: occupied ? terminalPartDefinitionId || null : null,
            sealPartDefinitionId: occupied ? sealPartDefinitionId || null : null,
            plugPartDefinitionId:
              !occupied && unusedRequirement === 'cavity-plug-required'
                ? plugPartDefinitionId || null
                : null,
            unusedRequirement: occupied ? ('occupied' as const) : unusedRequirement
          };
        })
      }
    });
  }
</script>

<section class="interfaces-lens">
  <p>Explicit typed connection targets</p>
  <h2>Interfaces</h2>

  <details open>
    <summary>Project-local Part Definitions</summary>
    <div class="authoring-grid">
      <label
        ><span>Part label</span><input bind:value={definitionLabel} disabled={!canAuthor} /></label
      >
      <label
        ><span>Provenance</span><input
          bind:value={definitionProvenance}
          disabled={!canAuthor}
        /></label
      >
      <button
        type="button"
        disabled={!canAuthor || !definitionLabel.trim()}
        onclick={addPartDefinition}>Add Part Definition</button
      >
    </div>
    <ul class="part-register">
      {#each snapshot.partDefinitions as definition (definition.id)}
        <li>
          <strong>{definition.label}</strong><span
            >r{definition.revision} · {definition.provenance}</span
          >
        </li>
      {:else}
        <li>
          <strong>No Part Definitions</strong><span>Project-owned primitives remain available.</span
          >
        </li>
      {/each}
    </ul>
  </details>

  <details open>
    <summary>Bulk Connector cavity mapping</summary>
    <div class="authoring-grid connector-grid">
      <label>
        <span>Connector</span>
        <select bind:value={connectorComponentId} disabled={!canAuthor}>
          <option value="">Choose Connector</option>
          {#each connectorComponents as connector (connector.id)}<option value={connector.id}
              >{connector.label}</option
            >{/each}
        </select>
      </label>
      <label
        ><span>Cavity name prefix</span><input
          bind:value={cavityPrefix}
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Pin mapping prefix</span><input
          bind:value={pinMappingPrefix}
          disabled={!canAuthor}
        /></label
      >
      <label>
        <span>Terminal Part Definition</span>
        <select bind:value={terminalPartDefinitionId} disabled={!canAuthor}>
          <option value="">Not selected</option>
          {#each snapshot.partDefinitions as definition (definition.id)}<option
              value={definition.id}>{definition.label}</option
            >{/each}
        </select>
      </label>
      <label>
        <span>Seal Part Definition</span>
        <select bind:value={sealPartDefinitionId} disabled={!canAuthor}>
          <option value="">Not selected</option>
          {#each snapshot.partDefinitions as definition (definition.id)}<option
              value={definition.id}>{definition.label}</option
            >{/each}
        </select>
      </label>
      <label>
        <span>Unused-cavity requirement</span>
        <select bind:value={unusedRequirement} disabled={!canAuthor}>
          <option value="cavity-plug-required">Cavity plug required</option>
          <option value="seal-required">Seal required</option>
          <option value="open-allowed">Open allowed</option>
        </select>
      </label>
      <label>
        <span>Cavity plug Part Definition</span>
        <select bind:value={plugPartDefinitionId} disabled={!canAuthor}>
          <option value="">Not selected</option>
          {#each snapshot.partDefinitions as definition (definition.id)}<option
              value={definition.id}>{definition.label}</option
            >{/each}
        </select>
      </label>
      <p class="boundary-copy">
        Each Port receives one cavity name and pin map. Connected pins capture their Wire and Mate;
        unused pins retain an explicit requirement.
      </p>
      <button
        type="button"
        disabled={!canAuthor ||
          !connectorComponentId ||
          (unusedRequirement === 'cavity-plug-required' && !plugPartDefinitionId)}
        onclick={configureConnector}>Save all Connector cavities</button
      >
    </div>
  </details>

  <table>
    <thead
      ><tr
        ><th>Port / cavity</th><th>Domain</th><th>Wire / Mate</th><th>Terminal / seal / unused</th
        ></tr
      ></thead
    >
    <tbody>
      {#each ports as port (port.id)}
        {@const cavity = snapshot.electrical.connectors
          .flatMap((connector) => connector.cavities)
          .find((candidate) => candidate.portId === port.id)}
        {@const wireLabel = snapshot.topology.connections.find(
          (connection) => connection.id === cavity?.wireConnectionId
        )?.label}
        {@const mateLabel = snapshot.topology.connections.find(
          (connection) => connection.id === cavity?.mateConnectionId
        )?.label}
        <tr>
          <th
            >{cavity?.cavityName ?? port.label}<small
              >{port.id}{cavity?.pinMapping ? ` · ${cavity.pinMapping}` : ''}</small
            ></th
          >
          <td>{port.domain}</td>
          <td>{wireLabel ?? '—'}<small>{mateLabel ?? 'No Mate'}</small></td>
          <td
            >{cavity?.terminalPartDefinitionId ?? '—'}<small
              >{cavity?.sealPartDefinitionId ??
                cavity?.plugPartDefinitionId ??
                cavity?.unusedRequirement ??
                'Not mapped'}</small
            ></td
          >
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  .interfaces-lens > p,
  summary,
  label span {
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
  details {
    margin-bottom: 0.65rem;
    border: 1px solid #cbd8d3;
    background: #f8faf7;
  }
  summary {
    padding: 0.7rem;
    color: #28504f;
    cursor: pointer;
    font-weight: 700;
  }
  .authoring-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(9rem, 1fr));
    gap: 0.55rem;
    padding: 0 0.7rem 0.7rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  input,
  select,
  button {
    min-height: 2.75rem;
    border: 1px solid #9bb3ac;
    border-radius: 0.3rem;
  }
  input,
  select {
    width: 100%;
    padding: 0.42rem 0.5rem;
    background: #fff;
    color: #203e40;
  }
  button {
    padding: 0.42rem 0.65rem;
    background: #234d4c;
    color: #fff;
    cursor: pointer;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }
  .boundary-copy {
    grid-column: span 2;
    align-self: end;
    margin: 0;
    color: #5f7471;
    font-size: 0.68rem;
    line-height: 1.4;
  }
  .part-register {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    padding: 0 0.7rem 0.7rem;
    list-style: none;
  }
  .part-register li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.45rem;
    border-top: 1px solid #d5dfdb;
  }
  .part-register span {
    color: #6b7c7a;
    font: 0.6rem var(--font-mono);
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
  @media (max-width: 60rem) {
    .authoring-grid {
      grid-template-columns: 1fr;
    }
    .boundary-copy {
      grid-column: auto;
    }
  }
</style>
