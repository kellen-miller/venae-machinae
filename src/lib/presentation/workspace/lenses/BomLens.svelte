<script lang="ts">
  import { aggregateProjectBom } from '../../../build/build-record';

  import type { ProcurementMethod } from '../../../build/build-record';
  import type { ProjectOutputKind } from '../../../reporting/generate-output';
  import type { ProjectAction } from '../../../project/action';
  import type { ProjectSnapshot } from '../../../project/project';

  let {
    snapshot,
    canAuthor,
    onaction,
    onoutput
  }: {
    snapshot: ProjectSnapshot;
    canAuthor: boolean;
    onaction: (action: ProjectAction) => boolean;
    onoutput: (kind: ProjectOutputKind) => Promise<void>;
  } = $props();

  const bom = $derived(aggregateProjectBom(snapshot));
  const installationSubjects = $derived([
    ...snapshot.topology.components.map((component) => ({
      id: component.id,
      label: `${component.label} · Component`
    })),
    ...snapshot.topology.connections.map((connection) => ({
      id: connection.id,
      label: `${connection.label} · Connection`
    })),
    ...snapshot.tombstones.map((tombstone) => ({
      id: tombstone.subjectId,
      label: `${tombstone.subjectId} · historical predecessor`
    }))
  ]);

  let procurementPartDefinitionId = $state('');
  let procurementVariant = $state('');
  let procurementUnit = $state('ea');
  let purchasedQuantity = $state('1');
  let procurementMethod = $state<ProcurementMethod>('exact');
  let packageSize = $state('');
  let sparePercent = $state('');
  let wasteQuantity = $state('');
  let consumableQuantity = $state('');
  let procurementNote = $state('');
  let procurementProvenance = $state('');

  let installationSubjectId = $state('');
  let installationStatus = $state<'planned' | 'installed' | 'removed'>('installed');
  let installedPartDefinitionId = $state('');
  let installedVariant = $state('');
  let installedQuantity = $state('1');
  let installedUnit = $state('ea');
  let measuredEvidenceId = $state('');
  let observationEvidenceId = $state('');
  let installationPhotoHash = $state('');
  let recordSubstitution = $state(false);
  let intendedPartDefinitionId = $state('');
  let substitutionReason = $state('');
  let installationNotes = $state('');
  let installationProvenance = $state('');

  function optionalDecimal(value: string): string | null {
    return value.trim() || null;
  }

  function addProcurementChoice(): void {
    if (
      !procurementPartDefinitionId ||
      !procurementVariant.trim() ||
      !procurementUnit.trim() ||
      !purchasedQuantity.trim() ||
      !procurementNote.trim() ||
      !procurementProvenance.trim()
    ) {
      return;
    }

    if (
      onaction({
        type: 'set-procurement-choice',
        causationId: crypto.randomUUID(),
        choice: {
          id: crypto.randomUUID(),
          partDefinitionId: procurementPartDefinitionId,
          variant: procurementVariant.trim(),
          unit: procurementUnit.trim(),
          purchasedQuantity: purchasedQuantity.trim(),
          method: procurementMethod,
          packageSize: optionalDecimal(packageSize),
          sparePercent: optionalDecimal(sparePercent),
          wasteQuantity: optionalDecimal(wasteQuantity),
          consumableQuantity: optionalDecimal(consumableQuantity),
          note: procurementNote.trim(),
          provenance: procurementProvenance.trim()
        }
      })
    ) {
      procurementNote = '';
      procurementProvenance = '';
    }
  }

  function addInstallation(): void {
    if (
      !installationSubjectId ||
      !installedQuantity.trim() ||
      !installedUnit.trim() ||
      !installationProvenance.trim() ||
      (installationStatus === 'installed' &&
        (!installedPartDefinitionId || !installedVariant.trim())) ||
      (measuredEvidenceId !== '' && measuredEvidenceId === observationEvidenceId) ||
      (recordSubstitution &&
        (!intendedPartDefinitionId || !installedPartDefinitionId || !substitutionReason.trim()))
    ) {
      return;
    }

    if (
      onaction({
        type: 'record-installation',
        causationId: crypto.randomUUID(),
        installation: {
          id: crypto.randomUUID(),
          subjectId: installationSubjectId,
          status: installationStatus,
          installedPartDefinitionId: installedPartDefinitionId || null,
          installedVariant: installedVariant.trim() || null,
          quantity: installedQuantity.trim(),
          unit: installedUnit.trim(),
          measuredEvidenceIds: measuredEvidenceId ? [measuredEvidenceId] : [],
          observationEvidenceIds: observationEvidenceId ? [observationEvidenceId] : [],
          substitution: recordSubstitution
            ? {
                intendedPartDefinitionId,
                installedPartDefinitionId,
                reason: substitutionReason.trim()
              }
            : null,
          photoAssetHashes: installationPhotoHash ? [installationPhotoHash] : [],
          notes: installationNotes.trim(),
          recordedAt: new Date().toISOString(),
          provenance: installationProvenance.trim()
        }
      })
    ) {
      installedVariant = '';
      installationNotes = '';
      installationProvenance = '';
      substitutionReason = '';
    }
  }
</script>

<section class="bom-lens">
  <p>Demand derives from explicit project records</p>
  <h2>BOM</h2>
  <div class="output-actions" aria-label="Revision-locked output actions">
    <button type="button" onclick={() => onoutput('print')}>Preview printable report</button>
    <button type="button" onclick={() => onoutput('csv')}>Download BOM CSV</button>
    <button type="button" onclick={() => onoutput('zip')}>Download Export All ZIP</button>
    <button type="button" onclick={() => onoutput('validation')}>Download Validation Report</button>
    <button type="button" onclick={() => onoutput('project-json')}
      >Download round-trip Project JSON</button
    >
  </div>

  <div class="record-summary">
    {snapshot.build.procurementChoices.length} procurement choices ·
    {snapshot.build.installations.length} installation records
  </div>

  <h3>Exact design demand</h3>
  <ul class="bom-lines">
    {#each bom as line (line.id)}
      <li>
        <div>
          <strong>{line.label}</strong>
          <small
            >{line.variant || 'base definition'} · {line.consumingSubjectIds.length} consumers</small
          >
          {#each line.procurementChoices as choice (choice.id)}
            <small class="choice">{choice.purchasedQuantity} {choice.unit} · {choice.method}</small>
          {/each}
        </div>
        <span>{line.exactDemand} {line.unit}</span>
      </li>
    {:else}
      <li><strong>No Part Requirements</strong><span>No hidden catalog demand.</span></li>
    {/each}
  </ul>

  <section class="build-register" aria-labelledby="procurement-heading">
    <div>
      <p>Explicit choice; never inferred</p>
      <h3 id="procurement-heading">Procurement</h3>
      <ul class="record-list">
        {#each snapshot.build.procurementChoices as choice (choice.id)}
          <li>
            <strong
              >{snapshot.partDefinitions.find(
                (definition) => definition.id === choice.partDefinitionId
              )?.label ?? choice.partDefinitionId}</strong
            >
            <span>{choice.purchasedQuantity} {choice.unit} · {choice.method}</span>
            <small>{choice.variant} · {choice.provenance}</small>
          </li>
        {:else}
          <li><small>No explicit procurement choices.</small></li>
        {/each}
      </ul>
    </div>

    <form onsubmit={(event) => event.preventDefault()}>
      <label>
        <span>Part Definition</span>
        <select
          aria-label="Procurement Part Definition"
          bind:value={procurementPartDefinitionId}
          disabled={!canAuthor}
        >
          <option value="">Choose definition</option>
          {#each snapshot.partDefinitions as definition (definition.id)}
            <option value={definition.id}>{definition.label} · r{definition.revision}</option>
          {/each}
        </select>
      </label>
      <label
        ><span>Variant</span><input
          aria-label="Procurement variant"
          bind:value={procurementVariant}
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Purchased quantity</span><input
          bind:value={purchasedQuantity}
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Unit</span><input
          aria-label="Procurement unit"
          bind:value={procurementUnit}
          disabled={!canAuthor}
        /></label
      >
      <label>
        <span>Method</span>
        <select
          aria-label="Procurement method"
          bind:value={procurementMethod}
          disabled={!canAuthor}
        >
          <option value="exact">Exact</option>
          <option value="package">Package</option>
          <option value="spool">Spool</option>
          <option value="spares">Spares</option>
          <option value="waste">Waste</option>
          <option value="consumable">Consumable</option>
        </select>
      </label>
      <label
        ><span>Package size</span><input bind:value={packageSize} disabled={!canAuthor} /></label
      >
      <label
        ><span>Spare percent</span><input bind:value={sparePercent} disabled={!canAuthor} /></label
      >
      <label
        ><span>Waste quantity</span><input
          bind:value={wasteQuantity}
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Consumable quantity</span><input
          bind:value={consumableQuantity}
          disabled={!canAuthor}
        /></label
      >
      <label class="wide"
        ><span>Note</span><input
          aria-label="Procurement note"
          bind:value={procurementNote}
          disabled={!canAuthor}
        /></label
      >
      <label class="wide"
        ><span>Provenance</span><input
          aria-label="Procurement provenance"
          bind:value={procurementProvenance}
          disabled={!canAuthor}
        /></label
      >
      <button
        type="button"
        disabled={!canAuthor ||
          !procurementPartDefinitionId ||
          !procurementVariant.trim() ||
          !procurementNote.trim() ||
          !procurementProvenance.trim()}
        onclick={addProcurementChoice}>Record procurement choice</button
      >
    </form>
  </section>

  <section class="build-register" aria-labelledby="installation-heading">
    <div>
      <p>As-built evidence on retained identity</p>
      <h3 id="installation-heading">Installation</h3>
      <ul class="record-list">
        {#each snapshot.build.installations as installation (installation.id)}
          <li>
            <strong>{installation.installedVariant ?? 'Product not yet recorded'}</strong>
            <span>{installation.status} · {installation.quantity} {installation.unit}</span>
            <small>{installation.subjectId} · {installation.provenance}</small>
          </li>
        {:else}
          <li><small>No installation records.</small></li>
        {/each}
      </ul>
    </div>

    <form onsubmit={(event) => event.preventDefault()}>
      <label class="wide">
        <span>Topology subject</span>
        <select
          aria-label="Installation subject"
          bind:value={installationSubjectId}
          disabled={!canAuthor}
        >
          <option value="">Choose subject</option>
          {#each installationSubjects as subject (subject.id)}
            <option value={subject.id}>{subject.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select
          aria-label="Installation status"
          bind:value={installationStatus}
          disabled={!canAuthor}
        >
          <option value="planned">Planned</option>
          <option value="installed">Installed</option>
          <option value="removed">Removed</option>
        </select>
      </label>
      <label>
        <span>Installed Part Definition</span>
        <select
          aria-label="Installed Part Definition"
          bind:value={installedPartDefinitionId}
          disabled={!canAuthor}
        >
          <option value="">Not recorded</option>
          {#each snapshot.partDefinitions as definition (definition.id)}
            <option value={definition.id}>{definition.label} · r{definition.revision}</option>
          {/each}
        </select>
      </label>
      <label
        ><span>Installed variant</span><input
          bind:value={installedVariant}
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Quantity</span><input
          aria-label="Installed quantity"
          bind:value={installedQuantity}
          disabled={!canAuthor}
        /></label
      >
      <label
        ><span>Unit</span><input
          aria-label="Installed unit"
          bind:value={installedUnit}
          disabled={!canAuthor}
        /></label
      >
      <label>
        <span>Measured evidence</span>
        <select
          aria-label="Measured evidence"
          bind:value={measuredEvidenceId}
          disabled={!canAuthor}
        >
          <option value="">None</option>
          {#each snapshot.evidence as evidence (evidence.id)}
            <option value={evidence.id}>{evidence.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Observation evidence</span>
        <select
          aria-label="Observation evidence"
          bind:value={observationEvidenceId}
          disabled={!canAuthor}
        >
          <option value="">None</option>
          {#each snapshot.evidence as evidence (evidence.id)}
            <option value={evidence.id}>{evidence.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Photo asset</span>
        <select
          aria-label="Installation photo"
          bind:value={installationPhotoHash}
          disabled={!canAuthor}
        >
          <option value="">None</option>
          {#each snapshot.assetHashes as hash (hash)}
            <option value={hash}>{hash.slice(0, 12)}…</option>
          {/each}
        </select>
      </label>
      <label class="checkbox wide">
        <input type="checkbox" bind:checked={recordSubstitution} disabled={!canAuthor} />
        <span>Record substitution</span>
      </label>
      {#if recordSubstitution}
        <label>
          <span>Intended Part Definition</span>
          <select bind:value={intendedPartDefinitionId} disabled={!canAuthor}>
            <option value="">Choose definition</option>
            {#each snapshot.partDefinitions as definition (definition.id)}
              <option value={definition.id}>{definition.label}</option>
            {/each}
          </select>
        </label>
        <label class="wide"
          ><span>Substitution reason</span><input
            bind:value={substitutionReason}
            disabled={!canAuthor}
          /></label
        >
      {/if}
      <label class="wide"
        ><span>Notes</span><input
          aria-label="Installation notes"
          bind:value={installationNotes}
          disabled={!canAuthor}
        /></label
      >
      <label class="wide"
        ><span>Provenance</span><input
          aria-label="Installation provenance"
          bind:value={installationProvenance}
          disabled={!canAuthor}
        /></label
      >
      <button
        type="button"
        disabled={!canAuthor ||
          !installationSubjectId ||
          !installationProvenance.trim() ||
          (installationStatus === 'installed' &&
            (!installedPartDefinitionId || !installedVariant.trim()))}
        onclick={addInstallation}>Record installation</button
      >
    </form>
  </section>
</section>

<style>
  .bom-lens > p,
  .build-register p {
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

  h3 {
    margin: 1rem 0 0.55rem;
    color: #254948;
    font: 1.05rem var(--font-display);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .bom-lines {
    display: grid;
    gap: 0.4rem;
  }

  .bom-lines li {
    display: flex;
    justify-content: space-between;
    padding: 0.7rem;
    border-bottom: 1px solid #d5dfdb;
  }

  .bom-lines li > div,
  .record-list li {
    display: grid;
  }

  .bom-lines span,
  .record-list span {
    color: #a6532f;
    font: 0.72rem var(--font-mono);
  }

  small {
    color: #5d716f;
    font: 0.62rem var(--font-mono);
  }

  small.choice {
    margin-top: 0.15rem;
    color: #326762;
  }

  .record-summary {
    padding: 0.55rem 0.7rem;
    border: 1px solid #c3d0ca;
    background: #eef3ed;
    color: #254948;
    font: 0.68rem var(--font-mono);
  }

  .output-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-bottom: 1.1rem;
    padding: 0.7rem;
    border: 1px solid #c3d0ca;
    border-left: 0.25rem solid #a6532f;
    background: #eef3ed;
  }

  .output-actions button,
  form button {
    min-height: 2.35rem;
    padding: 0.4rem 0.65rem;
    border: 1px solid #9db0a9;
    border-radius: 0.3rem;
    background: #fafbf7;
    color: #254948;
    cursor: pointer;
  }

  .output-actions button:first-child,
  form button {
    border-color: #a6532f;
    background: #a6532f;
    color: #fffaf3;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .build-register {
    display: grid;
    grid-template-columns: minmax(14rem, 0.42fr) minmax(22rem, 1fr);
    gap: 1rem;
    margin-top: 1.2rem;
    padding-top: 1rem;
    border-top: 1px solid #c3d0ca;
  }

  .record-list {
    display: grid;
    gap: 0.4rem;
  }

  .record-list li {
    gap: 0.12rem;
    padding: 0.55rem;
    border: 1px solid #d5dfdb;
    background: #f6f8f4;
  }

  form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    padding: 0.75rem;
    border: 1px solid #c3d0ca;
    background: #f6f8f4;
  }

  label {
    display: grid;
    gap: 0.2rem;
    color: #526865;
    font: 0.6rem var(--font-mono);
  }

  label.wide,
  form button {
    grid-column: 1 / -1;
  }

  label.checkbox {
    display: flex;
    align-items: center;
  }

  input,
  select {
    min-width: 0;
    min-height: 2.25rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid #9db0a9;
    border-radius: 0.25rem;
    background: #fff;
    color: #173d3f;
  }

  @media (max-width: 900px) {
    .build-register {
      grid-template-columns: 1fr;
    }
  }
</style>
