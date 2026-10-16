<script lang="ts">
  import { WORKSPACE_VIEWS } from './workspace-presentation.svelte';

  import type { WorkspaceView } from './workspace-presentation.svelte';

  const viewSymbols: Record<WorkspaceView, string> = {
    canvas: 'M3 3h18v18H3zM7 8h4v4H7zm7 5h4v4h-4zM11 10h5v3',
    systems: 'M3 3h7v7H3zm11 11h7v7h-7zM6 10v8h8M10 6h8v8',
    'circuits-lines': 'M3 6h6v5h6v7h6M3 18h6v-4M15 6h6',
    interfaces: 'M4 7h6v10H4zm10 0h6v10h-6zM10 10h4m-4 4h4',
    routes: 'M4 4h6v6h10v10M4 20V10h6',
    'harnesses-bundles': 'M3 6h7q4 0 4 6t7 6M3 12h6q4 0 4 3t8 6M3 3h9q5 0 5 6t4 6',
    calculations: 'M5 3h14v18H5zM8 7h8M8 11h2m4 0h2m-8 4h2m4 0h2m-8 3h2m4 0h2',
    evidence: 'M5 3h10l4 4v14H5zM14 3v5h5M8 12h8m-8 4h6',
    bom: 'M4 5h16v16H4zM8 3v4m8-4v4M8 11h8m-8 4h8',
    findings: 'M12 3l10 18H2zM12 9v5m0 3v1',
    'state-compare': 'M3 4h7v16H3zm11 0h7v16h-7zM6 8v8m11-8v8'
  };

  let {
    activeView,
    onopen
  }: {
    activeView: WorkspaceView;
    onopen: (view: WorkspaceView) => void;
  } = $props();
</script>

<nav class="view-launcher" aria-label="View Launcher">
  {#each WORKSPACE_VIEWS as view (view.id)}
    <button
      type="button"
      aria-label={`${view.label} view`}
      aria-pressed={activeView === view.id}
      title={view.label}
      onclick={() => onopen(view.id)}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"
        ><path d={viewSymbols[view.id]} /></svg
      >
      <span class="view-label">{view.label}</span>
    </button>
  {/each}
</nav>

<style>
  .view-launcher {
    position: absolute;
    z-index: 8;
    top: 6.9rem;
    left: 1.15rem;
    display: grid;
    width: 3.25rem;
    gap: 0.25rem;
    padding: 0.35rem;
    border: 1px solid rgb(109 140 135 / 65%);
    border-radius: 0.75rem;
    background: rgb(12 23 24 / 92%);
    box-shadow: 0 1.1rem 2.8rem rgb(0 0 0 / 28%);
    backdrop-filter: blur(16px);
  }

  button {
    position: relative;
    display: grid;
    place-items: center;
    width: 2.55rem;
    height: 2.35rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 0.4rem;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    border-color: var(--color-line-strong);
    color: var(--color-text);
    outline: none;
  }

  button[aria-pressed='true'] {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }

  svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .view-label {
    position: absolute;
    left: calc(100% + 0.7rem);
    width: max-content;
    padding: 0.35rem 0.55rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-small);
    background: #132426;
    color: var(--color-text);
    font-size: 0.68rem;
    opacity: 0;
    pointer-events: none;
    transform: translateX(-0.25rem);
    transition:
      opacity 120ms ease,
      transform 120ms ease;
  }

  button:hover .view-label,
  button:focus-visible .view-label {
    opacity: 1;
    transform: translateX(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .view-label {
      transition: none;
    }
  }

  @media (max-width: 43.75rem) {
    .view-launcher {
      position: fixed;
      top: auto;
      right: 0.5rem;
      bottom: 0.5rem;
      left: 0.5rem;
      grid-auto-flow: column;
      grid-template-columns: repeat(11, minmax(2.4rem, 1fr));
      width: auto;
      overflow-x: auto;
    }

    button {
      width: 100%;
    }

    .view-label {
      display: none;
    }
  }
</style>
