import { describe, expect, it } from 'vitest';

import {
  acknowledgeFinding,
  EMPTY_VALIDATION_HISTORY,
  retainStaleValidationHistory,
  suppressFinding,
  UNKNOWN_REASONS
} from '../../src/lib/validation/finding';
import {
  evaluateValidation,
  publishValidationRun,
  recordValidationRunFailure
} from '../../src/lib/validation/evaluate-validation';
import {
  REVIEW_PROFILES,
  VALIDATION_RULES,
  rulesForReviewProfile
} from '../../src/lib/validation/rule-catalog';
import { createBlankProject } from '../../src/lib/project/project';
import { applyProjectAction } from '../../src/lib/project/apply-action';
import {
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from '../../src/lib/persistence/project-document';

import type { ProjectSnapshot } from '../../src/lib/project/project';
import type { ValidationHistory, ValidationScope } from '../../src/lib/validation/finding';

const evaluatedAt = '2026-09-02T01:45:00Z';

function validationProject(): ProjectSnapshot {
  const blank = createBlankProject({
    id: 'project-validation',
    name: 'Validation fixture',
    createdAt: '2026-09-02T01:40:00Z'
  });

  return {
    ...blank,
    revision: 7,
    topology: {
      systems: [
        { id: 'system-electrical', label: 'Electrical', domain: 'electrical', mediumId: null }
      ],
      components: [
        {
          id: 'source',
          label: 'Source',
          kind: 'part',
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: '0', y: '0' },
          ports: [
            {
              id: 'source-out',
              componentId: 'source',
              label: 'Out',
              domain: 'electrical',
              mediumId: null,
              interfaceKey: 'ring-m6'
            },
            {
              id: 'source-aux',
              componentId: 'source',
              label: 'Aux',
              domain: 'electrical',
              mediumId: null,
              interfaceKey: null
            }
          ]
        },
        {
          id: 'load',
          label: 'Load',
          kind: 'part',
          definitionId: null,
          predecessorId: null,
          successorId: null,
          position: { x: '100', y: '0' },
          ports: [
            {
              id: 'load-in',
              componentId: 'load',
              label: 'In',
              domain: 'electrical',
              mediumId: null,
              interfaceKey: 'blade-6.3'
            },
            {
              id: 'load-aux',
              componentId: 'load',
              label: 'Aux',
              domain: 'electrical',
              mediumId: null,
              interfaceKey: null
            }
          ]
        }
      ],
      connections: [
        {
          id: 'wire-conflict',
          label: 'Conflicting feed',
          systemId: 'system-electrical',
          sourcePortId: 'source-out',
          targetPortId: 'load-in',
          domain: 'electrical',
          mediumId: null,
          kind: 'electrical-wire',
          interfaceAssessment: 'incompatible',
          routeId: null
        },
        {
          id: 'wire-unknown',
          label: 'Unassessed auxiliary feed',
          systemId: 'system-electrical',
          sourcePortId: 'source-aux',
          targetPortId: 'load-aux',
          domain: 'electrical',
          mediumId: null,
          kind: 'electrical-wire',
          interfaceAssessment: 'unknown',
          routeId: null
        }
      ],
      routes: [],
      segments: []
    },
    evidence: [
      {
        id: 'evidence-conflict',
        subjectId: 'wire-conflict',
        label: 'Measured current',
        state: 'conflicting',
        value: null,
        unit: 'A',
        provenance: 'two independent measurements',
        conflictValues: ['8.2', '11.4']
      }
    ],
    calculations: [
      {
        id: 'calculation-missing-input',
        subjectId: 'wire-conflict',
        operatingStateId: 'state-run',
        formulaId: 'electrical.voltage-drop.v1',
        pathId: null,
        inputs: [],
        assumptions: ['steady DC'],
        conditions: {},
        omissions: [],
        desiredOutputUnit: 'volt'
      }
    ],
    operatingStates: [
      {
        id: 'state-run',
        name: 'Run',
        description: 'Validation state',
        commands: [],
        conditions: [],
        measurements: [],
        assumptions: [],
        applicableEvidenceIds: [],
        bindings: []
      }
    ],
    results: [
      {
        id: 'result-calculation-missing-input',
        sourceRevision: 7,
        status: 'unknown',
        kind: 'calculation',
        detail: {
          type: 'calculation',
          outcome: {
            status: 'unknown',
            completeness: 'unknown',
            output: null,
            bounds: null,
            reason: 'missing-input: current',
            omissions: [],
            trace: {
              calculationId: 'calculation-missing-input',
              subjectId: 'wire-conflict',
              operatingStateId: 'state-run',
              pathId: null,
              formulaId: 'electrical.voltage-drop.v1',
              formulaRevision: 1,
              inputIds: [],
              assumptions: ['steady DC'],
              conditions: {},
              applicability: ['steady DC'],
              calculatedAt: evaluatedAt
            }
          }
        }
      }
    ]
  };
}

function run(
  project: ProjectSnapshot,
  history: ValidationHistory = EMPTY_VALIDATION_HISTORY,
  scope: ValidationScope = { kind: 'incremental', subjectIds: [project.id] }
) {
  return evaluateValidation(project, {
    runId: `run-${project.revision}-${scope.kind}`,
    evaluatedAt,
    scope,
    previousHistory: history,
    applicabilityDecisions: []
  });
}

describe('MVP-VAL-001 application-owned Validation Rule catalog', () => {
  it('is explicit, versioned, local, deterministic, and cumulatively selected by fixed profiles', () => {
    expect(VALIDATION_RULES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(VALIDATION_RULES.map((rule) => rule.id)).size).toBe(VALIDATION_RULES.length);
    expect(VALIDATION_RULES.every((rule) => rule.revision === 1)).toBe(true);
    expect(JSON.stringify(VALIDATION_RULES)).not.toMatch(/script|sourceCode|functionBody/i);

    expect(REVIEW_PROFILES.map((profile) => profile.id)).toEqual([
      'topology-review',
      'engineering-review',
      'build-preparation',
      'as-built-review'
    ]);
    const ruleCounts = REVIEW_PROFILES.map((profile) => rulesForReviewProfile(profile.id).length);
    expect(ruleCounts).toEqual([...ruleCounts].sort((left, right) => left - right));
    for (let index = 1; index < REVIEW_PROFILES.length; index += 1) {
      const previous = new Set(rulesForReviewProfile(REVIEW_PROFILES[index - 1]!.id));
      expect(rulesForReviewProfile(REVIEW_PROFILES[index]!.id)).toEqual(
        expect.arrayContaining([...previous])
      );
    }
  });
});

describe('MVP-VAL-002 MVP-VAL-003 canonical scoped Findings', () => {
  it('derives one stable identity per rule, subject, and scope with scoped severity meaning', () => {
    const candidate = run(validationProject());
    const history = publishValidationRun(EMPTY_VALIDATION_HISTORY, candidate);
    const severities = Object.fromEntries(
      history.findings.map((finding) => [finding.ruleId, finding.severity])
    );

    expect(severities).toMatchObject({
      'topology.interface-conflict': 'warning',
      'evidence.conflicting': 'warning',
      'calculation.request-input': 'blocker'
    });
    expect(new Set(history.findings.map((finding) => finding.id)).size).toBe(
      history.findings.length
    );
    const blocker = history.findings.find(
      (finding) => finding.ruleId === 'calculation.request-input'
    );
    expect(blocker).toMatchObject({
      subjectId: 'wire-conflict',
      affectedOperation: 'calculation:calculation-missing-input',
      lifecycle: 'active',
      evaluation: 'current',
      disposition: { kind: 'unreviewed' }
    });
    expect(blocker?.claim).toContain('calculation-missing-input');
    expect(blocker?.trace).toMatchObject({
      ruleId: 'calculation.request-input',
      ruleRevision: 1,
      subjectId: 'wire-conflict',
      resultIds: ['result-calculation-missing-input']
    });
    expect(JSON.stringify(history)).not.toMatch(/safe|unsafe|ready|health score/i);
  });
});

describe('MVP-VAL-004 MVP-VAL-005 independent Finding axes and Unknown reasons', () => {
  it('keeps evaluation, lifecycle, disposition, and reason-coded Unknown independent', () => {
    expect(UNKNOWN_REASONS).toEqual([
      'missing',
      'conflicting',
      'ambiguous',
      'unsupported',
      'unevaluated',
      'stale',
      'unobservable',
      'outside-applicability-envelope'
    ]);
    const history = publishValidationRun(EMPTY_VALIDATION_HISTORY, run(validationProject()));
    const missing = history.findings.find(
      (finding) => finding.ruleId === 'calculation.request-input'
    );
    const conflict = history.findings.find((finding) => finding.ruleId === 'evidence.conflicting');
    expect(missing?.unknownReason).toBe('missing');
    expect(conflict?.unknownReason).toBe('conflicting');
    expect(missing?.severity).toBe('blocker');
    expect(missing?.evaluation).toBe('current');
    expect(missing?.lifecycle).toBe('active');
    expect(missing?.disposition.kind).toBe('unreviewed');
  });
});

describe('MVP-VAL-006 MVP-VAL-007 optional blanks and result completeness', () => {
  it('creates no incremental Finding for optional blanks and scopes missing inputs to one calculation', () => {
    const project = validationProject();
    const incremental = publishValidationRun(EMPTY_VALIDATION_HISTORY, run(project));
    expect(
      incremental.findings.some((finding) => finding.ruleId === 'topology.interface-known')
    ).toBe(false);
    expect(
      incremental.findings.find((finding) => finding.ruleId === 'calculation.request-input')
        ?.affectedOperation
    ).toBe('calculation:calculation-missing-input');
    expect(project.results[0]?.detail).toMatchObject({
      type: 'calculation',
      outcome: { completeness: 'unknown' }
    });

    const explicit = publishValidationRun(
      incremental,
      run(project, incremental, { kind: 'review-profile', profileId: 'topology-review' })
    );
    expect(
      explicit.findings.find((finding) => finding.ruleId === 'topology.interface-known')
    ).toMatchObject({ severity: 'caution', unknownReason: 'ambiguous' });
  });
});

describe('MVP-VAL-008 MVP-VAL-009 incremental and explicit Review Profile evaluation', () => {
  it('runs structural/conflict/screen rules incrementally and completeness only by explicit profile', () => {
    const project = validationProject();
    const incremental = run(project);
    expect(incremental.run.ruleIds).toEqual(
      expect.arrayContaining([
        'topology.interface-conflict',
        'evidence.conflicting',
        'calculation.request-input',
        'screen.configured'
      ])
    );
    expect(incremental.run.ruleIds).not.toContain('build.route-defined');

    const engineering = run(project, EMPTY_VALIDATION_HISTORY, {
      kind: 'review-profile',
      profileId: 'engineering-review'
    });
    const build = run(project, EMPTY_VALIDATION_HISTORY, {
      kind: 'review-profile',
      profileId: 'build-preparation'
    });
    expect(build.run.ruleIds).toEqual(expect.arrayContaining(engineering.run.ruleIds));
    expect(build.run.ruleIds).toContain('build.route-defined');
    expect(build.run.profileId).toBe('build-preparation');
  });
});

describe('MVP-VAL-010 Validation Coverage accounting', () => {
  it('counts every bounded outcome without producing a project score', () => {
    const project = validationProject();
    const candidate = evaluateValidation(project, {
      runId: 'run-coverage',
      evaluatedAt,
      scope: { kind: 'review-profile', profileId: 'build-preparation' },
      previousHistory: EMPTY_VALIDATION_HISTORY,
      applicabilityDecisions: [
        {
          ruleId: 'build.route-defined',
          subjectId: 'wire-conflict',
          scopeKey: 'profile:build-preparation',
          classification: 'excluded',
          rationale: 'route evidence is intentionally outside this bounded review',
          evidenceIds: ['evidence-conflict'],
          recordedAtRevision: 7
        }
      ]
    });

    expect(candidate.run.coverage).toMatchObject({
      applicable: expect.any(Number),
      evaluated: expect.any(Number),
      passed: expect.any(Number),
      activeFinding: expect.any(Number),
      unknown: expect.any(Number),
      stale: expect.any(Number),
      unsupported: expect.any(Number),
      failed: expect.any(Number),
      excluded: 1,
      notApplicable: expect.any(Number)
    });
    const coverage = candidate.run.coverage;
    if (!coverage) throw new Error('successful validation run should publish coverage');
    expect(coverage.applicable).toBeGreaterThan(0);
    expect(coverage.activeFinding).toBeGreaterThan(0);
    expect(coverage).not.toHaveProperty('score');
    expect(coverage).not.toHaveProperty('health');
  });
});

describe('MVP-VAL-011 disposition rules and invalidation', () => {
  it('retains exact acknowledgement/suppression context, rejects Blocker suppression, and resets on recurrence', () => {
    const project = validationProject();
    let history = publishValidationRun(EMPTY_VALIDATION_HISTORY, run(project));
    const warning = history.findings.find(
      (finding) => finding.ruleId === 'topology.interface-conflict'
    )!;
    const blocker = history.findings.find(
      (finding) => finding.ruleId === 'calculation.request-input'
    )!;

    const acknowledged = acknowledgeFinding(history, {
      findingId: warning.id,
      projectRevision: project.revision,
      rationale: 'Reviewed against the current connector evidence.'
    });
    expect(acknowledged.accepted).toBe(true);
    if (!acknowledged.accepted) throw new Error('acknowledgement should pass');
    history = acknowledged.history;
    expect(history.findings.find((finding) => finding.id === warning.id)).toMatchObject({
      severity: 'warning',
      lifecycle: 'active',
      disposition: {
        kind: 'acknowledged',
        ruleId: warning.ruleId,
        subjectId: warning.subjectId,
        scopeKey: warning.scopeKey,
        recordedAtRevision: 7,
        rationale: 'Reviewed against the current connector evidence.'
      }
    });

    const suppressed = suppressFinding(history, {
      findingId: warning.id,
      projectRevision: project.revision,
      rationale: 'Retained for this exact evidence configuration.'
    });
    expect(suppressed.accepted).toBe(true);
    expect(
      suppressFinding(history, {
        findingId: blocker.id,
        projectRevision: project.revision,
        rationale: 'Must be rejected.'
      })
    ).toEqual({ accepted: false, reason: 'blocker-cannot-be-suppressed' });

    const resolvedProject = {
      ...project,
      revision: 8,
      topology: {
        ...project.topology,
        connections: project.topology.connections.map((connection) => ({
          ...connection,
          interfaceAssessment: 'compatible' as const
        }))
      }
    };
    history = publishValidationRun(history, run(resolvedProject, history));
    const recurringProject = { ...project, revision: 9 };
    history = publishValidationRun(history, run(recurringProject, history));
    const recurring = history.findings.find((finding) => finding.id === warning.id)!;
    expect(recurring.occurrences).toHaveLength(2);
    expect(recurring.lifecycle).toBe('active');
    expect(recurring.disposition).toEqual({ kind: 'unreviewed' });
  });
});

describe('MVP-VAL-012 reevaluation, subject tombstones, and recurrence', () => {
  it('resolves only by reevaluation, records subject removal, and restores the stable trace on undo evidence', () => {
    const project = validationProject();
    let history = publishValidationRun(EMPTY_VALIDATION_HISTORY, run(project));
    const original = history.findings.find(
      (finding) => finding.ruleId === 'topology.interface-conflict'
    )!;
    const removed = {
      ...project,
      revision: 8,
      topology: { ...project.topology, connections: [] },
      tombstones: [
        { subjectId: 'wire-conflict', subjectKind: 'connection' as const, successorId: 'wire-new' }
      ]
    };
    history = publishValidationRun(history, run(removed, history));
    expect(history.findings.find((finding) => finding.id === original.id)).toMatchObject({
      lifecycle: 'resolved',
      occurrences: [{ resolvedAtRevision: 8, resolutionReason: 'subject-removed' }],
      trace: {
        tombstone: {
          subjectId: 'wire-conflict',
          subjectKind: 'connection',
          successorId: 'wire-new'
        }
      }
    });

    const restored = { ...project, revision: 9 };
    history = publishValidationRun(history, run(restored, history));
    const recurring = history.findings.find((finding) => finding.id === original.id)!;
    expect(recurring.lifecycle).toBe('active');
    expect(recurring.occurrences).toHaveLength(2);
    expect(recurring.trace).toMatchObject({
      subjectId: 'wire-conflict',
      tombstone: null
    });
  });
});

describe('MVP-VAL-013 atomic Validation Run publication', () => {
  it('publishes Findings and coverage together while failed/canceled runs retain prior current evidence', () => {
    const project = validationProject();
    const current = publishValidationRun(EMPTY_VALIDATION_HISTORY, run(project));
    const currentRunIds = current.currentRunIds;
    const findingIds = current.findings.map((finding) => finding.id);

    const stale = retainStaleValidationHistory(current);
    expect(stale.currentRunIds).toEqual([]);
    expect(stale.runs.find((run) => run.id === currentRunIds[0])?.status).toBe('stale');
    expect(stale.findings.find((finding) => finding.id === findingIds[0])?.evaluation).toBe(
      'stale'
    );

    const failed = recordValidationRunFailure(current, {
      runId: 'run-failed',
      projectRevision: 8,
      evaluatedAt,
      scope: { kind: 'incremental', subjectIds: ['wire-conflict'] },
      status: 'failed'
    });
    expect(failed.currentRunIds).toEqual(currentRunIds);
    expect(failed.findings.map((finding) => finding.id)).toEqual(findingIds);
    expect(failed.runs.at(-1)).toMatchObject({ id: 'run-failed', status: 'failed' });

    const canceled = recordValidationRunFailure(failed, {
      runId: 'run-canceled',
      projectRevision: 9,
      evaluatedAt,
      scope: { kind: 'review-profile', profileId: 'topology-review' },
      status: 'canceled'
    });
    expect(canceled.currentRunIds).toEqual(currentRunIds);
    expect(canceled.findings.map((finding) => finding.id)).toEqual(findingIds);
    expect(canceled.runs.at(-1)).toMatchObject({ id: 'run-canceled', status: 'canceled' });
  });
});

describe('MVP-VAL-014 ordered corrective Finding content contract', () => {
  it('retains every ordered presentation field without an aggregate verdict', () => {
    const history = publishValidationRun(EMPTY_VALIDATION_HISTORY, run(validationProject()));
    const finding = history.findings.find(
      (candidate) => candidate.ruleId === 'topology.interface-conflict'
    )!;
    expect(finding).toMatchObject({
      claim: expect.any(String),
      severityRationale: expect.any(String),
      knownEvidence: expect.any(Array),
      unknownEvidence: expect.any(Array),
      affectedOperation: expect.any(String),
      inputIds: expect.any(Array),
      assumptions: expect.any(Array),
      ruleRevision: 1,
      trace: expect.any(Object),
      disposition: expect.any(Object),
      occurrences: expect.any(Array),
      correctiveActions: expect.any(Array)
    });
  });
});

describe('Validation persistence and review actions', () => {
  it('round-trips one atomic history and preserves severity through scoped user decisions', () => {
    const project = validationProject();
    const history = publishValidationRun(EMPTY_VALIDATION_HISTORY, run(project));
    const persisted: ProjectSnapshot = {
      ...project,
      results: [
        ...project.results,
        {
          id: 'result-validation-history',
          sourceRevision: project.revision,
          status: 'current',
          kind: 'validation',
          detail: { type: 'validation', history }
        }
      ],
      validationApplicabilityDecisions: [
        {
          ruleId: 'build.route-defined',
          subjectId: 'wire-conflict',
          scopeKey: 'profile:build-preparation',
          classification: 'excluded',
          rationale: 'bounded review excludes routing until the physical survey',
          evidenceIds: ['evidence-conflict'],
          recordedAtRevision: project.revision
        }
      ]
    };
    const reopened = projectDocumentToSnapshot(projectSnapshotToDocument(persisted));
    expect(reopened).toEqual(persisted);

    const warning = history.findings.find(
      (finding) => finding.ruleId === 'topology.interface-conflict'
    )!;
    const suppressed = applyProjectAction(reopened, {
      type: 'suppress-finding',
      causationId: 'suppress-warning',
      findingId: warning.id,
      rationale: 'Reviewed for this exact connector evidence.'
    });
    expect(suppressed.accepted).toBe(true);
    if (!suppressed.accepted) throw new Error(suppressed.rejection.message);
    const reviewedHistory = suppressed.snapshot.results.find(
      (result) => result.detail?.type === 'validation'
    )?.detail;
    expect(
      reviewedHistory?.type === 'validation'
        ? reviewedHistory.history.findings.find((finding) => finding.id === warning.id)
        : null
    ).toMatchObject({
      severity: 'warning',
      lifecycle: 'active',
      disposition: { kind: 'suppressed', rationale: 'Reviewed for this exact connector evidence.' }
    });

    const applicability = applyProjectAction(reopened, {
      type: 'set-validation-applicability',
      causationId: 'exclude-route-rule',
      decision: {
        ruleId: 'build.route-defined',
        subjectId: 'wire-unknown',
        scopeKey: 'profile:build-preparation',
        classification: 'not-applicable',
        rationale: 'This auxiliary feed is outside the bounded physical routing review.',
        evidenceIds: ['evidence-conflict']
      }
    });
    expect(applicability.accepted).toBe(true);
    if (!applicability.accepted) throw new Error(applicability.rejection.message);
    expect(applicability.snapshot.validationApplicabilityDecisions).toContainEqual(
      expect.objectContaining({
        subjectId: 'wire-unknown',
        classification: 'not-applicable',
        recordedAtRevision: 8
      })
    );
  });
});
