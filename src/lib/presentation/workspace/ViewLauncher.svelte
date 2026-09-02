<script lang="ts">
  import { WORKSPACE_VIEWS } from './workspace-presentation.svelte';

  import type { WorkspaceView } from './workspace-presentation.svelte';

  let {
    activeView,
    onopen
  }: {
    activeView: WorkspaceView;
    onopen: (view: WorkspaceView) => void;
  } = $props();
</script>

<nav class="view-launcher" aria-label="View Launcher">
  {#each WORKSPACE_VIEWS as view, index (view.id)}
    <button
      type="button"
      aria-label={`${view.label} view`}
      aria-pressed={activeView === view.id}
      title={view.label}
      onclick={() => onopen(view.id)}
    >
      <span class="view-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
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
    border-radius: 0.8rem 0.25rem 0.8rem 0.25rem;
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
    border-radius: 0.45rem 0.15rem 0.45rem 0.15rem;
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

  .view-index {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 750;
    letter-spacing: 0.08em;
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
