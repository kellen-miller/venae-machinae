<script lang="ts">
  import type { ProjectSnapshot } from '../../project/project';
  import type { ImpactPreview, ProjectAction } from '../../project/action';
  import type { RendererViewport } from '../../renderer/projection';
  import type { OverlayChannel } from '../../operating-state/operating-state';
  import type { EvaluationScope } from '../../session/project-session.svelte';
  import BomLens from './lenses/BomLens.svelte';
  import CalculationsLens from './lenses/CalculationsLens.svelte';
  import CircuitsLinesLens from './lenses/CircuitsLinesLens.svelte';
  import EvidenceLens from './lenses/EvidenceLens.svelte';
  import FindingsLens from './lenses/FindingsLens.svelte';
  import HarnessesBundlesLens from './lenses/HarnessesBundlesLens.svelte';
  import InterfacesLens from './lenses/InterfacesLens.svelte';
  import RoutesLens from './lenses/RoutesLens.svelte';
  import StateCompareLens from './lenses/StateCompareLens.svelte';
  import SystemsLens from './lenses/SystemsLens.svelte';

  import type { DenseWorkspaceView, WorkspaceSubject } from './workspace-presentation.svelte';

  let {
    activeView,
    snapshot,
    selection,
    viewport,
    comparisonViewports,
    comparisonStateIds,
    overlayChannels,
    motionPaused,
    canAuthor,
    branchPreview,
    onaction,
    onvalidate,
    onpreviewbranch,
    onconfirmbranch,
    oncancelbranch,
    onclose,
    onincreasezoom,
    onincreasecomparison,
    oncomparisonstate,
    oncomparisonviewport,
    onpreview,
    onselect
  }: {
    activeView: DenseWorkspaceView;
    snapshot: ProjectSnapshot;
    selection: WorkspaceSubject | null;
    viewport: RendererViewport;
    comparisonViewports: Readonly<{ left: RendererViewport; right: RendererViewport }>;
    comparisonStateIds: Readonly<{ left: string | null; right: string | null }>;
    overlayChannels: readonly OverlayChannel[];
    motionPaused: boolean;
    canAuthor: boolean;
    branchPreview: ImpactPreview | null;
    onaction: (action: ProjectAction) => boolean;
    onvalidate: (scope: EvaluationScope) => void;
    onpreviewbranch: (action: Extract<ProjectAction, { type: 'insert-electrical-branch' }>) => void;
    onconfirmbranch: () => void;
    oncancelbranch: () => void;
    onclose: () => void;
    onincreasezoom: () => void;
    onincreasecomparison: (side: 'left' | 'right') => void;
    oncomparisonstate: (side: 'left' | 'right', stateId: string | null) => void;
    oncomparisonviewport: (viewport: RendererViewport) => void;
    onpreview: (componentId: string) => void;
    onselect: (componentId: string) => void;
  } = $props();
</script>

<div
  class="lens-stack"
  role="dialog"
  aria-label="Lens Stack"
  data-lens-viewport={activeView}
  data-zoom={viewport.zoom}
>
  <div class="stack-rail" aria-hidden="true">
    <span></span><span></span><span></span>
  </div>
  <header class="stack-header">
    <div>
      <span>Lens Stack</span>
      <strong>Project revision {snapshot.revision}</strong>
    </div>
    <button
      type="button"
      aria-label={`Increase ${activeView === 'circuits-lines' ? 'Circuits & Lines' : activeView === 'harnesses-bundles' ? 'Harnesses & Bundles' : activeView.charAt(0).toUpperCase() + activeView.slice(1)} lens zoom`}
      onclick={onincreasezoom}
    >
      {viewport.zoom.toFixed(1)}×
    </button>
    <button type="button" aria-label="Close Lens Stack and return to Canvas" onclick={onclose}
      >×</button
    >
  </header>

  <div class="lens-content">
    {#if activeView === 'systems'}
      <SystemsLens
        {snapshot}
        selectionId={selection?.id ?? null}
        {canAuthor}
        {onaction}
        {onpreview}
        {onselect}
      />
    {:else if activeView === 'circuits-lines'}
      <CircuitsLinesLens
        {snapshot}
        {canAuthor}
        {branchPreview}
        {onaction}
        {onpreviewbranch}
        {onconfirmbranch}
        {oncancelbranch}
      />
    {:else if activeView === 'interfaces'}
      <InterfacesLens {snapshot} {canAuthor} {onaction} />
    {:else if activeView === 'routes'}
      <RoutesLens {snapshot} {canAuthor} {onaction} />
    {:else if activeView === 'harnesses-bundles'}
      <HarnessesBundlesLens {snapshot} {canAuthor} {onaction} />
    {:else if activeView === 'calculations'}
      <CalculationsLens {snapshot} {canAuthor} {onaction} />
    {:else if activeView === 'evidence'}
      <EvidenceLens {snapshot} />
    {:else if activeView === 'bom'}
      <BomLens {snapshot} />
    {:else if activeView === 'findings'}
      <FindingsLens {snapshot} {canAuthor} {onaction} {onvalidate} />
    {:else}
      <StateCompareLens
        {snapshot}
        {canAuthor}
        {onaction}
        leftViewport={comparisonViewports.left}
        rightViewport={comparisonViewports.right}
        stateIds={comparisonStateIds}
        {overlayChannels}
        {motionPaused}
        onincrease={onincreasecomparison}
        onstate={oncomparisonstate}
        onviewport={oncomparisonviewport}
      />
    {/if}
  </div>
</div>

<style>
  .lens-stack {
    position: absolute;
    z-index: 6;
    inset: 0.75rem 21.4rem 0.75rem 5.2rem;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid rgb(38 76 75 / 42%);
    border-radius: 1rem 0.3rem 1rem 0.3rem;
    background: rgb(242 246 241 / 96%);
    color: #243e40;
    box-shadow: 0 2rem 6rem rgb(16 38 38 / 34%);
    backdrop-filter: blur(20px);
  }

  .stack-rail {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    display: grid;
    align-content: center;
    gap: 0.45rem;
    width: 0.5rem;
    background: #183f41;
  }

  .stack-rail span {
    width: 100%;
    height: 2.4rem;
    background: #c06a3c;
  }

  .stack-header {
    display: flex;
    gap: 0.45rem;
    justify-content: flex-end;
    align-items: center;
    min-height: 3.25rem;
    padding: 0.5rem 0.65rem 0.5rem 1.25rem;
    border-bottom: 1px solid #c8d5d0;
    background: rgb(232 239 234 / 92%);
  }

  .stack-header > div {
    display: grid;
    margin-right: auto;
  }

  .stack-header span,
  .stack-header strong {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .stack-header span {
    color: #a6532f;
  }

  .stack-header strong {
    color: #627573;
  }

  .stack-header button {
    min-width: 2.4rem;
    min-height: 2.2rem;
    border: 1px solid #a9bbb5;
    border-radius: 0.35rem;
    background: #f8faf7;
    color: #254948;
    cursor: pointer;
  }

  .stack-header button:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }

  .lens-content {
    overflow: auto;
    padding: 1.2rem 1.35rem 2rem 1.55rem;
  }

  @media (max-width: 70rem) {
    .lens-stack {
      right: 0.75rem;
    }
  }

  @media (max-width: 43.75rem) {
    .lens-stack {
      inset: 0.5rem 0.5rem 4.55rem;
    }
  }
</style>
