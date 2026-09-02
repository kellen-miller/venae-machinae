<script lang="ts">
  import type { ProjectSessionView } from '../../session/project-session.svelte';

  let {
    view,
    onretry,
    onemergencyexport
  }: {
    view: ProjectSessionView;
    onretry: () => void;
    onemergencyexport: () => void;
  } = $props();
</script>

<div class="workspace-status" aria-label="Project status">
  <span data-status={view.save.status}>Save <strong>{view.save.status}</strong></span>
  <span data-status={view.evaluation.status}
    >Evaluation <strong>{view.evaluation.status}</strong></span
  >
  <span>Revision <strong>{view.snapshot.revision}</strong></span>
</div>

{#if view.save.status === 'failed'}
  <aside class="save-failed" role="alert">
    <strong>Save failed.</strong>
    <span>
      Unsaved changes remain in memory and are not durable. Resolve storage before closing.
    </span>
    <div>
      <button type="button" onclick={onretry}>Retry save</button>
      <button type="button" onclick={onemergencyexport}>Export unsaved working state</button>
    </div>
  </aside>
{:else if view.evaluation.status === 'stale'}
  <aside class="evaluation-stale" role="status">
    Evaluation is stale; topology remains editable while a matching revision is prepared.
  </aside>
{/if}

<style>
  .workspace-status {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }

  .workspace-status > span {
    display: grid;
    gap: 0.05rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.52rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .workspace-status strong {
    color: var(--color-text);
    font-size: 0.67rem;
  }

  [data-status='failed'] strong,
  [data-status='stale'] strong {
    color: #f4a68b;
  }

  .save-failed,
  .evaluation-stale {
    position: fixed;
    z-index: 20;
    right: 1rem;
    bottom: 1rem;
    display: grid;
    max-width: 28rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid #bd593e;
    border-radius: var(--radius-small);
    background: #422721;
    color: #fff0e9;
    box-shadow: 0 1rem 3rem rgb(0 0 0 / 32%);
  }

  .save-failed div {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .save-failed button {
    min-height: 2rem;
    border: 1px solid currentColor;
    border-radius: var(--radius-small);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .evaluation-stale {
    border-color: #99864e;
    background: #3e3926;
  }

  @media (max-width: 43.75rem) {
    .workspace-status span:not(:last-child) {
      display: none;
    }
  }
</style>
