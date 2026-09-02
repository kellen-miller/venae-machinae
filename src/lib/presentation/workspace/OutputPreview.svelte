<script lang="ts">
  import type { PrintableReport } from '../../reporting/generate-output';

  let { report, onclose }: { report: PrintableReport; onclose: () => void } = $props();
</script>

<div class="report-backdrop" role="dialog" aria-modal="true" aria-label="Printable Project Report">
  <article class="report-paper">
    <header>
      <div>
        <span>Venae Machinae · revision-locked output</span>
        <h1>{report.metadata.projectName}</h1>
        <p>
          Revision {report.metadata.projectRevision} · {report.metadata.revisionState} ·
          {report.metadata.generatedAt}
        </p>
      </div>
      <div class="report-actions">
        <button type="button" onclick={() => window.print()}>Print report</button>
        <button type="button" aria-label="Close print preview" onclick={onclose}>Close</button>
      </div>
    </header>

    <dl class="report-metadata">
      <div>
        <dt>View</dt>
        <dd>{report.metadata.view}</dd>
      </div>
      <div>
        <dt>Operating State</dt>
        <dd>{report.metadata.operatingState?.name ?? 'None selected'}</dd>
      </div>
      <div>
        <dt>Filters</dt>
        <dd>
          {report.metadata.filters.domain} · {report.metadata.filters.systemId ?? 'all systems'}
        </dd>
      </div>
      <div>
        <dt>Overlay Channels</dt>
        <dd>{report.metadata.overlayChannels.join(', ') || 'None'}</dd>
      </div>
      <div>
        <dt>Units</dt>
        <dd>{report.metadata.unitSystem}</dd>
      </div>
      <div>
        <dt>Pagination</dt>
        <dd>{report.metadata.pagination}</dd>
      </div>
    </dl>

    <section>
      <h2>Legend</h2>
      <ul class="compact-list">
        {#each report.metadata.legend as item (item)}
          <li>{item}</li>
        {:else}
          <li>No overlay legend applies.</li>
        {/each}
      </ul>
    </section>

    <section>
      <h2>BOM · exact design demand</h2>
      <table>
        <thead>
          <tr><th>Part / variant</th><th>Demand</th><th>Consumers</th><th>Procurement</th></tr>
        </thead>
        <tbody>
          {#each report.bom as line (line.id)}
            <tr>
              <td
                ><strong>{line.label}</strong><small>{line.variant || 'base definition'}</small></td
              >
              <td>{line.exactDemand} {line.unit}</td>
              <td>{line.consumingSubjectIds.join(', ')}</td>
              <td>
                {line.procurementChoices
                  .map((choice) => `${choice.purchasedQuantity} ${choice.unit} · ${choice.method}`)
                  .join('; ') || 'No explicit choice'}
              </td>
            </tr>
          {:else}
            <tr><td colspan="4">No Part Requirements in this revision.</td></tr>
          {/each}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Visible Findings</h2>
      <ul class="findings">
        {#each report.visibleFindings as finding (finding.id)}
          <li>
            <strong>{finding.severity} · {finding.disposition.kind}</strong>
            <span>{finding.claim}</span>
          </li>
        {:else}
          <li><strong>None visible</strong><span>No active Finding is in this revision.</span></li>
        {/each}
      </ul>
    </section>

    <footer>
      <span>Provenance summary</span>
      <p>{report.metadata.provenanceSummary.join('; ') || 'No provenance recorded.'}</p>
      <small
        >Page footer · Project {report.metadata.projectId} · Revision {report.metadata
          .projectRevision}</small
      >
    </footer>
  </article>
</div>

<style>
  .report-backdrop {
    position: fixed;
    z-index: 30;
    inset: 0;
    overflow: auto;
    padding: 2rem;
    background: rgb(15 37 38 / 76%);
    backdrop-filter: blur(12px);
  }

  .report-paper {
    width: min(70rem, 100%);
    min-height: 88rem;
    margin: 0 auto;
    padding: clamp(1.5rem, 4vw, 4.5rem);
    border-top: 0.5rem solid #173f41;
    background: #fbfaf4;
    color: #213638;
    box-shadow: 0 2rem 6rem rgb(0 0 0 / 35%);
  }

  header {
    display: flex;
    gap: 2rem;
    justify-content: space-between;
    align-items: start;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #9aacaa;
  }

  header span,
  dt,
  footer span,
  footer small {
    color: #a34f2d;
    font: 0.68rem var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0.3rem 0;
    color: #173f41;
    font: clamp(2.4rem, 6vw, 4.4rem) / 0.95 var(--font-display);
  }

  header p,
  footer p {
    margin: 0;
    font: 0.76rem var(--font-mono);
  }

  .report-actions {
    display: flex;
    gap: 0.45rem;
  }

  button {
    min-height: 2.5rem;
    padding: 0.45rem 0.8rem;
    border: 1px solid #7e9894;
    border-radius: 0.25rem;
    background: #eef2ec;
    color: #173f41;
    cursor: pointer;
  }

  button:first-child {
    border-color: #a34f2d;
    background: #a34f2d;
    color: #fffaf0;
  }

  .report-metadata {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin: 1.5rem 0 2.5rem;
  }

  .report-metadata div {
    padding: 0.75rem 0;
    border-bottom: 1px solid #d8ded8;
  }

  dt,
  dd {
    margin: 0;
  }

  dd {
    margin-top: 0.2rem;
    font: 0.78rem var(--font-mono);
  }

  section {
    margin-top: 2.5rem;
  }

  h2 {
    margin: 0 0 0.8rem;
    color: #173f41;
    font: 1.8rem var(--font-display);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  th,
  td {
    padding: 0.7rem 0.55rem;
    border-bottom: 1px solid #cbd5ce;
    text-align: left;
    vertical-align: top;
  }

  th {
    color: #6b7c7a;
    font: 0.62rem var(--font-mono);
    text-transform: uppercase;
  }

  td small {
    display: block;
    color: #6b7c7a;
  }

  .compact-list,
  .findings {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .compact-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .compact-list li {
    padding: 0.35rem 0.55rem;
    border: 1px solid #b8c6be;
    font: 0.7rem var(--font-mono);
  }

  .findings li {
    display: grid;
    grid-template-columns: 12rem 1fr;
    gap: 1rem;
    padding: 0.7rem 0;
    border-bottom: 1px solid #cbd5ce;
  }

  .findings strong {
    color: #a34f2d;
    text-transform: capitalize;
  }

  footer {
    margin-top: 4rem;
    padding-top: 1rem;
    border-top: 2px solid #173f41;
  }

  footer small {
    display: block;
    margin-top: 2rem;
    color: #6b7c7a;
  }

  @media (max-width: 46rem) {
    .report-backdrop {
      padding: 0;
    }

    .report-paper {
      min-height: 100%;
      padding: 1.2rem;
    }

    header {
      display: grid;
    }

    .report-metadata {
      grid-template-columns: 1fr;
    }

    .findings li {
      grid-template-columns: 1fr;
    }
  }

  @media print {
    :global(body *) {
      visibility: hidden;
    }

    .report-backdrop,
    .report-backdrop * {
      visibility: visible;
    }

    .report-backdrop {
      position: absolute;
      inset: 0;
      padding: 0;
      background: white;
    }

    .report-paper {
      width: 100%;
      min-height: 0;
      padding: 0;
      box-shadow: none;
    }

    .report-actions {
      display: none;
    }

    thead {
      display: table-header-group;
    }

    tr {
      break-inside: avoid;
    }
  }
</style>
