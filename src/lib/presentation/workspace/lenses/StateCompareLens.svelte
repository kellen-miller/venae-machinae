<script lang="ts">
  import type { ProjectSnapshot } from '../../../project/project';
  import type { RendererViewport } from '../../../renderer/projection';

  let {
    snapshot,
    leftViewport,
    rightViewport,
    onincrease
  }: {
    snapshot: ProjectSnapshot;
    leftViewport: RendererViewport;
    rightViewport: RendererViewport;
    onincrease: (side: 'left' | 'right') => void;
  } = $props();
</script>

<section>
  <p>Only this destination links two canvas viewports</p>
  <h2>State Compare</h2>
  <div class="comparison-grid">
    <article data-compare-viewport="left" data-zoom={leftViewport.zoom}>
      <header>
        <span>A</span><strong>{snapshot.operatingStates[0]?.name ?? 'State A'}</strong>
      </header>
      <div class="mini-canvas">Viewport {leftViewport.zoom.toFixed(1)}×</div>
      <button
        type="button"
        aria-label="Increase left comparison zoom"
        onclick={() => onincrease('left')}>Zoom in linked pair</button
      >
    </article>
    <article data-compare-viewport="right" data-zoom={rightViewport.zoom}>
      <header>
        <span>B</span><strong>{snapshot.operatingStates[1]?.name ?? 'State B'}</strong>
      </header>
      <div class="mini-canvas">Viewport {rightViewport.zoom.toFixed(1)}×</div>
      <button
        type="button"
        aria-label="Increase right comparison zoom"
        onclick={() => onincrease('right')}>Zoom in linked pair</button
      >
    </article>
  </div>
</section>

<style>
  section > p {
    margin: 0;
    color: #6b7c7a;
    font: 0.62rem var(--font-mono);
    text-transform: uppercase;
  }
  h2 {
    margin: 0.15rem 0 1rem;
    color: #173d3f;
    font: 2rem var(--font-display);
  }
  .comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
  }
  article {
    overflow: hidden;
    border: 1px solid #bdccc7;
    border-radius: 0.6rem 0.2rem 0.6rem 0.2rem;
    background: #f9faf7;
  }
  header {
    display: flex;
    gap: 0.55rem;
    align-items: center;
    padding: 0.55rem;
    border-bottom: 1px solid #d3ddda;
  }
  header span {
    display: grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    background: #1d4a4b;
    color: white;
    font: 0.65rem var(--font-mono);
  }
  .mini-canvas {
    display: grid;
    place-items: center;
    min-height: 11rem;
    background:
      radial-gradient(#a7b9b3 1px, transparent 1px) 0 0 / 18px 18px,
      #e7eeea;
    color: #4f6966;
    font: 0.7rem var(--font-mono);
  }
  button {
    width: 100%;
    min-height: 2.4rem;
    border: 0;
    border-top: 1px solid #d3ddda;
    background: #edf3ef;
    color: #214847;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: -3px;
  }
  @media (max-width: 43.75rem) {
    .comparison-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
