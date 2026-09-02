<script lang="ts">
  import { compareOperatingStateOverlays } from '../../../operating-state/evaluate-overlay';
  import {
    createOperatingState,
    createReferenceOperatingStates
  } from '../../../operating-state/operating-state';
  import { projectSnapshotToRendererProjection } from '../../../renderer/projection';
  import TopologyRenderer from '../../../renderer/TopologyRenderer.svelte';

  import type {
    OverlayChannel,
    StateBinding,
    StateBindingDirection,
    StateBindingEvidenceState,
    StateStatement
  } from '../../../operating-state/operating-state';
  import type { ProjectAction } from '../../../project/action';
  import type { ProjectSnapshot } from '../../../project/project';
  import type { RendererIntent } from '../../../renderer/intent';
  import type { RendererViewport } from '../../../renderer/projection';

  let {
    snapshot,
    canAuthor,
    onaction,
    leftViewport,
    rightViewport,
    stateIds,
    overlayChannels,
    motionPaused,
    onincrease,
    onstate,
    onviewport
  }: {
    snapshot: ProjectSnapshot;
    canAuthor: boolean;
    onaction: (action: ProjectAction) => boolean;
    leftViewport: RendererViewport;
    rightViewport: RendererViewport;
    stateIds: Readonly<{ left: string | null; right: string | null }>;
    overlayChannels: readonly OverlayChannel[];
    motionPaused: boolean;
    onincrease: (side: 'left' | 'right') => void;
    onstate: (side: 'left' | 'right', stateId: string | null) => void;
    onviewport: (viewport: RendererViewport) => void;
  } = $props();

  let stateName = $state('');
  let stateDescription = $state('');
  let draftNames = $state<Record<string, string>>({});
  let draftDescriptions = $state<Record<string, string>>({});
  let statementStateId = $state('');
  let statementKind = $state<'commands' | 'conditions' | 'measurements' | 'assumptions'>(
    'commands'
  );
  let statementSubjectId = $state('');
  let statementLabel = $state('');
  let statementValue = $state('');
  let statementUnit = $state('');
  let statementProvenance = $state('user-entered state statement');
  let bindingStateId = $state('');
  let bindingConnectionId = $state('');
  let bindingPathConnectionIds = $state<string[]>([]);
  let bindingChannel = $state<StateBinding['channel']>('potential');
  let bindingEvidenceState = $state<StateBindingEvidenceState>('known');
  let bindingValue = $state('');
  let bindingUnit = $state('V');
  let bindingDirection = $state<StateBindingDirection>('source-to-load');
  let bindingEvidenceId = $state('');
  let bindingCalculationResultId = $state('');
  let bindingApplicability = $state('selected Operating State');
  let bindingAssumptions = $state('');
  let bindingOmissions = $state('');
  let bindingUncertainty = $state('');
  let bindingConflicts = $state('');
  let bindingProvenance = $state('user-entered State Binding');

  const leftStateId = $derived(stateIds.left ?? snapshot.operatingStates[0]?.id ?? null);
  const rightStateId = $derived(stateIds.right ?? snapshot.operatingStates[1]?.id ?? null);
  const leftOverlay = $derived(
    snapshot.results.find(
      (result) =>
        (result.status === 'current' || result.status === 'stale') &&
        result.detail?.type === 'overlay' &&
        result.detail.overlay.operatingStateId === leftStateId
    )?.detail
  );
  const rightOverlay = $derived(
    snapshot.results.find(
      (result) =>
        (result.status === 'current' || result.status === 'stale') &&
        result.detail?.type === 'overlay' &&
        result.detail.overlay.operatingStateId === rightStateId
    )?.detail
  );
  const leftProjection = $derived(
    projectSnapshotToRendererProjection(snapshot, {
      operatingStateId: leftStateId,
      overlayChannels
    })
  );
  const rightProjection = $derived(
    projectSnapshotToRendererProjection(snapshot, {
      operatingStateId: rightStateId,
      overlayChannels
    })
  );
  const differences = $derived(
    leftOverlay?.type === 'overlay' && rightOverlay?.type === 'overlay'
      ? compareOperatingStateOverlays(leftOverlay.overlay, rightOverlay.overlay)
      : []
  );

  function handleRendererIntent(intent: RendererIntent): void {
    if (intent.type === 'viewport-changed') onviewport(intent.viewport);
  }

  function addState(): void {
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

  function addReferenceStates(): void {
    const existingNames = new Set(snapshot.operatingStates.map((state) => state.name));
    for (const state of createReferenceOperatingStates(() => crypto.randomUUID())) {
      if (existingNames.has(state.name)) continue;
      onaction({
        type: 'add-operating-state',
        causationId: crypto.randomUUID(),
        state
      });
    }
  }

  function updateState(stateId: string): void {
    const state = snapshot.operatingStates.find((candidate) => candidate.id === stateId);
    if (!state) return;
    onaction({
      type: 'update-operating-state',
      causationId: crypto.randomUUID(),
      state: {
        ...state,
        name: draftNames[state.id]?.trim() || state.name,
        description: draftDescriptions[state.id]?.trim() || state.description
      }
    });
  }

  function cloneState(stateId: string): void {
    const state = snapshot.operatingStates.find((candidate) => candidate.id === stateId);
    if (!state) return;
    onaction({
      type: 'clone-operating-state',
      causationId: crypto.randomUUID(),
      stateId,
      cloneId: crypto.randomUUID(),
      cloneName: `${state.name} copy`
    });
  }

  function deleteState(stateId: string): void {
    onaction({
      type: 'delete-operating-state',
      causationId: crypto.randomUUID(),
      stateId
    });
  }

  function splitEntries(value: string): string[] {
    return value
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function addStatement(): void {
    const state = snapshot.operatingStates.find(
      (candidate) => candidate.id === (statementStateId || leftStateId)
    );
    const subjectId = statementSubjectId || snapshot.id;
    if (!state || !statementLabel.trim() || !statementValue.trim() || !statementProvenance.trim()) {
      return;
    }
    const statement: StateStatement = {
      id: crypto.randomUUID(),
      subjectId,
      label: statementLabel.trim(),
      value: statementValue.trim(),
      unit: statementUnit.trim() || null,
      provenance: statementProvenance.trim()
    };
    const statements = [...state[statementKind], statement];
    const updated =
      statementKind === 'commands'
        ? { ...state, commands: statements }
        : statementKind === 'conditions'
          ? { ...state, conditions: statements }
          : statementKind === 'measurements'
            ? { ...state, measurements: statements }
            : { ...state, assumptions: statements };
    if (
      onaction({
        type: 'update-operating-state',
        causationId: crypto.randomUUID(),
        state: updated
      })
    ) {
      statementLabel = '';
      statementValue = '';
      statementUnit = '';
    }
  }

  function addBinding(): void {
    const state = snapshot.operatingStates.find(
      (candidate) => candidate.id === (bindingStateId || leftStateId)
    );
    const connection = snapshot.topology.connections.find(
      (candidate) => candidate.id === bindingConnectionId
    );
    const sourceComponent = snapshot.topology.components.find((component) =>
      component.ports.some((port) => port.id === connection?.sourcePortId)
    );
    if (!state || !connection || !bindingApplicability.trim()) return;

    const known = bindingEvidenceState === 'known';
    const direction =
      bindingChannel === 'potential' || bindingChannel === 'temperature'
        ? null
        : bindingEvidenceState === 'conflicting' && bindingChannel === 'fluid-direction'
          ? 'conflicting'
          : bindingEvidenceState === 'unknown' && bindingChannel === 'fluid-direction'
            ? 'unknown'
            : bindingEvidenceState === 'excluded' && bindingChannel === 'fluid-direction'
              ? 'excluded'
              : bindingDirection;
    const requiresBehavior =
      known &&
      (bindingChannel === 'signal' ||
        (bindingChannel === 'fluid-direction' &&
          (direction === 'forward' || direction === 'reverse')));
    const pathConnectionIds = bindingPathConnectionIds.includes(connection.id)
      ? bindingPathConnectionIds
      : [connection.id, ...bindingPathConnectionIds];
    const binding: StateBinding = {
      id: crypto.randomUUID(),
      subjectId: connection.id,
      systemId: connection.systemId,
      channel: bindingChannel,
      evidenceState: bindingEvidenceState,
      value:
        known &&
        (bindingChannel === 'potential' ||
          bindingChannel === 'current' ||
          bindingChannel === 'temperature')
          ? bindingValue.trim() || null
          : null,
      unit: bindingUnit.trim() || null,
      direction,
      referenceSubjectId: bindingChannel === 'potential' ? snapshot.id : null,
      pathConnectionIds,
      behavior:
        requiresBehavior && sourceComponent
          ? {
              id: crypto.randomUUID(),
              componentId: sourceComponent.id,
              description: `${bindingChannel} Behavior for ${connection.label}`,
              provenance: bindingProvenance.trim()
            }
          : null,
      calculationResultId: bindingCalculationResultId || null,
      evidenceIds: bindingEvidenceId ? [bindingEvidenceId] : [],
      assumptions: splitEntries(bindingAssumptions),
      omissions: splitEntries(bindingOmissions),
      applicability: bindingApplicability.trim(),
      uncertainty: bindingUncertainty.trim() || null,
      conflictValues: splitEntries(bindingConflicts),
      provenance: bindingProvenance.trim() ? [bindingProvenance.trim()] : []
    };
    if (
      onaction({
        type: 'upsert-state-binding',
        causationId: crypto.randomUUID(),
        operatingStateId: state.id,
        binding
      })
    ) {
      bindingValue = '';
      bindingConflicts = '';
      bindingAssumptions = '';
      bindingOmissions = '';
      bindingUncertainty = '';
      bindingPathConnectionIds = [];
    }
  }
</script>

<section>
  <p>Linked two-up canvases · differences classify change, never cause</p>
  <h2>State Compare</h2>

  <details class="state-authoring" open>
    <summary>Operating State register</summary>
    <div class="new-state">
      <label>
        <span>State name</span>
        <input
          aria-label="State Compare Operating State name"
          bind:value={stateName}
          disabled={!canAuthor}
        />
      </label>
      <label>
        <span>Description</span>
        <input
          aria-label="State Compare Operating State description"
          bind:value={stateDescription}
          disabled={!canAuthor}
        />
      </label>
      <button type="button" onclick={addState} disabled={!canAuthor || !stateName.trim()}>
        Create Operating State
      </button>
      <button type="button" onclick={addReferenceStates} disabled={!canAuthor}>
        Create five reference Operating States
      </button>
    </div>
    <ul class="state-register">
      {#each snapshot.operatingStates as state (state.id)}
        <li data-operating-state-record={state.id}>
          <label>
            <span>Name</span>
            <input
              aria-label={`${state.name} editable name`}
              value={draftNames[state.id] ?? state.name}
              oninput={(event) =>
                (draftNames = { ...draftNames, [state.id]: event.currentTarget.value })}
              disabled={!canAuthor}
            />
          </label>
          <label>
            <span>Description</span>
            <input
              aria-label={`${state.name} editable description`}
              value={draftDescriptions[state.id] ?? state.description}
              oninput={(event) =>
                (draftDescriptions = {
                  ...draftDescriptions,
                  [state.id]: event.currentTarget.value
                })}
              disabled={!canAuthor}
            />
          </label>
          <div>
            <button type="button" onclick={() => updateState(state.id)} disabled={!canAuthor}
              >Save</button
            >
            <button type="button" onclick={() => cloneState(state.id)} disabled={!canAuthor}
              >Clone</button
            >
            <button type="button" onclick={() => deleteState(state.id)} disabled={!canAuthor}
              >Delete</button
            >
          </div>
        </li>
      {/each}
    </ul>
  </details>

  <details class="binding-authoring">
    <summary>Commands, conditions, measurements, assumptions, and State Bindings</summary>
    <div class="statement-form">
      <label>
        <span>Operating State</span>
        <select aria-label="Statement Operating State" bind:value={statementStateId}>
          <option value="">State A</option>
          {#each snapshot.operatingStates as state (state.id)}
            <option value={state.id}>{state.name}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Statement kind</span>
        <select aria-label="State statement kind" bind:value={statementKind}>
          <option value="commands">Command</option>
          <option value="conditions">Condition</option>
          <option value="measurements">Measurement</option>
          <option value="assumptions">Assumption</option>
        </select>
      </label>
      <label>
        <span>Subject</span>
        <select aria-label="State statement subject" bind:value={statementSubjectId}>
          <option value={snapshot.id}>{snapshot.name}</option>
          {#each snapshot.topology.systems as system (system.id)}
            <option value={system.id}>{system.label}</option>
          {/each}
          {#each snapshot.topology.components as component (component.id)}
            <option value={component.id}>{component.label}</option>
          {/each}
          {#each snapshot.topology.connections as connection (connection.id)}
            <option value={connection.id}>{connection.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Label</span>
        <input aria-label="State statement label" bind:value={statementLabel} />
      </label>
      <label>
        <span>Value</span>
        <input aria-label="State statement value" bind:value={statementValue} />
      </label>
      <label>
        <span>Unit</span>
        <input aria-label="State statement unit" bind:value={statementUnit} />
      </label>
      <label>
        <span>Provenance</span>
        <input aria-label="State statement provenance" bind:value={statementProvenance} />
      </label>
      <button
        type="button"
        onclick={addStatement}
        disabled={!canAuthor || !snapshot.operatingStates.length}
      >
        Add explicit statement
      </button>
    </div>

    <div class="binding-form">
      <label>
        <span>Operating State</span>
        <select aria-label="Binding Operating State" bind:value={bindingStateId}>
          <option value="">State A</option>
          {#each snapshot.operatingStates as state (state.id)}
            <option value={state.id}>{state.name}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Physical connection</span>
        <select aria-label="Binding physical connection" bind:value={bindingConnectionId}>
          <option value="">Choose connection</option>
          {#each snapshot.topology.connections as connection (connection.id)}
            <option value={connection.id}>{connection.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Overlay Channel</span>
        <select aria-label="Binding Overlay Channel" bind:value={bindingChannel}>
          <option value="potential">Electrical potential</option>
          <option value="current">Electrical current</option>
          <option value="signal">Signal</option>
          <option value="fluid-direction">Fluid direction</option>
          <option value="temperature">Temperature</option>
        </select>
      </label>
      <label>
        <span>Complete path</span>
        <select
          multiple
          size="4"
          aria-label="Binding path connections"
          bind:value={bindingPathConnectionIds}
        >
          {#each snapshot.topology.connections as connection (connection.id)}
            <option value={connection.id}>{connection.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Evidence state</span>
        <select aria-label="Binding evidence state" bind:value={bindingEvidenceState}>
          <option value="known">Known</option>
          <option value="unknown">Unknown</option>
          <option value="conflicting">Conflicting</option>
          <option value="unsupported">Unsupported</option>
          <option value="excluded">Excluded</option>
        </select>
      </label>
      <label>
        <span>Value</span>
        <input aria-label="Binding value" bind:value={bindingValue} />
      </label>
      <label>
        <span>Unit</span>
        <input aria-label="Binding unit" bind:value={bindingUnit} />
      </label>
      <label>
        <span>Direction</span>
        <select aria-label="Binding direction" bind:value={bindingDirection}>
          <option value="source-to-load">Source to load</option>
          <option value="load-to-return">Load to return</option>
          <option value="driver-to-receiver">Driver to receiver</option>
          <option value="bidirectional">Bidirectional</option>
          <option value="forward">Forward</option>
          <option value="reverse">Reverse</option>
          <option value="zero">Explicitly zero</option>
          <option value="unknown">Unknown</option>
          <option value="conflicting">Conflicting</option>
          <option value="excluded">Excluded</option>
        </select>
      </label>
      <label>
        <span>Evidence</span>
        <select aria-label="Binding evidence" bind:value={bindingEvidenceId}>
          <option value="">No evidence selected</option>
          {#each snapshot.evidence as evidence (evidence.id)}
            <option value={evidence.id}>{evidence.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Calculation Result</span>
        <select aria-label="Binding Calculation Result" bind:value={bindingCalculationResultId}>
          <option value="">No Calculation Result selected</option>
          {#each snapshot.results.filter((result) => result.detail?.type === 'calculation') as result (result.id)}
            <option value={result.id}>{result.id}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Applicability</span>
        <input aria-label="Binding applicability" bind:value={bindingApplicability} />
      </label>
      <label>
        <span>Assumptions</span>
        <input aria-label="Binding assumptions" bind:value={bindingAssumptions} />
      </label>
      <label>
        <span>Omissions</span>
        <input aria-label="Binding omissions" bind:value={bindingOmissions} />
      </label>
      <label>
        <span>Uncertainty</span>
        <input aria-label="Binding uncertainty" bind:value={bindingUncertainty} />
      </label>
      <label>
        <span>Conflict values</span>
        <input aria-label="Binding conflict values" bind:value={bindingConflicts} />
      </label>
      <label>
        <span>Provenance</span>
        <input aria-label="Binding provenance" bind:value={bindingProvenance} />
      </label>
      <button
        type="button"
        onclick={addBinding}
        disabled={!canAuthor || !bindingConnectionId || !snapshot.operatingStates.length}
      >
        Add explicit State Binding
      </button>
    </div>

    <ul class="binding-register">
      {#each snapshot.operatingStates as state (state.id)}
        {#each state.bindings as binding (binding.id)}
          <li data-state-binding-record={binding.id}>
            <span>{state.name}</span>
            <strong>{binding.channel}</strong>
            <span>{binding.evidenceState} · {binding.subjectId}</span>
            <button
              type="button"
              disabled={!canAuthor}
              onclick={() =>
                onaction({
                  type: 'remove-state-binding',
                  causationId: crypto.randomUUID(),
                  operatingStateId: state.id,
                  bindingId: binding.id
                })}>Remove</button
            >
          </li>
        {/each}
      {/each}
    </ul>
  </details>

  <div class="comparison-grid" data-motion-paused={motionPaused}>
    <article data-compare-viewport="left" data-zoom={leftViewport.zoom}>
      <header>
        <span>A</span>
        <label>
          <strong>Operating State A</strong>
          <select
            aria-label="Compare Operating State A"
            value={leftStateId ?? ''}
            onchange={(event) => onstate('left', event.currentTarget.value || null)}
          >
            <option value="">Choose state</option>
            {#each snapshot.operatingStates as state (state.id)}
              <option value={state.id}>{state.name}</option>
            {/each}
          </select>
        </label>
      </header>
      <div class="mini-canvas">
        <TopologyRenderer
          projection={leftProjection}
          viewport={leftViewport}
          capability="review"
          onintent={handleRendererIntent}
        />
      </div>
      <button
        type="button"
        aria-label="Increase left comparison zoom"
        onclick={() => onincrease('left')}>Zoom in linked pair</button
      >
    </article>
    <article data-compare-viewport="right" data-zoom={rightViewport.zoom}>
      <header>
        <span>B</span>
        <label>
          <strong>Operating State B</strong>
          <select
            aria-label="Compare Operating State B"
            value={rightStateId ?? ''}
            onchange={(event) => onstate('right', event.currentTarget.value || null)}
          >
            <option value="">Choose state</option>
            {#each snapshot.operatingStates as state (state.id)}
              <option value={state.id}>{state.name}</option>
            {/each}
          </select>
        </label>
      </header>
      <div class="mini-canvas">
        <TopologyRenderer
          projection={rightProjection}
          viewport={rightViewport}
          capability="review"
          onintent={handleRendererIntent}
        />
      </div>
      <button
        type="button"
        aria-label="Increase right comparison zoom"
        onclick={() => onincrease('right')}>Zoom in linked pair</button
      >
    </article>
  </div>

  <section class="difference-table" aria-label="State Compare differences">
    <header>
      <h3>Observed differences</h3>
      <span>{motionPaused ? 'Motion paused' : 'Constant direction cue enabled'}</span>
    </header>
    <table>
      <thead>
        <tr><th>Subject</th><th>Channel</th><th>Classification</th><th>A</th><th>B</th></tr>
      </thead>
      <tbody>
        {#each differences as difference (`${difference.connectionId}:${difference.channel}`)}
          <tr>
            <td>{difference.connectionId}</td>
            <td>{difference.channel}</td>
            <td>{difference.classification}</td>
            <td>{difference.leftLabel ?? 'absent'}</td>
            <td>{difference.rightLabel ?? 'absent'}</td>
          </tr>
        {:else}
          <tr><td colspan="5">No evaluated differences available.</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
</section>

<style>
  section > p {
    margin: 0;
    color: #6b7c7a;
    font: 0.62rem var(--font-mono);
    text-transform: uppercase;
  }

  h2 {
    margin: 0.15rem 0 0.65rem;
    color: #173d3f;
    font: 2rem var(--font-display);
  }

  .state-authoring,
  .binding-authoring {
    margin-bottom: 0.65rem;
    border: 1px solid #bdccc7;
    border-radius: 0.4rem;
    background: #f9faf7;
  }

  .state-authoring > summary,
  .binding-authoring > summary {
    padding: 0.55rem;
    font: 0.72rem var(--font-mono);
    cursor: pointer;
  }

  .new-state,
  .state-register li {
    display: grid;
    grid-template-columns: 1fr 1.4fr auto auto;
    gap: 0.4rem;
    align-items: end;
    padding: 0.5rem;
    border-top: 1px solid #d3ddda;
  }

  .state-register {
    max-height: 10rem;
    overflow: auto;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .state-register li {
    grid-template-columns: 1fr 1.4fr auto;
  }

  .state-register li > div {
    display: flex;
    gap: 0.25rem;
  }

  .statement-form,
  .binding-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.4rem;
    align-items: end;
    padding: 0.5rem;
    border-top: 1px solid #d3ddda;
  }

  .binding-register {
    max-height: 8rem;
    overflow: auto;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .binding-register li {
    display: grid;
    grid-template-columns: 1fr 0.7fr 1.4fr auto;
    gap: 0.4rem;
    align-items: center;
    padding: 0.35rem 0.5rem;
    border-top: 1px solid #d3ddda;
    font: 0.62rem var(--font-mono);
  }

  label {
    display: grid;
    gap: 0.2rem;
    font: 0.6rem var(--font-mono);
    text-transform: uppercase;
  }

  input,
  select,
  button {
    min-height: 2.15rem;
    border: 1px solid #aebfba;
    border-radius: 0.3rem;
    background: #f9faf7;
    color: #214847;
    font: 0.68rem var(--font-mono);
  }

  input,
  select {
    padding: 0.35rem 0.45rem;
  }

  button {
    padding: 0.35rem 0.55rem;
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
  }

  article {
    overflow: hidden;
    border: 1px solid #bdccc7;
    border-radius: 0.6rem 0.2rem 0.6rem 0.2rem;
    background: #f9faf7;
  }

  article > header {
    display: flex;
    gap: 0.55rem;
    align-items: center;
    padding: 0.55rem;
    border-bottom: 1px solid #d3ddda;
  }

  article > header > span {
    display: grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    background: #1d4a4b;
    color: white;
    font: 0.65rem var(--font-mono);
  }

  article > header label {
    flex: 1;
  }

  .mini-canvas {
    height: 14rem;
    overflow: hidden;
    background: #e7eeea;
  }

  .mini-canvas :global(.renderer-shell) {
    height: 100%;
    min-height: 0;
    grid-template-columns: 1fr;
  }

  .mini-canvas :global(.semantic-lens) {
    display: none;
  }

  article > button {
    width: 100%;
    border: 0;
    border-top: 1px solid #d3ddda;
    border-radius: 0;
    background: #edf3ef;
  }

  .difference-table {
    margin-top: 0.65rem;
    overflow: auto;
    border: 1px solid #bdccc7;
    border-radius: 0.4rem;
    background: #f9faf7;
  }

  .difference-table header {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
  }

  .difference-table h3 {
    margin: 0;
    font: 1rem var(--font-display);
  }

  .difference-table span,
  table {
    font: 0.62rem var(--font-mono);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 0.4rem;
    border-top: 1px solid #d3ddda;
    text-align: left;
  }

  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  summary:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }

  @media (max-width: 43.75rem) {
    .comparison-grid,
    .new-state,
    .state-register li,
    .binding-register li {
      grid-template-columns: 1fr;
    }
  }
</style>
