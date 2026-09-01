<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';

  import { createBrowserApplication } from '$lib/composition/create-browser-application';

  import type { BrowserApplication } from '$lib/composition/create-browser-application';

  const baselineCapabilities = [
    ['Project authority', 'Browser profile'],
    ['Delivery origin', 'localhost:4173'],
    ['Server project data', 'None']
  ] as const;

  type ProjectListing = Awaited<ReturnType<BrowserApplication['listProjects']>>[number];

  let application = $state<BrowserApplication | null>(null);
  let projects = $state<readonly ProjectListing[]>([]);
  let libraryState = $state<'loading' | 'ready' | 'creating' | 'failed'>('loading');
  let failure = $state<string | null>(null);

  onMount(() => {
    let canceled = false;
    void (async () => {
      try {
        const openedApplication = await createBrowserApplication();
        if (canceled) {
          await openedApplication.close();
          return;
        }

        application = openedApplication;
        projects = await openedApplication.listProjects();
        libraryState = 'ready';
      } catch (error) {
        failure = error instanceof Error ? error.message : 'The browser Project Library failed.';
        libraryState = 'failed';
      }
    })();

    return () => {
      canceled = true;
      if (application) void application.close();
    };
  });

  async function createBlankProject(): Promise<void> {
    if (!application || libraryState !== 'ready') return;

    libraryState = 'creating';
    failure = null;
    const outcome = await application.createBlankProject({
      id: crypto.randomUUID(),
      name: `Vehicle project ${projects.length + 1}`,
      createdAt: new Date().toISOString()
    });
    if (!outcome.created) {
      failure = `Project creation failed: ${outcome.reason}.`;
      libraryState = 'failed';
      return;
    }

    await application.close();
    await goto(resolve('/projects/[projectId]', { projectId: outcome.snapshot.id }));
  }
</script>

<svelte:head>
  <title>Project Library · Venae Machinae</title>
</svelte:head>

<main class="library-shell" data-shell-state={libraryState}>
  <header class="masthead">
    <a class="wordmark" href={resolve('/')} aria-label="Venae Machinae Project Library">
      <span class="wordmark-mark" aria-hidden="true">VM</span>
      <span>
        <strong>Venae Machinae</strong>
        <small>Vehicle systems workspace</small>
      </span>
    </a>

    <span class="local-badge"><span aria-hidden="true"></span> Local application</span>
  </header>

  <section class="hero" aria-labelledby="library-heading">
    <div class="hero-copy">
      <p class="eyebrow">Project Library</p>
      <h1 id="library-heading">Your vehicle systems work stays in this browser.</h1>
      <p class="hero-summary">
        The local SvelteKit server delivers the application. Project content, engineering evidence,
        and calculations remain browser-local.
      </p>

      <div class="hero-actions">
        <button
          type="button"
          disabled={libraryState !== 'ready'}
          aria-describedby="library-action-status"
          onclick={createBlankProject}
        >
          {libraryState === 'creating' ? 'Creating…' : 'Blank project'}
        </button>
        <p id="library-action-status" aria-live="polite">
          {#if failure}
            {failure}
          {:else if libraryState === 'loading'}
            Opening the browser Project Library…
          {:else}
            Project creation writes one whole snapshot to this browser profile.
          {/if}
        </p>
      </div>
    </div>

    <aside class="boundary-card" aria-labelledby="boundary-heading">
      <p class="eyebrow">Authority boundary</p>
      <h2 id="boundary-heading">One origin. No project endpoint.</h2>
      <dl>
        {#each baselineCapabilities as [term, description] (term)}
          <div>
            <dt>{term}</dt>
            <dd>{description}</dd>
          </div>
        {/each}
      </dl>
    </aside>
  </section>

  {#if projects.length === 0}
    <section class="empty-library" aria-labelledby="empty-heading">
      <div class="empty-icon" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div>
        <p class="eyebrow">Empty library</p>
        <h2 id="empty-heading">No browser-local projects yet</h2>
        <p>Create a blank Project to open the shared canvas and dense projection.</p>
      </div>
    </section>
  {:else}
    <section class="project-library" aria-labelledby="projects-heading">
      <div>
        <p class="eyebrow">Browser-local projects</p>
        <h2 id="projects-heading">Continue authoring</h2>
      </div>
      <ol>
        {#each projects as project (project.id)}
          <li>
            <a href={resolve('/projects/[projectId]', { projectId: project.id })}>
              <strong>{project.name}</strong>
              <span>Revision {project.revision}</span>
            </a>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</main>

<style>
  .project-library {
    display: grid;
    grid-template-columns: minmax(12rem, 0.35fr) minmax(0, 1fr);
    gap: 2rem;
    padding: 1.5rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-medium);
    background: rgb(17 29 31 / 76%);
  }

  .project-library ol {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .project-library a {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    min-height: 3.4rem;
    padding: 0.8rem 1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-small);
    color: var(--color-text);
    text-decoration: none;
  }

  .project-library a:hover {
    border-color: var(--color-accent);
  }

  .project-library strong {
    font-family: var(--font-display);
  }

  .project-library span {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }

  @media (max-width: 52rem) {
    .project-library {
      grid-template-columns: 1fr;
    }
  }
</style>
