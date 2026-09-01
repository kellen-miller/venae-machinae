<script lang="ts">
  import TopologyRenderer from '../../renderer/TopologyRenderer.svelte';

  import type { RendererIntentHandler } from '../../renderer/intent';
  import type {
    RendererCapabilityMode,
    RendererProjection,
    RendererViewport
  } from '../../renderer/projection';
  import type { VehicleBackground } from '../../project/project';
  import type { ProjectAsset } from '../../session/session-backing';
  import type { WorkspaceMode } from './workspace-presentation.svelte';

  let {
    projection,
    viewport,
    capability,
    mode,
    background,
    backgroundAsset,
    onintent
  }: {
    projection: RendererProjection;
    viewport: RendererViewport;
    capability: RendererCapabilityMode;
    mode: WorkspaceMode;
    background: VehicleBackground | null;
    backgroundAsset: ProjectAsset | null;
    onintent: RendererIntentHandler;
  } = $props();

  function attachBackgroundSource(image: HTMLImageElement): () => void {
    if (!backgroundAsset) return () => undefined;
    const bytes = new ArrayBuffer(backgroundAsset.bytes.byteLength);
    new Uint8Array(bytes).set(backgroundAsset.bytes);
    const url = URL.createObjectURL(new Blob([bytes], { type: backgroundAsset.mimeType }));
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }
</script>

<section class="canvas-workspace" data-canvas-geometry data-mode={mode} aria-label="Canvas view">
  <div class="canvas-status" aria-hidden="true">
    <span>Mode</span>
    <strong>{mode}</strong>
  </div>

  {#if background?.visible && backgroundAsset}
    <div
      class="vehicle-background"
      data-background-hash={background.assetHash}
      data-background-locked={background.locked}
      data-calibration-distance={`${background.calibration.distance.decimal} ${background.calibration.distance.unit}`}
      style:opacity={background.opacity}
      style:transform={`translate(${background.position.x}px, ${background.position.y}px)`}
      aria-label="Calibrated vehicle background reference"
    >
      <img {@attach attachBackgroundSource} alt="" draggable="false" />
    </div>
  {/if}

  <TopologyRenderer {projection} {viewport} {capability} {onintent} />
</section>

<style>
  .canvas-workspace {
    position: absolute;
    inset: 0;
    min-width: 0;
  }

  .canvas-workspace :global(.renderer-shell) {
    height: 100%;
  }

  .canvas-workspace :global(.canvas-lens) {
    height: 100%;
  }

  .canvas-workspace :global(.svg-frame),
  .canvas-workspace :global(svg) {
    height: 100%;
    min-height: 100%;
    border: 0;
    border-radius: 0;
  }

  .canvas-workspace :global(.semantic-lens) {
    display: none;
  }

  .canvas-status {
    position: absolute;
    z-index: 3;
    right: 1rem;
    bottom: 0.9rem;
    display: flex;
    gap: 0.42rem;
    align-items: center;
    padding: 0.32rem 0.55rem;
    border: 1px solid rgb(29 68 68 / 28%);
    border-radius: 999px;
    background: rgb(247 250 246 / 86%);
    color: #304e50;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    pointer-events: none;
  }

  .canvas-status strong {
    color: #a34d28;
  }

  .vehicle-background {
    position: absolute;
    z-index: 1;
    top: 9rem;
    left: 14rem;
    display: grid;
    place-items: center;
    width: 28rem;
    aspect-ratio: 16 / 7;
    overflow: hidden;
    border: 2px dashed rgb(43 80 80 / 42%);
    background: rgb(239 244 239 / 35%);
    color: #355e5e;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    pointer-events: none;
  }

  .vehicle-background img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  @media (max-width: 43.75rem) {
    .canvas-status {
      bottom: 4.7rem;
    }
  }
</style>
