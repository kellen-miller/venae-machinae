<script lang="ts">
  import { PRIMITIVES } from '../../reference/primitives';
  import ContextualHelp from '../help/ContextualHelp.svelte';
  import { FLUID_NOMINAL_SIZE_LABEL, fluidLineNominalSize } from '../../fluid/fluid';

  import type { ProjectSnapshot } from '../../project/project';
  import type { ProjectAction } from '../../project/action';
  import type { WorkspaceMode, WorkspaceSubject } from './workspace-presentation.svelte';

  let {
    snapshot,
    selection,
    preview,
    mode,
    denseViewOpen,
    canAuthor,
    onmove,
    onaddprimitive,
    ondelete,
    onfollow,
    onreveal,
    onaction
  }: {
    snapshot: ProjectSnapshot;
    selection: WorkspaceSubject | null;
    preview: WorkspaceSubject | null;
    mode: WorkspaceMode;
    denseViewOpen: boolean;
    canAuthor: boolean;
    onmove: (componentId: string, x: string, y: string) => void;
    onaddprimitive: (primitiveId: string, fluidSystemId?: string) => void;
    ondelete: (subject: Readonly<{ kind: 'component' | 'connection'; id: string }>) => void;
    onfollow: () => void;
    onreveal: () => void;
    onaction: (action: ProjectAction) => boolean;
  } = $props();

  const selectedComponent = $derived(
    selection?.kind === 'component'
      ? snapshot.topology.components.find((component) => component.id === selection.id)
      : undefined
  );
  const selectedConnection = $derived(
    selection?.kind === 'connection'
      ? snapshot.topology.connections.find((connection) => connection.id === selection.id)
      : undefined
  );
  const previewLabel = $derived.by(() => {
    if (!preview) return null;
    return (
      snapshot.topology.components.find((component) => component.id === preview.id)?.label ??
      snapshot.topology.connections.find((connection) => connection.id === preview.id)?.label ??
      preview.id
    );
  });
  let positionX = $derived(selectedComponent?.position.x ?? '0');
  let positionY = $derived(selectedComponent?.position.y ?? '0');
  let fluidSystemId = $state('');
  const lineSize = $derived(fluidLineNominalSize(snapshot.evidence, selectedConnection?.id ?? ''));
  const sizeEvidence = $derived(
    snapshot.evidence.find(
      (record) =>
        record.subjectId === selectedConnection?.id && record.label === FLUID_NOMINAL_SIZE_LABEL
    )
  );
  const sizeChoices = $derived(
    [
      ...new Set([
        2,
        3,
        4,
        5,
        6,
        8,
        10,
        12,
        16,
        20,
        24,
        32,
        ...(lineSize.dashSize ? [lineSize.dashSize] : [])
      ])
    ].sort((a, b) => a - b)
  );
  let nominalSize = $derived(lineSize.dashSize === null ? '' : String(lineSize.dashSize));
  let sizeProvenance = $derived(sizeEvidence?.provenance ?? 'Entered by me');
  const connectionMedium = $derived(
    snapshot.fluid.media.find((medium) => medium.id === selectedConnection?.mediumId)
  );
  const connectionEndpoints = $derived(
    selectedConnection
      ? [selectedConnection.sourcePortId, selectedConnection.targetPortId].map((id) => {
          const component = snapshot.topology.components.find((component) =>
            component.ports.some((port) => port.id === id)
          );
          return {
            component: component?.label ?? 'Unknown',
            port: component?.ports.find((port) => port.id === id)?.label ?? 'Unknown'
          };
        })
      : []
  );

  function saveLineSize(): void {
    if (!selectedConnection) return;

    onaction({
      type: 'configure-fluid-line-size',
      causationId: crypto.randomUUID(),
      connectionId: selectedConnection.id,
      evidenceId: sizeEvidence?.id ?? crypto.randomUUID(),
      dashSize: nominalSize ? Number(nominalSize) : null,
      provenance: sizeProvenance
    });
  }
</script>

<aside class="inspector" class:dense-view-open={denseViewOpen} aria-label="Inspector">
  <header>
    <p>Inspector</p>
    <span
      >{selection?.kind === 'connection'
        ? 'Line'
        : selection?.kind === 'component'
          ? 'Part'
          : 'Get started'}</span
    >
  </header>

  {#if mode === 'add'}
    <section class="primitive-library" aria-label="Manufacturer-neutral primitives">
      <p class="subject-kind">Parts</p>
      <h2>Add a part</h2>
      <p class="primitive-boundary">Choose a starting shape, then add your own details.</p>
      <label class="fluid-system-choice">
        <span>Add to system</span>
        <select bind:value={fluidSystemId} disabled={!canAuthor}>
          <option value="">Choose a system</option>
          {#each snapshot.topology.systems.filter((system) => system.domain === 'fluid') as system (system.id)}
            <option value={system.id}>{system.label}</option>
          {/each}
        </select>
      </label>
      <ul>
        {#each PRIMITIVES as primitive (primitive.id)}
          {@const fluidPrimitive = primitive.ports.some((port) => port.domain === 'fluid')}
          <li>
            <button
              type="button"
              disabled={!canAuthor || (fluidPrimitive && !fluidSystemId)}
              onclick={() => onaddprimitive(primitive.id, fluidSystemId || undefined)}
            >
              <strong>Add {primitive.label.toLocaleLowerCase()}</strong>
              <span>{primitive.description}</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if preview && previewLabel}
    <section class="preview-actions" aria-label="Preview actions">
      <div>
        <small>Preview</small>
        <strong>{previewLabel}</strong>
      </div>
      <button type="button" onclick={onfollow}>Follow preview</button>
      <button type="button" onclick={onreveal}>Reveal preview on canvas</button>
    </section>
  {/if}

  {#if selectedComponent}
    <section class="subject-inspector">
      <p class="subject-kind">Part</p>
      <h2>{selectedComponent.label}</h2>
      <p class="part-guide">
        Drag this part to move it. Select a connection point to start a line.
      </p>
      <details class="advanced-details">
        <summary>More details</summary>
        <dl>
          <div>
            <dt>Connection points</dt>
            <dd>{selectedComponent.ports.length}</dd>
          </div>
          <div>
            <dt>Part Definition</dt>
            <dd>{selectedComponent.definitionId ?? 'Project-owned primitive'}</dd>
          </div>
        </dl>
        <fieldset disabled={!canAuthor}>
          <legend>Canvas position</legend>
          <label>
            <span>X</span>
            <input aria-label="Component X position" bind:value={positionX} inputmode="decimal" />
          </label>
          <label>
            <span>Y</span>
            <input aria-label="Component Y position" bind:value={positionY} inputmode="decimal" />
          </label>
          <button type="button" onclick={() => onmove(selectedComponent.id, positionX, positionY)}>
            Apply position
          </button>
        </fieldset>
        <button
          class="delete-subject"
          type="button"
          disabled={!canAuthor}
          onclick={() => ondelete({ kind: 'component', id: selectedComponent.id })}
          >Delete component</button
        >
      </details>
    </section>
  {:else if selectedConnection}
    <section class="subject-inspector">
      <p class="subject-kind">Connection</p>
      <h2>{selectedConnection.label}</h2>
      {#if selectedConnection.domain === 'fluid'}
        <div class="line-summary">
          <strong>{lineSize.label}</strong><span
            >{connectionMedium?.label ?? 'Fluid'} · {selectedConnection.kind === 'fluid-hose'
              ? 'Flexible hose'
              : selectedConnection.kind === 'fluid-tube'
                ? 'Hard line'
                : 'Pipe'}</span
          >
        </div>
        <div class="endpoint-summary" aria-label="Connection endpoints">
          {#each connectionEndpoints as endpoint, index (index)}
            <div>
              <small>{index === 0 ? 'Connects' : 'To'}</small><strong>{endpoint.component}</strong
              ><span>{endpoint.port}</span>
            </div>
          {/each}
        </div>
        <fieldset class="line-size-editor" disabled={!canAuthor}>
          <legend>Line size</legend>
          <label
            ><span>AN size</span><select
              aria-label="Nominal AN size"
              bind:value={nominalSize}
              onchange={saveLineSize}
              ><option value="">Not set</option>{#each sizeChoices as size (size)}<option
                  value={String(size)}>-{size}AN</option
                >{/each}</select
            ></label
          >
          <p>Choose a size to see the line change. You can undo any change.</p>
        </fieldset>
      {/if}
      <details class="advanced-details">
        <summary>More details</summary>
        {#if selectedConnection.domain === 'fluid'}
          <label
            ><span>Where did this size come from?</span><input
              aria-label="Line size provenance"
              bind:value={sizeProvenance}
              onchange={saveLineSize}
            /></label
          >
          <p class="part-guide">
            AN is a nominal fitting size. Actual inside diameter and flow are separate measurements.
          </p>
        {/if}
        <dl>
          <div>
            <dt>Interface</dt>
            <dd>{selectedConnection.interfaceAssessment}</dd>
          </div>
          <div>
            <dt>Route</dt>
            <dd>{selectedConnection.routeId ?? 'Unrouted'}</dd>
          </div>
        </dl>
        <ContextualHelp
          topic={selectedConnection.domain === 'electrical'
            ? 'electrical-connection'
            : 'fluid-connection'}
        />
        <button
          class="delete-subject"
          type="button"
          disabled={!canAuthor}
          onclick={() => ondelete({ kind: 'connection', id: selectedConnection.id })}
          >Delete connection</button
        >
      </details>
    </section>
  {:else}
    <section class="empty-inspector">
      <p class="subject-kind">Your fluid map</p>
      <h2>Follow the circuit</h2>
      <ol>
        <li>Hover a line to trace its two endpoints.</li>
        <li>Click a line to see its size and connected parts.</li>
        <li>Choose a system above to explore one circuit.</li>
        <li>Scroll to zoom. Drag empty space to move around.</li>
      </ol>
    </section>
  {/if}
</aside>

<style>
  .inspector {
    position: absolute;
    z-index: 7;
    top: 0.75rem;
    right: 0.75rem;
    width: min(20rem, calc(100% - 6rem));
    max-height: calc(100% - 1.5rem);
    overflow: auto;
    border: 1px solid #344754;
    border-radius: 0.75rem;
    background: rgb(20 31 41 / 96%);
    color: #d7e7ed;
    box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 24%);
    backdrop-filter: blur(15px);
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding: 0.62rem 0.75rem;
    border-bottom: 1px solid #2c414e;
  }

  header p,
  .subject-kind,
  small,
  header span {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  header p,
  .subject-kind {
    color: #8bc6d3;
  }

  header span,
  small {
    color: #9ab0bd;
  }

  .subject-inspector,
  .empty-inspector,
  .preview-actions,
  .primitive-library {
    padding: 0.85rem;
  }

  .primitive-library {
    border-bottom: 1px solid #344754;
  }

  .primitive-boundary {
    margin: -0.45rem 0 0.75rem;
    color: #9ab0bd;
    font-size: 0.66rem;
    line-height: 1.4;
  }

  .fluid-system-choice {
    display: grid;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
    color: #9ab0bd;
    font: 0.62rem var(--font-mono);
    text-transform: uppercase;
  }

  .fluid-system-choice select {
    min-height: 2.5rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid #9bb3ac;
    border-radius: 0.3rem;
    background: #0f1d28;
    color: #d7e7ed;
  }

  .primitive-library ul {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .primitive-library li button {
    display: grid;
    width: 100%;
    gap: 0.15rem;
    min-height: 2.8rem;
    text-align: left;
  }

  .primitive-library li span {
    color: #b8ceca;
    font-size: 0.58rem;
  }

  .preview-actions {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.42rem;
    align-items: center;
    background: #1c3340;
    border-bottom: 1px solid #344754;
  }

  .preview-actions div {
    display: grid;
  }

  .preview-actions button:last-child {
    grid-column: 1 / -1;
  }

  h2 {
    margin: 0.2rem 0 0.9rem;
    font-family: var(--font-body);
    font-size: 1.2rem;
    font-weight: 600;
  }

  dl {
    display: grid;
    gap: 0.45rem;
    margin: 0;
  }

  dl div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.42rem;
    border-bottom: 1px solid #2c414e;
  }

  dt {
    color: #9ab0bd;
    font-size: 0.65rem;
  }

  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.65rem;
  }

  fieldset {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem;
    margin: 1rem 0 0;
    padding: 0.7rem;
    border: 1px solid #344754;
  }

  legend,
  label span {
    color: #9ab0bd;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    text-transform: uppercase;
  }

  label {
    display: grid;
    gap: 0.2rem;
  }

  input,
  select,
  button {
    min-height: 2.25rem;
    border: 1px solid #3b5261;
    border-radius: 0.3rem;
    font: inherit;
  }

  input,
  select {
    color: #d7e7ed;
    width: 100%;
    padding: 0.35rem 0.45rem;
    background: #0f1d28;
  }

  button {
    padding: 0.35rem 0.55rem;
    background: #284452;
    color: #f6fbf7;
    cursor: pointer;
  }

  fieldset > button {
    grid-column: 1 / -1;
  }

  .delete-subject {
    width: 100%;
    margin-top: 0.8rem;
    border-color: #a94b36;
    background: #2b232a;
    color: #e5a29a;
  }

  .delete-subject:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  button:focus-visible,
  input:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }

  ol {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding-left: 1.2rem;
    color: #9db2c0;
    font-size: 0.72rem;
    line-height: 1.45;
  }

  .advanced-details {
    margin-top: 1rem;
    border-top: 1px solid #344754;
    padding-top: 0.8rem;
  }
  .advanced-details summary {
    color: #a9bdca;
    cursor: pointer;
    font-size: 0.75rem;
    margin-bottom: 0.7rem;
  }
  .part-guide {
    color: #a9bdca;
    font-size: 0.75rem;
    line-height: 1.6;
  }

  .line-summary {
    display: grid;
    gap: 0.3rem;
    margin: 1rem 0;
    padding: 0.8rem;
    border: 1px solid #354d5c;
    border-radius: 0.5rem;
    background: #1b303e;
  }

  .line-summary strong {
    color: #8fd5e4;
    font: 1.4rem var(--font-mono);
  }

  .line-summary span {
    color: #acc3ce;
    font-size: 0.7rem;
  }

  .endpoint-summary {
    display: grid;
    gap: 0.8rem;
    padding-left: 0.8rem;
    border-left: 1px solid #4a697b;
  }

  .endpoint-summary div {
    display: grid;
    gap: 0.2rem;
  }

  .endpoint-summary strong {
    font-size: 0.8rem;
    font-weight: 550;
  }

  .endpoint-summary span {
    color: #a1b7c4;
    font-size: 0.68rem;
  }

  .line-size-editor {
    grid-template-columns: 1fr;
    margin-bottom: 1rem;
    border-radius: 0.5rem;
  }

  .line-size-editor p {
    color: #91a8b7;
    font-size: 0.65rem;
    line-height: 1.6;
    margin: 0.2rem 0;
  }

  @media (max-width: 70rem) {
    .inspector.dense-view-open {
      display: none;
    }
  }

  @media (max-width: 43.75rem) {
    .inspector:not(:has(.subject-inspector)):not(:has(.primitive-library)):not(
        :has(.preview-actions)
      ) {
      display: none;
    }

    .inspector {
      top: auto;
      right: 0.5rem;
      bottom: 4.55rem;
      left: 0.5rem;
      width: auto;
      max-height: 36vh;
    }
  }
</style>
