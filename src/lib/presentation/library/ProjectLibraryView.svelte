<script module lang="ts">
  export type ProjectLibraryState =
    'loading' | 'ready' | 'creating' | 'copying-example' | 'duplicating' | 'failed';

  export type ProjectListing = Readonly<{
    id: string;
    name: string;
    revision: number;
    createdAt: string;
  }>;
</script>

<script lang="ts">
  import { resolve } from '$app/paths';

  import type {
    LibraryOverview,
    StagedLibraryImport
  } from '../../composition/create-browser-application';

  let {
    state,
    projects,
    failure,
    operationFailure,
    operationStatus,
    overview,
    stagedImport,
    onblank,
    onexample,
    onduplicate,
    onnamedsnapshot,
    onrestoresnapshot,
    ontrash,
    onrestoretrash,
    onexportproject,
    onexporttemplates,
    onbackup,
    ondiagnostics,
    onexportquarantine,
    onstageimport,
    oncommitimport
  }: {
    state: ProjectLibraryState;
    projects: readonly ProjectListing[];
    failure: string | null;
    operationFailure: string | null;
    operationStatus: string | null;
    overview: LibraryOverview | null;
    stagedImport: StagedLibraryImport | null;
    onblank: () => void;
    onexample: () => void;
    onduplicate: (project: ProjectListing) => void;
    onnamedsnapshot: (project: ProjectListing) => void;
    onrestoresnapshot: (snapshotId: string) => void;
    ontrash: (project: ProjectListing) => void;
    onrestoretrash: (trashId: string) => void;
    onexportproject: (project: ProjectListing) => void;
    onexporttemplates: () => void;
    onbackup: () => void;
    ondiagnostics: () => void;
    onexportquarantine: (quarantineId: string) => void;
    onstageimport: (file: File) => void;
    oncommitimport: (decision: 'replace' | 'import-copy' | 'cancel') => void;
  } = $props();

  const ready = $derived(state === 'ready');
  let importInput: HTMLInputElement | null = null;

  function selectImport(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onstageimport(file);
    input.value = '';
  }
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
      <p class="boundary-note">
        Loopback-only delivery. Cross-device and plain-HTTP LAN editing are unsupported; each future
        secure origin would own an independent browser library with no implicit sync.
      </p>
    </aside>
  </section>

  {#if overview}
    <section class="library-health" aria-labelledby="health-heading">
      <div data-storage-status={overview.storage.persistence}>
        <p class="eyebrow">Browser storage</p>
        <h2 id="health-heading">{overview.storage.persistence} storage</h2>
        <p>{overview.storage.message}</p>
        {#if overview.storage.usage !== null && overview.storage.quota !== null}
          <small
            >Browser-reported usage {overview.storage.usage.toLocaleString()} of
            {overview.storage.quota.toLocaleString()} bytes.</small
          >
        {/if}
      </div>
      <div>
        <p class="eyebrow">Device-loss boundary</p>
        <h2>
          Last Library Backup:
          {overview.backupHealth.lastLibraryBackupAt ? 'just now' : 'never'}
        </h2>
        <p>Autosave does not protect against profile or device loss. Download a Library Backup.</p>
        {#if overview.backupHealth.reminders.length > 0}
          <small>Reminder: {overview.backupHealth.reminders.join(', ')}.</small>
        {/if}
      </div>
      <div class="library-health-actions">
        <button type="button" disabled={!ready} onclick={onbackup}>Download Library Backup</button>
        <button type="button" disabled={!ready} onclick={ondiagnostics}
          >Download redacted diagnostics</button
        >
      </div>
    </section>
  {/if}

  {#if failure}
    <section class="library-error" role="alert">
      <p class="eyebrow">Project Library unavailable</p>
      <h2>Your browser-local work was not changed.</h2>
      <p>{failure}</p>
    </section>
  {/if}

  {#if operationFailure}
    <section class="library-error" role="alert">
      <p class="eyebrow">Operation blocked</p>
      <p>{operationFailure}</p>
    </section>
  {:else if operationStatus}
    <p class="operation-status" role="status">{operationStatus}</p>
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
      <button type="button" disabled={!ready} onclick={() => importInput?.click()}>
        <strong>Import .venae.json</strong>
        <span>Strictly validate and stage before confirmation</span>
      </button>
      <input
        class="visually-hidden"
        bind:this={importInput}
        type="file"
        accept=".json,.venae.json,.venae-templates.json,.venae-backup.json"
        aria-label="Import exchange file"
        onchange={selectImport}
      />
      <button
        type="button"
        disabled={!ready}
        aria-describedby="example-explanation"
        onclick={onexample}
      >
        <strong
          >{state === 'copying-example'
            ? 'Copying illustrative example…'
            : 'Copy illustrative example'}</strong
        >
        <span id="example-explanation"
          >Illustrative assumptions and unknowns remain explicit. This is not a safety endorsement
          or recommended vehicle design.</span
        >
      </button>
    </div>
  </section>

  {#if stagedImport}
    <section class="staged-import" aria-labelledby="staged-import-heading">
      <div>
        <p class="eyebrow">Validated staging area</p>
        <h2 id="staged-import-heading">
          {stagedImport.format === 'venae-project'
            ? 'Staged project import'
            : stagedImport.format === 'venae-templates'
              ? 'Staged template import'
              : 'Staged Library Backup restore'}
        </h2>
        <p>No library changes until you confirm.</p>
      </div>
      <dl>
        <div>
          <dt>Format</dt>
          <dd>{stagedImport.summary.format}</dd>
        </div>
        <div>
          <dt>Assets</dt>
          <dd>{stagedImport.summary.assetCount}</dd>
        </div>
        {#if stagedImport.format === 'venae-project'}
          <div>
            <dt>Project identity</dt>
            <dd>{stagedImport.summary.projectId}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{stagedImport.summary.projectRevision}</dd>
          </div>
        {:else if stagedImport.format === 'venae-templates'}
          <div>
            <dt>Templates</dt>
            <dd>{stagedImport.summary.templateCount}</dd>
          </div>
          <div>
            <dt>Revisions</dt>
            <dd>{stagedImport.summary.revisionCount}</dd>
          </div>
        {:else}
          <div>
            <dt>Projects</dt>
            <dd>{stagedImport.summary.projectCount}</dd>
          </div>
          <div>
            <dt>Snapshots</dt>
            <dd>{stagedImport.summary.namedSnapshotCount}</dd>
          </div>
        {/if}
      </dl>
      <div class="staged-actions">
        <button type="button" onclick={() => oncommitimport('cancel')}>Cancel import</button>
        <button type="button" onclick={() => oncommitimport('replace')}>
          {stagedImport.format === 'venae-backup' ? 'Replace Library' : 'Replace existing'}
        </button>
        {#if stagedImport.format !== 'venae-backup'}
          <button type="button" onclick={() => oncommitimport('import-copy')}>Import as copy</button
          >
        {/if}
      </div>
    </section>
  {/if}

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
            <button
              type="button"
              aria-label={`Create Named Snapshot for ${project.name}`}
              disabled={!ready}
              onclick={() => onnamedsnapshot(project)}
            >
              Snapshot
            </button>
            <button
              type="button"
              aria-label={`Export ${project.name} as .venae.json`}
              disabled={!ready}
              onclick={() => onexportproject(project)}
            >
              Export
            </button>
            <button
              type="button"
              aria-label={`Move ${project.name} to Trash`}
              disabled={!ready}
              onclick={() => ontrash(project)}
            >
              Trash
            </button>
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if overview && overview.namedSnapshots.length > 0}
    <section class="retained-records" aria-labelledby="snapshots-heading">
      <div>
        <p class="eyebrow">Immutable contents</p>
        <h2 id="snapshots-heading">Named Snapshots</h2>
      </div>
      <ol>
        {#each overview.namedSnapshots as snapshot (snapshot.id)}
          <li>
            <strong>{snapshot.name}</strong>
            <span>Revision {snapshot.projectRevision} · user-retained</span>
            <button type="button" onclick={() => onrestoresnapshot(snapshot.id)}
              >Restore {snapshot.name}</button
            >
            <small>{snapshot.note}</small>
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if overview && overview.trash.length > 0}
    <section class="retained-records" aria-labelledby="trash-heading">
      <div>
        <p class="eyebrow">30-day recovery</p>
        <h2 id="trash-heading">Trash</h2>
      </div>
      <ol>
        {#each overview.trash as entry (entry.id)}
          <li>
            <strong>{entry.label}</strong>
            <span>Retained until {entry.expiresAt.slice(0, 10)}</span>
            <button type="button" onclick={() => onrestoretrash(entry.id)}
              >Restore {entry.label}</button
            >
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if overview && overview.templateRevisionCount > 0}
    <section class="template-summary">
      <div>
        <p class="eyebrow">Part Definition Templates</p>
        <h2>{overview.templateRevisionCount} immutable revisions</h2>
      </div>
      <button type="button" onclick={onexporttemplates}>Export template revisions</button>
    </section>
  {/if}

  {#if overview && overview.quarantine.length > 0}
    <section class="retained-records" aria-labelledby="quarantine-heading">
      <div>
        <p class="eyebrow">No silent repair</p>
        <h2 id="quarantine-heading">Quarantine</h2>
      </div>
      <ol>
        {#each overview.quarantine as record (record.id)}
          <li>
            <strong>{record.sourceId}</strong>
            <span>{record.reason}</span>
            <button type="button" onclick={() => onexportquarantine(record.id)}>
              Download raw {record.sourceId}
            </button>
            <small>Retained {record.quarantinedAt.slice(0, 10)}</small>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</main>

<style>
  .creation-actions,
  .library-health,
  .library-loading,
  .library-error,
  .project-library,
  .staged-import,
  .retained-records,
  .template-summary {
    margin-bottom: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-medium);
    background: rgb(17 29 31 / 84%);
  }

  .creation-actions,
  .project-library,
  .staged-import,
  .retained-records,
  .template-summary {
    display: grid;
    grid-template-columns: minmax(12rem, 0.32fr) minmax(0, 1fr);
    gap: 1.5rem;
  }

  .library-health {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
    gap: 1rem;
    align-items: center;
  }

  .library-health h2,
  .library-health p,
  .staged-import p,
  .retained-records p {
    margin: 0;
  }

  .library-health p,
  .library-health small,
  .retained-records small,
  .retained-records span,
  .staged-import p {
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }

  .library-health button,
  .staged-actions button,
  .retained-records button,
  .template-summary button {
    min-height: 2.5rem;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-small);
    background: var(--color-surface-raised);
    color: var(--color-text);
    cursor: pointer;
  }

  .library-health-actions {
    display: grid;
    gap: 0.45rem;
  }

  .operation-status {
    margin: 0 0 1rem;
    padding: 0.7rem 1rem;
    border-left: 3px solid var(--color-accent);
    background: rgb(19 48 48 / 72%);
    color: var(--color-text-muted);
    font-size: 0.75rem;
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

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .staged-import dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
    margin: 0;
  }

  .staged-import dl div {
    padding: 0.45rem;
    border: 1px solid var(--color-line);
  }

  .staged-import dt {
    color: var(--color-text-muted);
    font: 0.58rem var(--font-mono);
    text-transform: uppercase;
  }

  .staged-import dd {
    margin: 0.15rem 0 0;
    overflow-wrap: anywhere;
    font-size: 0.72rem;
  }

  .staged-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .staged-actions button:last-child {
    border-color: var(--color-accent);
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
    grid-template-columns: minmax(0, 1fr) repeat(4, auto);
    gap: 0.5rem;
  }

  .retained-records > ol {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .retained-records li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.6rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-small);
  }

  .retained-records small {
    grid-column: 1 / -1;
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
    .project-library,
    .library-health,
    .staged-import,
    .retained-records,
    .template-summary {
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

    .retained-records li {
      grid-template-columns: 1fr;
    }
  }
</style>
