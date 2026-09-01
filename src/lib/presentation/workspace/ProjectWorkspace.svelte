<script lang="ts">
  import { resolve } from '$app/paths';

  import TopologyRenderer from '$lib/renderer/TopologyRenderer.svelte';
  import { projectSnapshotToRendererProjection } from '$lib/renderer/projection';
  import { setProjectSessionContext } from '$lib/session/project-context';

  import type { RendererIntent } from '$lib/renderer/intent';
  import type { RendererViewport } from '$lib/renderer/projection';
  import type { ProjectSession } from '$lib/session/project-session.svelte';

  const { session }: { session: ProjectSession } = $props();
  setProjectSessionContext(() => session);

  let viewport = $state<RendererViewport>({ x: 0, y: 0, zoom: 1 });
  let interactionStatus = $state('Canvas and dense projection share one Project revision.');
  const projection = $derived(projectSnapshotToRendererProjection(session.view.snapshot));
  const rendererCapability = $derived(
    session.view.capability.mode === 'author' ? ('author' as const) : ('review' as const)
  );

  function handleIntent(intent: RendererIntent): void {
    if (intent.type === 'viewport-changed') {
      viewport = intent.viewport;
      return;
    }

    interactionStatus = `${intent.type} is visible but becomes editable in the topology milestone.`;
  }

  function applyProjectEdit(): void {
    const revision = session.view.snapshot.revision + 1;
    const outcome = session.execute({
      type: 'rename-project',
      causationId: crypto.randomUUID(),
      name: `Vehicle project r${revision}`
    });
    interactionStatus = outcome.accepted
      ? `Project edit accepted at revision ${outcome.revision}.`
      : `Project edit blocked: ${outcome.rejection.code}.`;
  }
</script>

<svelte:head>
  <title>{session.view.snapshot.name} · Venae Machinae</title>
</svelte:head>

<main
  class="project-workspace"
  data-project-revision={session.view.snapshot.revision}
  data-save-status={session.view.save.status}
  data-evaluation-status={session.view.evaluation.status}
>
  <header class="workspace-header">
    <a href={resolve('/')} aria-label="Back to Project Library">← Library</a>
    <div>
      <p>Vehicle Project</p>
      <h1>{session.view.snapshot.name}</h1>
    </div>
    <dl>
      <div>
        <dt>Revision</dt>
        <dd>{session.view.snapshot.revision}</dd>
      </div>
      <div>
        <dt>Save</dt>
        <dd>{session.view.save.status}</dd>
      </div>
      <div>
        <dt>Evaluation</dt>
        <dd>{session.view.evaluation.status}</dd>
      </div>
    </dl>
    <button
      type="button"
      disabled={session.view.capability.mode !== 'author'}
      onclick={applyProjectEdit}>Apply project edit</button
    >
  </header>

  {#if session.view.capability.mode === 'review'}
    <p class="capability-notice" role="status">
      Review mode: {session.view.capability.reason}. Project mutation is blocked at the session.
    </p>
  {/if}

  <section class="projection-grid" aria-label="Synchronized project projections">
    <div class="canvas-projection" data-canvas-revision={projection.revision}>
      <TopologyRenderer
        {projection}
        {viewport}
        capability={rendererCapability}
        onintent={handleIntent}
      />
    </div>

    <aside class="dense-projection" data-dense-revision={session.view.snapshot.revision}>
      <p>Dense projection</p>
      <h2>Project revision {session.view.snapshot.revision}</h2>
      <dl>
        <div>
          <dt>Systems</dt>
          <dd>{session.view.snapshot.topology.systems.length}</dd>
        </div>
        <div>
          <dt>Components</dt>
          <dd>{session.view.snapshot.topology.components.length}</dd>
        </div>
        <div>
          <dt>Connections</dt>
          <dd>{session.view.snapshot.topology.connections.length}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{session.view.snapshot.evidence.length}</dd>
        </div>
      </dl>
      <p class="interaction-status" aria-live="polite">{interactionStatus}</p>
    </aside>
  </section>
</main>

<style>
  .project-workspace {
    min-height: 100vh;
    padding: 0.8rem;
  }

  .workspace-header {
    display: grid;
    grid-template-columns: auto minmax(14rem, 1fr) auto auto;
    gap: 1rem;
    align-items: center;
    min-height: 5.4rem;
    padding: 0.7rem 1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-medium) var(--radius-small) var(--radius-medium) var(--radius-small);
    background: rgb(17 29 31 / 94%);
  }

  .workspace-header > a {
    color: var(--color-accent);
    font-size: 0.75rem;
    text-decoration: none;
    text-transform: uppercase;
  }

  .workspace-header p,
  .dense-projection > p:first-child {
    margin: 0 0 0.2rem;
    color: var(--color-copper);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1,
  h2 {
    margin: 0;
    font-family: var(--font-display);
  }

  h1 {
    font-size: clamp(1.4rem, 3vw, 2.4rem);
    line-height: 1;
  }

  h2 {
    font-size: 1.35rem;
  }

  dl {
    margin: 0;
  }

  .workspace-header dl {
    display: flex;
    gap: 1rem;
  }

  dl div {
    display: grid;
    gap: 0.1rem;
  }

  dt {
    color: var(--color-text-muted);
    font-size: 0.58rem;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }

  button {
    min-height: 2.75rem;
    padding: 0.6rem 0.9rem;
    border: 0;
    border-radius: var(--radius-small);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: 750;
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .capability-notice {
    margin: 0.65rem 0 0;
    padding: 0.7rem 0.9rem;
    color: #ffe7d7;
    background: rgb(126 66 38 / 48%);
    border: 1px solid #a76949;
    border-radius: var(--radius-small);
  }

  .projection-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 18rem;
    gap: 0.7rem;
    min-height: calc(100vh - 7rem);
    padding-top: 0.7rem;
  }

  .canvas-projection {
    min-width: 0;
  }

  .dense-projection {
    padding: 1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-small) var(--radius-medium) var(--radius-small) var(--radius-medium);
    background: linear-gradient(160deg, rgb(26 43 45 / 96%), rgb(13 23 24 / 96%));
  }

  .dense-projection dl {
    display: grid;
    gap: 0.7rem;
    margin-top: 1.4rem;
  }

  .dense-projection dl div {
    grid-template-columns: 1fr auto;
    padding-bottom: 0.55rem;
    border-bottom: 1px solid var(--color-line);
  }

  .interaction-status {
    margin: 1.4rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.74rem;
    line-height: 1.5;
  }

  @media (max-width: 70rem) {
    .workspace-header {
      grid-template-columns: auto 1fr auto;
    }

    .workspace-header dl {
      display: none;
    }

    .projection-grid {
      grid-template-columns: 1fr;
    }

    .dense-projection {
      order: -1;
    }
  }

  @media (max-width: 43.75rem) {
    .project-workspace {
      padding: 0;
    }

    .workspace-header {
      grid-template-columns: auto 1fr;
      border-radius: 0;
    }

    .workspace-header button {
      grid-column: 1 / -1;
    }

    .projection-grid {
      padding: 0.5rem;
    }
  }
</style>
