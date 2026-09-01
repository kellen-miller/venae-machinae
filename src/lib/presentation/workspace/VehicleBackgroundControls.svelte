<script lang="ts">
  import type { VehicleBackground } from '../../project/project';
  import type { ProjectAsset } from '../../session/session-backing';

  let {
    current,
    canAuthor,
    onapply,
    onremove
  }: {
    current: VehicleBackground | null;
    canAuthor: boolean;
    onapply: (background: VehicleBackground, asset: ProjectAsset | null) => void;
    onremove: () => void;
  } = $props();

  let selectedAsset = $state<ProjectAsset | null>(null);
  let assetStatus = $derived(
    current ? 'Stored raster ready.' : 'Choose a PNG, JPEG, or WebP raster.'
  );
  let assetHash = $derived(current?.assetHash ?? '');
  let opacity = $derived(current?.opacity ?? '0.35');
  let positionX = $derived(current?.position.x ?? '0');
  let positionY = $derived(current?.position.y ?? '0');
  let firstX = $derived(current?.calibration.first.x ?? '0');
  let firstY = $derived(current?.calibration.first.y ?? '0');
  let secondX = $derived(current?.calibration.second.x ?? '100');
  let secondY = $derived(current?.calibration.second.y ?? '0');
  let distance = $derived(current?.calibration.distance.decimal ?? '1000');
  let distanceUnit = $derived<VehicleBackground['calibration']['distance']['unit']>(
    current?.calibration.distance.unit ?? 'mm'
  );
  let visible = $derived(current?.visible ?? true);
  let locked = $derived(current?.locked ?? true);

  async function selectAsset(event: Event): Promise<void> {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      selectedAsset = null;
      assetHash = '';
      assetStatus = 'Unsupported file. Choose a PNG, JPEG, or WebP raster.';
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    assetHash = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    selectedAsset = {
      sha256: assetHash,
      mimeType: file.type as ProjectAsset['mimeType'],
      bytes
    };
    assetStatus = `${file.name} ready as ${assetHash.slice(0, 12)}…`;
  }

  function apply(): void {
    if (!assetHash) {
      assetStatus = 'Choose a raster before applying the background.';
      return;
    }

    onapply(
      {
        assetHash,
        mimeType: selectedAsset?.mimeType ?? current?.mimeType ?? 'image/png',
        calibration: {
          first: { x: firstX, y: firstY },
          second: { x: secondX, y: secondY },
          distance: { decimal: distance, unit: distanceUnit }
        },
        position: { x: positionX, y: positionY },
        opacity,
        visible,
        locked
      },
      selectedAsset
    );
  }
</script>

<details class="background-controls">
  <summary>Vehicle background</summary>
  <div>
    <p>
      One inert raster reference. Calibration-derived geometry remains explicitly estimated and
      never overrides entered or measured evidence.
    </p>
    <fieldset disabled={!canAuthor}>
      <legend>Hash-addressed raster</legend>
      <label class="wide">
        <span>{current ? 'Replace raster file' : 'Raster file'}</span>
        <input
          aria-label="Background raster file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onchange={selectAsset}
        />
      </label>
      <p class="asset-status wide" aria-live="polite">{assetStatus}</p>
      {#if assetHash}<code class="asset-hash wide">SHA-256 {assetHash}</code>{/if}
      <label><span>Position X</span><input bind:value={positionX} inputmode="decimal" /></label>
      <label><span>Position Y</span><input bind:value={positionY} inputmode="decimal" /></label>
      <label><span>First point X</span><input bind:value={firstX} inputmode="decimal" /></label>
      <label><span>First point Y</span><input bind:value={firstY} inputmode="decimal" /></label>
      <label><span>Second point X</span><input bind:value={secondX} inputmode="decimal" /></label>
      <label><span>Second point Y</span><input bind:value={secondY} inputmode="decimal" /></label>
      <label><span>Distance</span><input bind:value={distance} inputmode="decimal" /></label>
      <label>
        <span>Unit</span>
        <select bind:value={distanceUnit}>
          <option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option>
          <option value="in">in</option><option value="ft">ft</option>
        </select>
      </label>
      <label><span>Opacity</span><input bind:value={opacity} inputmode="decimal" /></label>
      <label class="check"
        ><input type="checkbox" bind:checked={visible} /><span>Visible</span></label
      >
      <label class="check"><input type="checkbox" bind:checked={locked} /><span>Locked</span></label
      >
      <div class="actions wide">
        <button type="button" onclick={apply}
          >{current ? 'Replace background reference' : 'Apply background reference'}</button
        >
        {#if current}<button type="button" class="secondary" onclick={onremove}>Remove</button>{/if}
      </div>
    </fieldset>
  </div>
</details>

<style>
  .background-controls {
    position: absolute;
    z-index: 9;
    right: 0.75rem;
    bottom: 3.9rem;
    width: min(31rem, calc(100% - 6rem));
    border: 1px solid rgb(35 73 72 / 36%);
    border-radius: 0.6rem 0.2rem 0.6rem 0.2rem;
    background: rgb(246 249 244 / 94%);
    color: #263f40;
    box-shadow: 0 1rem 3rem rgb(17 40 40 / 22%);
  }

  summary {
    padding: 0.6rem 0.75rem;
    color: #2e5654;
    font: 0.64rem var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
  }

  details > div {
    max-height: 62vh;
    overflow: auto;
    padding: 0 0.75rem 0.75rem;
  }

  p {
    margin: 0 0 0.65rem;
    color: #667a77;
    font-size: 0.68rem;
    line-height: 1.45;
  }

  .asset-status {
    margin: 0;
  }

  .asset-hash {
    overflow-wrap: anywhere;
    color: #4e6563;
    font-size: 0.56rem;
  }

  fieldset {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem;
    margin: 0;
    padding: 0.65rem;
    border: 1px solid #cad7d2;
  }

  legend,
  label span {
    color: #647875;
    font: 0.56rem var(--font-mono);
    text-transform: uppercase;
  }

  label {
    display: grid;
    gap: 0.2rem;
  }

  .wide {
    grid-column: 1 / -1;
  }

  input,
  select,
  button {
    min-height: 2.1rem;
    border: 1px solid #a7bbb5;
    border-radius: 0.3rem;
    background: #fffefb;
    color: #233f40;
    font: 0.7rem var(--font-mono);
  }

  input,
  select {
    width: 100%;
    padding: 0.3rem 0.45rem;
  }

  .check {
    display: flex;
    align-items: center;
  }

  .check input {
    width: auto;
  }

  .actions {
    display: flex;
    gap: 0.45rem;
  }

  button {
    padding: 0.35rem 0.6rem;
    background: #173f41;
    color: white;
    cursor: pointer;
  }

  button.secondary {
    background: #f7f9f5;
    color: #8a3f2d;
  }

  :disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  input:focus-visible,
  select:focus-visible,
  button:focus-visible,
  summary:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }
</style>
