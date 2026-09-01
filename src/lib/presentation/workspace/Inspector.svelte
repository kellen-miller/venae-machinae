<script lang="ts">
  import { PRIMITIVES } from '../../reference/primitives';

  import type { ProjectSnapshot } from '../../project/project';
  import type { WorkspaceMode, WorkspaceSubject } from './workspace-presentation.svelte';

  let {
    snapshot,
    selection,
    preview,
    mode,
    canAuthor,
    onmove,
    onaddprimitive,
    onfollow,
    onreveal
  }: {
    snapshot: ProjectSnapshot;
    selection: WorkspaceSubject | null;
    preview: WorkspaceSubject | null;
    mode: WorkspaceMode;
    canAuthor: boolean;
    onmove: (componentId: string, x: string, y: string) => void;
    onaddprimitive: (primitiveId: string, fluidSystemId?: string) => void;
    onfollow: () => void;
    onreveal: () => void;
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
</script>

<aside class="inspector" aria-label="Inspector">
  <header>
    <p>Inspector</p>
    <span>{selection?.kind ?? 'No selection'}</span>
  </header>

  {#if mode === 'add'}
    <section class="primitive-library" aria-label="Manufacturer-neutral primitives">
      <p class="subject-kind">Immutable primitive library</p>
      <h2>Add project-owned topology</h2>
      <p class="primitive-boundary">
        Primitives supply identity shape only. They add no manufacturer data, ratings, or evidence.
      </p>
      <label class="fluid-system-choice">
        <span>Fluid System for new fluid primitive</span>
        <select bind:value={fluidSystemId} disabled={!canAuthor}>
          <option value="">Choose Fluid System</option>
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
      <p class="subject-kind">{selectedComponent.kind} · {selectedComponent.id}</p>
      <h2>{selectedComponent.label}</h2>
      <dl>
        <div>
          <dt>Ports</dt>
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
    </section>
  {:else if selectedConnection}
    <section class="subject-inspector">
      <p class="subject-kind">{selectedConnection.kind} · {selectedConnection.id}</p>
      <h2>{selectedConnection.label}</h2>
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
    </section>
  {:else}
    <section class="empty-inspector">
      <p class="subject-kind">Workspace guide</p>
      <h2>Select explicit topology</h2>
      <ol>
        <li>Create a System for one engineering domain.</li>
        <li>Add Components with explicit typed Ports.</li>
        <li>Connect only compatible Ports.</li>
        <li>Route physical Connections independently.</li>
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
    border: 1px solid rgb(27 61 61 / 30%);
    border-radius: 0.85rem 0.3rem 0.85rem 0.3rem;
    background: rgb(247 249 245 / 94%);
    color: #233e40;
    box-shadow: 0 1.5rem 4rem rgb(24 47 47 / 20%);
    backdrop-filter: blur(15px);
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding: 0.62rem 0.75rem;
    border-bottom: 1px solid #ccd9d5;
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
    color: #9b4e2c;
  }

  header span,
  small {
    color: #687b7b;
  }

  .subject-inspector,
  .empty-inspector,
  .preview-actions,
  .primitive-library {
    padding: 0.85rem;
  }

  .primitive-library {
    border-bottom: 1px solid #cbd8d3;
  }

  .primitive-boundary {
    margin: -0.45rem 0 0.75rem;
    color: #5d716f;
    font-size: 0.66rem;
    line-height: 1.4;
  }

  .fluid-system-choice {
    display: grid;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
    color: #5d716f;
    font: 0.62rem var(--font-mono);
    text-transform: uppercase;
  }

  .fluid-system-choice select {
    min-height: 2.5rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid #9bb3ac;
    border-radius: 0.3rem;
    background: #fff;
    color: #203e40;
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
    background: #e2f1ec;
    border-bottom: 1px solid #b9d3ca;
  }

  .preview-actions div {
    display: grid;
  }

  .preview-actions button:last-child {
    grid-column: 1 / -1;
  }

  h2 {
    margin: 0.2rem 0 0.9rem;
    font-family: var(--font-display);
    font-size: 1.45rem;
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
    border-bottom: 1px solid #dde5e1;
  }

  dt {
    color: #687b7b;
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
    border: 1px solid #cbd8d3;
  }

  legend,
  label span {
    color: #596e6d;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    text-transform: uppercase;
  }

  label {
    display: grid;
    gap: 0.2rem;
  }

  input,
  button {
    min-height: 2.25rem;
    border: 1px solid #9fb4ae;
    border-radius: 0.3rem;
    font: inherit;
  }

  input {
    width: 100%;
    padding: 0.35rem 0.45rem;
    background: #fffefb;
  }

  button {
    padding: 0.35rem 0.55rem;
    background: #173f41;
    color: #f6fbf7;
    cursor: pointer;
  }

  fieldset > button {
    grid-column: 1 / -1;
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
    color: #526665;
    font-size: 0.72rem;
    line-height: 1.45;
  }

  @media (max-width: 43.75rem) {
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
