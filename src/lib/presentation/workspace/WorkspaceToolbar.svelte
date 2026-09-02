<script lang="ts">
  import type { ProjectSnapshot } from '../../project/project';
  import type { OverlayChannel } from '../../operating-state/operating-state';
  import type { WorkspaceMode } from './workspace-presentation.svelte';

  const modes: readonly Readonly<{ id: WorkspaceMode; label: string; shortcut: string }>[] = [
    { id: 'select', label: 'Select', shortcut: 'V' },
    { id: 'pan', label: 'Pan', shortcut: 'H' },
    { id: 'add', label: 'Add', shortcut: 'A' },
    { id: 'connect', label: 'Connect', shortcut: 'C' },
    { id: 'route', label: 'Route', shortcut: 'R' }
  ];
  const overlayChannelControls: readonly Readonly<{
    id: OverlayChannel;
    label: string;
  }>[] = [
    { id: 'potential', label: 'Electrical potential' },
    { id: 'current', label: 'Electrical current' },
    { id: 'signal', label: 'Signal direction' },
    { id: 'fluid-direction', label: 'Fluid direction' },
    { id: 'temperature', label: 'Temperature' },
    { id: 'finding', label: 'Findings' },
    { id: 'selection', label: 'Selection' }
  ];

  let {
    snapshot,
    mode,
    domainFilter,
    systemFilterId,
    operatingStateId,
    overlayChannels,
    motionPaused,
    canUndo,
    canRedo,
    canAuthor,
    onmode,
    ondomainfilter,
    onsystemfilter,
    onstate,
    onchannel,
    onmotion,
    onundo,
    onredo,
    onsearch,
    oncommand
  }: {
    snapshot: ProjectSnapshot;
    mode: WorkspaceMode;
    domainFilter: 'all' | 'electrical' | 'fluid';
    systemFilterId: string | null;
    operatingStateId: string | null;
    overlayChannels: readonly OverlayChannel[];
    motionPaused: boolean;
    canUndo: boolean;
    canRedo: boolean;
    canAuthor: boolean;
    onmode: (mode: WorkspaceMode) => void;
    ondomainfilter: (domain: 'all' | 'electrical' | 'fluid') => void;
    onsystemfilter: (systemId: string | null) => void;
    onstate: (stateId: string | null) => void;
    onchannel: (channel: OverlayChannel, enabled: boolean) => void;
    onmotion: (paused: boolean) => void;
    onundo: () => void;
    onredo: () => void;
    onsearch: () => void;
    oncommand: () => void;
  } = $props();
</script>

<div class="workspace-toolbar">
  <div class="mode-group" role="toolbar" aria-label="Workspace modes">
    {#each modes as candidate (candidate.id)}
      <button
        type="button"
        aria-label={`${candidate.label} mode`}
        aria-pressed={mode === candidate.id}
        disabled={!canAuthor && candidate.id !== 'select' && candidate.id !== 'pan'}
        onclick={() => onmode(candidate.id)}
      >
        <span>{candidate.label}</span>
        <kbd>{candidate.shortcut}</kbd>
      </button>
    {/each}
  </div>

  <div class="projection-filters" aria-label="Projection filters">
    <label>
      <span>Domain</span>
      <select
        aria-label="Domain filter"
        value={domainFilter}
        onchange={(event) =>
          ondomainfilter(event.currentTarget.value as 'all' | 'electrical' | 'fluid')}
      >
        <option value="all">All domains</option>
        <option value="electrical">Electrical</option>
        <option value="fluid">Fluid</option>
      </select>
    </label>

    <label>
      <span>System</span>
      <select
        aria-label="System filter"
        value={systemFilterId ?? ''}
        onchange={(event) => onsystemfilter(event.currentTarget.value || null)}
      >
        <option value="">All systems</option>
        {#each snapshot.topology.systems as system (system.id)}
          <option value={system.id}>{system.label}</option>
        {/each}
      </select>
    </label>

    <label>
      <span>State</span>
      <select
        aria-label="Operating State"
        value={operatingStateId ?? ''}
        onchange={(event) => onstate(event.currentTarget.value || null)}
      >
        <option value="">No state selected</option>
        {#each snapshot.operatingStates as state (state.id)}
          <option value={state.id}>{state.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <details class="overlay-controls">
    <summary>Overlay channels</summary>
    <fieldset>
      <legend>Independent derived channels</legend>
      {#each overlayChannelControls as channel (channel.id)}
        <label>
          <input
            type="checkbox"
            aria-label={`${channel.label} Overlay Channel`}
            checked={overlayChannels.includes(channel.id)}
            onchange={(event) => onchannel(channel.id, event.currentTarget.checked)}
          />
          <span>{channel.label}</span>
        </label>
      {/each}
      <label>
        <input
          type="checkbox"
          aria-label="Pause direction motion"
          checked={motionPaused}
          onchange={(event) => onmotion(event.currentTarget.checked)}
        />
        <span>Pause direction motion</span>
      </label>
    </fieldset>
  </details>

  <div class="utility-actions">
    <button type="button" disabled={!canUndo} onclick={onundo} aria-label="Undo last Project action"
      >↶</button
    >
    <button type="button" disabled={!canRedo} onclick={onredo} aria-label="Redo Project action"
      >↷</button
    >
    <button type="button" onclick={onsearch} aria-label="Search project subjects">
      Search <kbd>/</kbd>
    </button>
    <button type="button" onclick={oncommand} aria-label="Open command palette">
      Commands <kbd>⌘K</kbd>
    </button>
  </div>
</div>

<style>
  .workspace-toolbar {
    display: grid;
    grid-template-columns: auto minmax(24rem, 1fr) auto auto;
    gap: 0.8rem;
    align-items: center;
    min-height: 3.2rem;
    padding: 0.38rem 0.55rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-small);
    background: rgb(15 28 29 / 96%);
  }

  .mode-group,
  .utility-actions,
  .projection-filters {
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }

  .overlay-controls {
    position: relative;
    color: var(--color-text);
    font: 0.68rem var(--font-mono);
  }

  .overlay-controls summary {
    min-height: 2.25rem;
    padding: 0.55rem 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: 0.35rem;
    background: rgb(27 45 46 / 88%);
    cursor: pointer;
  }

  .overlay-controls fieldset {
    position: absolute;
    z-index: 20;
    right: 0;
    display: grid;
    min-width: 16rem;
    margin: 0.25rem 0 0;
    padding: 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: 0.35rem;
    background: #102526;
    box-shadow: var(--shadow-panel);
  }

  .overlay-controls label {
    grid-template-columns: auto 1fr;
    min-height: 1.8rem;
  }

  .overlay-controls legend {
    color: var(--color-text-muted);
  }

  button,
  select {
    min-height: 2.25rem;
    border: 1px solid var(--color-line);
    border-radius: 0.35rem;
    background: rgb(27 45 46 / 88%);
    color: var(--color-text);
    font: inherit;
  }

  button {
    display: inline-flex;
    gap: 0.45rem;
    align-items: center;
    padding: 0.38rem 0.58rem;
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    border-color: var(--color-accent);
    background: rgb(78 177 162 / 19%);
    color: #d9fff8;
    box-shadow: inset 0 -2px 0 var(--color-accent);
  }

  button:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  kbd {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.58rem;
  }

  .projection-filters {
    justify-content: center;
  }

  label {
    display: grid;
    grid-template-columns: auto minmax(7rem, 1fr);
    align-items: center;
    gap: 0.35rem;
  }

  label > span {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  select {
    padding: 0.3rem 1.7rem 0.3rem 0.5rem;
    font-size: 0.7rem;
  }

  @media (max-width: 70rem) {
    .workspace-toolbar {
      grid-template-columns: 1fr auto;
    }

    .projection-filters {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-content: start;
      overflow-x: auto;
    }

    .overlay-controls {
      grid-column: 2;
      grid-row: 1;
    }
  }

  @media (max-width: 43.75rem) {
    .workspace-toolbar {
      display: flex;
      overflow-x: auto;
      border-radius: 0;
    }

    .projection-filters {
      display: none;
    }

    .overlay-controls fieldset {
      position: fixed;
      top: 7rem;
      right: 0.5rem;
    }

    .mode-group button span,
    .utility-actions button:not(:last-child) {
      display: none;
    }
  }
</style>
