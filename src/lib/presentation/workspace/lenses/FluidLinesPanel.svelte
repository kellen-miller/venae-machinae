<script lang="ts">
  import { createOperatingState } from '../../../operating-state/operating-state';

  import type { FluidBehaviorRole, FluidLineConstruction, FluidLength } from '../../../fluid/fluid';
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

  const fluidSystems = $derived(
    snapshot.topology.systems.filter((system) => system.domain === 'fluid')
  );
  const fluidPorts = $derived(
    snapshot.topology.components.flatMap((component) =>
      component.ports
        .filter((port) => port.domain === 'fluid')
        .map((port) => ({ ...port, componentLabel: component.label }))
    )
  );
  const fluidConnections = $derived(
    snapshot.topology.connections.filter((connection) => connection.domain === 'fluid')
  );
  const selectedSystem = $derived(fluidSystems.find((system) => system.id === connectionSystemId));
  const availablePorts = $derived(
    fluidPorts.filter(
      (port) => !selectedSystem?.mediumId || port.mediumId === selectedSystem.mediumId
    )
  );
  const selectedBehavior = $derived(
    snapshot.fluid.behaviors.find((behavior) => behavior.id === boundaryBehaviorId)
  );

  let connectionLabel = $state('');
  let connectionSystemId = $state('');
  let connectionSourcePortId = $state('');
  let connectionTargetPortId = $state('');
  let connectionKind = $state<'fluid-hose' | 'fluid-tube' | 'fluid-pipe'>('fluid-hose');

  let lineConnectionId = $state('');
  let linePartDefinitionId = $state('');
  let routeLength = $state('');
  let hydraulicLength = $state('');
  let cutLength = $state('');
  let elevationStart = $state('');
  let elevationEnd = $state('');
  let lineEnvironment = $state('engine bay');
  let lineProvenance = $state('user-entered Fluid Line record');
  let hoseReinforcement = $state('textile braid');
  let hoseBendRadius = $state('');
  let tubeMaterial = $state('aluminum');
  let tubeWallThickness = $state('');
  let pipeMaterial = $state('steel');
  let pipeSchedule = $state('');

  let behaviorComponentId = $state('');
  let behaviorRole = $state<FluidBehaviorRole>('passage');
  let behaviorDescription = $state('');
  let behaviorProvenance = $state('user-entered Component Behavior');

  let stateName = $state('Warm idle');
  let stateDescription = $state('Engine warm at idle');

  let boundaryBehaviorId = $state('');
  let boundaryStateId = $state('');
  let boundarySubjectId = $state('');
  let boundaryQuantity = $state<
    'pressure' | 'flow' | 'temperature' | 'level' | 'command' | 'operating-point'
  >('temperature');
  let boundaryValue = $state('');
  let boundaryUnit = $state('degC');
  let boundarySource = $state<'measured' | 'entered' | 'sourced' | 'assumed'>('entered');
  let boundaryProvenance = $state('user-entered Boundary Condition');

  function addFluidConnection(): void {
    const system = selectedSystem ?? fluidSystems[0];
    const source = fluidPorts.find((port) => port.id === connectionSourcePortId);
    const target = fluidPorts.find((port) => port.id === connectionTargetPortId);
    if (!system?.mediumId || !source || !target) return;

    if (
      onaction({
        type: 'add-connection',
        causationId: crypto.randomUUID(),
        connection: {
          id: crypto.randomUUID(),
          label: connectionLabel.trim() || `${source.componentLabel} to ${target.componentLabel}`,
          systemId: system.id,
          sourcePortId: source.id,
          targetPortId: target.id,
          domain: 'fluid',
          mediumId: system.mediumId,
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

  function length(decimal: string, source: FluidLength['source']): FluidLength | null {
    return decimal.trim()
      ? {
          decimal: decimal.trim(),
          unit: 'm',
          source,
          provenance: lineProvenance.trim()
        }
      : null;
  }

  function lineConstruction(
    kind: 'fluid-hose' | 'fluid-tube' | 'fluid-pipe'
  ): FluidLineConstruction {
    if (kind === 'fluid-hose') {
      return {
        kind: 'hose',
        reinforcement: hoseReinforcement.trim(),
        minimumBendRadius: length(hoseBendRadius, 'sourced')
      };
    }
    if (kind === 'fluid-tube') {
      return {
        kind: 'tube',
        material: tubeMaterial.trim(),
        wallThickness: length(tubeWallThickness, 'sourced')
      };
    }
    return {
      kind: 'pipe',
      material: pipeMaterial.trim(),
      schedule: pipeSchedule.trim()
    };
  }

  function configureFluidLine(): void {
    const connection = fluidConnections.find((candidate) => candidate.id === lineConnectionId);
    if (
      !connection ||
      connection.kind === 'electrical-wire' ||
      connection.kind === 'electrical-mate' ||
      !lineEnvironment.trim() ||
      !lineProvenance.trim()
    ) {
      return;
    }

    onaction({
      type: 'configure-fluid-line',
      causationId: crypto.randomUUID(),
      line: {
        connectionId: connection.id,
        partDefinitionId: linePartDefinitionId || null,
        construction: lineConstruction(connection.kind),
        routeLength: length(routeLength, 'measured'),
        hydraulicLength: length(hydraulicLength, 'measured'),
        cutLength: length(cutLength, 'entered'),
        elevation:
          elevationStart.trim() && elevationEnd.trim()
            ? {
                start: elevationStart.trim(),
                end: elevationEnd.trim(),
                unit: 'm',
                source: 'entered',
                provenance: lineProvenance.trim()
              }
            : null,
        environment: lineEnvironment.trim(),
        provenance: lineProvenance.trim()
      }
    });
  }

  function configureBehavior(): void {
    const component = snapshot.topology.components.find(
      (candidate) => candidate.id === behaviorComponentId
    );
    const ports = component?.ports.filter((port) => port.domain === 'fluid') ?? [];
    const mediumIds = [
      ...new Set(
        ports
          .map((port) => port.mediumId)
          .filter((mediumId): mediumId is string => mediumId !== null)
      )
    ];
    if (!component || ports.length === 0 || !behaviorDescription.trim()) return;

    onaction({
      type: 'configure-fluid-behavior',
      causationId: crypto.randomUUID(),
      behavior: {
        id: crypto.randomUUID(),
        componentId: component.id,
        role: behaviorRole,
        portIds: ports.map((port) => port.id),
        mediumIds,
        description: behaviorDescription.trim(),
        provenance: behaviorProvenance.trim()
      }
    });
  }

  function addOperatingState(): void {
    if (!stateName.trim()) return;
    if (
      onaction({
        type: 'add-operating-state',
        causationId: crypto.randomUUID(),
        state: createOperatingState({
          id: crypto.randomUUID(),
          name: stateName.trim(),
          description: stateDescription.trim()
        })
      })
    ) {
      stateName = '';
      stateDescription = '';
    }
  }

  function recordBoundary(): void {
    if (
      !selectedBehavior ||
      !boundaryStateId ||
      !boundarySubjectId ||
      !boundaryValue.trim() ||
      !boundaryProvenance.trim()
    ) {
      return;
    }

    onaction({
      type: 'record-fluid-boundary-condition',
      causationId: crypto.randomUUID(),
      boundary: {
        id: crypto.randomUUID(),
        behaviorId: selectedBehavior.id,
        subjectId: boundarySubjectId,
        operatingStateId: boundaryStateId,
        quantity: boundaryQuantity,
        value: boundaryValue.trim(),
        unit: boundaryQuantity === 'command' ? null : boundaryUnit.trim() || null,
        source: boundarySource,
        provenance: boundaryProvenance.trim()
      }
    });
  }
</script>

<section class="fluid-panel">
  <header>
    <p>Fluid construction remains medium-specific</p>
    <h3>Fluid Lines & Behaviors</h3>
  </header>

  <details open>
    <summary>Add two-ended Fluid Line topology</summary>
    <div class="authoring-grid">
      <label>
        <span>Fluid System</span>
        <select bind:value={connectionSystemId} disabled={!canAuthor}>
          <option value="">Choose Fluid System</option>
          {#each fluidSystems as system (system.id)}
            <option value={system.id}>{system.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Line label</span>
        <input bind:value={connectionLabel} disabled={!canAuthor} />
      </label>
      <label>
        <span>Construction kind</span>
        <select bind:value={connectionKind} disabled={!canAuthor}>
          <option value="fluid-hose">Flexible hose</option>
          <option value="fluid-tube">Rigid tube</option>
          <option value="fluid-pipe">Rigid pipe</option>
        </select>
      </label>
      <label>
        <span>Fluid source Port</span>
        <select bind:value={connectionSourcePortId} disabled={!canAuthor}>
          <option value="">Choose source Port</option>
          {#each availablePorts as port (port.id)}
            <option value={port.id}>{port.componentLabel} · {port.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Fluid target Port</span>
        <select bind:value={connectionTargetPortId} disabled={!canAuthor}>
          <option value="">Choose target Port</option>
          {#each availablePorts as port (port.id)}
            <option value={port.id}>{port.componentLabel} · {port.label}</option>
          {/each}
        </select>
      </label>
      <button
        type="button"
        disabled={!canAuthor ||
          !connectionSystemId ||
          !connectionSourcePortId ||
          !connectionTargetPortId}
        onclick={addFluidConnection}
      >
        Add Fluid Line
      </button>
    </div>
  </details>

  <details>
    <summary>Record Line construction and length evidence</summary>
    <div class="authoring-grid">
      <label>
        <span>Fluid Line</span>
        <select bind:value={lineConnectionId} disabled={!canAuthor}>
          <option value="">Choose Fluid Line</option>
          {#each fluidConnections as connection (connection.id)}
            <option value={connection.id}>{connection.label} · {connection.kind}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Part Definition</span>
        <select bind:value={linePartDefinitionId} disabled={!canAuthor}>
          <option value="">Not assigned</option>
          {#each snapshot.partDefinitions as definition (definition.id)}
            <option value={definition.id}>{definition.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Route Length (m)</span>
        <input bind:value={routeLength} inputmode="decimal" disabled={!canAuthor} />
      </label>
      <label>
        <span>Hydraulic Length (m)</span>
        <input bind:value={hydraulicLength} inputmode="decimal" disabled={!canAuthor} />
      </label>
      <label>
        <span>Cut Length (m)</span>
        <input bind:value={cutLength} inputmode="decimal" disabled={!canAuthor} />
      </label>
      <label>
        <span>Elevation start (m)</span>
        <input bind:value={elevationStart} inputmode="decimal" disabled={!canAuthor} />
      </label>
      <label>
        <span>Elevation end (m)</span>
        <input bind:value={elevationEnd} inputmode="decimal" disabled={!canAuthor} />
      </label>
      <label>
        <span>Environment</span>
        <input bind:value={lineEnvironment} disabled={!canAuthor} />
      </label>
      <label class="wide">
        <span>Line provenance</span>
        <input bind:value={lineProvenance} disabled={!canAuthor} />
      </label>
      <label>
        <span>Hose reinforcement</span>
        <input bind:value={hoseReinforcement} disabled={!canAuthor} />
      </label>
      <label>
        <span>Hose minimum bend radius (m)</span>
        <input bind:value={hoseBendRadius} inputmode="decimal" disabled={!canAuthor} />
      </label>
      <label>
        <span>Tube material</span>
        <input bind:value={tubeMaterial} disabled={!canAuthor} />
      </label>
      <label>
        <span>Tube wall thickness (m)</span>
        <input bind:value={tubeWallThickness} inputmode="decimal" disabled={!canAuthor} />
      </label>
      <label>
        <span>Pipe material</span>
        <input bind:value={pipeMaterial} disabled={!canAuthor} />
      </label>
      <label>
        <span>Pipe schedule</span>
        <input bind:value={pipeSchedule} disabled={!canAuthor} />
      </label>
      <button type="button" disabled={!canAuthor || !lineConnectionId} onclick={configureFluidLine}>
        Save Fluid Line record
      </button>
    </div>
  </details>

  <details>
    <summary>Compose Component Behavior</summary>
    <div class="authoring-grid">
      <label>
        <span>Fluid Component</span>
        <select bind:value={behaviorComponentId} disabled={!canAuthor}>
          <option value="">Choose Component</option>
          {#each snapshot.fluid.components as record (record.componentId)}
            <option value={record.componentId}>
              {snapshot.topology.components.find((component) => component.id === record.componentId)
                ?.label} · {record.role}
            </option>
          {/each}
        </select>
      </label>
      <label>
        <span>Behavior role</span>
        <select bind:value={behaviorRole} disabled={!canAuthor}>
          {#each ['passage', 'pump', 'restriction', 'valve', 'heat-source', 'heat-sink', 'volume', 'heat-exchanger'] as role (role)}
            <option value={role}>{role}</option>
          {/each}
        </select>
      </label>
      <label class="wide">
        <span>Behavior description</span>
        <input bind:value={behaviorDescription} disabled={!canAuthor} />
      </label>
      <label class="wide">
        <span>Behavior provenance</span>
        <input bind:value={behaviorProvenance} disabled={!canAuthor} />
      </label>
      <button
        type="button"
        disabled={!canAuthor || !behaviorComponentId || !behaviorDescription.trim()}
        onclick={configureBehavior}
      >
        Add Component Behavior
      </button>
    </div>
  </details>

  <details>
    <summary>Record explicit Boundary Condition</summary>
    <div class="authoring-grid">
      <label>
        <span>Operating State name</span>
        <input bind:value={stateName} disabled={!canAuthor} />
      </label>
      <label class="wide">
        <span>Operating State description</span>
        <input bind:value={stateDescription} disabled={!canAuthor} />
      </label>
      <button type="button" disabled={!canAuthor || !stateName.trim()} onclick={addOperatingState}>
        Add Operating State
      </button>
      <label>
        <span>Component Behavior</span>
        <select bind:value={boundaryBehaviorId} disabled={!canAuthor}>
          <option value="">Choose Behavior</option>
          {#each snapshot.fluid.behaviors as behavior (behavior.id)}
            <option value={behavior.id}>{behavior.role} · {behavior.description}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Operating State</span>
        <select
          aria-label="Boundary Operating State"
          bind:value={boundaryStateId}
          disabled={!canAuthor}
        >
          <option value="">Choose Operating State</option>
          {#each snapshot.operatingStates as state (state.id)}
            <option value={state.id}>{state.name}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Boundary subject</span>
        <select bind:value={boundarySubjectId} disabled={!canAuthor}>
          <option value="">Choose Behavior or Port</option>
          {#if selectedBehavior}
            <option value={selectedBehavior.id}>Behavior · {selectedBehavior.description}</option>
          {/if}
          {#each selectedBehavior?.portIds ?? [] as portId (portId)}
            <option value={portId}>
              {fluidPorts.find((port) => port.id === portId)?.componentLabel} ·
              {fluidPorts.find((port) => port.id === portId)?.label}
            </option>
          {/each}
        </select>
      </label>
      <label>
        <span>Boundary quantity</span>
        <select bind:value={boundaryQuantity} disabled={!canAuthor}>
          <option value="pressure">Pressure</option>
          <option value="flow">Flow</option>
          <option value="temperature">Temperature</option>
          <option value="level">Level</option>
          <option value="command">Command</option>
          <option value="operating-point">Assumed operating point</option>
        </select>
      </label>
      <label>
        <span>Boundary value</span>
        <input bind:value={boundaryValue} disabled={!canAuthor} />
      </label>
      <label>
        <span>Boundary unit</span>
        <input bind:value={boundaryUnit} disabled={!canAuthor} />
      </label>
      <label>
        <span>Boundary source</span>
        <select bind:value={boundarySource} disabled={!canAuthor}>
          <option value="measured">Measured</option>
          <option value="entered">Entered</option>
          <option value="sourced">Sourced</option>
          <option value="assumed">Assumed</option>
        </select>
      </label>
      <label class="wide">
        <span>Boundary provenance</span>
        <input bind:value={boundaryProvenance} disabled={!canAuthor} />
      </label>
      <button
        type="button"
        disabled={!canAuthor ||
          !boundaryBehaviorId ||
          !boundaryStateId ||
          !boundarySubjectId ||
          !boundaryValue.trim()}
        onclick={recordBoundary}
      >
        Record Boundary Condition
      </button>
    </div>
  </details>

  <div class="register-grid">
    <section>
      <h4>Fluid Lines</h4>
      <ul>
        {#each fluidConnections as connection (connection.id)}
          {@const line = snapshot.fluid.lines.find(
            (candidate) => candidate.connectionId === connection.id
          )}
          <li>
            <strong>{connection.label}</strong>
            <span>{connection.kind} · {connection.routeId ?? 'Unrouted'}</span>
            <span>
              {line?.hydraulicLength?.decimal ?? 'Unknown'}
              {line?.hydraulicLength?.unit ?? ''} hydraulic
            </span>
          </li>
        {:else}
          <li><strong>No Fluid Lines</strong><span>Add exact two-Port topology first.</span></li>
        {/each}
      </ul>
    </section>
    <section>
      <h4>Behaviors & Boundaries</h4>
      <ul>
        {#each snapshot.fluid.behaviors as behavior (behavior.id)}
          <li>
            <strong>{behavior.role}</strong>
            <span>{behavior.mediumIds.length} media · {behavior.portIds.length} Ports</span>
            <span>
              {snapshot.fluid.boundaryConditions.filter(
                (boundary) => boundary.behaviorId === behavior.id
              ).length} boundaries
            </span>
          </li>
        {:else}
          <li>
            <strong>No Component Behaviors</strong>
            <span>Topology remains valid without inferred hydraulics.</span>
          </li>
        {/each}
      </ul>
    </section>
  </div>
</section>

<style>
  .fluid-panel {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 3px double #6b9fa2;
  }

  header p,
  summary,
  label span {
    margin: 0;
    color: #637b7b;
    font: 0.62rem var(--font-mono);
    text-transform: uppercase;
  }

  h3 {
    margin: 0.15rem 0 0.8rem;
    color: #1e555a;
    font: 1.5rem var(--font-display);
  }

  h4 {
    margin: 0 0 0.55rem;
    color: #244a49;
    font: 1rem var(--font-display);
  }

  details {
    margin-bottom: 0.55rem;
    border: 1px solid #bdd3d3;
    background: #f4f9f8;
  }

  summary {
    padding: 0.7rem;
    color: #28585a;
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
    border: 1px solid #8faeae;
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
    background: #1e555a;
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

  .wide {
    grid-column: span 2;
  }

  .register-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.7rem;
    margin-top: 1rem;
  }

  ul {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: minmax(10rem, 1fr) auto auto;
    gap: 0.7rem;
    padding: 0.65rem;
    border: 1px solid #cfdbd7;
    background: #fafbf8;
  }

  li strong {
    font-family: var(--font-display);
  }

  li span {
    color: #687a79;
    font: 0.62rem var(--font-mono);
  }

  @media (max-width: 60rem) {
    .authoring-grid,
    .register-grid {
      grid-template-columns: 1fr;
    }

    .wide {
      grid-column: auto;
    }

    li {
      grid-template-columns: 1fr;
    }
  }
</style>
