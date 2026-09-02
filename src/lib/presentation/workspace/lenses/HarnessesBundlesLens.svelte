<script lang="ts">
  import type { ElectricalProperty } from '../../../electrical/electrical';
  import type { ProjectAction } from '../../../project/action';
  import type { ProjectSnapshot } from '../../../project/project';

  let {
    snapshot,
    canAuthor,
    onaction
  }: {
    snapshot: ProjectSnapshot;
    canAuthor: boolean;
    onaction: (action: ProjectAction) => boolean;
  } = $props();

  const wires = $derived(
    snapshot.topology.connections.filter((connection) => connection.kind === 'electrical-wire')
  );
  let harnessLabel = $state('Auxiliary cooling harness');
  let harnessId = $state('');
  let bundleLabel = $state('Auxiliary cooling trunk');
  let coveringPartDefinitionId = $state('');
  let coveringDescription = $state('Braided sleeve');
  let shield = $state('foil');
  let drainWireConnectionId = $state('');
  let twistAllowance = $state('0.04');
  let pitch = $state('45');
  let concentricAllowance = $state('0.03');
  let layDirection = $state<'left' | 'right'>('right');
  let constructionNotes = $state('Maintain construction through shared trunk');
  let cablePartDefinitionId = $state('');
  let cableGauge = $state('18');
  let cableMaterial = $state('copper');
  let cableProvenance = $state('supplier sheet');

  function configureHarness(): void {
    if (!harnessLabel.trim() || wires.length === 0) return;
    const nextHarnessId = crypto.randomUUID();
    if (
      onaction({
        type: 'configure-electrical-harness',
        causationId: crypto.randomUUID(),
        harness: {
          id: nextHarnessId,
          label: harnessLabel.trim(),
          componentIds: snapshot.electrical.components
            .filter((record) => record.role === 'connector')
            .map((record) => record.componentId),
          wireConnectionIds: wires.map((wire) => wire.id)
        }
      })
    ) {
      harnessId = nextHarnessId;
    }
  }

  function configureBundle(): void {
    const harness = snapshot.electrical.harnesses.find((candidate) => candidate.id === harnessId);
    if (!harness || !bundleLabel.trim()) return;
    const segmentIds = [
      ...new Set(
        harness.wireConnectionIds.flatMap((connectionId) => {
          const connection = snapshot.topology.connections.find(
            (candidate) => candidate.id === connectionId
          );
          return (
            snapshot.topology.routes.find((route) => route.id === connection?.routeId)
              ?.segmentIds ?? []
          );
        })
      )
    ];
    const pair = harness.wireConnectionIds.slice(0, 2);
    onaction({
      type: 'configure-electrical-bundle',
      causationId: crypto.randomUUID(),
      bundle: {
        id: crypto.randomUUID(),
        harnessId: harness.id,
        label: bundleLabel.trim(),
        wireConnectionIds: harness.wireConnectionIds,
        segmentIds,
        transitions:
          segmentIds.length > 0 ? [{ segmentId: segmentIds.at(-1)!, kind: 'split' }] : [],
        coverings: segmentIds.map((segmentId) => ({
          segmentId,
          description: coveringDescription.trim() || 'Covering description not recorded',
          partDefinitionId: coveringPartDefinitionId || null
        })),
        twistedPairs:
          pair.length === 2
            ? [
                {
                  id: crypto.randomUUID(),
                  wireConnectionIds: [pair[0]!, pair[1]!],
                  shield: shield.trim() || null,
                  drainWireConnectionId: drainWireConnectionId || null,
                  cutLengthAllowance: twistAllowance.trim()
                    ? {
                        decimal: twistAllowance.trim(),
                        unit: 'm',
                        source: 'entered',
                        provenance: 'user-entered construction record'
                      }
                    : null,
                  notes: constructionNotes.trim()
                }
              ]
            : [],
        concentric:
          pair.length === 2
            ? {
                layers: pair.map((connectionId, index) => ({
                  order: index + 1,
                  wireConnectionIds: [connectionId]
                })),
                pitch: pitch.trim()
                  ? {
                      decimal: pitch.trim(),
                      unit: 'mm',
                      source: 'entered',
                      provenance: 'user-entered construction record'
                    }
                  : null,
                layDirection,
                cutLengthAllowance: concentricAllowance.trim()
                  ? {
                      decimal: concentricAllowance.trim(),
                      unit: 'm',
                      source: 'entered',
                      provenance: 'user-entered construction record'
                    }
                  : null,
                notes: constructionNotes.trim()
              }
            : null,
        notes: constructionNotes.trim()
      }
    });
  }

  function knownProperty(value: string, unit: string | null): ElectricalProperty {
    return {
      state: 'known',
      value: value.trim(),
      unit,
      provenance: cableProvenance.trim(),
      conflictValues: []
    };
  }

  function unknownProperty(): ElectricalProperty {
    return {
      state: 'unknown',
      value: null,
      unit: null,
      provenance: null,
      conflictValues: []
    };
  }

  function recordCableEvidence(): void {
    if (
      !cablePartDefinitionId ||
      !cableGauge.trim() ||
      !cableMaterial.trim() ||
      !cableProvenance.trim()
    ) {
      return;
    }
    onaction({
      type: 'record-electrical-cable-specification',
      causationId: crypto.randomUUID(),
      specification: {
        partDefinitionId: cablePartDefinitionId,
        conductorAreaOrGauge: knownProperty(cableGauge, 'AWG'),
        material: knownProperty(cableMaterial, null),
        strandConstruction: unknownProperty(),
        insulation: unknownProperty(),
        color: unknownProperty(),
        stripe: unknownProperty(),
        minimumTemperature: unknownProperty(),
        maximumTemperature: unknownProperty(),
        resistancePerLength: unknownProperty(),
        applicableCurrentData: unknownProperty()
      }
    });
  }
</script>

<section class="harness-lens">
  <p>Physical wire construction without inferred consumption</p>
  <h2>Harnesses & Bundles</h2>
  <div class="boundary">
    <strong>{wires.length}</strong><span>two-ended Wires available for explicit grouping</span>
  </div>

  <details open>
    <summary>Group current Wires into a Harness</summary>
    <div class="authoring-grid">
      <label
        ><span>Harness label</span><input bind:value={harnessLabel} disabled={!canAuthor} /></label
      >
      <p class="boundary-copy">
        Includes every current Wire and Connector in this electrical construction snapshot.
      </p>
      <button type="button" disabled={!canAuthor || wires.length === 0} onclick={configureHarness}
        >Create Harness</button
      >
    </div>
  </details>

  <details open>
    <summary>Record Bundle construction</summary>
    <div class="authoring-grid">
      <label>
        <span>Harness</span>
        <select bind:value={harnessId} disabled={!canAuthor}>
          <option value="">Choose Harness</option>
          {#each snapshot.electrical.harnesses as harness (harness.id)}<option value={harness.id}
              >{harness.label}</option
            >{/each}
        </select>
      </label>
      <label
        ><span>Bundle label</span><input bind:value={bundleLabel} disabled={!canAuthor} /></label
      >
      <label
        ><span>Covering description</span><input
          bind:value={coveringDescription}
          disabled={!canAuthor}
        /></label
      >
      <label>
        <span>Covering Part Definition</span>
        <select bind:value={coveringPartDefinitionId} disabled={!canAuthor}>
          <option value="">Not assigned</option>
          {#each snapshot.partDefinitions as definition (definition.id)}<option
              value={definition.id}>{definition.label}</option
            >{/each}
        </select>
      </label>
      <label
        ><span>Twisted-pair shield</span><input bind:value={shield} disabled={!canAuthor} /></label
      >
      <label>
        <span>Drain Wire</span>
        <select bind:value={drainWireConnectionId} disabled={!canAuthor}>
          <option value="">No drain Wire</option>
          {#each wires as wire (wire.id)}<option value={wire.id}>{wire.label}</option>{/each}
        </select>
      </label>
      <label
        ><span>Twist Cut Length allowance (m)</span><input
          bind:value={twistAllowance}
          inputmode="decimal"
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Concentric pitch (mm)</span><input
          bind:value={pitch}
          inputmode="decimal"
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Concentric Cut Length allowance (m)</span><input
          bind:value={concentricAllowance}
          inputmode="decimal"
          disabled={!canAuthor}
        /></label
      >
      <label>
        <span>Lay direction</span>
        <select bind:value={layDirection} disabled={!canAuthor}
          ><option value="left">Left</option><option value="right">Right</option></select
        >
      </label>
      <label class="wide"
        ><span>Construction notes</span><input
          bind:value={constructionNotes}
          disabled={!canAuthor}
        /></label
      >
      <p class="boundary-copy">
        Allowances remain sourced or user-entered; this view performs no twist or lay-consumption
        calculation.
      </p>
      <button type="button" disabled={!canAuthor || !harnessId} onclick={configureBundle}
        >Record Bundle construction</button
      >
    </div>
  </details>

  <details>
    <summary>Record cable evidence</summary>
    <div class="authoring-grid">
      <label>
        <span>Cable Part Definition</span>
        <select bind:value={cablePartDefinitionId} disabled={!canAuthor}>
          <option value="">Choose Part Definition</option>
          {#each snapshot.partDefinitions as definition (definition.id)}<option
              value={definition.id}>{definition.label}</option
            >{/each}
        </select>
      </label>
      <label
        ><span>Conductor area or gauge</span><input
          bind:value={cableGauge}
          disabled={!canAuthor}
        /></label
      >
      <label><span>Material</span><input bind:value={cableMaterial} disabled={!canAuthor} /></label>
      <label
        ><span>Evidence provenance</span><input
          bind:value={cableProvenance}
          disabled={!canAuthor}
        /></label
      >
      <p class="boundary-copy">
        Unentered strand, insulation, color, stripe, temperature, resistance, and current data
        remain Unknown.
      </p>
      <button
        type="button"
        disabled={!canAuthor || !cablePartDefinitionId}
        onclick={recordCableEvidence}>Record cable specification</button
      >
    </div>
  </details>

  <div class="construction-register">
    {#each snapshot.electrical.harnesses as harness (harness.id)}
      <article>
        <strong>{harness.label}</strong><span
          >{harness.wireConnectionIds.length} Wires · {harness.componentIds.length} Connectors</span
        >
      </article>
    {/each}
    {#each snapshot.electrical.bundles as bundle (bundle.id)}
      <article>
        <strong>{bundle.label}</strong>
        <span
          >{bundle.segmentIds.length} Segments · {bundle.coverings.length} coverings · {bundle
            .twistedPairs.length} twisted pairs · {bundle.concentric?.layers.length ?? 0} concentric Layers</span
        >
      </article>
    {:else}
      <p class="empty">No Bundle record yet. Grouping never changes electrical continuity.</p>
    {/each}
  </div>
</section>

<style>
  .harness-lens > p,
  summary,
  label span {
    margin: 0;
    color: #5d716f;
    font: 0.62rem var(--font-mono);
    text-transform: uppercase;
  }
  h2 {
    margin: 0.15rem 0 1rem;
    color: #173d3f;
    font: 2rem var(--font-display);
  }
  .boundary {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    margin-bottom: 0.65rem;
    padding: 0.75rem;
    border: 1px solid #cbd8d3;
    background: #f9faf7;
  }
  .boundary strong {
    color: #a6532f;
    font: 2rem var(--font-display);
  }
  .boundary span {
    color: #526866;
  }
  details {
    margin-bottom: 0.55rem;
    border: 1px solid #cbd8d3;
    background: #f8faf7;
  }
  summary {
    padding: 0.7rem;
    color: #28504f;
    cursor: pointer;
    font-weight: 700;
  }
  .authoring-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(9rem, 1fr));
    gap: 0.55rem;
    padding: 0 0.7rem 0.7rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  input,
  select,
  button {
    min-height: 2.75rem;
    border: 1px solid #9bb3ac;
    border-radius: 0.3rem;
  }
  input,
  select {
    width: 100%;
    padding: 0.42rem 0.5rem;
    background: #fff;
    color: #203e40;
  }
  button {
    padding: 0.42rem 0.65rem;
    background: #234d4c;
    color: #fff;
    cursor: pointer;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }
  .wide,
  .boundary-copy {
    grid-column: span 2;
  }
  .boundary-copy {
    align-self: end;
    margin: 0;
    color: #5f7471;
    font-size: 0.68rem;
    line-height: 1.4;
    text-transform: none;
  }
  .construction-register {
    display: grid;
    gap: 0.45rem;
    margin-top: 0.75rem;
  }
  article {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.7rem;
    border: 1px solid #cbd8d3;
    background: #f9faf7;
  }
  article span {
    color: #687a79;
    font: 0.62rem var(--font-mono);
  }
  .empty {
    padding: 0.8rem;
    border-left: 3px solid #9db4ad;
    line-height: 1.5;
    text-transform: none;
  }
  @media (max-width: 60rem) {
    .authoring-grid {
      grid-template-columns: 1fr;
    }
    .wide,
    .boundary-copy {
      grid-column: auto;
    }
  }
</style>
