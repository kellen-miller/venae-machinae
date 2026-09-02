import {
  findingIdentity,
  validationFingerprint,
  validationHistorySchema,
  validationScopeKey
} from './finding';
import { validationRulesForScope } from './rule-catalog';

import type { ProjectResult, ProjectSnapshot } from '../project/project';
import type {
  Finding,
  FindingSeverity,
  FindingUnknownReason,
  ValidationApplicabilityDecision,
  ValidationCoverage,
  ValidationCoverageEntry,
  ValidationHistory,
  ValidationRun,
  ValidationScope
} from './finding';
import type { ValidationRule } from './rule-catalog';

type FindingDraft = Readonly<{
  subjectId: string;
  scopeKey: string;
  claim: string;
  severity: FindingSeverity;
  severityRationale: string;
  evaluation: Finding['evaluation'];
  unknownReason: FindingUnknownReason | null;
  knownEvidence: readonly string[];
  unknownEvidence: readonly string[];
  affectedOperation: string;
  inputIds: readonly string[];
  evidenceIds: readonly string[];
  resultIds: readonly string[];
  assumptions: readonly string[];
  correctiveActions: readonly string[];
  invalidationEvidence: unknown;
}>;

type ObservationOutcome = ValidationCoverageEntry['outcome'];

type RuleObservation = Readonly<{
  rule: ValidationRule;
  subjectId: string;
  scopeKey: string;
  outcome: ObservationOutcome;
  unknownReason: FindingUnknownReason | null;
  finding: FindingDraft | null;
}>;

export type ValidationRunCandidate = Readonly<{
  run: ValidationRun;
  findings: readonly Finding[];
}>;

type EvaluateValidationOptions = Readonly<{
  runId: string;
  evaluatedAt: string;
  scope: ValidationScope;
  previousHistory: ValidationHistory;
  applicabilityDecisions: readonly ValidationApplicabilityDecision[];
}>;

function projectResult(snapshot: ProjectSnapshot, id: string): ProjectResult | null {
  return snapshot.results.find((result) => result.id === id) ?? null;
}

function calculationUnknownReason(reason: string | null): FindingUnknownReason {
  if (!reason) return 'unevaluated';
  if (reason.startsWith('missing-')) return 'missing';
  if (reason.startsWith('ambiguous-') || reason.startsWith('invalid-')) return 'ambiguous';
  if (reason.includes('unsupported')) return 'unsupported';
  if (reason.includes('outside-')) return 'outside-applicability-envelope';
  return 'unobservable';
}

function screenUnknownReason(
  reason: 'bound-overlap' | 'missing-evidence' | 'conflicting-evidence' | 'quantity-mismatch' | null
): FindingUnknownReason {
  if (reason === 'missing-evidence') return 'missing';
  if (reason === 'conflicting-evidence') return 'conflicting';
  if (reason === 'bound-overlap' || reason === 'quantity-mismatch') return 'ambiguous';
  return 'unevaluated';
}

function interfaceObservations(
  snapshot: ProjectSnapshot,
  rule: ValidationRule,
  scopeKey: string
): RuleObservation[] {
  return snapshot.topology.connections.map((connection) => {
    if (connection.interfaceAssessment === 'incompatible') {
      return {
        rule,
        subjectId: connection.id,
        scopeKey,
        outcome: 'active-finding',
        unknownReason: null,
        finding: {
          subjectId: connection.id,
          scopeKey,
          claim: `${connection.label} has explicitly incompatible endpoint interfaces.`,
          severity: 'warning',
          severityRationale:
            'Warning records the direct interface conflict for this connection only.',
          evaluation: 'current',
          unknownReason: null,
          knownEvidence: ['interfaceAssessment=incompatible'],
          unknownEvidence: [],
          affectedOperation: `connection:${connection.id}`,
          inputIds: [connection.sourcePortId, connection.targetPortId],
          evidenceIds: [],
          resultIds: [],
          assumptions: [],
          correctiveActions: [
            'Select compatible endpoint interfaces.',
            'Record an explicit transition component and evidence.'
          ],
          invalidationEvidence: connection
        }
      };
    }
    if (connection.interfaceAssessment === 'unknown') {
      return {
        rule,
        subjectId: connection.id,
        scopeKey,
        outcome: 'unknown',
        unknownReason: 'ambiguous',
        finding: null
      };
    }
    return {
      rule,
      subjectId: connection.id,
      scopeKey,
      outcome: 'passed',
      unknownReason: null,
      finding: null
    };
  });
}

function evidenceObservations(
  snapshot: ProjectSnapshot,
  rule: ValidationRule,
  scopeKey: string
): RuleObservation[] {
  return snapshot.evidence.map((evidence) => {
    if (evidence.state === 'conflicting') {
      return {
        rule,
        subjectId: evidence.subjectId,
        scopeKey,
        outcome: 'active-finding',
        unknownReason: 'conflicting',
        finding: {
          subjectId: evidence.subjectId,
          scopeKey,
          claim: `${evidence.label} contains explicit conflicting evidence.`,
          severity: 'warning',
          severityRationale:
            'Warning records the conflict for evaluations that depend on this evidence.',
          evaluation: 'current',
          unknownReason: 'conflicting',
          knownEvidence: [...evidence.conflictValues],
          unknownEvidence: ['one applicable value is not selected'],
          affectedOperation: `evidence-backed-evaluation:${evidence.subjectId}`,
          inputIds: [evidence.id],
          evidenceIds: [evidence.id],
          resultIds: [],
          assumptions: [],
          correctiveActions: [
            'Resolve the conflicting sources or select the applicable evidence explicitly.'
          ],
          invalidationEvidence: evidence
        }
      };
    }
    return {
      rule,
      subjectId: evidence.subjectId,
      scopeKey,
      outcome: evidence.state === 'known' ? 'passed' : 'unknown',
      unknownReason: evidence.state === 'unknown' ? 'missing' : null,
      finding: null
    };
  });
}

function calculationObservations(
  snapshot: ProjectSnapshot,
  rule: ValidationRule,
  scopeKey: string
): RuleObservation[] {
  return snapshot.calculations.map((calculation) => {
    const result = projectResult(snapshot, `result-${calculation.id}`);
    if (!result?.detail || result.detail.type !== 'calculation') {
      return {
        rule,
        subjectId: calculation.subjectId,
        scopeKey,
        outcome: 'unknown',
        unknownReason: 'unevaluated',
        finding: null
      };
    }

    const outcome = result.detail.outcome;
    if (result.status === 'stale') {
      return {
        rule,
        subjectId: calculation.subjectId,
        scopeKey,
        outcome: 'stale',
        unknownReason: 'stale',
        finding: null
      };
    }
    if (result.status === 'failed') {
      return {
        rule,
        subjectId: calculation.subjectId,
        scopeKey,
        outcome: 'failed',
        unknownReason: 'unobservable',
        finding: null
      };
    }
    if (outcome.status === 'unsupported') {
      return {
        rule,
        subjectId: calculation.subjectId,
        scopeKey,
        outcome: 'unsupported',
        unknownReason: 'unsupported',
        finding: null
      };
    }
    if (outcome.status === 'calculated') {
      return {
        rule,
        subjectId: calculation.subjectId,
        scopeKey,
        outcome: 'passed',
        unknownReason: null,
        finding: null
      };
    }

    const unknownReason = calculationUnknownReason(outcome.reason);
    return {
      rule,
      subjectId: calculation.subjectId,
      scopeKey,
      outcome: 'active-finding',
      unknownReason,
      finding: {
        subjectId: calculation.subjectId,
        scopeKey,
        claim: `Calculation ${calculation.id} cannot evaluate because ${outcome.reason ?? 'its required input is unresolved'}.`,
        severity: 'blocker',
        severityRationale: `Blocker prevents only calculation ${calculation.id}; unrelated editing, saving, reporting, and exchange remain available.`,
        evaluation: 'current',
        unknownReason,
        knownEvidence: [],
        unknownEvidence: [outcome.reason ?? 'required input unresolved'],
        affectedOperation: `calculation:${calculation.id}`,
        inputIds: outcome.trace.inputIds,
        evidenceIds: [],
        resultIds: [result.id],
        assumptions: outcome.trace.assumptions,
        correctiveActions: ['Provide or explicitly select every required calculation input.'],
        invalidationEvidence: { calculation, outcome }
      }
    };
  });
}

function screenObservations(
  snapshot: ProjectSnapshot,
  rule: ValidationRule,
  scopeKey: string
): RuleObservation[] {
  const observations: RuleObservation[] = [];
  for (const screening of snapshot.screenings) {
    const result = projectResult(snapshot, `result-${screening.id}`);
    if (!result?.detail || result.detail.type !== 'screening') {
      observations.push({
        rule,
        subjectId: screening.subjectId,
        scopeKey,
        outcome: 'unknown',
        unknownReason: 'unevaluated',
        finding: null
      });
      continue;
    }
    for (const candidate of result.detail.result.candidates) {
      for (const comparison of candidate.comparisons) {
        const comparisonScope = `${scopeKey}:screen:${validationFingerprint([
          screening.id,
          candidate.candidateId,
          comparison.criterionId
        ])}`;
        if (comparison.outcome === 'not-applicable') {
          observations.push({
            rule,
            subjectId: candidate.candidateId,
            scopeKey: comparisonScope,
            outcome: 'not-applicable',
            unknownReason: null,
            finding: null
          });
          continue;
        }
        const unknownReason =
          comparison.outcome === 'indeterminate' || comparison.outcome === 'unevaluated'
            ? screenUnknownReason(comparison.reason)
            : null;
        const severity =
          comparison.outcome === 'fail'
            ? 'warning'
            : comparison.outcome === 'pass'
              ? 'information'
              : 'caution';
        const claim = `${candidate.label} ${comparison.outcome} criterion ${comparison.criterionId} in configured screen ${screening.id}.`;
        observations.push({
          rule,
          subjectId: candidate.candidateId,
          scopeKey: comparisonScope,
          outcome: 'active-finding',
          unknownReason,
          finding: {
            subjectId: candidate.candidateId,
            scopeKey: comparisonScope,
            claim,
            severity,
            severityRationale:
              severity === 'warning'
                ? 'Warning records the explicit configured limit violation for this comparison.'
                : severity === 'information'
                  ? 'Information records a passing configured comparison without ranking the candidate.'
                  : 'Caution records unresolved or bounded evidence for this comparison.',
            evaluation: 'current',
            unknownReason,
            knownEvidence:
              comparison.outcome === 'pass' || comparison.outcome === 'fail' ? [claim] : [],
            unknownEvidence: unknownReason ? [comparison.reason ?? 'comparison unevaluated'] : [],
            affectedOperation: `screen:${screening.id}:${candidate.candidateId}`,
            inputIds: [comparison.criterionId],
            evidenceIds: [],
            resultIds: [result.id],
            assumptions: [],
            correctiveActions:
              severity === 'information'
                ? ['Retain the supplied limit and evidence trace for review.']
                : [
                    'Supply or revise explicit candidate evidence and rerun this configured screen.'
                  ],
            invalidationEvidence: comparison
          }
        });
      }
    }
  }
  return observations;
}

function completenessObservations(
  snapshot: ProjectSnapshot,
  rule: ValidationRule,
  scopeKey: string
): RuleObservation[] {
  if (rule.id === 'topology.interface-known') {
    return snapshot.topology.connections.map((connection) =>
      connection.interfaceAssessment === 'unknown'
        ? {
            rule,
            subjectId: connection.id,
            scopeKey,
            outcome: 'active-finding',
            unknownReason: 'ambiguous',
            finding: {
              subjectId: connection.id,
              scopeKey,
              claim: `${connection.label} has no explicit interface compatibility conclusion for this review.`,
              severity: 'caution',
              severityRationale:
                'Caution records missing profile evidence for this connection only.',
              evaluation: 'current',
              unknownReason: 'ambiguous',
              knownEvidence: [],
              unknownEvidence: ['interface compatibility conclusion'],
              affectedOperation: 'Topology Review',
              inputIds: [connection.sourcePortId, connection.targetPortId],
              evidenceIds: [],
              resultIds: [],
              assumptions: [],
              correctiveActions: ['Record compatibility evidence or an explicit transition.'],
              invalidationEvidence: connection
            }
          }
        : {
            rule,
            subjectId: connection.id,
            scopeKey,
            outcome: 'passed',
            unknownReason: null,
            finding: null
          }
    );
  }
  if (rule.id === 'engineering.state-evidence') {
    return snapshot.operatingStates.map((state) =>
      state.bindings.length === 0
        ? {
            rule,
            subjectId: state.id,
            scopeKey,
            outcome: 'active-finding',
            unknownReason: 'missing',
            finding: {
              subjectId: state.id,
              scopeKey,
              claim: `${state.name} has no explicit State Binding for this review.`,
              severity: 'caution',
              severityRationale:
                'Caution records missing Engineering Review evidence for this state.',
              evaluation: 'current',
              unknownReason: 'missing',
              knownEvidence: [],
              unknownEvidence: ['State Binding'],
              affectedOperation: 'Engineering Review',
              inputIds: [],
              evidenceIds: state.applicableEvidenceIds,
              resultIds: [],
              assumptions: state.assumptions.map((assumption) => assumption.value),
              correctiveActions: ['Add an explicit State Binding or narrow the review scope.'],
              invalidationEvidence: state
            }
          }
        : {
            rule,
            subjectId: state.id,
            scopeKey,
            outcome: 'passed',
            unknownReason: null,
            finding: null
          }
    );
  }
  if (rule.id === 'build.route-defined') {
    return snapshot.topology.connections.map((connection) =>
      connection.routeId === null
        ? {
            rule,
            subjectId: connection.id,
            scopeKey,
            outcome: 'active-finding',
            unknownReason: 'missing',
            finding: {
              subjectId: connection.id,
              scopeKey,
              claim: `${connection.label} has no explicit Route for Build Preparation.`,
              severity: 'caution',
              severityRationale:
                'Caution records missing build-preparation evidence for this path.',
              evaluation: 'current',
              unknownReason: 'missing',
              knownEvidence: [],
              unknownEvidence: ['Route'],
              affectedOperation: 'Build Preparation',
              inputIds: [connection.id],
              evidenceIds: [],
              resultIds: [],
              assumptions: [],
              correctiveActions: ['Author an explicit Route or exclude it with evidenced scope.'],
              invalidationEvidence: connection
            }
          }
        : {
            rule,
            subjectId: connection.id,
            scopeKey,
            outcome: 'passed',
            unknownReason: null,
            finding: null
          }
    );
  }

  const subjects = [
    ...snapshot.topology.components.map((component) => component.id),
    ...snapshot.topology.connections.map((connection) => connection.id)
  ];
  return subjects.map((subjectId) => {
    const evidence = snapshot.evidence.filter((item) => item.subjectId === subjectId);
    const known = evidence.filter((item) => item.state === 'known' && item.provenance);
    return known.length > 0
      ? {
          rule,
          subjectId,
          scopeKey,
          outcome: 'passed',
          unknownReason: null,
          finding: null
        }
      : {
          rule,
          subjectId,
          scopeKey,
          outcome: 'active-finding',
          unknownReason: 'unobservable',
          finding: {
            subjectId,
            scopeKey,
            claim: `${subjectId} has no known, sourced evidence for this As-Built Review.`,
            severity: 'caution',
            severityRationale:
              'Caution records unobserved as-built evidence for this subject only.',
            evaluation: 'current',
            unknownReason: 'unobservable',
            knownEvidence: [],
            unknownEvidence: ['known sourced evidence'],
            affectedOperation: 'As-Built Review',
            inputIds: [subjectId],
            evidenceIds: evidence.map((item) => item.id),
            resultIds: [],
            assumptions: [],
            correctiveActions: ['Record measured, entered, or sourced as-built evidence.'],
            invalidationEvidence: evidence
          }
        };
  });
}

function observationsForRule(
  snapshot: ProjectSnapshot,
  rule: ValidationRule,
  scopeKey: string
): RuleObservation[] {
  if (rule.id === 'topology.interface-conflict') {
    return interfaceObservations(snapshot, rule, scopeKey);
  }
  if (rule.id === 'evidence.conflicting') {
    return evidenceObservations(snapshot, rule, scopeKey);
  }
  if (rule.id === 'calculation.request-input') {
    return calculationObservations(snapshot, rule, scopeKey);
  }
  if (rule.id === 'screen.configured') return screenObservations(snapshot, rule, scopeKey);
  return completenessObservations(snapshot, rule, scopeKey);
}

function applyDecisions(
  observations: readonly RuleObservation[],
  decisions: readonly ValidationApplicabilityDecision[]
): RuleObservation[] {
  return observations.map((observation) => {
    const decision = decisions.find(
      (candidate) =>
        candidate.ruleId === observation.rule.id &&
        candidate.subjectId === observation.subjectId &&
        candidate.scopeKey === observation.scopeKey
    );
    return decision
      ? {
          ...observation,
          outcome: decision.classification,
          unknownReason: null,
          finding: null
        }
      : observation;
  });
}

function findingFromDraft(
  rule: ValidationRule,
  draft: FindingDraft,
  projectRevision: number,
  previous: Finding | undefined
): Finding {
  const id = findingIdentity(rule.id, draft.subjectId, draft.scopeKey);
  const invalidationKey = validationFingerprint([
    rule.id,
    rule.revision,
    draft.subjectId,
    draft.scopeKey,
    draft.invalidationEvidence
  ]);
  const recurring = previous?.lifecycle === 'resolved';
  const occurrences = previous
    ? recurring
      ? [
          ...previous.occurrences,
          {
            number: previous.occurrences.length + 1,
            openedAtRevision: projectRevision,
            resolvedAtRevision: null,
            resolutionReason: null
          }
        ]
      : previous.occurrences
    : [
        {
          number: 1,
          openedAtRevision: projectRevision,
          resolvedAtRevision: null,
          resolutionReason: null
        }
      ];
  const disposition =
    !recurring && previous?.invalidationKey === invalidationKey
      ? previous.disposition
      : ({ kind: 'unreviewed' } as const);
  return {
    id,
    ruleId: rule.id,
    ruleRevision: rule.revision,
    subjectId: draft.subjectId,
    scopeKey: draft.scopeKey,
    claim: draft.claim,
    severity: draft.severity,
    severityRationale: draft.severityRationale,
    evaluation: draft.evaluation,
    lifecycle: 'active',
    unknownReason: draft.unknownReason,
    knownEvidence: [...draft.knownEvidence],
    unknownEvidence: [...draft.unknownEvidence],
    affectedOperation: draft.affectedOperation,
    inputIds: [...draft.inputIds],
    assumptions: [...draft.assumptions],
    trace: {
      ruleId: rule.id,
      ruleRevision: rule.revision,
      subjectId: draft.subjectId,
      scopeKey: draft.scopeKey,
      inputIds: [...draft.inputIds],
      evidenceIds: [...draft.evidenceIds],
      resultIds: [...draft.resultIds],
      assumptions: [...draft.assumptions],
      tombstone: null
    },
    disposition,
    occurrences,
    correctiveActions: [...draft.correctiveActions],
    invalidationKey
  };
}

function liveSubjectExists(snapshot: ProjectSnapshot, subjectId: string): boolean {
  return (
    snapshot.id === subjectId ||
    snapshot.topology.systems.some((subject) => subject.id === subjectId) ||
    snapshot.topology.components.some(
      (subject) => subject.id === subjectId || subject.ports.some((port) => port.id === subjectId)
    ) ||
    snapshot.topology.connections.some((subject) => subject.id === subjectId) ||
    snapshot.topology.routes.some((subject) => subject.id === subjectId) ||
    snapshot.topology.segments.some((subject) => subject.id === subjectId) ||
    snapshot.evidence.some((subject) => subject.id === subjectId) ||
    snapshot.calculations.some((subject) => subject.id === subjectId) ||
    snapshot.screenings.some((subject) => subject.id === subjectId) ||
    snapshot.partDefinitions.some((subject) => subject.id === subjectId) ||
    snapshot.operatingStates.some((subject) => subject.id === subjectId)
  );
}

function resolveFinding(snapshot: ProjectSnapshot, finding: Finding): Finding {
  const tombstone = snapshot.tombstones.find(
    (candidate) => candidate.subjectId === finding.subjectId
  );
  const subjectRemoved = !liveSubjectExists(snapshot, finding.subjectId) && Boolean(tombstone);
  const occurrences = finding.occurrences.map((occurrence, index) =>
    index === finding.occurrences.length - 1 && occurrence.resolvedAtRevision === null
      ? {
          ...occurrence,
          resolvedAtRevision: snapshot.revision,
          resolutionReason: subjectRemoved
            ? ('subject-removed' as const)
            : ('reevaluated-passed' as const)
        }
      : occurrence
  );
  return {
    ...finding,
    evaluation: 'current',
    lifecycle: 'resolved',
    occurrences,
    trace: { ...finding.trace, tombstone: subjectRemoved ? tombstone! : null }
  };
}

function coverage(entries: readonly ValidationCoverageEntry[]): ValidationCoverage {
  const count = (outcome: ValidationCoverageEntry['outcome']) =>
    entries.filter((entry) => entry.outcome === outcome).length;
  const excluded = count('excluded');
  const notApplicable = count('not-applicable');
  const passed = count('passed');
  const activeFinding = count('active-finding');
  const unknown = count('unknown');
  const stale = count('stale');
  const unsupported = count('unsupported');
  const failed = count('failed');
  return {
    applicable: entries.length - excluded - notApplicable,
    evaluated: passed + activeFinding + unknown + stale + unsupported + failed,
    passed,
    activeFinding,
    unknown,
    stale,
    unsupported,
    failed,
    excluded,
    notApplicable,
    entries: [...entries]
  };
}

export function evaluateValidation(
  snapshot: ProjectSnapshot,
  options: EvaluateValidationOptions
): ValidationRunCandidate {
  const rules = validationRulesForScope(options.scope);
  const scopeKey = validationScopeKey(options.scope);
  const observations = applyDecisions(
    rules.flatMap((rule) => observationsForRule(snapshot, rule, scopeKey)),
    options.applicabilityDecisions
  );
  const previousById = new Map(
    options.previousHistory.findings.map((finding) => [finding.id, finding])
  );
  const activeIds = new Set<string>();
  const updatedById = new Map(
    options.previousHistory.findings.map((finding) => [finding.id, finding])
  );

  for (const observation of observations) {
    if (!observation.finding) continue;
    const id = findingIdentity(observation.rule.id, observation.subjectId, observation.scopeKey);
    activeIds.add(id);
    updatedById.set(
      id,
      findingFromDraft(
        observation.rule,
        observation.finding,
        snapshot.revision,
        previousById.get(id)
      )
    );
  }

  const evaluatedRuleIds = new Set(rules.map((rule) => rule.id));
  for (const previous of options.previousHistory.findings) {
    if (
      previous.lifecycle !== 'active' ||
      !evaluatedRuleIds.has(previous.ruleId) ||
      !previous.scopeKey.startsWith(scopeKey) ||
      activeIds.has(previous.id)
    ) {
      continue;
    }
    updatedById.set(previous.id, resolveFinding(snapshot, previous));
  }

  const findings = [...updatedById.values()];
  const entries = observations.map((observation): ValidationCoverageEntry => {
    const findingId = observation.finding
      ? findingIdentity(observation.rule.id, observation.subjectId, observation.scopeKey)
      : null;
    return {
      ruleId: observation.rule.id,
      ruleRevision: observation.rule.revision,
      subjectId: observation.subjectId,
      scopeKey: observation.scopeKey,
      outcome: observation.outcome,
      findingId,
      unknownReason: observation.unknownReason
    };
  });
  const profileId =
    options.scope.kind === 'incremental'
      ? null
      : options.scope.kind === 'validate-project'
        ? 'as-built-review'
        : options.scope.profileId;
  return {
    run: {
      id: options.runId,
      projectRevision: snapshot.revision,
      scope: options.scope,
      scopeKey,
      profileId,
      status: 'current',
      evaluatedAt: options.evaluatedAt,
      ruleIds: rules.map((rule) => rule.id),
      findingIds: entries.flatMap((entry) => (entry.findingId ? [entry.findingId] : [])),
      coverage: coverage(entries)
    },
    findings
  };
}

export function publishValidationRun(
  history: ValidationHistory,
  candidate: ValidationRunCandidate
): ValidationHistory {
  const priorCurrentRuns = history.runs.map((run) =>
    run.status === 'current' && run.scopeKey === candidate.run.scopeKey
      ? { ...run, status: 'stale' as const }
      : run
  );
  const replacedIds = new Set(
    history.runs
      .filter((run) => run.status === 'current' && run.scopeKey === candidate.run.scopeKey)
      .map((run) => run.id)
  );
  return validationHistorySchema.parse({
    findings: candidate.findings,
    runs: [...priorCurrentRuns, candidate.run],
    currentRunIds: [
      ...history.currentRunIds.filter((runId) => !replacedIds.has(runId)),
      candidate.run.id
    ]
  });
}

export function recordValidationRunFailure(
  history: ValidationHistory,
  input: Readonly<{
    runId: string;
    projectRevision: number;
    evaluatedAt: string;
    scope: ValidationScope;
    status: 'failed' | 'canceled';
  }>
): ValidationHistory {
  const scopeKey = validationScopeKey(input.scope);
  const profileId =
    input.scope.kind === 'incremental'
      ? null
      : input.scope.kind === 'validate-project'
        ? 'as-built-review'
        : input.scope.profileId;
  return validationHistorySchema.parse({
    ...history,
    runs: [
      ...history.runs,
      {
        id: input.runId,
        projectRevision: input.projectRevision,
        scope: input.scope,
        scopeKey,
        profileId,
        status: input.status,
        evaluatedAt: input.evaluatedAt,
        ruleIds: [],
        findingIds: [],
        coverage: null
      }
    ]
  });
}
