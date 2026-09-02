// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import FindingsLens from '../../src/lib/presentation/workspace/lenses/FindingsLens.svelte';
import { createBlankProject } from '../../src/lib/project/project';

import type { ProjectSnapshot } from '../../src/lib/project/project';
import type { ValidationHistory } from '../../src/lib/validation/finding';

const history: ValidationHistory = {
  findings: [
    {
      id: 'finding:topology.interface-conflict:0123456789abcdef',
      ruleId: 'topology.interface-conflict',
      ruleRevision: 1,
      subjectId: 'wire-feed',
      scopeKey: 'incremental',
      claim: 'Fan feed has explicitly incompatible endpoint interfaces.',
      severity: 'warning',
      severityRationale: 'Warning records the direct conflict for this connection only.',
      evaluation: 'current',
      lifecycle: 'active',
      unknownReason: null,
      knownEvidence: ['source=ring-m6', 'target=blade-6.3'],
      unknownEvidence: [],
      affectedOperation: 'connection:wire-feed',
      inputIds: ['source-out', 'fan-in'],
      assumptions: ['no transition component is present'],
      trace: {
        ruleId: 'topology.interface-conflict',
        ruleRevision: 1,
        subjectId: 'wire-feed',
        scopeKey: 'incremental',
        inputIds: ['source-out', 'fan-in'],
        evidenceIds: ['evidence-interface'],
        resultIds: [],
        assumptions: ['no transition component is present'],
        tombstone: null
      },
      disposition: { kind: 'unreviewed' },
      occurrences: [
        {
          number: 1,
          openedAtRevision: 4,
          resolvedAtRevision: null,
          resolutionReason: null
        }
      ],
      correctiveActions: ['Select compatible endpoint interfaces.'],
      invalidationKey: 'fedcba9876543210'
    }
  ],
  runs: [
    {
      id: 'run-validation-4',
      projectRevision: 4,
      scope: { kind: 'incremental', subjectIds: ['wire-feed'] },
      scopeKey: 'incremental',
      profileId: null,
      status: 'current',
      evaluatedAt: '2026-09-02T02:00:00Z',
      ruleIds: ['topology.interface-conflict'],
      findingIds: ['finding:topology.interface-conflict:0123456789abcdef'],
      coverage: {
        applicable: 1,
        evaluated: 1,
        passed: 0,
        activeFinding: 1,
        unknown: 0,
        stale: 0,
        unsupported: 0,
        failed: 0,
        excluded: 0,
        notApplicable: 0,
        entries: [
          {
            ruleId: 'topology.interface-conflict',
            ruleRevision: 1,
            subjectId: 'wire-feed',
            scopeKey: 'incremental',
            outcome: 'active-finding',
            findingId: 'finding:topology.interface-conflict:0123456789abcdef',
            unknownReason: null
          }
        ]
      }
    }
  ],
  currentRunIds: ['run-validation-4']
};

function project(revision = 4): ProjectSnapshot {
  return {
    ...createBlankProject({
      id: 'project-findings',
      name: 'Findings fixture',
      createdAt: '2026-09-02T01:55:00Z'
    }),
    revision,
    results: [
      {
        id: 'result-validation-history',
        sourceRevision: 4,
        status: 'current',
        kind: 'validation',
        detail: { type: 'validation', history }
      }
    ]
  };
}

describe('MVP-VAL-014 Finding presentation', () => {
  it('orders corrective evidence, exposes fixed reviews, and preserves focus during background publication', async () => {
    const user = userEvent.setup();
    const onaction = vi.fn(() => true);
    const onvalidate = vi.fn();
    const rendered = render(FindingsLens, {
      props: { snapshot: project(), canAuthor: true, onaction, onvalidate }
    });

    const finding = screen.getByRole('article', { name: 'Warning Finding for wire-feed' });
    const labels = within(finding)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(labels).toEqual([
      'Claim',
      'Severity rationale',
      'Known evidence',
      'Unknown evidence',
      'Affected operation',
      'Inputs',
      'Assumptions',
      'Rule revision',
      'Trace',
      'Disposition',
      'Recurrence',
      'Corrective actions'
    ]);
    expect(finding).toHaveTextContent('No unknown evidence recorded');
    expect(finding).toHaveTextContent('topology.interface-conflict · r1');

    await user.click(screen.getByRole('button', { name: 'Run Engineering Review' }));
    expect(onvalidate).toHaveBeenCalledWith({
      kind: 'review-profile',
      profileId: 'engineering-review'
    });

    const validateProject = screen.getByRole('button', { name: 'Validate Project' });
    validateProject.focus();
    await rendered.rerender({
      snapshot: project(5),
      canAuthor: true,
      onaction,
      onvalidate
    });
    expect(document.activeElement).toBe(validateProject);
    expect(rendered.container.querySelector('[aria-live]')).toBeNull();
  });
});
