<script lang="ts">
  import { deriveCircuitNetIds, deriveElectricalNets } from '../../../electrical/electrical';
  import FluidLinesPanel from './FluidLinesPanel.svelte';

  import type { ElectricalConductorRole } from '../../../electrical/electrical';
  import type { ImpactPreview, ProjectAction } from '../../../project/action';
  import type { ProjectSnapshot } from '../../../project/project';
  import type { Connection } from '../../../topology/topology';

  let {
    snapshot,
    canAuthor,
    branchPreview,
    onaction,
    onpreviewbranch,
    onconfirmbranch,
    oncancelbranch
  }: {
    snapshot: ProjectSnapshot;
    canAuthor: boolean;
    branchPreview: ImpactPreview | null;
    onaction: (action: ProjectAction) => boolean;
    onpreviewbranch: (action: Extract<ProjectAction, { type: 'insert-electrical-branch' }>) => void;
    onconfirmbranch: () => void;
    oncancelbranch: () => void;
  } = $props();

  const electricalSystems = $derived(
    snapshot.topology.systems.filter((system) => system.domain === 'electrical')
  );
  const electricalPorts = $derived(
    snapshot.topology.components.flatMap((component) =>
      component.ports
        .filter((port) => port.domain === 'electrical')
        .map((port) => ({ ...port, componentLabel: component.label }))
    )
  );
  const electricalConnections = $derived(
    snapshot.topology.connections.filter((connection) => connection.domain === 'electrical')
  );
  const wires = $derived(
    electricalConnections.filter((connection) => connection.kind === 'electrical-wire')
  );
  const nets = $derived(deriveElectricalNets(snapshot.topology));

  let connectionLabel = $state('');
  let connectionSystemId = $state('');
  let connectionSourcePortId = $state('');
  let connectionTargetPortId = $state('');
  let connectionKind = $state<'electrical-wire' | 'electrical-mate'>('electrical-wire');
  let configuredWireId = $state('');
  let wirePartDefinitionId = $state('');
  let wireRole = $state<ElectricalConductorRole>('power');
  let wireProtocol = $state('');
  let wireRouteLength = $state('');
  let wireCutLength = $state('');
  let wireServiceAllowance = $state('');
  let wireEnvironment = $state('engine bay');
  let wireProvenance = $state('user-entered construction record');
  let circuitLabel = $state('Auxiliary cooling circuit');
  let circuitSystemId = $state('');
  let protectionComponentId = $state('');
  let branchConnectionId = $state('');
  let branchTargetPortId = $state('');
  let branchLabel = $state('Auxiliary branch splice');

  function addConnection(): void {
    const systemId = connectionSystemId || electricalSystems[0]?.id;
    if (!systemId || !connectionSourcePortId || !connectionTargetPortId) return;
    const source = electricalPorts.find((port) => port.id === connectionSourcePortId);
    const target = electricalPorts.find((port) => port.id === connectionTargetPortId);
    if (!source || !target) return;

    if (
      onaction({
        type: 'add-connection',
        causationId: crypto.randomUUID(),
        connection: {
          id: crypto.randomUUID(),
          label: connectionLabel.trim() || `${source.label} to ${target.label}`,
          systemId,
          sourcePortId: source.id,
          targetPortId: target.id,
          domain: 'electrical',
          mediumId: null,
          kind: connectionKind,
          interfaceAssessment:
            source.interfaceKey && target.interfaceKey
              ? source.interfaceKey === target.interfaceKey
                ? 'compatible'
                : 'incompatible'
              : 'unknown',
          routeId: null
        }
      })
    ) {
      connectionLabel = '';
      connectionSourcePortId = '';
      connectionTargetPortId = '';
    }
  }

  function electricalLength(
    decimal: string,
    source: 'measured' | 'entered'
  ): {
    decimal: string;
    unit: 'm';
    source: 'measured' | 'entered';
    provenance: string;
  } | null {
    return decimal.trim()
      ? { decimal: decimal.trim(), unit: 'm', source, provenance: wireProvenance.trim() }
      : null;
  }

  function configureWire(): void {
    if (!configuredWireId || !wireEnvironment.trim() || !wireProvenance.trim()) return;
    onaction({
      type: 'configure-electrical-wire',
      causationId: crypto.randomUUID(),
      wire: {
        connectionId: configuredWireId,
        partDefinitionId: wirePartDefinitionId || null,
        role: wireRole,
        protocol: wireProtocol.trim() || null,
        routeLength: electricalLength(wireRouteLength, 'measured'),
        cutLength: electricalLength(wireCutLength, 'entered'),
        serviceAllowance: electricalLength(wireServiceAllowance, 'entered'),
        environment: wireEnvironment.trim()
      }
    });
  }

  function addCircuit(): void {
    const systemId = circuitSystemId || electricalSystems[0]?.id;
    if (!systemId || !circuitLabel.trim()) return;
    const connectionIds = wires
      .filter((connection) => connection.systemId === systemId)
      .map((connection) => connection.id);
    onaction({
      type: 'add-electrical-circuit',
      causationId: crypto.randomUUID(),
      circuit: {
        id: crypto.randomUUID(),
        label: circuitLabel.trim(),
        systemId,
        connectionIds,
        componentIds: snapshot.electrical.components.map((record) => record.componentId),
        protectionComponentIds: protectionComponentId ? [protectionComponentId] : []
      }
    });
  }

  function previewBranch(): void {
    const connection = wires.find((candidate) => candidate.id === branchConnectionId);
    const branchPort = electricalPorts.find((port) => port.id === branchTargetPortId);
    if (!connection || !branchPort || !branchLabel.trim()) return;
    const junctionId = crypto.randomUUID();
    const junctionPortIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    const replacementConnectionIds = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID()
    ];
    const configured = snapshot.electrical.wires.find(
      (wire) => wire.connectionId === connection.id
    );
    const replacementConnections: readonly Connection[] = [
      {
        ...connection,
        id: replacementConnectionIds[0]!,
        label: `${connection.label} · source to splice`,
        targetPortId: junctionPortIds[0]!,
        routeId: null
      },
      {
        ...connection,
        id: replacementConnectionIds[1]!,
        label: `${connection.label} · splice to original load`,
        sourcePortId: junctionPortIds[1]!,
        routeId: null
      },
      {
        ...connection,
        id: replacementConnectionIds[2]!,
        label: `${connection.label} · splice to branch`,
        sourcePortId: junctionPortIds[2]!,
        targetPortId: branchPort.id,
        routeId: null
      }
    ];
    onpreviewbranch({
      type: 'insert-electrical-branch',
      causationId: crypto.randomUUID(),
      connectionId: connection.id,
      junction: {
        id: junctionId,
        label: branchLabel.trim(),
        kind: 'junction',
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '320', y: '240' },
        ports: junctionPortIds.map((portId, index) => ({
          id: portId,
          componentId: junctionId,
          label: ['Upstream', 'Original load', 'Branch load'][index]!,
          domain: 'electrical',
          mediumId: null,
          interfaceKey: null
        }))
      },
      role: 'splice',
      replacementConnections,
      replacementWires: replacementConnectionIds.map((connectionId) => ({
        connectionId,
        partDefinitionId: configured?.partDefinitionId ?? null,
        role: configured?.role ?? 'power',
        protocol: configured?.protocol ?? null,
        routeLength: null,
        cutLength: null,
        serviceAllowance: null,
        environment: configured?.environment ?? 'not recorded'
      })),
      routeTransferConnectionId: connection.routeId ? replacementConnectionIds[0]! : null,
      confirmedImpactSubjectIds: []
    });
  }
</script>

<section class="circuits-lens">
  <p>Functional and physical paths remain distinct</p>
  <h2>Circuits & Lines</h2>

  <details open>
    <summary>Add explicit electrical topology</summary>
    <div class="authoring-grid">
      <label
        ><span>Connection label</span><input
          bind:value={connectionLabel}
          disabled={!canAuthor}
        /></label
      >
      <label>
        <span>Electrical System</span>
        <select bind:value={connectionSystemId} disabled={!canAuthor}>
          <option value="">Choose System</option>
          {#each electricalSystems as system (system.id)}<option value={system.id}
              >{system.label}</option
            >{/each}
        </select>
      </label>
      <label>
        <span>Source Port</span>
        <select aria-label="Source Port" bind:value={connectionSourcePortId} disabled={!canAuthor}>
          <option value="">Choose source Port</option>
          {#each electricalPorts as port (port.id)}<option value={port.id}
              >{port.componentLabel} · {port.label}</option
            >{/each}
        </select>
      </label>
      <label>
        <span>Target Port</span>
        <select aria-label="Target Port" bind:value={connectionTargetPortId} disabled={!canAuthor}>
          <option value="">Choose target Port</option>
          {#each electricalPorts as port (port.id)}<option value={port.id}
              >{port.componentLabel} · {port.label}</option
            >{/each}
        </select>
      </label>
      <label>
        <span>Connection kind</span>
        <select bind:value={connectionKind} disabled={!canAuthor}>
          <option value="electrical-wire">Wire</option>
          <option value="electrical-mate">Per-pin Mate</option>
        </select>
      </label>
      <button
        type="button"
        disabled={!canAuthor || electricalSystems.length === 0}
        onclick={addConnection}>Add electrical Connection</button
      >
    </div>
  </details>

  <details>
    <summary>Record Wire construction</summary>
    <div class="authoring-grid">
      <label>
        <span>Wire</span>
        <select bind:value={configuredWireId} disabled={!canAuthor}>
          <option value="">Choose Wire</option>
          {#each wires as wire (wire.id)}<option value={wire.id}>{wire.label}</option>{/each}
        </select>
      </label>
      <label>
        <span>Cable Part Definition</span>
        <select bind:value={wirePartDefinitionId} disabled={!canAuthor}>
          <option value="">Not assigned</option>
          {#each snapshot.partDefinitions as definition (definition.id)}<option
              value={definition.id}>{definition.label}</option
            >{/each}
        </select>
      </label>
      <label>
        <span>Conductor role</span>
        <select bind:value={wireRole} disabled={!canAuthor}>
          {#each ['power', 'return', 'analog', 'discrete', 'pwm', 'data'] as role (role)}<option
              value={role}>{role}</option
            >{/each}
        </select>
      </label>
      <label
        ><span>Protocol metadata</span><input
          bind:value={wireProtocol}
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Route Length (m)</span><input
          bind:value={wireRouteLength}
          inputmode="decimal"
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Cut Length (m)</span><input
          bind:value={wireCutLength}
          inputmode="decimal"
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Service allowance (m)</span><input
          bind:value={wireServiceAllowance}
          inputmode="decimal"
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Environment</span><input bind:value={wireEnvironment} disabled={!canAuthor} /></label
      >
      <label class="wide"
        ><span>Length provenance</span><input
          bind:value={wireProvenance}
          disabled={!canAuthor}
        /></label
      >
      <button type="button" disabled={!canAuthor || !configuredWireId} onclick={configureWire}
        >Save Wire record</button
      >
    </div>
  </details>

  <details>
    <summary>Create functional Circuit</summary>
    <div class="authoring-grid">
      <label
        ><span>Circuit label</span><input bind:value={circuitLabel} disabled={!canAuthor} /></label
      >
      <label>
        <span>Electrical System</span>
        <select bind:value={circuitSystemId} disabled={!canAuthor}>
          <option value="">Choose System</option>
          {#each electricalSystems as system (system.id)}<option value={system.id}
              >{system.label}</option
            >{/each}
        </select>
      </label>
      <label>
        <span>Protection Component</span>
        <select bind:value={protectionComponentId} disabled={!canAuthor}>
          <option value="">No fuse assigned</option>
          {#each snapshot.electrical.components.filter((record) => record.role === 'fuse') as record (record.componentId)}
            <option value={record.componentId}
              >{snapshot.topology.components.find(
                (component) => component.id === record.componentId
              )?.label}</option
            >
          {/each}
        </select>
      </label>
      <p class="boundary-copy">
        Assigns every current Wire in the chosen System and every current electrical Component.
      </p>
      <button type="button" disabled={!canAuthor || wires.length === 0} onclick={addCircuit}
        >Add electrical Circuit</button
      >
    </div>
  </details>

  <details>
    <summary>Insert splice branch</summary>
    <div class="authoring-grid">
      <label>
        <span>Wire to replace</span>
        <select bind:value={branchConnectionId} disabled={!canAuthor}>
          <option value="">Choose Wire</option>
          {#each wires as wire (wire.id)}<option value={wire.id}>{wire.label}</option>{/each}
        </select>
      </label>
      <label>
        <span>Branch target Port</span>
        <select bind:value={branchTargetPortId} disabled={!canAuthor}>
          <option value="">Choose target Port</option>
          {#each electricalPorts as port (port.id)}<option value={port.id}
              >{port.componentLabel} · {port.label}</option
            >{/each}
        </select>
      </label>
      <label
        ><span>Junction label</span><input bind:value={branchLabel} disabled={!canAuthor} /></label
      >
      <button
        type="button"
        disabled={!canAuthor || !branchConnectionId || !branchTargetPortId}
        onclick={previewBranch}>Preview branch replacement</button
      >
    </div>
  </details>

  {#if branchPreview}
    <section class="branch-preview" aria-label="Electrical branch impact preview">
      <p>Commit preview · no topology changed yet</p>
      <h3>Replace one Wire with explicit two-ended topology</h3>
      <ul>
        {#each branchPreview.replacementConnections ?? [] as connection (connection.id)}
          <li><strong>{connection.label}</strong><span>{connection.id}</span></li>
        {/each}
      </ul>
      <dl>
        <div>
          <dt>Affected evidence</dt>
          <dd>{branchPreview.evidenceIds?.length ?? 0}</dd>
        </div>
        <div>
          <dt>Route transfer</dt>
          <dd>
            {branchPreview.routeTransfer
              ? `${branchPreview.routeTransfer.routeId} → ${branchPreview.routeTransfer.connectionId}`
              : 'No Route'}
          </dd>
        </div>
      </dl>
      <div class="preview-actions">
        <button type="button" onclick={oncancelbranch}>Cancel</button>
        <button type="button" disabled={!canAuthor} onclick={onconfirmbranch}
          >Commit branch replacement</button
        >
      </div>
    </section>
  {/if}

  <div class="register-grid">
    <section>
      <h3>Electrical Connections</h3>
      <ul>
        {#each electricalConnections as connection (connection.id)}
          <li>
            <strong>{connection.label}</strong><span
              >{connection.kind} · {connection.routeId ?? 'Unrouted'}</span
            >
          </li>
        {:else}
          <li><strong>No Connections</strong><span>Add explicit two-Port topology first.</span></li>
        {/each}
      </ul>
    </section>
    <section>
      <h3>Derived Nets & Circuits</h3>
      <ul>
        {#each snapshot.electrical.circuits as circuit (circuit.id)}
          <li>
            <strong>{circuit.label}</strong><span
              >{deriveCircuitNetIds(circuit, nets).length} Nets · {circuit.connectionIds.length} Wires</span
            >
          </li>
        {:else}
          <li>
            <strong>{nets.length} structural Nets</strong><span
              >No functional Circuit assigned.</span
            >
          </li>
        {/each}
      </ul>
    </section>
  </div>

  <FluidLinesPanel {snapshot} {canAuthor} {onaction} />
</section>

<style>
  .circuits-lens > p,
  summary,
  label span,
  .branch-preview > p {
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
  h3 {
    margin: 0 0 0.55rem;
    color: #244a49;
    font: 1rem var(--font-display);
  }
  details {
    margin-bottom: 0.55rem;
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
  .wide,
  .boundary-copy {
    grid-column: span 2;
  }
  .boundary-copy {
    align-self: end;
    margin: 0;
    color: #5f7471;
    font-size: 0.68rem;
    line-height: 1.4;
  }
  .branch-preview {
    margin: 0.75rem 0;
    padding: 0.85rem;
    border: 2px solid #c56a3c;
    background: #fff6ef;
  }
  .branch-preview h3 {
    margin-top: 0.2rem;
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
    gap: 1rem;
    padding: 0.65rem;
    border: 1px solid #cfdbd7;
    background: #fafbf8;
  }
  li strong {
    font-family: var(--font-display);
  }
  li span,
  dd {
    color: #687a79;
    font: 0.62rem var(--font-mono);
  }
  dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem;
  }
  dl div {
    padding: 0.5rem;
    border-left: 3px solid #c56a3c;
  }
  dt {
    color: #5d716f;
    font-size: 0.62rem;
  }
  dd {
    margin: 0.2rem 0 0;
    overflow-wrap: anywhere;
  }
  .preview-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.45rem;
  }
  .preview-actions button:first-child {
    background: #f8faf7;
    color: #234d4c;
  }
  .register-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.7rem;
    margin-top: 1rem;
  }
  @media (max-width: 60rem) {
    .authoring-grid,
    .register-grid {
      grid-template-columns: 1fr;
    }
    .wide,
    .boundary-copy {
      grid-column: auto;
    }
  }
</style>
