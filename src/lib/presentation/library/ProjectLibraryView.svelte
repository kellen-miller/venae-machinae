<script module lang="ts">
  export type ProjectLibraryState = 'loading' | 'ready' | 'creating' | 'duplicating' | 'failed';

  export type ProjectListing = Readonly<{
    id: string;
    name: string;
    revision: number;
    createdAt: string;
  }>;
</script>

<script lang="ts">
  import { resolve } from '$app/paths';

  let {
    state,
    projects,
    failure,
    onblank,
    onduplicate
  }: {
    state: ProjectLibraryState;
    projects: readonly ProjectListing[];
    failure: string | null;
    onblank: () => void;
    onduplicate: (project: ProjectListing) => void;
  } = $props();

  const ready = $derived(state === 'ready');
</script>

<main class="library-shell" data-shell-state={state} data-library-state={state}>
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
    </div>

    <aside class="boundary-card" aria-labelledby="boundary-heading">
      <p class="eyebrow">Authority boundary</p>
      <h2 id="boundary-heading">One origin. No project endpoint.</h2>
      <dl>
        <div>
          <dt>Project authority</dt>
          <dd>Browser profile</dd>
        </div>
        <div>
          <dt>Delivery origin</dt>
          <dd>localhost:4173</dd>
        </div>
        <div>
          <dt>Server project data</dt>
          <dd>None</dd>
        </div>
      </dl>
    </aside>
  </section>

  {#if failure}
    <section class="library-error" role="alert">
      <p class="eyebrow">Project Library unavailable</p>
      <h2>Your browser-local work was not changed.</h2>
      <p>{failure}</p>
    </section>
  {/if}

  <section class="creation-actions" aria-labelledby="creation-heading">
    <div>
      <p class="eyebrow">Start or copy</p>
      <h2 id="creation-heading">Open directly into the canvas</h2>
    </div>
    <div class="creation-grid">
      <button
        type="button"
        aria-label={state === 'creating' ? 'Creating project' : 'Blank project'}
        disabled={!ready}
        onclick={onblank}
      >
        <strong>{state === 'creating' ? 'Creating…' : 'Blank project'}</strong>
        <span>One empty immutable snapshot</span>
      </button>
      {#if projects.length === 0}
        <button type="button" disabled aria-describedby="duplicate-explanation">
          <strong>Duplicate project</strong>
          <span id="duplicate-explanation">Available after a Project exists</span>
        </button>
      {/if}
      <button type="button" disabled aria-describedby="import-explanation">
        <strong>Import .venae.json</strong>
        <span id="import-explanation"
          >Import becomes available after local validation and staging are ready.</span
        >
      </button>
      <button type="button" disabled aria-describedby="example-explanation">
        <strong>Copy illustrative example</strong>
        <span id="example-explanation"
          >Available when the verified example fixture is complete.</span
        >
      </button>
    </div>
  </section>

  {#if state === 'loading'}
    <section class="library-loading" aria-busy="true" aria-label="Opening Project Library">
      <div class="skeleton-title"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row short"></div>
      <p>Opening the browser Project Library…</p>
    </section>
  {:else if state !== 'failed' && projects.length === 0}
    <section class="empty-library" aria-labelledby="empty-heading">
      <div class="empty-icon" aria-hidden="true"><span></span><span></span><span></span></div>
      <div>
        <p class="eyebrow">Empty library</p>
        <h2 id="empty-heading">No browser-local projects yet</h2>
        <ol aria-label="Start a vehicle project">
          <li>Name the Vehicle Project.</li>
          <li>Create one domain-homogeneous System.</li>
          <li>Add project-owned Components with explicit Ports.</li>
          <li>Record unknowns and evidence as they become known.</li>
        </ol>
      </div>
    </section>
  {:else if projects.length > 0}
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
            <button
              type="button"
              aria-label={`Duplicate ${project.name}`}
              disabled={!ready}
              onclick={() => onduplicate(project)}
            >
              Duplicate
            </button>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</main>

<style>
  .creation-actions,
  .library-loading,
  .library-error,
  .project-library {
    margin-bottom: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-medium);
    background: rgb(17 29 31 / 84%);
  }

  .creation-actions,
  .project-library {
    display: grid;
    grid-template-columns: minmax(12rem, 0.32fr) minmax(0, 1fr);
    gap: 1.5rem;
  }

  .creation-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .creation-grid button {
    display: grid;
    gap: 0.2rem;
    min-height: 4.5rem;
    padding: 0.7rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-small);
    background: var(--color-surface-raised);
    color: var(--color-text);
    text-align: left;
    cursor: pointer;
  }

  .creation-grid button:first-child {
    border-color: var(--color-accent);
  }

  .creation-grid button:disabled {
    cursor: not-allowed;
    opacity: 0.52;
  }

  .creation-grid span,
  .project-library span {
    color: var(--color-text-muted);
    font: 0.65rem var(--font-mono);
  }

  .library-error {
    border-color: #c56e55;
    background: rgb(81 38 31 / 62%);
  }

  .library-error p:last-child {
    margin-bottom: 0;
    color: #ffd5c8;
  }

  .library-loading {
    display: grid;
    gap: 0.65rem;
  }

  .library-loading p {
    margin: 0;
    color: var(--color-text-muted);
    font: 0.7rem var(--font-mono);
  }

  .skeleton-title,
  .skeleton-row {
    height: 1rem;
    border-radius: 999px;
    background: var(--color-line);
  }

  .skeleton-title {
    width: 14rem;
    height: 1.8rem;
  }

  .skeleton-row.short {
    width: 62%;
  }

  .empty-library ol {
    display: grid;
    gap: 0.35rem;
    margin: 0.75rem 0 0;
    padding-left: 1.2rem;
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .project-library > ol {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .project-library li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem;
  }

  .project-library a,
  .project-library button {
    min-height: 3.5rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-small);
    background: transparent;
    color: var(--color-text);
  }

  .project-library a {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem;
    text-decoration: none;
  }

  .project-library button {
    padding-inline: 0.8rem;
    cursor: pointer;
  }

  .project-library button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  @media (max-width: 52rem) {
    .creation-actions,
    .project-library {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 38rem) {
    .creation-grid {
      grid-template-columns: 1fr;
    }

    .project-library li {
      grid-template-columns: 1fr;
    }
  }
</style>
