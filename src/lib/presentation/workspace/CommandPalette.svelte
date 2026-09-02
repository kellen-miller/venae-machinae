<script lang="ts">
  import type { ProjectSnapshot } from '../../project/project';
  import type { WorkspaceSubject, WorkspaceView } from './workspace-presentation.svelte';

  const commands: readonly Readonly<{
    id: string;
    label: string;
    group: string;
  }>[] = [
    { id: 'mode:select', label: 'Use Select mode', group: 'Mode' },
    { id: 'mode:pan', label: 'Use Pan mode', group: 'Mode' },
    { id: 'mode:add', label: 'Use Add mode', group: 'Mode' },
    { id: 'mode:connect', label: 'Use Connect mode', group: 'Mode' },
    { id: 'mode:route', label: 'Use Route mode', group: 'Mode' },
    { id: 'view:systems', label: 'Open Systems view', group: 'View' },
    { id: 'view:routes', label: 'Open Routes view', group: 'View' },
    { id: 'view:evidence', label: 'Open Evidence view', group: 'View' },
    { id: 'view:state-compare', label: 'Open State Compare view', group: 'View' }
  ];

  let {
    kind,
    snapshot,
    query,
    onquery,
    onclose,
    oncommand,
    onsubject
  }: {
    kind: 'commands' | 'search';
    snapshot: ProjectSnapshot;
    query: string;
    onquery: (query: string) => void;
    onclose: () => void;
    oncommand: (command: string) => void;
    onsubject: (subject: WorkspaceSubject, view: WorkspaceView) => void;
  } = $props();

  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const filteredCommands = $derived(
    commands.filter((command) => command.label.toLocaleLowerCase().includes(normalizedQuery))
  );
  const subjects = $derived([
    ...snapshot.topology.components.map((component) => ({
      id: component.id,
      label: component.label,
      detail: `${component.kind} · ${component.ports.length} Ports`,
      subject: { kind: 'component' as const, id: component.id },
      view: 'systems' as const
    })),
    ...snapshot.topology.connections.map((connection) => ({
      id: connection.id,
      label: connection.label,
      detail: `${connection.kind} · ${connection.interfaceAssessment}`,
      subject: { kind: 'connection' as const, id: connection.id },
      view: 'circuits-lines' as const
    })),
    ...snapshot.evidence.map((evidence) => ({
      id: evidence.id,
      label: evidence.label,
      detail: `${evidence.state} · ${evidence.subjectId}`,
      subject: { kind: 'component' as const, id: evidence.subjectId },
      view: 'evidence' as const
    }))
  ]);
  const filteredSubjects = $derived(
    subjects.filter((subject) =>
      `${subject.label} ${subject.detail} ${subject.id}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    )
  );
</script>

<div class="palette-backdrop">
  <button class="backdrop-dismiss" type="button" aria-label="Close palette" onclick={onclose}
  ></button>
  <div
    class="command-palette"
    role="dialog"
    aria-modal="true"
    aria-label={kind === 'commands' ? 'Command palette' : 'Project search'}
  >
    <header>
      <div>
        <p>{kind === 'commands' ? 'Command palette' : 'Project-wide search'}</p>
        <span
          >{kind === 'commands'
            ? 'Navigate and act without hidden shortcuts'
            : 'Components, Connections, and evidence'}</span
        >
      </div>
      <button type="button" onclick={onclose} aria-label="Close palette">Esc</button>
    </header>
    <label>
      <span class="sr-only"
        >{kind === 'commands' ? 'Filter commands' : 'Search project subjects'}</span
      >
      <input
        aria-label={kind === 'commands' ? 'Filter commands' : 'Search project subjects'}
        value={query}
        oninput={(event) => onquery(event.currentTarget.value)}
        placeholder={kind === 'commands'
          ? 'Type a command…'
          : 'Search by label, identity, or state…'}
      />
    </label>

    <ul>
      {#if kind === 'commands'}
        {#each filteredCommands as command (command.id)}
          <li>
            <button type="button" onclick={() => oncommand(command.id)}>
              <span>{command.label}</span><small>{command.group}</small>
            </button>
          </li>
        {/each}
      {:else}
        {#each filteredSubjects as subject (subject.id)}
          <li>
            <button type="button" onclick={() => onsubject(subject.subject, subject.view)}>
              <span>{subject.label}<small>{subject.detail}</small></span><code>{subject.id}</code>
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  </div>
</div>

<style>
  .palette-backdrop {
    position: fixed;
    z-index: 50;
    inset: 0;
    display: grid;
    place-items: start center;
    padding-top: min(14vh, 8rem);
    background: rgb(4 13 14 / 68%);
    backdrop-filter: blur(7px);
  }

  .backdrop-dismiss {
    position: absolute;
    inset: 0;
    width: 100%;
    border: 0;
    background: transparent;
    cursor: default;
  }

  .command-palette {
    position: relative;
    width: min(42rem, calc(100% - 2rem));
    max-height: min(38rem, 74vh);
    overflow: hidden;
    border: 1px solid #63817b;
    border-radius: 0.9rem 0.3rem 0.9rem 0.3rem;
    background: #f5f8f3;
    color: #203d3f;
    box-shadow: 0 2.5rem 8rem rgb(0 0 0 / 48%);
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem 0.85rem;
    border-bottom: 1px solid #cad7d2;
  }

  header div {
    display: grid;
  }

  header p,
  header span {
    margin: 0;
  }

  header p {
    color: #a4512e;
    font: 0.63rem var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  header span {
    color: #657977;
    font-size: 0.68rem;
  }

  header button {
    min-width: 2.5rem;
    min-height: 2rem;
    border: 1px solid #afbeb9;
    border-radius: 0.3rem;
    background: #eef3ef;
    color: #4e6563;
    font: 0.58rem var(--font-mono);
  }

  label {
    display: block;
    padding: 0.75rem;
  }

  input {
    width: 100%;
    min-height: 3rem;
    padding: 0.6rem 0.8rem;
    border: 2px solid #7a9690;
    border-radius: 0.45rem;
    background: #fffefb;
    color: #203d3f;
    font: 1rem var(--font-display);
  }

  input:focus-visible,
  button:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }

  ul {
    max-height: 28rem;
    overflow: auto;
    margin: 0;
    padding: 0 0.75rem 0.75rem;
    list-style: none;
  }

  li button {
    display: flex;
    width: 100%;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    min-height: 3.15rem;
    padding: 0.55rem 0.7rem;
    border: 0;
    border-top: 1px solid #d4deda;
    background: transparent;
    color: #213f41;
    text-align: left;
    cursor: pointer;
  }

  li button:hover {
    background: #e7f0eb;
  }

  li button > span,
  li button > span small {
    display: grid;
  }

  small,
  code {
    color: #6c7e7c;
    font: 0.58rem var(--font-mono);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  @media (prefers-reduced-motion: reduce) {
    .palette-backdrop,
    .command-palette {
      scroll-behavior: auto;
    }
  }
</style>
