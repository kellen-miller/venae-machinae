<script lang="ts">
  import { resolve } from '$app/paths';

  import { projectSnapshotToRendererProjection } from '../../renderer/projection';
  import { createProjectComponentFromPrimitive, PRIMITIVES } from '../../reference/primitives';
  import { setProjectSessionContext } from '../../session/project-context';
  import CanvasWorkspace from './CanvasWorkspace.svelte';
  import CapabilityNotice from './CapabilityNotice.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import Inspector from './Inspector.svelte';
  import LensStack from './LensStack.svelte';
  import VehicleBackgroundControls from './VehicleBackgroundControls.svelte';
  import ViewLauncher from './ViewLauncher.svelte';
  import WorkspaceStatus from './WorkspaceStatus.svelte';
  import WorkspaceToolbar from './WorkspaceToolbar.svelte';
  import { WorkspacePresentation } from './workspace-presentation.svelte';

  import type { RendererIntent } from '../../renderer/intent';
  import type { RendererPoint } from '../../renderer/projection';
  import type { ElectricalComponentRole } from '../../electrical/electrical';
  import type { ImpactPreview, ProjectAction } from '../../project/action';
  import type { VehicleBackground } from '../../project/project';
  import type { ProjectAsset } from '../../session/session-backing';
  import type { ProjectSession } from '../../session/project-session.svelte';
  import type {
    DenseWorkspaceView,
    WorkspaceMode,
    WorkspaceSubject,
    WorkspaceView
  } from './workspace-presentation.svelte';

  const { session }: { session: ProjectSession } = $props();
  setProjectSessionContext(() => session);

  const presentation = new WorkspacePresentation();
  let previewSourcePortId = $state<string | null>(null);
  let interactionStatus = $state('Canvas and dense projections share one Project revision.');
  let pendingBranchAction = $state<Extract<
    ProjectAction,
    { type: 'insert-electrical-branch' }
  > | null>(null);
  let branchPreview = $state<ImpactPreview | null>(null);
  const canAuthor = $derived(session.view.capability.mode === 'author');
  const rendererCapability = $derived(canAuthor ? ('author' as const) : ('review' as const));
  const backgroundAsset = $derived(
    session.view.snapshot.vehicleBackground
      ? (session.view.assets.find(
          (asset) => asset.sha256 === session.view.snapshot.vehicleBackground?.assetHash
        ) ?? null)
      : null
  );
  const activeDenseView = $derived(
    presentation.activeView === 'canvas' ? null : (presentation.activeView as DenseWorkspaceView)
  );
  const projection = $derived(
    projectSnapshotToRendererProjection(session.view.snapshot, {
      selectedSubjectId: presentation.selection?.id ?? null,
      previewSubjectId: presentation.preview?.id ?? null,
      previewSourcePortId,
      domainFilter: presentation.domainFilter,
      systemFilterId: presentation.systemFilterId
    })
  );
  const canvasViewportIdentity = $derived(
    `${presentation.canvasViewport.x},${presentation.canvasViewport.y},${presentation.canvasViewport.zoom}`
  );

  function execute(action: ProjectAction): boolean {
    const outcome = session.execute(action);
    interactionStatus = outcome.accepted
      ? `${action.type} accepted at revision ${outcome.revision}.`
      : `${action.type} blocked: ${outcome.rejection.code}.`;
    return outcome.accepted;
  }

  function select(subject: WorkspaceSubject): void {
    presentation.select(subject);
    interactionStatus = `Selected ${subject.id} in every projection.`;
  }

  function setMode(mode: WorkspaceMode): void {
    if (!canAuthor && mode !== 'select' && mode !== 'pan') {
      interactionStatus = `Mode ${mode} is unavailable: ${session.view.capability.reason}.`;
      return;
    }
    presentation.setMode(mode);
    interactionStatus = `${mode} mode active.`;
  }

  function componentForPort(portId: string | null): string | null {
    if (!portId) return null;
    return (
      session.view.snapshot.topology.components.find((component) =>
        component.ports.some((port) => port.id === portId)
      )?.id ?? null
    );
  }

  function handleIntent(intent: RendererIntent): void {
    if (intent.type === 'viewport-changed') {
      presentation.updateCanvasViewport(intent.viewport);
      return;
    }
    if (intent.type === 'select') {
      select({ kind: intent.target === 'node' ? 'component' : intent.target, id: intent.id });
      return;
    }
    if (intent.type === 'preview') {
      previewSourcePortId = intent.sourcePortId;
      const componentId = componentForPort(intent.targetPortId ?? intent.sourcePortId);
      presentation.setPreview(componentId ? { kind: 'component', id: componentId } : null);
      return;
    }
    if (intent.type === 'move-component') {
      if (presentation.mode !== 'select') {
        interactionStatus = 'Component movement requires Select mode.';
        return;
      }
      execute({
        type: 'move-component',
        causationId: crypto.randomUUID(),
        componentId: intent.componentId,
        position: { x: String(intent.position.x), y: String(intent.position.y) }
      });
      return;
    }
    if (intent.type === 'connect-ports') {
      if (presentation.mode !== 'connect') {
        interactionStatus = 'Port connection requires Connect mode.';
        return;
      }
      const ports = session.view.snapshot.topology.components.flatMap(
        (component) => component.ports
      );
      const source = ports.find((port) => port.id === intent.sourcePortId);
      const target = ports.find((port) => port.id === intent.targetPortId);
      const system = session.view.snapshot.topology.systems.find(
        (candidate) =>
          candidate.domain === source?.domain &&
          (candidate.domain === 'electrical' || candidate.mediumId === source?.mediumId)
      );
      if (!source || !target || !system) {
        interactionStatus = 'No explicit compatible System owns this Connection.';
        return;
      }
      execute({
        type: 'add-connection',
        causationId: crypto.randomUUID(),
        connection: {
          id: crypto.randomUUID(),
          label: `${source.label} to ${target.label}`,
          systemId: system.id,
          sourcePortId: source.id,
          targetPortId: target.id,
          domain: source.domain,
          mediumId: source.mediumId,
          kind: source.domain === 'electrical' ? 'electrical-wire' : 'fluid-hose',
          interfaceAssessment:
            source.interfaceKey && target.interfaceKey
              ? source.interfaceKey === target.interfaceKey
                ? 'compatible'
                : 'incompatible'
              : 'unknown',
          routeId: null
        }
      });
      return;
    }
    if (presentation.mode !== 'route') {
      interactionStatus = 'Route-point movement requires Route mode.';
      return;
    }
    const connection = session.view.snapshot.topology.connections.find(
      (candidate) => candidate.id === intent.connectionId
    );
    const route = session.view.snapshot.topology.routes.find(
      (candidate) => candidate.id === connection?.routeId
    );
    const segmentId = intent.routePointId.slice(`${intent.connectionId}:`.length);
    const segment = session.view.snapshot.topology.segments.find(
      (candidate) => candidate.id === segmentId
    );
    if (!connection || !route || !segment) {
      interactionStatus = 'The selected Route point no longer exists.';
      return;
    }
    execute({
      type: 'set-connection-route',
      causationId: crypto.randomUUID(),
      connectionId: connection.id,
      route,
      newSegments: [
        { ...segment, end: { x: String(intent.position.x), y: String(intent.position.y) } }
      ]
    });
  }

  function selectedPosition(subject: WorkspaceSubject | null): RendererPoint | null {
    if (!subject) return null;
    if (subject.kind === 'component') {
      const component = session.view.snapshot.topology.components.find(
        (candidate) => candidate.id === subject.id
      );
      return component
        ? { x: Number(component.position.x), y: Number(component.position.y) }
        : null;
    }
    const connection = session.view.snapshot.topology.connections.find(
      (candidate) => candidate.id === subject.id
    );
    const source = session.view.snapshot.topology.components.find((component) =>
      component.ports.some((port) => port.id === connection?.sourcePortId)
    );
    return source ? { x: Number(source.position.x), y: Number(source.position.y) } : null;
  }

  function revealPreview(): void {
    const position = selectedPosition(presentation.preview);
    if (!position) return;
    presentation.reveal(position);
  }

  function moveComponent(componentId: string, x: string, y: string): void {
    execute({
      type: 'move-component',
      causationId: crypto.randomUUID(),
      componentId,
      position: { x, y }
    });
  }

  function addPrimitive(primitiveId: string): void {
    const primitive = PRIMITIVES.find((candidate) => candidate.id === primitiveId);
    if (!primitive) {
      interactionStatus = `Primitive ${primitiveId} is unavailable.`;
      return;
    }

    const componentId = crypto.randomUUID();
    const index = session.view.snapshot.topology.components.length;
    const component = createProjectComponentFromPrimitive({
      primitiveId,
      componentId,
      portIds: primitive.ports.map(() => crypto.randomUUID()),
      position: {
        x: String(120 + (index % 4) * 208),
        y: String(120 + Math.floor(index / 4) * 152)
      }
    });
    const roleByPrimitive: Readonly<Record<string, ElectricalComponentRole>> = {
      'electrical-source': 'source',
      'ground-point': 'ground',
      fuse: 'fuse',
      relay: 'relay',
      switch: 'switch',
      'electrical-load': 'load',
      controller: 'controller',
      connector: 'connector',
      splice: 'splice',
      bus: 'bus'
    };
    const role = roleByPrimitive[primitiveId];
    if (!role) {
      interactionStatus = `Primitive ${primitiveId} has no authoring role.`;
      return;
    }

    if (
      execute({
        type: 'add-electrical-component',
        causationId: crypto.randomUUID(),
        component,
        role
      })
    ) {
      select({ kind: 'component', id: component.id });
    }
  }

  function previewBranch(
    action: Extract<ProjectAction, { type: 'insert-electrical-branch' }>
  ): void {
    pendingBranchAction = action;
    branchPreview = session.previewImpact(action);
    interactionStatus = `Branch preview covers ${branchPreview.subjectIds.length} affected subjects.`;
  }

  function confirmBranch(): void {
    if (!pendingBranchAction || !branchPreview) return;
    if (
      execute({
        ...pendingBranchAction,
        confirmedImpactSubjectIds: branchPreview.subjectIds
      })
    ) {
      pendingBranchAction = null;
      branchPreview = null;
    }
  }

  function cancelBranch(): void {
    pendingBranchAction = null;
    branchPreview = null;
    interactionStatus = 'Branch preview canceled without changing topology.';
  }

  function setBackground(background: VehicleBackground | null, asset: ProjectAsset | null): void {
    if (asset) {
      const registration = session.registerAsset(asset);
      if (!registration.registered) {
        interactionStatus = `set-vehicle-background blocked: ${registration.rejection.code}.`;
        return;
      }
    }

    execute({
      type: 'set-vehicle-background',
      causationId: crypto.randomUUID(),
      background
    });
  }

  function applyProjectEdit(): void {
    const revision = session.view.snapshot.revision + 1;
    execute({
      type: 'rename-project',
      causationId: crypto.randomUUID(),
      name: `Vehicle project r${revision}`
    });
  }

  function runCommand(command: string): void {
    const [kind, value] = command.split(':');
    if (kind === 'mode') setMode(value as WorkspaceMode);
    if (kind === 'view') presentation.openView(value as WorkspaceView);
    presentation.commandPaletteOpen = false;
    presentation.searchQuery = '';
  }

  function handleGlobalKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      presentation.commandPaletteOpen = false;
      presentation.searchOpen = false;
      presentation.searchQuery = '';
      setMode('select');
      return;
    }
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
      event.preventDefault();
      presentation.commandPaletteOpen = true;
      presentation.searchOpen = false;
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      presentation.searchOpen = true;
      presentation.commandPaletteOpen = false;
      return;
    }
    const mode = {
      v: 'select',
      h: 'pan',
      a: 'add',
      c: 'connect',
      r: 'route'
    }[event.key.toLocaleLowerCase()] as WorkspaceMode | undefined;
    if (mode) setMode(mode);
  }
</script>

<svelte:window onkeydown={handleGlobalKey} />

<svelte:head>
  <title>{session.view.snapshot.name} · Venae Machinae</title>
</svelte:head>

<main
  class="project-workspace"
  data-project-revision={session.view.snapshot.revision}
  data-save-status={session.view.save.status}
  data-evaluation-status={session.view.evaluation.status}
  data-workspace-mode={presentation.mode}
  data-active-view={presentation.activeView}
  data-primary-selection={presentation.selection?.id ?? ''}
  data-workspace-preview={presentation.preview?.id ?? ''}
  data-canvas-viewport={canvasViewportIdentity}
>
  <header class="workspace-header">
    <a href={resolve('/')} aria-label="Back to Project Library">← Library</a>
    <div class="project-identity">
      <p>Vehicle Project</p>
      <h1>{session.view.snapshot.name}</h1>
    </div>
    <WorkspaceStatus view={session.view} />
    <button class="revision-action" type="button" disabled={!canAuthor} onclick={applyProjectEdit}
      >Apply project edit</button
    >
  </header>

  <div class="workspace-controls">
    <CapabilityNotice capability={session.view.capability} />
    <WorkspaceToolbar
      snapshot={session.view.snapshot}
      mode={presentation.mode}
      domainFilter={presentation.domainFilter}
      systemFilterId={presentation.systemFilterId}
      operatingStateId={presentation.operatingStateId}
      canUndo={session.view.canUndo}
      canRedo={session.view.canRedo}
      {canAuthor}
      onmode={setMode}
      ondomainfilter={(domain) => (presentation.domainFilter = domain)}
      onsystemfilter={(systemId) => (presentation.systemFilterId = systemId)}
      onstate={(stateId) => (presentation.operatingStateId = stateId)}
      onundo={() => session.undo()}
      onredo={() => session.redo()}
      onsearch={() => {
        presentation.searchOpen = true;
        presentation.commandPaletteOpen = false;
      }}
      oncommand={() => {
        presentation.commandPaletteOpen = true;
        presentation.searchOpen = false;
      }}
    />
  </div>

  <section class="workspace-stage" aria-label="Project Workspace">
    <div data-canvas-revision={projection.revision}>
      <CanvasWorkspace
        {projection}
        viewport={presentation.canvasViewport}
        capability={rendererCapability}
        mode={presentation.mode}
        background={session.view.snapshot.vehicleBackground}
        {backgroundAsset}
        onintent={handleIntent}
      />
    </div>
    <span
      class="revision-bridge"
      data-dense-revision={session.view.snapshot.revision}
      aria-hidden="true"
    ></span>
    <ViewLauncher
      activeView={presentation.activeView}
      onopen={(view) => presentation.openView(view)}
    />

    {#if activeDenseView}
      <LensStack
        activeView={activeDenseView}
        snapshot={session.view.snapshot}
        selection={presentation.selection}
        viewport={presentation.lensViewports[activeDenseView]}
        comparisonViewports={presentation.comparisonViewports}
        {canAuthor}
        {branchPreview}
        onaction={execute}
        onpreviewbranch={previewBranch}
        onconfirmbranch={confirmBranch}
        oncancelbranch={cancelBranch}
        onclose={() => presentation.openView('canvas')}
        onincreasezoom={() => presentation.increaseLensZoom(activeDenseView)}
        onincreasecomparison={(side) => presentation.increaseComparisonZoom(side)}
        onpreview={(componentId) => presentation.setPreview({ kind: 'component', id: componentId })}
        onselect={(componentId) => select({ kind: 'component', id: componentId })}
      />
    {/if}

    <Inspector
      snapshot={session.view.snapshot}
      selection={presentation.selection}
      preview={presentation.preview}
      mode={presentation.mode}
      {canAuthor}
      onmove={moveComponent}
      onaddprimitive={addPrimitive}
      onfollow={() => presentation.followPreview()}
      onreveal={revealPreview}
    />
    <VehicleBackgroundControls
      current={session.view.snapshot.vehicleBackground}
      {canAuthor}
      onapply={(background, asset) => setBackground(background, asset)}
      onremove={() => setBackground(null, null)}
    />

    {#if presentation.revealFrame}
      <button
        class="return-presentation"
        type="button"
        onclick={() => presentation.returnFromReveal()}
      >
        Return to prior canvas presentation
      </button>
    {/if}
  </section>

  <p class="interaction-status" aria-live="polite">{interactionStatus}</p>

  {#if presentation.commandPaletteOpen || presentation.searchOpen}
    <CommandPalette
      kind={presentation.commandPaletteOpen ? 'commands' : 'search'}
      snapshot={session.view.snapshot}
      query={presentation.searchQuery}
      onquery={(query) => (presentation.searchQuery = query)}
      onclose={() => {
        presentation.commandPaletteOpen = false;
        presentation.searchOpen = false;
        presentation.searchQuery = '';
      }}
      oncommand={runCommand}
      onsubject={(subject, view) => {
        select(subject);
        presentation.openView(view);
        presentation.commandPaletteOpen = false;
        presentation.searchOpen = false;
        presentation.searchQuery = '';
      }}
    />
  {/if}
</main>

<style>
  .project-workspace {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    gap: 0.45rem;
    height: 100vh;
    min-height: 40rem;
    overflow: hidden;
    padding: 0.55rem;
    background: #102123;
  }

  .workspace-header {
    display: grid;
    grid-template-columns: auto minmax(14rem, 1fr) auto auto;
    gap: 0.9rem;
    align-items: center;
    min-height: 4.4rem;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-medium) var(--radius-small) var(--radius-medium) var(--radius-small);
    background: rgb(17 29 31 / 97%);
  }

  .workspace-header > a {
    color: var(--color-accent);
    font-size: 0.7rem;
    text-decoration: none;
    text-transform: uppercase;
  }

  .project-identity p,
  .project-identity h1 {
    margin: 0;
  }

  .project-identity p {
    color: var(--color-copper);
    font-family: var(--font-mono);
    font-size: 0.56rem;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(1.2rem, 2.1vw, 1.8rem);
    line-height: 1;
  }

  .revision-action,
  .return-presentation {
    min-height: 2.4rem;
    padding: 0.45rem 0.7rem;
    border: 0;
    border-radius: var(--radius-small);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: 750;
    cursor: pointer;
  }

  .revision-action:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  .workspace-stage {
    position: relative;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--color-line-strong);
    border-radius: 0.8rem 0.25rem 0.8rem 0.25rem;
    background: #dfe8e4;
  }

  .workspace-controls {
    display: grid;
    gap: 0.45rem;
  }

  .workspace-stage > div:first-child {
    position: absolute;
    inset: 0;
  }

  .revision-bridge {
    position: absolute;
  }

  .return-presentation {
    position: absolute;
    z-index: 12;
    top: 0.8rem;
    left: 5.4rem;
    box-shadow: 0 0.8rem 2rem rgb(14 39 39 / 28%);
  }

  .interaction-status {
    margin: 0;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.58rem;
  }

  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  @media (max-width: 70rem) {
    .workspace-header {
      grid-template-columns: auto 1fr auto;
    }

    .revision-action {
      display: none;
    }
  }

  @media (max-width: 43.75rem) {
    .project-workspace {
      gap: 0;
      padding: 0;
    }

    .workspace-header {
      grid-template-columns: auto 1fr auto;
      border-radius: 0;
    }

    .project-identity p {
      display: none;
    }

    h1 {
      overflow: hidden;
      font-size: 1rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .workspace-stage {
      border-radius: 0;
    }

    .interaction-status {
      display: none;
    }
  }
</style>
