<script lang="ts">
  import { REVIEW_PROFILES } from '../../../validation/rule-catalog';
  import FindingSummary from './FindingSummary.svelte';

  import type { ProjectAction } from '../../../project/action';
  import type { ProjectSnapshot } from '../../../project/project';
  import type { EvaluationScope } from '../../../session/project-session.svelte';

  let {
    snapshot,
    canAuthor,
    onaction,
    onvalidate
  }: {
    snapshot: ProjectSnapshot;
    canAuthor: boolean;
    onaction: (action: ProjectAction) => boolean;
    onvalidate: (scope: EvaluationScope) => void;
  } = $props();

  const validationResult = $derived(
    snapshot.results.find(
      (result) =>
        (result.status === 'current' || result.status === 'stale' || result.status === 'failed') &&
        result.detail?.type === 'validation'
    )
  );
  const history = $derived(
    validationResult?.detail?.type === 'validation' ? validationResult.detail.history : null
  );
  const findings = $derived(
    history?.findings.toSorted((left, right) =>
      `${left.lifecycle === 'active' ? '0' : '1'}:${left.severity}:${left.ruleId}:${left.subjectId}`.localeCompare(
        `${right.lifecycle === 'active' ? '0' : '1'}:${right.severity}:${right.ruleId}:${right.subjectId}`
      )
    ) ?? []
  );
  const displayedRun = $derived(
    history?.runs.find((run) => run.id === history.currentRunIds.at(-1)) ??
      history?.runs.toReversed().find((run) => run.coverage !== null) ??
      null
  );
  const coverage = $derived(displayedRun?.coverage ?? null);
</script>

<section class="findings-lens">
  <header class="lens-intro">
    <div>
      <p>Application-owned · local · versioned</p>
      <h2>Findings</h2>
      <span>Scoped corrective evidence, never a readiness or health score.</span>
    </div>
    <output data-validation-result-status={validationResult?.status ?? 'unevaluated'}>
      {validationResult?.status ?? 'unevaluated'}
    </output>
  </header>

  <div class="review-profiles" aria-label="Validation Review Profiles">
    {#each REVIEW_PROFILES as profile (profile.id)}
      <button
        type="button"
        onclick={() => onvalidate({ kind: 'review-profile', profileId: profile.id })}
        title={profile.description}>Run {profile.label}</button
      >
    {/each}
    <button type="button" class="validate-project" onclick={() => onvalidate({ kind: 'all' })}
      >Validate Project</button
    >
  </div>

  {#if coverage}
    <section class="coverage" aria-label="Validation Coverage">
      <header>
        <h3>Coverage accounting</h3>
        <span>{displayedRun?.scopeKey} · revision {displayedRun?.projectRevision}</span>
      </header>
      <dl>
        <div>
          <dt>Applicable</dt>
          <dd>{coverage.applicable}</dd>
        </div>
        <div>
          <dt>Evaluated</dt>
          <dd>{coverage.evaluated}</dd>
        </div>
        <div>
          <dt>Passed</dt>
          <dd>{coverage.passed}</dd>
        </div>
        <div>
          <dt>Active Finding</dt>
          <dd>{coverage.activeFinding}</dd>
        </div>
        <div>
          <dt>Unknown</dt>
          <dd>{coverage.unknown}</dd>
        </div>
        <div>
          <dt>Stale</dt>
          <dd>{coverage.stale}</dd>
        </div>
        <div>
          <dt>Unsupported</dt>
          <dd>{coverage.unsupported}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{coverage.failed}</dd>
        </div>
        <div>
          <dt>Excluded</dt>
          <dd>{coverage.excluded}</dd>
        </div>
        <div>
          <dt>Not applicable</dt>
          <dd>{coverage.notApplicable}</dd>
        </div>
      </dl>
    </section>
  {/if}

  <div class="finding-list">
    {#each findings as finding (finding.id)}
      <FindingSummary {finding} {canAuthor} {onaction} />
    {:else}
      <section class="empty-findings">
        <strong>No Findings in published runs</strong>
        <p>
          This is not a completeness, safety, readiness, or health claim. Run an explicit Review
          Profile for bounded completeness checks.
        </p>
      </section>
    {/each}
  </div>
</section>

<style>
  .findings-lens {
    display: grid;
    gap: 1rem;
  }
  .lens-intro {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }
  .lens-intro div {
    display: grid;
  }
  .lens-intro p,
  .lens-intro span,
  .lens-intro output,
  .coverage span,
  .coverage h3,
  dt,
  dd {
    font-family: var(--font-mono);
  }
  .lens-intro p,
  .lens-intro span {
    margin: 0;
    color: #687a77;
    font-size: 0.62rem;
  }
  .lens-intro p {
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  h2 {
    margin: 0.12rem 0 0.2rem;
    color: #173d3f;
    font: 2.2rem var(--font-display);
  }
  .lens-intro output {
    padding: 0.4rem 0.55rem;
    border: 1px solid #a9bbb5;
    border-radius: 0.25rem;
    color: #47615f;
    font-size: 0.62rem;
    text-transform: uppercase;
  }
  .review-profiles {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.4rem;
    padding: 0.55rem;
    border: 1px solid #b8c8c2;
    border-radius: 0.65rem 0.2rem 0.65rem 0.2rem;
    background: #e9efea;
  }
  .review-profiles button {
    min-height: 2.65rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid #9dafaa;
    border-radius: 0.32rem;
    background: #f9fbf7;
    color: #294a49;
    font: 0.64rem var(--font-mono);
    cursor: pointer;
  }
  .review-profiles .validate-project {
    border-color: #ac5b34;
    background: #254b4a;
    color: #f8eee7;
  }
  .review-profiles button:focus-visible {
    outline: 2px solid #d3612f;
    outline-offset: 2px;
  }
  .coverage {
    overflow: hidden;
    border: 1px solid #b8c8c2;
    border-radius: 0.65rem 0.2rem 0.65rem 0.2rem;
    background: #f8faf6;
  }
  .coverage header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0.7rem;
    border-bottom: 1px solid #d6dfda;
  }
  .coverage h3,
  .coverage span {
    margin: 0;
    color: #607370;
    font-size: 0.59rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin: 0;
  }
  dl div {
    display: grid;
    gap: 0.15rem;
    padding: 0.55rem 0.7rem;
    border-right: 1px solid #e0e6e2;
    border-bottom: 1px solid #e0e6e2;
  }
  dt {
    color: #6b7c79;
    font-size: 0.55rem;
    text-transform: uppercase;
  }
  dd {
    margin: 0;
    color: #234746;
    font-size: 1rem;
    font-weight: 800;
  }
  .finding-list {
    display: grid;
    gap: 0.75rem;
  }
  .empty-findings {
    padding: 1rem;
    border: 1px dashed #aabbb6;
    border-radius: 0.55rem;
    background: #f7faf5;
  }
  .empty-findings strong,
  .empty-findings p {
    margin: 0;
  }
  .empty-findings p {
    margin-top: 0.25rem;
    color: #687a77;
    font-size: 0.7rem;
  }
  @media (max-width: 65rem) {
    .review-profiles {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .review-profiles .validate-project {
      grid-column: 1 / -1;
    }
    dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 43.75rem) {
    .lens-intro {
      align-items: flex-start;
    }
    .review-profiles,
    dl {
      grid-template-columns: 1fr;
    }
  }
</style>
