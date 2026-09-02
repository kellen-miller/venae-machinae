<script lang="ts">
  import type { ProjectAction } from '../../../project/action';
  import type { Finding } from '../../../validation/finding';

  let {
    finding,
    canAuthor,
    onaction
  }: {
    finding: Finding;
    canAuthor: boolean;
    onaction: (action: ProjectAction) => boolean;
  } = $props();

  let rationale = $state('');
  let applicability = $state<'excluded' | 'not-applicable'>('excluded');
  let applicabilityRationale = $state('');
  let applicabilityEvidence = $state('');

  function recordDisposition(type: 'acknowledge-finding' | 'suppress-finding'): void {
    if (!rationale.trim()) return;
    const accepted = onaction({
      type,
      causationId: crypto.randomUUID(),
      findingId: finding.id,
      rationale
    });
    if (accepted) rationale = '';
  }

  function recordApplicability(): void {
    if (!applicabilityRationale.trim()) return;
    const accepted = onaction({
      type: 'set-validation-applicability',
      causationId: crypto.randomUUID(),
      decision: {
        ruleId: finding.ruleId,
        subjectId: finding.subjectId,
        scopeKey: finding.scopeKey,
        classification: applicability,
        rationale: applicabilityRationale,
        evidenceIds: applicabilityEvidence
          .split(',')
          .map((evidenceId) => evidenceId.trim())
          .filter(Boolean)
      }
    });
    if (accepted) {
      applicabilityRationale = '';
      applicabilityEvidence = '';
    }
  }
</script>

<article
  class:resolved={finding.lifecycle === 'resolved'}
  data-severity={finding.severity}
  aria-label={`${finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1)} Finding for ${finding.subjectId}`}
>
  <header>
    <div>
      <span>{finding.severity} · {finding.evaluation}</span>
      <strong>{finding.subjectId}</strong>
    </div>
    <output>{finding.lifecycle}</output>
  </header>

  <div class="finding-fields">
    <section>
      <h3>Claim</h3>
      <p>{finding.claim}</p>
    </section>
    <section>
      <h3>Severity rationale</h3>
      <p>{finding.severityRationale}</p>
    </section>
    <section>
      <h3>Known evidence</h3>
      <p>{finding.knownEvidence.join(' · ') || 'No known evidence recorded'}</p>
    </section>
    <section>
      <h3>Unknown evidence</h3>
      <p>{finding.unknownEvidence.join(' · ') || 'No unknown evidence recorded'}</p>
    </section>
    <section>
      <h3>Affected operation</h3>
      <p>{finding.affectedOperation}</p>
    </section>
    <section>
      <h3>Inputs</h3>
      <p>{finding.inputIds.join(' · ') || 'No explicit inputs'}</p>
    </section>
    <section>
      <h3>Assumptions</h3>
      <p>{finding.assumptions.join(' · ') || 'No assumptions recorded'}</p>
    </section>
    <section>
      <h3>Rule revision</h3>
      <p>{finding.ruleId} · r{finding.ruleRevision}</p>
    </section>
    <section>
      <h3>Trace</h3>
      <p>
        scope {finding.scopeKey} · evidence {finding.trace.evidenceIds.join(', ') || 'none'} · results
        {finding.trace.resultIds.join(', ') || 'none'}
      </p>
    </section>
    <section>
      <h3>Disposition</h3>
      <p>
        {finding.disposition.kind}{finding.disposition.kind === 'unreviewed'
          ? ''
          : ` · ${finding.disposition.rationale}`}
      </p>
    </section>
    <section>
      <h3>Recurrence</h3>
      <p>
        occurrence {finding.occurrences.at(-1)?.number ?? 1} · opened revision
        {finding.occurrences.at(-1)?.openedAtRevision ?? 'unknown'}
      </p>
    </section>
    <section>
      <h3>Corrective actions</h3>
      <ul>
        {#each finding.correctiveActions as action (action)}<li>{action}</li>{/each}
      </ul>
    </section>
  </div>

  {#if finding.lifecycle === 'active'}
    <div class="review-controls">
      <label>Review rationale <input bind:value={rationale} disabled={!canAuthor} /></label>
      <div>
        <button
          type="button"
          disabled={!canAuthor || !rationale.trim()}
          onclick={() => recordDisposition('acknowledge-finding')}>Acknowledge Finding</button
        >
        <button
          type="button"
          disabled={!canAuthor || finding.severity === 'blocker' || !rationale.trim()}
          onclick={() => recordDisposition('suppress-finding')}>Suppress Finding</button
        >
      </div>
      {#if finding.severity === 'blocker'}
        <small>Blockers cannot be suppressed; only reevaluation can resolve them.</small>
      {/if}
    </div>

    <details>
      <summary>Applicability decision</summary>
      <div class="applicability-controls">
        <label>
          Classification
          <select bind:value={applicability} disabled={!canAuthor}>
            <option value="excluded">Excluded</option>
            <option value="not-applicable">Not applicable</option>
          </select>
        </label>
        <label>Rationale <input bind:value={applicabilityRationale} disabled={!canAuthor} /></label>
        <label>
          Evidence IDs, comma separated
          <input bind:value={applicabilityEvidence} disabled={!canAuthor} />
        </label>
        <button
          type="button"
          disabled={!canAuthor || !applicabilityRationale.trim() || !applicabilityEvidence.trim()}
          onclick={recordApplicability}>Record applicability decision</button
        >
      </div>
    </details>
  {/if}
</article>

<style>
  article {
    overflow: hidden;
    border: 1px solid #bcc9c4;
    border-left: 0.3rem solid #947327;
    border-radius: 0.7rem 0.18rem 0.7rem 0.18rem;
    background: #fbfcf7;
  }
  article[data-severity='blocker'] {
    border-left-color: #993b35;
  }
  article[data-severity='warning'] {
    border-left-color: #b45d32;
  }
  article[data-severity='information'] {
    border-left-color: #337b78;
  }
  article.resolved {
    opacity: 0.72;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0.9rem;
    border-bottom: 1px solid #d5ded9;
    background: #edf2ec;
  }
  header div {
    display: grid;
    gap: 0.12rem;
  }
  header span,
  header output,
  h3,
  label,
  summary,
  small {
    font-family: var(--font-mono);
  }
  header span,
  header output {
    color: #667673;
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .finding-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .finding-fields section {
    min-width: 0;
    padding: 0.72rem 0.9rem;
    border-right: 1px solid #e0e6e2;
    border-bottom: 1px solid #e0e6e2;
  }
  h3,
  p,
  ul {
    margin: 0;
  }
  h3 {
    margin-bottom: 0.25rem;
    color: #9b4f2e;
    font-size: 0.58rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  p,
  li {
    overflow-wrap: anywhere;
    color: #344e4e;
    font-size: 0.72rem;
    line-height: 1.45;
  }
  ul {
    padding-left: 1rem;
  }
  .review-controls,
  .applicability-controls {
    display: grid;
    gap: 0.55rem;
    padding: 0.8rem 0.9rem;
    border-top: 1px solid #d5ded9;
    background: #f3f6f1;
  }
  .review-controls > div,
  .applicability-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  label {
    display: grid;
    gap: 0.25rem;
    color: #536765;
    font-size: 0.62rem;
  }
  input,
  select,
  button {
    min-height: 2.35rem;
    border: 1px solid #9dafaa;
    border-radius: 0.32rem;
    background: #fff;
    color: #264746;
    font: 0.7rem var(--font-mono);
  }
  input,
  select {
    padding: 0 0.55rem;
  }
  button {
    padding: 0.4rem 0.7rem;
    cursor: pointer;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  summary:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }
  small {
    color: #8b3d36;
    font-size: 0.6rem;
  }
  details {
    border-top: 1px solid #d5ded9;
  }
  summary {
    padding: 0.65rem 0.9rem;
    color: #536765;
    cursor: pointer;
    font-size: 0.63rem;
  }
  @media (max-width: 48rem) {
    .finding-fields,
    .review-controls > div,
    .applicability-controls {
      grid-template-columns: 1fr;
    }
  }
</style>
