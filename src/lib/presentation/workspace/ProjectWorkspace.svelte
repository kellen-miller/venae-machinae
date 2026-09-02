<script lang="ts">
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';

  import { createProjectExchange } from '../../exchange/project-exchange';
  import {
    captureOutputRevision,
    createCsvTables,
    createExportAllZip,
    createPrintableReport,
    createValidationReport
  } from '../../reporting/generate-output';
  import { projectSnapshotToDocument } from '../../persistence/project-document';
  import { projectSnapshotToRendererProjection } from '../../renderer/projection';
  import { createProjectComponentFromPrimitive, PRIMITIVES } from '../../reference/primitives';
  import { setProjectSessionContext } from '../../session/project-context';
  import CanvasWorkspace from './CanvasWorkspace.svelte';
  import CapabilityNotice from './CapabilityNotice.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import Inspector from './Inspector.svelte';
  import LensStack from './LensStack.svelte';
  import OutputPreview from './OutputPreview.svelte';
  import VehicleBackgroundControls from './VehicleBackgroundControls.svelte';
  import ViewLauncher from './ViewLauncher.svelte';
  import WorkspaceStatus from './WorkspaceStatus.svelte';
  import WorkspaceToolbar from './WorkspaceToolbar.svelte';
  import { WorkspacePresentation } from './workspace-presentation.svelte';

  import type { RendererIntent } from '../../renderer/intent';
  import type { RendererPoint } from '../../renderer/projection';
  import type { ElectricalComponentRole } from '../../electrical/electrical';
  import type { FluidComponentRole } from '../../fluid/fluid';
  import type { ImpactPreview, ProjectAction } from '../../project/action';
  import type { PartDefinition, VehicleBackground } from '../../project/project';
  import type { PrintableReport, ProjectOutputKind } from '../../reporting/generate-output';
  import type { ProjectAsset } from '../../session/session-backing';
  import type { ProjectSession } from '../../session/project-session.svelte';
  import type {
    DenseWorkspaceView,
    WorkspaceMode,
    WorkspaceSubject,
    WorkspaceView
  } from './workspace-presentation.svelte';

  const {
    session,
    onpromotetemplate
  }: {
    session: ProjectSession;
    onpromotetemplate: (
      definition: PartDefinition
    ) => Promise<{ promoted: true } | { promoted: false; reason: string }>;
  } = $props();
  setProjectSessionContext(() => session);

  const presentation = new WorkspacePresentation();
  let previewSourcePortId = $state<string | null>(null);
  let interactionStatus = $state('Canvas and dense projections share one Project revision.');
  let pendingBranchAction = $state<Extract<
    ProjectAction,
    { type: 'insert-electrical-branch' }
  > | null>(null);
  let branchPreview = $state<ImpactPreview | null>(null);
  let prefersReducedMotion = $state(false);
  let printableReport = $state<PrintableReport | null>(null);
  const canAuthor = $derived(session.view.capability.mode === 'author');
  const rendererCapability = $derived(canAuthor ? ('author' as const) : ('review' as const));
  const motionPaused = $derived(presentation.motionPaused || prefersReducedMotion);
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
  const activeOverlayResult = $derived(
    session.view.snapshot.results.find(
      (result) =>
        (result.status === 'current' || result.status === 'stale') &&
        result.detail?.type === 'overlay' &&
        result.detail.overlay.operatingStateId === presentation.operatingStateId
    )
  );
  const activeOverlay = $derived(
    activeOverlayResult?.detail?.type === 'overlay' ? activeOverlayResult.detail.overlay : null
  );
  const overlayLifecycleStatus = $derived(
    session.view.evaluation.status === 'queued'
      ? 'stale'
      : session.view.snapshot.results.some((result) => result.status === 'failed')
        ? 'failed'
        : (activeOverlayResult?.status ?? 'unavailable')
  );
  const projection = $derived(
    projectSnapshotToRendererProjection(session.view.snapshot, {
      selectedSubjectId: presentation.selection?.id ?? null,
      previewSubjectId: presentation.preview?.id ?? null,
      previewSourcePortId,
      domainFilter: presentation.domainFilter,
      systemFilterId: presentation.systemFilterId,
      operatingStateId: presentation.operatingStateId,
      overlayChannels: presentation.overlayChannels
    })
  );
  const canvasViewportIdentity = $derived(
    `${presentation.canvasViewport.x},${presentation.canvasViewport.y},${presentation.canvasViewport.zoom}`
  );

  onMount(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => (prefersReducedMotion = preference.matches);
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      if (session.view.save.status !== 'failed') return;
      event.preventDefault();
      event.returnValue = '';
    };
    update();
    preference.addEventListener('change', update);
    window.addEventListener('beforeunload', warnAboutUnsavedChanges);
    return () => {
      preference.removeEventListener('change', update);
      window.removeEventListener('beforeunload', warnAboutUnsavedChanges);
    };
  });

  function execute(action: ProjectAction): boolean {
    const outcome = session.execute(action);
    interactionStatus = outcome.accepted
      ? `${action.type} accepted at revision ${outcome.revision}.`
      : `${action.type} blocked: ${outcome.rejection.code}.`;
    return outcome.accepted;
  }

  async function requestAuthoringTakeover(): Promise<void> {
    const outcome = await session.requestTakeover();
    interactionStatus = outcome.requested
      ? 'Authoring takeover requested; retrying after the current writer flushes.'
      : `Authoring takeover unavailable: ${outcome.reason}.`;
    if (outcome.requested) window.setTimeout(() => window.location.reload(), 600);
  }

  async function retrySave(): Promise<void> {
    const outcome = await session.flush('explicit');
    interactionStatus = outcome.saved
      ? `Retry saved durable revision ${outcome.revision}.`
      : `Retry failed: ${outcome.reason}. Unsaved changes remain in memory.`;
  }

  async function exportUnsavedWorkingState(): Promise<void> {
    if (
      !window.confirm(
        'Export the current unsaved working state? The file will explicitly remain marked as non-durable.'
      )
    ) {
      return;
    }
    const output = await session.acquireOutputRevision({ allowUnsavedWorkingState: true });
    if (!output.acquired) {
      interactionStatus = 'Emergency export failed to acquire one immutable working revision.';
      return;
    }
    const envelope = await createProjectExchange({
      project: projectSnapshotToDocument(output.snapshot),
      assets: session.view.assets.map((asset) => ({
        mimeType: asset.mimeType,
        bytes: new Uint8Array(asset.bytes)
      })),
      exportedAt: new Date().toISOString(),
      revisionState:
        output.source === 'unsaved-working-state' ? 'Unsaved working state' : 'Durable revision'
    });
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${output.snapshot.id}.unsaved.venae.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    interactionStatus = `Exported revision ${output.snapshot.revision} as ${envelope.exportMetadata.revisionState}.`;
  }

  function downloadOutput(filename: string, contents: BlobPart, mimeType: string): void {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function generateOutput(kind: ProjectOutputKind): Promise<void> {
    const acquired = await session.acquireOutputRevision({ allowUnsavedWorkingState: false });
    if (!acquired.acquired) {
      interactionStatus = 'Output blocked: the current Project revision could not be saved.';
      return;
    }
    const output = captureOutputRevision(acquired.snapshot, {
      source: acquired.source,
      generatedAt: new Date().toISOString(),
      view: presentation.activeView,
      operatingStateId: presentation.operatingStateId,
      domainFilter: presentation.domainFilter,
      systemFilterId: presentation.systemFilterId,
      overlayChannels: presentation.overlayChannels,
      legend: [
        'Solid trace: known evidence',
        'Hatched trace: unknown or conflicting evidence',
        'Orange mark: visible Finding'
      ],
      pagination: 'A4 portrait · repeat table headers'
    });
    const prefix = `${output.document.project.id}.r${output.document.project.revision}`;
    if (kind === 'print') {
      printableReport = createPrintableReport(output);
    } else if (kind === 'csv') {
      downloadOutput(
        `${prefix}.bom.csv`,
        createCsvTables(output)['bom.csv'] ?? '',
        'text/csv;charset=utf-8'
      );
    } else if (kind === 'zip') {
      downloadOutput(
        `${prefix}.outputs.zip`,
        new Uint8Array(createExportAllZip(output)).buffer,
        'application/zip'
      );
    } else if (kind === 'validation') {
      downloadOutput(
        `${prefix}.validation.json`,
        JSON.stringify(createValidationReport(output), null, 2),
        'application/json'
      );
    } else {
      const envelope = await createProjectExchange({
        project: output.document,
        assets: session.view.assets.map((asset) => ({
          mimeType: asset.mimeType,
          bytes: new Uint8Array(asset.bytes)
        })),
        exportedAt: output.context.generatedAt,
        revisionState:
          output.context.source === 'unsaved-working-state'
            ? 'Unsaved working state'
            : 'Durable revision'
      });
      downloadOutput(`${prefix}.venae.json`, JSON.stringify(envelope, null, 2), 'application/json');
    }
    interactionStatus = `Generated ${kind} from immutable revision ${output.document.project.revision}.`;
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

  function activateOperatingState(stateId: string | null): void {
    if (stateId === presentation.operatingStateId) return;
    presentation.setOperatingState(stateId);
    if (stateId) {
      session.requestEvaluation({ kind: 'changed-subjects', subjectIds: [stateId] });
      interactionStatus = `Operating State ${stateId} selected; prior Overlay is stale until atomic replacement.`;
    } else {
      interactionStatus = 'No Operating State selected; physical topology remains visible.';
    }
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

  function addPrimitive(primitiveId: string, fluidSystemId?: string): void {
    const primitive = PRIMITIVES.find((candidate) => candidate.id === primitiveId);
    if (!primitive) {
      interactionStatus = `Primitive ${primitiveId} is unavailable.`;
      return;
    }

    const componentId = crypto.randomUUID();
    const index = session.view.snapshot.topology.components.length;
    const fluidSystem = fluidSystemId
      ? session.view.snapshot.topology.systems.find(
          (system) => system.id === fluidSystemId && system.domain === 'fluid'
        )
      : undefined;
    if (primitive.ports.some((port) => port.domain === 'fluid') && !fluidSystem?.mediumId) {
      interactionStatus = 'Choose a Fluid System before adding a fluid primitive.';
      return;
    }

    const component = createProjectComponentFromPrimitive({
      primitiveId,
      componentId,
      portIds: primitive.ports.map(() => crypto.randomUUID()),
      ...(fluidSystem?.mediumId ? { mediumId: fluidSystem.mediumId } : {}),
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
    const fluidRoleByPrimitive: Readonly<Record<string, FluidComponentRole>> = {
      'fluid-endpoint': 'endpoint',
      'fluid-pump': 'pump',
      'fluid-valve': 'valve',
      'fluid-fitting': 'fitting',
      'fluid-union': 'union',
      'fluid-tee': 'tee',
      'fluid-volume': 'volume'
    };
    const electricalRole = roleByPrimitive[primitiveId];
    const fluidRole = fluidRoleByPrimitive[primitiveId];
    let accepted: boolean;
    if (electricalRole) {
      accepted = execute({
        type: 'add-electrical-component',
        causationId: crypto.randomUUID(),
        component,
        role: electricalRole
      });
    } else if (fluidRole) {
      accepted = execute({
        type: 'add-fluid-component',
        causationId: crypto.randomUUID(),
        component,
        role: fluidRole
      });
    } else {
      interactionStatus = `Primitive ${primitiveId} has no authoring role.`;
      return;
    }

    if (accepted) {
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
  data-operating-state={presentation.operatingStateId ?? ''}
  data-overlay-status={overlayLifecycleStatus}
  data-motion-paused={motionPaused}
>
  <header class="workspace-header">
    <a href={resolve('/')} aria-label="Back to Project Library">← Library</a>
    <div class="project-identity">
      <p>Vehicle Project</p>
      <h1>{session.view.snapshot.name}</h1>
    </div>
    <WorkspaceStatus
      view={session.view}
      onretry={retrySave}
      onemergencyexport={exportUnsavedWorkingState}
    />
    <button class="revision-action" type="button" disabled={!canAuthor} onclick={applyProjectEdit}
      >Apply project edit</button
    >
  </header>

  <div class="workspace-controls">
    <CapabilityNotice
      capability={session.view.capability}
      onrequesttakeover={requestAuthoringTakeover}
    />
    <WorkspaceToolbar
      snapshot={session.view.snapshot}
      mode={presentation.mode}
      domainFilter={presentation.domainFilter}
      systemFilterId={presentation.systemFilterId}
      operatingStateId={presentation.operatingStateId}
      overlayChannels={presentation.overlayChannels}
      {motionPaused}
      canUndo={session.view.canUndo}
      canRedo={session.view.canRedo}
      {canAuthor}
      onmode={setMode}
      ondomainfilter={(domain) => (presentation.domainFilter = domain)}
      onsystemfilter={(systemId) => (presentation.systemFilterId = systemId)}
      onstate={activateOperatingState}
      onchannel={(channel, enabled) => presentation.setOverlayChannel(channel, enabled)}
      onmotion={(paused) => (presentation.motionPaused = paused)}
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
        comparisonStateIds={presentation.comparisonStateIds}
        overlayChannels={presentation.overlayChannels}
        {motionPaused}
        {canAuthor}
        {branchPreview}
        {onpromotetemplate}
        onaction={execute}
        onvalidate={(scope) => {
          session.requestEvaluation(scope);
          interactionStatus =
            'Validation requested; prior evidence remains visible until publication.';
        }}
        onoutput={generateOutput}
        onpreviewbranch={previewBranch}
        onconfirmbranch={confirmBranch}
        oncancelbranch={cancelBranch}
        onclose={() => presentation.openView('canvas')}
        onincreasezoom={() => presentation.increaseLensZoom(activeDenseView)}
        onincreasecomparison={(side) => presentation.increaseComparisonZoom(side)}
        oncomparisonstate={(side, stateId) => presentation.setComparisonState(side, stateId)}
        oncomparisonviewport={(viewport) => presentation.updateComparisonViewport(viewport)}
        onpreview={(componentId) => presentation.setPreview({ kind: 'component', id: componentId })}
        onselect={(componentId) => select({ kind: 'component', id: componentId })}
      />
    {/if}

    <Inspector
      snapshot={session.view.snapshot}
      selection={presentation.selection}
      preview={presentation.preview}
      mode={presentation.mode}
      denseViewOpen={activeDenseView !== null}
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

    {#if presentation.operatingStateId}
      <aside
        class="overlay-inspector"
        aria-label="Operating State Overlay"
        data-overlay-inspector-status={overlayLifecycleStatus}
      >
        <header>
          <div>
            <span>Derived · read-only</span>
            <strong>{activeOverlay?.operatingStateName ?? 'Overlay unavailable'}</strong>
          </div>
          <output>{overlayLifecycleStatus}</output>
        </header>
        {#if activeOverlay}
          <p>
            Revision {activeOverlay.sourceRevision} · fingerprint {activeOverlay.inputFingerprint.slice(
              0,
              12
            )}
          </p>
          <ul class="overlay-availability" aria-label="Overlay availability">
            {#each activeOverlay.systems as system (system.systemId)}
              {#each system.channels as channel (`${system.systemId}:${channel.channel}`)}
                <li>
                  <strong>{channel.channel}</strong>
                  <span>{channel.availability} · {channel.evaluationStatus}</span>
                </li>
              {/each}
            {/each}
          </ul>
          <div class="overlay-traces">
            {#each activeOverlay.marks as mark (mark.id)}
              <details data-overlay-trace={mark.id}>
                <summary>{mark.staticCue} · {mark.label}</summary>
                <dl>
                  <dt>Physical topology</dt>
                  <dd>{mark.trace.physicalConnectionId}</dd>
                  <dt>Selected path</dt>
                  <dd>{mark.trace.pathConnectionIds.join(' → ')}</dd>
                  <dt>State Binding</dt>
                  <dd>{mark.trace.stateBindingId}</dd>
                  <dt>Component Behavior</dt>
                  <dd>{mark.trace.componentBehaviorId ?? 'explicitly absent'}</dd>
                  <dt>Calculation Result</dt>
                  <dd>{mark.trace.calculationResultId ?? 'explicitly absent'}</dd>
                  <dt>Sources</dt>
                  <dd>{mark.trace.sources.join('; ') || 'none'}</dd>
                  <dt>Assumptions</dt>
                  <dd>{mark.trace.assumptions.join('; ') || 'none'}</dd>
                  <dt>Omissions</dt>
                  <dd>{mark.trace.omissions.join('; ') || 'none'}</dd>
                  <dt>Applicability</dt>
                  <dd>{mark.trace.applicability}</dd>
                  <dt>Uncertainty</dt>
                  <dd>{mark.trace.uncertainty ?? 'none'}</dd>
                  <dt>Conflicts</dt>
                  <dd>{mark.trace.conflicts.join('; ') || 'none'}</dd>
                  <dt>Overlay mark</dt>
                  <dd>{mark.id}</dd>
                </dl>
              </details>
            {/each}
          </div>
        {:else}
          <p>Evaluation unavailable. Physical topology remains visible.</p>
        {/if}
      </aside>
    {/if}

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

  {#if printableReport}
    <OutputPreview report={printableReport} onclose={() => (printableReport = null)} />
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

  .overlay-inspector {
    position: absolute;
    z-index: 9;
    bottom: 0.75rem;
    left: 5.4rem;
    width: min(29rem, calc(100% - 8.5rem));
    max-height: 42%;
    overflow: auto;
    padding: 0.65rem;
    border: 1px solid #8aa6a0;
    border-radius: 0.6rem 0.2rem 0.6rem 0.2rem;
    background: rgb(245 248 244 / 95%);
    color: #173d3f;
    box-shadow: 0 0.8rem 2rem rgb(14 39 39 / 24%);
  }

  .overlay-inspector header,
  .overlay-inspector li {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .overlay-inspector header span,
  .overlay-inspector output,
  .overlay-inspector p,
  .overlay-inspector li,
  .overlay-inspector summary,
  .overlay-inspector dl {
    font: 0.62rem/1.45 var(--font-mono);
  }

  .overlay-inspector header span,
  .overlay-inspector output {
    display: block;
    color: #5b716d;
    text-transform: uppercase;
  }

  .overlay-inspector p,
  .overlay-availability {
    margin: 0.4rem 0;
  }

  .overlay-availability {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.25rem;
    padding: 0;
    list-style: none;
  }

  .overlay-availability li {
    padding: 0.28rem 0.4rem;
    background: #e5eeea;
  }

  .overlay-traces details {
    border-top: 1px solid #c7d4d0;
  }

  .overlay-traces summary {
    padding: 0.38rem 0;
    cursor: pointer;
  }

  .overlay-traces dl {
    display: grid;
    grid-template-columns: 8rem 1fr;
    margin: 0 0 0.5rem;
  }

  .overlay-traces dt {
    color: #5b716d;
  }

  .overlay-traces dd {
    margin: 0;
    overflow-wrap: anywhere;
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

    .overlay-inspector {
      right: 0.5rem;
      bottom: 4rem;
      left: 0.5rem;
      width: auto;
      max-height: 36%;
    }
  }
</style>
