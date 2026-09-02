import { z } from 'zod';

z.config({ jitless: true });

const identity = z.string().min(1).max(200);
const revision = z.number().int().nonnegative();

export const REVIEW_PROFILE_IDS = [
  'topology-review',
  'engineering-review',
  'build-preparation',
  'as-built-review'
] as const;

export type ReviewProfileId = (typeof REVIEW_PROFILE_IDS)[number];

export const UNKNOWN_REASONS = [
  'missing',
  'conflicting',
  'ambiguous',
  'unsupported',
  'unevaluated',
  'stale',
  'unobservable',
  'outside-applicability-envelope'
] as const;

export type FindingUnknownReason = (typeof UNKNOWN_REASONS)[number];

export const validationScopeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('incremental'), subjectIds: z.array(identity) }),
  z.strictObject({ kind: z.literal('review-profile'), profileId: z.enum(REVIEW_PROFILE_IDS) }),
  z.strictObject({ kind: z.literal('validate-project') })
]);

export type ValidationScope = z.infer<typeof validationScopeSchema>;

export function validationScopeKey(scope: ValidationScope): string {
  if (scope.kind === 'incremental') return 'incremental';
  if (scope.kind === 'validate-project') return 'profile:as-built-review';
  return `profile:${scope.profileId}`;
}

const findingDispositionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('unreviewed') }),
  z.strictObject({
    kind: z.enum(['acknowledged', 'suppressed']),
    ruleId: identity,
    ruleRevision: z.number().int().positive(),
    subjectId: identity,
    scopeKey: identity,
    occurrenceNumber: z.number().int().positive(),
    recordedAtRevision: revision,
    rationale: z.string().min(1),
    invalidationKey: z.string().regex(/^[a-f0-9]{16}$/)
  })
]);

export type FindingDisposition = z.infer<typeof findingDispositionSchema>;

const findingOccurrenceSchema = z.strictObject({
  number: z.number().int().positive(),
  openedAtRevision: revision,
  resolvedAtRevision: revision.nullable(),
  resolutionReason: z.enum(['reevaluated-passed', 'subject-removed']).nullable()
});

export type FindingOccurrence = z.infer<typeof findingOccurrenceSchema>;

const subjectTombstoneTraceSchema = z.strictObject({
  subjectId: identity,
  subjectKind: z.enum(['component', 'connection']),
  successorId: identity
});

export const findingTraceSchema = z.strictObject({
  ruleId: identity,
  ruleRevision: z.number().int().positive(),
  subjectId: identity,
  scopeKey: identity,
  inputIds: z.array(identity),
  evidenceIds: z.array(identity),
  resultIds: z.array(identity),
  assumptions: z.array(z.string()),
  tombstone: subjectTombstoneTraceSchema.nullable()
});

export type FindingTrace = z.infer<typeof findingTraceSchema>;

export const findingSchema = z.strictObject({
  id: identity,
  ruleId: identity,
  ruleRevision: z.number().int().positive(),
  subjectId: identity,
  scopeKey: identity,
  claim: z.string().min(1),
  severity: z.enum(['blocker', 'warning', 'caution', 'information']),
  severityRationale: z.string().min(1),
  evaluation: z.enum(['current', 'stale', 'unevaluated', 'unsupported', 'failed']),
  lifecycle: z.enum(['active', 'resolved']),
  unknownReason: z.enum(UNKNOWN_REASONS).nullable(),
  knownEvidence: z.array(z.string()),
  unknownEvidence: z.array(z.string()),
  affectedOperation: z.string().min(1),
  inputIds: z.array(identity),
  assumptions: z.array(z.string()),
  trace: findingTraceSchema,
  disposition: findingDispositionSchema,
  occurrences: z.array(findingOccurrenceSchema).min(1),
  correctiveActions: z.array(z.string().min(1)),
  invalidationKey: z.string().regex(/^[a-f0-9]{16}$/)
});

export type Finding = z.infer<typeof findingSchema>;
export type FindingSeverity = Finding['severity'];

export const validationCoverageEntrySchema = z.strictObject({
  ruleId: identity,
  ruleRevision: z.number().int().positive(),
  subjectId: identity,
  scopeKey: identity,
  outcome: z.enum([
    'passed',
    'active-finding',
    'unknown',
    'stale',
    'unsupported',
    'failed',
    'excluded',
    'not-applicable'
  ]),
  findingId: identity.nullable(),
  unknownReason: z.enum(UNKNOWN_REASONS).nullable()
});

export type ValidationCoverageEntry = z.infer<typeof validationCoverageEntrySchema>;

export const validationCoverageSchema = z.strictObject({
  applicable: z.number().int().nonnegative(),
  evaluated: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  activeFinding: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
  stale: z.number().int().nonnegative(),
  unsupported: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  excluded: z.number().int().nonnegative(),
  notApplicable: z.number().int().nonnegative(),
  entries: z.array(validationCoverageEntrySchema)
});

export type ValidationCoverage = z.infer<typeof validationCoverageSchema>;

export const validationRunSchema = z.strictObject({
  id: identity,
  projectRevision: revision,
  scope: validationScopeSchema,
  scopeKey: identity,
  profileId: z.enum(REVIEW_PROFILE_IDS).nullable(),
  status: z.enum(['current', 'stale', 'failed', 'canceled']),
  evaluatedAt: z.iso.datetime({ offset: true }),
  ruleIds: z.array(identity),
  findingIds: z.array(identity),
  coverage: validationCoverageSchema.nullable()
});

export type ValidationRun = z.infer<typeof validationRunSchema>;

export const validationHistorySchema = z.strictObject({
  findings: z.array(findingSchema),
  runs: z.array(validationRunSchema),
  currentRunIds: z.array(identity)
});

export type ValidationHistory = z.infer<typeof validationHistorySchema>;

export const validationApplicabilityDecisionSchema = z.strictObject({
  ruleId: identity,
  subjectId: identity,
  scopeKey: identity,
  classification: z.enum(['excluded', 'not-applicable']),
  rationale: z.string().min(1),
  evidenceIds: z.array(identity).min(1),
  recordedAtRevision: revision
});

export type ValidationApplicabilityDecision = z.infer<typeof validationApplicabilityDecisionSchema>;

export const EMPTY_VALIDATION_HISTORY: ValidationHistory = {
  findings: [],
  runs: [],
  currentRunIds: []
};

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function validationFingerprint(value: unknown): string {
  return fnv1a64(JSON.stringify(value));
}

export function findingIdentity(ruleId: string, subjectId: string, scopeKey: string): string {
  return `finding:${ruleId}:${validationFingerprint([ruleId, subjectId, scopeKey])}`;
}

type DispositionRequest = Readonly<{
  findingId: string;
  projectRevision: number;
  rationale: string;
}>;

export type FindingDispositionOutcome =
  | Readonly<{ accepted: true; history: ValidationHistory }>
  | Readonly<{
      accepted: false;
      reason:
        'missing-finding' | 'resolved-finding' | 'empty-rationale' | 'blocker-cannot-be-suppressed';
    }>;

function changeDisposition(
  history: ValidationHistory,
  request: DispositionRequest,
  kind: 'acknowledged' | 'suppressed'
): FindingDispositionOutcome {
  const finding = history.findings.find((candidate) => candidate.id === request.findingId);
  if (!finding) return { accepted: false, reason: 'missing-finding' };
  if (finding.lifecycle !== 'active') return { accepted: false, reason: 'resolved-finding' };
  if (!request.rationale.trim()) return { accepted: false, reason: 'empty-rationale' };
  if (kind === 'suppressed' && finding.severity === 'blocker') {
    return { accepted: false, reason: 'blocker-cannot-be-suppressed' };
  }

  const occurrence = finding.occurrences.at(-1)!;
  const disposition: FindingDisposition = {
    kind,
    ruleId: finding.ruleId,
    ruleRevision: finding.ruleRevision,
    subjectId: finding.subjectId,
    scopeKey: finding.scopeKey,
    occurrenceNumber: occurrence.number,
    recordedAtRevision: request.projectRevision,
    rationale: request.rationale.trim(),
    invalidationKey: finding.invalidationKey
  };
  return {
    accepted: true,
    history: validationHistorySchema.parse({
      ...history,
      findings: history.findings.map((candidate) =>
        candidate.id === finding.id ? { ...candidate, disposition } : candidate
      )
    })
  };
}

export function acknowledgeFinding(
  history: ValidationHistory,
  request: DispositionRequest
): FindingDispositionOutcome {
  return changeDisposition(history, request, 'acknowledged');
}

export function suppressFinding(
  history: ValidationHistory,
  request: DispositionRequest
): FindingDispositionOutcome {
  return changeDisposition(history, request, 'suppressed');
}

export function retainStaleValidationHistory(history: ValidationHistory): ValidationHistory {
  return validationHistorySchema.parse({
    findings: history.findings.map((finding) =>
      finding.lifecycle === 'active' && finding.evaluation === 'current'
        ? { ...finding, evaluation: 'stale' }
        : finding
    ),
    runs: history.runs.map((run) => (run.status === 'current' ? { ...run, status: 'stale' } : run)),
    currentRunIds: []
  });
}
