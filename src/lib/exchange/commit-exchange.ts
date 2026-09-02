import { libraryBackupPayloadSchema } from '../persistence/database-schema';
import { projectDocumentSchema } from '../persistence/project-document';
import { retainStaleProjectResult } from '../project/project';

import type { BrowserProjectLibrary } from '../persistence/project-library';
import type { ProjectDocument } from '../persistence/project-document';
import type {
  StagedExchange,
  StagedLibraryBackupExchange,
  StagedTemplateExchange
} from './stage-exchange';

export type ExchangeCommitDecision = 'replace' | 'import-copy' | 'cancel';
export const DEFAULT_EXCHANGE_COMMIT_DECISION: ExchangeCommitDecision = 'cancel';

export type ExchangeCommitOutcome =
  | Readonly<{
      committed: true;
      decision: 'replace' | 'import-copy';
      projectId: string;
      revision: number;
    }>
  | Readonly<{
      committed: false;
      reason: 'canceled' | 'revision-conflict' | 'quota-exceeded' | 'storage-error';
    }>;

const EXTERNAL_ID_KEYS = new Set(['formulaId', 'formulaIds', 'profileId', 'ruleId', 'ruleIds']);

function collectProjectOwnedIds(project: ProjectDocument): ReadonlySet<string> {
  const identities = new Set<string>([
    project.project.id,
    ...project.topology.systems.map((subject) => subject.id),
    ...project.topology.components.flatMap((subject) => [
      subject.id,
      ...subject.ports.map((port) => port.id)
    ]),
    ...project.topology.connections.map((subject) => subject.id),
    ...project.topology.routes.map((subject) => subject.id),
    ...project.topology.segments.map((subject) => subject.id),
    ...project.electrical.circuits.map((subject) => subject.id),
    ...project.electrical.harnesses.map((subject) => subject.id),
    ...project.electrical.bundles.flatMap((subject) => [
      subject.id,
      ...subject.twistedPairs.map((pair) => pair.id)
    ]),
    ...project.fluid.media.map((subject) => subject.id),
    ...project.fluid.behaviors.map((subject) => subject.id),
    ...project.fluid.boundaryConditions.map((subject) => subject.id),
    ...project.calculations.flatMap((subject) => [
      subject.id,
      ...subject.inputs.map((input) => input.quantity.id)
    ]),
    ...project.screenings.flatMap((subject) => [
      subject.id,
      ...subject.criteria.map((criterion) => criterion.id),
      ...subject.selectedCandidates.map((candidate) => candidate.id)
    ]),
    ...project.partDefinitions.map((subject) => subject.id),
    ...project.partRequirements.map((subject) => subject.id),
    ...project.build.procurementChoices.map((subject) => subject.id),
    ...project.build.installations.map((subject) => subject.id),
    ...project.evidence.map((subject) => subject.id),
    ...project.results.flatMap((result) => {
      if (result.detail?.type === 'overlay') {
        return [
          result.id,
          result.detail.overlay.id,
          ...result.detail.overlay.marks.map((mark) => mark.id)
        ];
      }
      if (result.detail?.type === 'validation') {
        return [
          result.id,
          ...result.detail.history.findings.map((finding) => finding.id),
          ...result.detail.history.runs.map((run) => run.id)
        ];
      }

      return [result.id];
    }),
    ...project.engineeringValues.map((subject) => subject.id),
    ...project.operatingStates.flatMap((state) => [
      state.id,
      ...state.commands.map((statement) => statement.id),
      ...state.conditions.map((statement) => statement.id),
      ...state.measurements.map((statement) => statement.id),
      ...state.assumptions.map((statement) => statement.id),
      ...state.bindings.flatMap((binding) => [
        binding.id,
        ...(binding.behavior ? [binding.behavior.id] : [])
      ])
    ]),
    ...project.tombstones.flatMap((tombstone) => [tombstone.subjectId, tombstone.successorId])
  ]);
  for (const mediumId of [
    ...project.topology.systems.map((system) => system.mediumId),
    ...project.topology.components.flatMap((component) =>
      component.ports.map((port) => port.mediumId)
    ),
    ...project.topology.connections.map((connection) => connection.mediumId)
  ]) {
    if (mediumId !== null) identities.add(mediumId);
  }

  return identities;
}

function rekeyProjectOwnedValue(
  value: unknown,
  key: string,
  identities: ReadonlyMap<string, string>,
  provenanceMarker: string
): unknown {
  if (typeof value === 'string') {
    const isIdentityReference =
      !EXTERNAL_ID_KEYS.has(key) && (key === 'id' || key.endsWith('Id') || key.endsWith('Ids'));
    return isIdentityReference ? (identities.get(value) ?? value) : value;
  }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => rekeyProjectOwnedValue(entry, key, identities, provenanceMarker));
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => {
      if (entryKey === 'provenance') {
        if (entryValue === null) return [entryKey, provenanceMarker];
        if (typeof entryValue === 'string') {
          return [entryKey, `${provenanceMarker}; ${entryValue}`];
        }
        if (Array.isArray(entryValue)) return [entryKey, [provenanceMarker, ...entryValue]];
      }

      return [entryKey, rekeyProjectOwnedValue(entryValue, entryKey, identities, provenanceMarker)];
    })
  );
}

export function rekeyProjectCopy(project: ProjectDocument): ProjectDocument {
  const sourceProject = projectDocumentSchema.parse(project);
  const identities = new Map(
    [...collectProjectOwnedIds(sourceProject)].map((identity) => [identity, crypto.randomUUID()])
  );
  for (const result of sourceProject.results) {
    if (result.detail?.type !== 'calculation') continue;
    const calculationId = identities.get(result.detail.outcome.trace.calculationId);
    if (calculationId) identities.set(result.id, `result-${calculationId}`);
  }

  const provenanceMarker = `Imported as copy from ${sourceProject.project.id}`;
  const rekeyed = rekeyProjectOwnedValue(
    sourceProject,
    '',
    identities,
    provenanceMarker
  ) as ProjectDocument;
  const copiedResults = rekeyed.results.map((result) => {
    const stale = retainStaleProjectResult({ ...result, sourceRevision: 1, status: 'current' });
    if (stale.detail?.type !== 'validation') return stale;
    return {
      ...stale,
      detail: {
        type: 'validation' as const,
        history: {
          ...stale.detail.history,
          findings: stale.detail.history.findings.map((finding) => ({
            ...finding,
            disposition: { kind: 'unreviewed' as const }
          }))
        }
      }
    };
  });

  return projectDocumentSchema.parse({
    ...rekeyed,
    project: {
      ...rekeyed.project,
      name: `${sourceProject.project.name} copy`,
      revision: 1,
      createdAt: new Date().toISOString()
    },
    results: copiedResults,
    validationApplicabilityDecisions: []
  });
}

export async function commitStagedExchange(
  staged: StagedExchange,
  decision: ExchangeCommitDecision = DEFAULT_EXCHANGE_COMMIT_DECISION,
  library: BrowserProjectLibrary
): Promise<ExchangeCommitOutcome> {
  if (decision === 'cancel') return Object.freeze({ committed: false, reason: 'canceled' });

  const snapshot =
    decision === 'import-copy'
      ? rekeyProjectCopy(staged.envelope.payload)
      : staged.envelope.payload;
  const current = await library.loadProject(snapshot.project.id);
  if (decision === 'replace' && current) {
    await library.createCheckpoint({
      projectId: snapshot.project.id,
      reason: 'before-import-replacement'
    });
  }

  const saved = await library.saveProject({
    projectId: snapshot.project.id,
    expectedRevision: current?.project.revision ?? null,
    snapshot,
    newAssets: staged.assets
  });
  if (!saved.saved) {
    return Object.freeze({
      committed: false,
      reason: saved.reason
    });
  }

  return Object.freeze({
    committed: true,
    decision,
    projectId: snapshot.project.id,
    revision: snapshot.project.revision
  });
}

export type TemplateExchangeCommitDecision = 'replace' | 'import-copy' | 'cancel';

export type TemplateExchangeCommitOutcome =
  | Readonly<{
      committed: true;
      decision: 'replace' | 'import-copy';
      templateIds: readonly string[];
      assetWrites: number;
    }>
  | Readonly<{
      committed: false;
      reason: 'canceled' | 'invalid-structure' | 'quota-exceeded' | 'storage-error';
    }>;

export async function commitStagedTemplateExchange(
  staged: StagedTemplateExchange,
  decision: TemplateExchangeCommitDecision = 'cancel',
  library: BrowserProjectLibrary
): Promise<TemplateExchangeCommitOutcome> {
  if (decision === 'cancel') return Object.freeze({ committed: false, reason: 'canceled' });
  const outcome = await library.importTemplateRevisions({
    templateRevisions: staged.envelope.payload.templateRevisions,
    assets: staged.assets,
    decision
  });
  if (!outcome.imported) return Object.freeze({ committed: false, reason: outcome.reason });
  return Object.freeze({
    committed: true,
    decision,
    templateIds: outcome.templateIds,
    assetWrites: outcome.assetWrites
  });
}

export type LibraryBackupExchangeCommitOutcome =
  | Readonly<{ committed: true; projectCount: number }>
  | Readonly<{ committed: false; reason: 'canceled' | 'invalid-backup' }>;

export async function commitStagedLibraryBackupExchange(
  staged: StagedLibraryBackupExchange,
  decision: 'replace' | 'cancel' = 'cancel',
  library: BrowserProjectLibrary
): Promise<LibraryBackupExchangeCommitOutcome> {
  if (decision === 'cancel') return Object.freeze({ committed: false, reason: 'canceled' });
  const { schemaVersion, createdAt, projects, namedSnapshots, templates, settings } =
    staged.envelope.payload;
  const payload = libraryBackupPayloadSchema.parse({
    schemaVersion,
    createdAt,
    projects,
    namedSnapshots,
    templates,
    settings,
    assets: staged.assets
  });
  const restoredAt = new Date().toISOString();
  const outcome = await library.restoreLibraryBackup({
    payload,
    decision,
    activeGenerationId: crypto.randomUUID(),
    rollbackGenerationId: crypto.randomUUID(),
    restoredAt
  });
  if (!outcome.restored) return Object.freeze({ committed: false, reason: outcome.reason });
  return Object.freeze({ committed: true, projectCount: outcome.projectCount });
}
