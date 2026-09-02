import { openDB } from 'idb';

import { createBlankProject as createBlankProjectSnapshot } from '../project/project';
import {
  libraryBackupPayloadSchema,
  libraryDiagnosticSchema,
  librarySettingsSchema,
  namedSnapshotSchema,
  PROJECT_LIBRARY_DATABASE_NAME,
  PROJECT_LIBRARY_DATABASE_VERSION,
  RECOVERY_CHECKPOINT_DAILY_DAYS,
  RECOVERY_CHECKPOINT_NEWEST_COUNT,
  recoveryCheckpointSchema,
  rollbackGenerationSchema,
  quarantinedRecordSchema,
  storedAssetSchema,
  storedProjectSchema,
  templateRevisionSchema,
  TRASH_RETENTION_DAYS,
  trashEntrySchema
} from './database-schema';
import {
  projectDocumentSchema,
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from './project-document';

import type { IDBPDatabase } from 'idb';
import type { PartDefinition, ProjectSnapshot } from '../project/project';
import type {
  LibraryBackupPayload,
  LibraryDiagnostic,
  LibrarySettings,
  NamedSnapshot,
  ProjectLibraryDatabase,
  QuarantinedRecord,
  RecoveryCheckpoint,
  RollbackGeneration,
  StoredAsset,
  TemplateRevision,
  TrashEntry
} from './database-schema';
import type { ProjectDocument } from './project-document';

export type SaveOutcome =
  | { saved: true; revision: number; assetWrites: number }
  | {
      saved: false;
      reason: 'revision-conflict';
      currentRevision: number;
    }
  | { saved: false; reason: 'quota-exceeded' | 'storage-error' };

export const SUBSTANTIAL_EDIT_ACTION_COUNT = 100;

export type RedactedLibraryDiagnostics = Readonly<{
  schemaVersion: 1;
  generatedAt: string;
  redaction: 'project-values-omitted';
  retainedEntryLimit: 200;
  omittedEntryCount: number;
  entries: readonly Readonly<Pick<LibraryDiagnostic, 'kind' | 'recordedAt'>>[];
}>;

function initialLibrarySettings(): LibrarySettings {
  return librarySettingsSchema.parse({
    key: 'library',
    activeGenerationId: crypto.randomUUID(),
    rollbackGenerationId: null,
    lastLibraryBackupAt: null,
    lastProjectExports: [],
    acceptedActionsSinceExport: 0,
    migrationPending: false
  });
}

export class BrowserProjectLibrary {
  constructor(private readonly database: IDBPDatabase<ProjectLibraryDatabase>) {}

  private async quarantineStoredProject(stored: unknown, error: unknown): Promise<void> {
    const sourceId =
      typeof stored === 'object' &&
      stored !== null &&
      'projectId' in stored &&
      typeof stored.projectId === 'string'
        ? stored.projectId
        : crypto.randomUUID();
    const reason =
      `Stored Project is invalid: ${error instanceof Error ? error.message : 'strict validation failed'}`.slice(
        0,
        2_000
      );
    const quarantined = quarantinedRecordSchema.parse({
      id: crypto.randomUUID(),
      sourceKind: 'stored-project',
      sourceId,
      quarantinedAt: new Date().toISOString(),
      reason,
      raw: JSON.stringify(stored)
    });
    const transaction = this.database.transaction(
      ['projects', 'quarantine', 'diagnostics'],
      'readwrite'
    );
    await transaction.objectStore('quarantine').put(quarantined);
    await transaction.objectStore('projects').delete(sourceId);
    await transaction.objectStore('diagnostics').put({
      id: crypto.randomUUID(),
      kind: 'quarantine',
      recordedAt: quarantined.quarantinedAt,
      message: `${sourceId}: ${reason}`
    });
    await transaction.done;
  }

  private async captureLibraryBackupPayload(
    createdAt: string,
    settings: LibrarySettings
  ): Promise<LibraryBackupPayload> {
    return libraryBackupPayloadSchema.parse({
      schemaVersion: 1,
      createdAt,
      projects: await this.database.getAll('projects'),
      namedSnapshots: await this.database.getAll('namedSnapshots'),
      templates: await this.database.getAll('templates'),
      assets: await this.database.getAll('assets'),
      settings
    });
  }

  async saveProject(input: {
    projectId: string;
    expectedRevision: number | null;
    snapshot: ProjectDocument;
    newAssets: readonly StoredAsset[];
  }): Promise<SaveOutcome> {
    const snapshot = projectDocumentSchema.parse(input.snapshot);
    if (snapshot.project.id !== input.projectId) {
      throw new Error('Project ID does not match the whole-snapshot identity');
    }

    const transaction = this.database.transaction(['projects', 'assets', 'settings'], 'readwrite');
    try {
      const current = await transaction.objectStore('projects').get(input.projectId);
      const currentRevision = current?.revision ?? null;
      if (currentRevision !== input.expectedRevision) {
        await transaction.done;
        return {
          saved: false,
          reason: 'revision-conflict',
          currentRevision: currentRevision ?? -1
        };
      }

      let assetWrites = 0;
      const assetStore = transaction.objectStore('assets');
      for (const inputAsset of input.newAssets) {
        const asset = storedAssetSchema.parse(inputAsset);
        if (!(await assetStore.get(asset.sha256))) {
          await assetStore.put(structuredClone(asset));
          assetWrites += 1;
        }
      }

      await transaction.objectStore('projects').put(
        storedProjectSchema.parse({
          projectId: input.projectId,
          revision: snapshot.project.revision,
          snapshot
        })
      );
      const settingsStore = transaction.objectStore('settings');
      const settings = librarySettingsSchema.parse(
        (await settingsStore.get('library')) ?? initialLibrarySettings()
      );
      const acceptedActions =
        input.expectedRevision === null
          ? 0
          : Math.max(0, snapshot.project.revision - input.expectedRevision);
      await settingsStore.put({
        ...settings,
        acceptedActionsSinceExport: settings.acceptedActionsSinceExport + acceptedActions
      });
      await transaction.done;
      return { saved: true, revision: snapshot.project.revision, assetWrites };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction already aborted or completed.
      }

      await transaction.done.catch(() => undefined);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        return { saved: false, reason: 'quota-exceeded' };
      }

      return { saved: false, reason: 'storage-error' };
    }
  }

  async loadProject(projectId: string): Promise<ProjectDocument | undefined> {
    const stored = await this.database.get('projects', projectId);
    if (!stored) return undefined;
    try {
      return projectDocumentSchema.parse(storedProjectSchema.parse(stored).snapshot);
    } catch (error) {
      await this.quarantineStoredProject(stored, error);
      return undefined;
    }
  }

  async createBlankProject(input: {
    id: string;
    name: string;
    createdAt: string;
  }): Promise<
    | { created: true; snapshot: ProjectSnapshot }
    | { created: false; reason: 'already-exists' | 'quota-exceeded' | 'storage-error' }
  > {
    const snapshot = createBlankProjectSnapshot(input);
    const outcome = await this.saveProject({
      projectId: snapshot.id,
      expectedRevision: null,
      snapshot: projectSnapshotToDocument(snapshot),
      newAssets: []
    });
    if (outcome.saved) return { created: true, snapshot };
    if (outcome.reason === 'revision-conflict') return { created: false, reason: 'already-exists' };
    return { created: false, reason: outcome.reason };
  }

  async duplicateProject(input: {
    sourceProjectId: string;
    id: string;
    name: string;
    createdAt: string;
  }): Promise<
    | { duplicated: true; snapshot: ProjectSnapshot }
    | {
        duplicated: false;
        reason: 'missing-project' | 'already-exists' | 'quota-exceeded' | 'storage-error';
      }
  > {
    const source = await this.openProject(input.sourceProjectId);
    if (!source) return { duplicated: false, reason: 'missing-project' };

    const snapshot: ProjectSnapshot = {
      ...structuredClone(source),
      id: input.id,
      name: input.name,
      createdAt: input.createdAt,
      revision: 0,
      results: source.results.map((result) =>
        result.status === 'current' ? { ...result, status: 'stale' as const } : result
      )
    };
    const outcome = await this.saveProject({
      projectId: snapshot.id,
      expectedRevision: null,
      snapshot: projectSnapshotToDocument(snapshot),
      newAssets: []
    });
    if (outcome.saved) return { duplicated: true, snapshot };
    if (outcome.reason === 'revision-conflict') {
      return { duplicated: false, reason: 'already-exists' };
    }

    return { duplicated: false, reason: outcome.reason };
  }

  async listProjects(): Promise<
    readonly Readonly<{
      id: string;
      name: string;
      revision: number;
      createdAt: string;
    }>[]
  > {
    const projects = await this.database.getAll('projects');
    const listings = [];
    for (const stored of projects) {
      try {
        const document = projectDocumentSchema.parse(storedProjectSchema.parse(stored).snapshot);
        listings.push({
          id: document.project.id,
          name: document.project.name,
          revision: document.project.revision,
          createdAt: document.project.createdAt
        });
      } catch (error) {
        await this.quarantineStoredProject(stored, error);
      }
    }

    return listings.sort(
      (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
    );
  }

  async openProject(projectId: string): Promise<ProjectSnapshot | undefined> {
    const document = await this.loadProject(projectId);
    return document ? projectDocumentToSnapshot(document) : undefined;
  }

  async createCheckpoint(input: {
    checkpointId?: string;
    projectId: string;
    reason: string;
    createdAt?: string;
  }): Promise<
    | { created: true; checkpointId: string; projectRevision: number }
    | { created: false; reason: 'missing-project' }
  > {
    const transaction = this.database.transaction(['projects', 'checkpoints'], 'readwrite');
    const project = await transaction.objectStore('projects').get(input.projectId);
    if (!project) {
      await transaction.done;
      return { created: false, reason: 'missing-project' };
    }

    const checkpointId = input.checkpointId ?? crypto.randomUUID();
    const checkpoint = recoveryCheckpointSchema.parse({
      id: checkpointId,
      projectId: input.projectId,
      projectRevision: project.revision,
      reason: input.reason,
      createdAt: input.createdAt ?? new Date().toISOString(),
      snapshot: structuredClone(project.snapshot)
    });
    await transaction.objectStore('checkpoints').put(checkpoint);
    await transaction.done;
    return { created: true, checkpointId, projectRevision: project.revision };
  }

  async listCheckpoints(projectId: string): Promise<readonly RecoveryCheckpoint[]> {
    const checkpoints = await this.database.getAllFromIndex('checkpoints', 'by-project', projectId);
    return checkpoints
      .map((checkpoint) => recoveryCheckpointSchema.parse(checkpoint))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async createNamedSnapshot(input: {
    id: string;
    projectId: string;
    name: string;
    note: string;
    createdAt: string;
  }): Promise<
    | { created: true; projectRevision: number }
    | { created: false; reason: 'missing-project' | 'already-exists' }
  > {
    const transaction = this.database.transaction(['projects', 'namedSnapshots'], 'readwrite');
    const project = await transaction.objectStore('projects').get(input.projectId);
    if (!project) {
      await transaction.done;
      return { created: false, reason: 'missing-project' };
    }
    if (await transaction.objectStore('namedSnapshots').get(input.id)) {
      await transaction.done;
      return { created: false, reason: 'already-exists' };
    }

    const namedSnapshot = namedSnapshotSchema.parse({
      id: input.id,
      projectId: input.projectId,
      projectRevision: project.revision,
      name: input.name,
      note: input.note,
      createdAt: input.createdAt,
      snapshot: structuredClone(project.snapshot)
    });
    await transaction.objectStore('namedSnapshots').put(namedSnapshot);
    await transaction.done;
    return { created: true, projectRevision: project.revision };
  }

  async updateNamedSnapshotMetadata(input: {
    id: string;
    name: string;
    note: string;
  }): Promise<{ updated: true } | { updated: false; reason: 'missing-snapshot' }> {
    const transaction = this.database.transaction('namedSnapshots', 'readwrite');
    const store = transaction.objectStore('namedSnapshots');
    const namedSnapshot = await store.get(input.id);
    if (!namedSnapshot) {
      await transaction.done;
      return { updated: false, reason: 'missing-snapshot' };
    }

    await store.put(
      namedSnapshotSchema.parse({ ...namedSnapshot, name: input.name, note: input.note })
    );
    await transaction.done;
    return { updated: true };
  }

  async listNamedSnapshots(projectId: string): Promise<readonly NamedSnapshot[]> {
    const namedSnapshots = await this.database.getAllFromIndex(
      'namedSnapshots',
      'by-project',
      projectId
    );
    return namedSnapshots
      .map((namedSnapshot) => namedSnapshotSchema.parse(namedSnapshot))
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
      );
  }

  async restoreNamedSnapshot(input: {
    id: string;
    checkpointId: string;
    restoredAt: string;
  }): Promise<
    | { restored: true; projectId: string; revision: number }
    | { restored: false; reason: 'missing-snapshot' | 'missing-project' }
  > {
    const transaction = this.database.transaction(
      ['projects', 'checkpoints', 'namedSnapshots'],
      'readwrite'
    );
    const namedSnapshot = await transaction.objectStore('namedSnapshots').get(input.id);
    if (!namedSnapshot) {
      await transaction.done;
      return { restored: false, reason: 'missing-snapshot' };
    }
    const project = await transaction.objectStore('projects').get(namedSnapshot.projectId);
    if (!project) {
      await transaction.done;
      return { restored: false, reason: 'missing-project' };
    }

    await transaction.objectStore('checkpoints').put(
      recoveryCheckpointSchema.parse({
        id: input.checkpointId,
        projectId: project.projectId,
        projectRevision: project.revision,
        reason: 'before-named-snapshot-restore',
        createdAt: input.restoredAt,
        snapshot: structuredClone(project.snapshot)
      })
    );
    const restoredSnapshot = projectDocumentSchema.parse({
      ...structuredClone(namedSnapshot.snapshot),
      project: {
        ...namedSnapshot.snapshot.project,
        id: project.projectId,
        revision: project.revision + 1
      }
    });
    await transaction.objectStore('projects').put({
      projectId: project.projectId,
      revision: restoredSnapshot.project.revision,
      snapshot: restoredSnapshot
    });
    await transaction.done;
    return {
      restored: true,
      projectId: project.projectId,
      revision: restoredSnapshot.project.revision
    };
  }

  async trashProject(input: {
    projectId: string;
    trashId: string;
    deletedAt: string;
  }): Promise<
    | { trashed: true; expiresAt: string }
    | { trashed: false; reason: 'missing-project' | 'already-exists' }
  > {
    const transaction = this.database.transaction(['projects', 'trash'], 'readwrite');
    const project = await transaction.objectStore('projects').get(input.projectId);
    if (!project) {
      await transaction.done;
      return { trashed: false, reason: 'missing-project' };
    }
    if (await transaction.objectStore('trash').get(input.trashId)) {
      await transaction.done;
      return { trashed: false, reason: 'already-exists' };
    }

    const expiresAt = new Date(
      Date.parse(input.deletedAt) + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1_000
    ).toISOString();
    const trashEntry = trashEntrySchema.parse({
      id: input.trashId,
      kind: 'project',
      sourceId: input.projectId,
      deletedAt: input.deletedAt,
      expiresAt,
      project: structuredClone(project),
      templateRevisions: []
    });
    await transaction.objectStore('trash').put(trashEntry);
    await transaction.objectStore('projects').delete(input.projectId);
    await transaction.done;
    return { trashed: true, expiresAt };
  }

  async listTrash(): Promise<readonly TrashEntry[]> {
    const entries = await this.database.getAll('trash');
    return entries
      .map((entry) => trashEntrySchema.parse(entry))
      .sort(
        (left, right) =>
          left.deletedAt.localeCompare(right.deletedAt) || left.id.localeCompare(right.id)
      );
  }

  async restoreTrash(
    trashId: string
  ): Promise<
    | { restored: true; kind: 'project' | 'template'; sourceId: string }
    | { restored: false; reason: 'missing-entry' | 'identity-conflict' }
  > {
    const transaction = this.database.transaction(['projects', 'templates', 'trash'], 'readwrite');
    const entry = await transaction.objectStore('trash').get(trashId);
    if (!entry) {
      await transaction.done;
      return { restored: false, reason: 'missing-entry' };
    }
    const parsed = trashEntrySchema.parse(entry);
    if (parsed.kind === 'project') {
      if (await transaction.objectStore('projects').get(parsed.sourceId)) {
        await transaction.done;
        return { restored: false, reason: 'identity-conflict' };
      }
      await transaction.objectStore('projects').put(structuredClone(parsed.project));
    } else {
      const existing = await transaction
        .objectStore('templates')
        .index('by-template')
        .getAll(parsed.sourceId);
      if (existing.length > 0) {
        await transaction.done;
        return { restored: false, reason: 'identity-conflict' };
      }
      for (const revision of parsed.templateRevisions) {
        await transaction.objectStore('templates').put(structuredClone(revision));
      }
    }

    await transaction.objectStore('trash').delete(trashId);
    await transaction.done;
    return { restored: true, kind: parsed.kind, sourceId: parsed.sourceId };
  }

  async reclaimDisposableRecords(input: {
    now: string;
  }): Promise<{ deletedCheckpoints: number; deletedTrashEntries: number }> {
    const now = Date.parse(input.now);
    if (!Number.isFinite(now)) throw new Error('Cleanup time must be an RFC 3339 timestamp');
    const transaction = this.database.transaction(['checkpoints', 'trash'], 'readwrite');
    const checkpoints = await transaction.objectStore('checkpoints').getAll();
    const byProject = new Map<string, RecoveryCheckpoint[]>();
    for (const unknownCheckpoint of checkpoints) {
      const checkpoint = recoveryCheckpointSchema.parse(unknownCheckpoint);
      const projectCheckpoints = byProject.get(checkpoint.projectId) ?? [];
      projectCheckpoints.push(checkpoint);
      byProject.set(checkpoint.projectId, projectCheckpoints);
    }

    let deletedCheckpoints = 0;
    const dailyCutoff = now - RECOVERY_CHECKPOINT_DAILY_DAYS * 24 * 60 * 60 * 1_000;
    for (const projectCheckpoints of byProject.values()) {
      const newestFirst = projectCheckpoints.sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      );
      const retainedIds = new Set(
        newestFirst.slice(0, RECOVERY_CHECKPOINT_NEWEST_COUNT).map((checkpoint) => checkpoint.id)
      );
      const retainedDays = new Set<string>();
      for (const checkpoint of newestFirst) {
        if (Date.parse(checkpoint.createdAt) < dailyCutoff) continue;
        const day = checkpoint.createdAt.slice(0, 10);
        if (retainedDays.has(day)) continue;
        retainedDays.add(day);
        retainedIds.add(checkpoint.id);
      }
      for (const checkpoint of newestFirst) {
        if (retainedIds.has(checkpoint.id)) continue;
        await transaction.objectStore('checkpoints').delete(checkpoint.id);
        deletedCheckpoints += 1;
      }
    }

    let deletedTrashEntries = 0;
    for (const unknownEntry of await transaction.objectStore('trash').getAll()) {
      const entry = trashEntrySchema.parse(unknownEntry);
      if (Date.parse(entry.expiresAt) > now) continue;
      await transaction.objectStore('trash').delete(entry.id);
      deletedTrashEntries += 1;
    }
    await transaction.done;
    return { deletedCheckpoints, deletedTrashEntries };
  }

  async createTemplateRevision(input: {
    templateId: string;
    revision: number;
    label: string;
    createdAt: string;
    definition: PartDefinition;
  }): Promise<{ created: true } | { created: false; reason: 'already-exists' }> {
    const key = `${input.templateId}:${input.revision}`;
    const transaction = this.database.transaction('templates', 'readwrite');
    const store = transaction.objectStore('templates');
    if (await store.get(key)) {
      await transaction.done;
      return { created: false, reason: 'already-exists' };
    }
    if (input.definition.revision !== input.revision) {
      transaction.abort();
      await transaction.done.catch(() => undefined);
      throw new Error('Template revision and Part Definition revision must match');
    }

    await store.put(
      templateRevisionSchema.parse({
        key,
        templateId: input.templateId,
        revision: input.revision,
        label: input.label,
        createdAt: input.createdAt,
        definition: structuredClone(input.definition)
      })
    );
    await transaction.done;
    return { created: true };
  }

  async listTemplateRevisions(templateId: string): Promise<readonly TemplateRevision[]> {
    const revisions = await this.database.getAllFromIndex('templates', 'by-template', templateId);
    return revisions
      .map((revision) => templateRevisionSchema.parse(revision))
      .sort((left, right) => left.revision - right.revision);
  }

  async listAllTemplateRevisions(): Promise<readonly TemplateRevision[]> {
    const revisions = await this.database.getAll('templates');
    return revisions
      .map((revision) => templateRevisionSchema.parse(revision))
      .sort(
        (left, right) =>
          left.templateId.localeCompare(right.templateId) || left.revision - right.revision
      );
  }

  async importTemplateRevisions(input: {
    templateRevisions: readonly TemplateRevision[];
    assets: readonly StoredAsset[];
    decision: 'replace' | 'import-copy';
  }): Promise<
    | {
        imported: true;
        templateIds: readonly string[];
        assetWrites: number;
      }
    | { imported: false; reason: 'invalid-structure' | 'quota-exceeded' | 'storage-error' }
  > {
    const revisions = input.templateRevisions.map((revision) =>
      templateRevisionSchema.parse(revision)
    );
    const assets = input.assets.map((asset) => storedAssetSchema.parse(asset));
    if (
      new Set(revisions.map((revision) => revision.key)).size !== revisions.length ||
      new Set(assets.map((asset) => asset.sha256)).size !== assets.length ||
      revisions.some(
        (revision) =>
          revision.key !== `${revision.templateId}:${revision.revision}` ||
          revision.definition.revision !== revision.revision
      )
    ) {
      return { imported: false, reason: 'invalid-structure' };
    }

    const templateIds = new Map<string, string>();
    const definitionIds = new Map<string, string>();
    for (const revision of revisions) {
      if (!templateIds.has(revision.templateId)) {
        templateIds.set(
          revision.templateId,
          input.decision === 'import-copy' ? crypto.randomUUID() : revision.templateId
        );
      }
      if (!definitionIds.has(revision.definition.id)) {
        definitionIds.set(
          revision.definition.id,
          input.decision === 'import-copy' ? crypto.randomUUID() : revision.definition.id
        );
      }
    }
    const imported = revisions.map((revision) => {
      const templateId = templateIds.get(revision.templateId)!;
      return templateRevisionSchema.parse({
        ...structuredClone(revision),
        key: `${templateId}:${revision.revision}`,
        templateId,
        label: input.decision === 'import-copy' ? `${revision.label} copy` : revision.label,
        definition: {
          ...structuredClone(revision.definition),
          id: definitionIds.get(revision.definition.id),
          provenance:
            input.decision === 'import-copy'
              ? `Imported as copy from template ${revision.templateId} revision ${revision.revision}; ${revision.definition.provenance}`
              : revision.definition.provenance
        }
      });
    });

    const transaction = this.database.transaction(['templates', 'assets'], 'readwrite');
    try {
      if (input.decision === 'replace') {
        for (const templateId of templateIds.keys()) {
          const existing = await transaction
            .objectStore('templates')
            .index('by-template')
            .getAll(templateId);
          for (const revision of existing) {
            await transaction.objectStore('templates').delete(revision.key);
          }
        }
      }
      for (const revision of imported) {
        await transaction.objectStore('templates').put(structuredClone(revision));
      }
      let assetWrites = 0;
      for (const asset of assets) {
        if (await transaction.objectStore('assets').get(asset.sha256)) continue;
        await transaction.objectStore('assets').put(structuredClone(asset));
        assetWrites += 1;
      }
      await transaction.done;
      return {
        imported: true,
        templateIds: [...new Set(imported.map((revision) => revision.templateId))].sort(),
        assetWrites
      };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction already aborted or completed.
      }
      await transaction.done.catch(() => undefined);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        return { imported: false, reason: 'quota-exceeded' };
      }
      return { imported: false, reason: 'storage-error' };
    }
  }

  async copyTemplateDefinition(input: {
    templateId: string;
    revision: number;
    definitionId: string;
  }): Promise<
    | { copied: true; definition: PartDefinition }
    | { copied: false; reason: 'missing-template-revision' }
  > {
    const stored = await this.database.get('templates', `${input.templateId}:${input.revision}`);
    if (!stored) return { copied: false, reason: 'missing-template-revision' };
    const revision = templateRevisionSchema.parse(stored);
    return {
      copied: true,
      definition: {
        ...structuredClone(revision.definition),
        id: input.definitionId,
        provenance: `Copied from template ${input.templateId} revision ${input.revision}; ${revision.definition.provenance}`
      }
    };
  }

  async trashTemplate(input: {
    templateId: string;
    trashId: string;
    deletedAt: string;
  }): Promise<
    | { trashed: true; expiresAt: string }
    | { trashed: false; reason: 'missing-template' | 'already-exists' }
  > {
    const transaction = this.database.transaction(['templates', 'trash'], 'readwrite');
    const revisions = await transaction
      .objectStore('templates')
      .index('by-template')
      .getAll(input.templateId);
    if (revisions.length === 0) {
      await transaction.done;
      return { trashed: false, reason: 'missing-template' };
    }
    if (await transaction.objectStore('trash').get(input.trashId)) {
      await transaction.done;
      return { trashed: false, reason: 'already-exists' };
    }

    const expiresAt = new Date(
      Date.parse(input.deletedAt) + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1_000
    ).toISOString();
    await transaction.objectStore('trash').put(
      trashEntrySchema.parse({
        id: input.trashId,
        kind: 'template',
        sourceId: input.templateId,
        deletedAt: input.deletedAt,
        expiresAt,
        project: null,
        templateRevisions: structuredClone(revisions)
      })
    );
    for (const revision of revisions) {
      await transaction.objectStore('templates').delete(revision.key);
    }
    await transaction.done;
    return { trashed: true, expiresAt };
  }

  async createLibraryBackup(input: {
    createdAt: string;
  }): Promise<{ created: true; payload: LibraryBackupPayload }> {
    const currentSettings = librarySettingsSchema.parse(
      (await this.database.get('settings', 'library')) ?? initialLibrarySettings()
    );
    const settings = librarySettingsSchema.parse({
      ...currentSettings,
      lastLibraryBackupAt: input.createdAt
    });
    const payload = await this.captureLibraryBackupPayload(input.createdAt, settings);
    const transaction = this.database.transaction(['settings', 'generations'], 'readwrite');
    await transaction.objectStore('settings').put(settings);
    if (settings.rollbackGenerationId) {
      const rollback = await transaction
        .objectStore('generations')
        .get(settings.rollbackGenerationId);
      if (rollback) {
        await transaction
          .objectStore('generations')
          .put(rollbackGenerationSchema.parse({ ...rollback, laterBackupAt: input.createdAt }));
      }
    }
    await transaction.done;
    return { created: true, payload };
  }

  previewLibraryBackup(payload: unknown):
    | {
        valid: true;
        projectCount: number;
        namedSnapshotCount: number;
        templateRevisionCount: number;
        assetCount: number;
        defaultDecision: 'cancel';
      }
    | { valid: false; reason: 'invalid-structure' | 'duplicate-identity' } {
    const parsed = libraryBackupPayloadSchema.safeParse(payload);
    if (!parsed.success) return { valid: false, reason: 'invalid-structure' };
    const identities = [
      parsed.data.projects.map((project) => project.projectId),
      parsed.data.namedSnapshots.map((snapshot) => snapshot.id),
      parsed.data.templates.map((revision) => revision.key),
      parsed.data.assets.map((asset) => asset.sha256)
    ];
    if (identities.some((values) => new Set(values).size !== values.length)) {
      return { valid: false, reason: 'duplicate-identity' };
    }
    return {
      valid: true,
      projectCount: parsed.data.projects.length,
      namedSnapshotCount: parsed.data.namedSnapshots.length,
      templateRevisionCount: parsed.data.templates.length,
      assetCount: parsed.data.assets.length,
      defaultDecision: 'cancel'
    };
  }

  async restoreLibraryBackup(input: {
    payload: unknown;
    decision: 'replace' | 'cancel';
    activeGenerationId: string;
    rollbackGenerationId: string;
    restoredAt: string;
  }): Promise<
    | { restored: true; projectCount: number }
    | { restored: false; reason: 'canceled' | 'invalid-backup' }
  > {
    if (input.decision === 'cancel') return { restored: false, reason: 'canceled' };
    const preview = this.previewLibraryBackup(input.payload);
    if (!preview.valid) return { restored: false, reason: 'invalid-backup' };
    const payload = libraryBackupPayloadSchema.parse(input.payload);
    const currentSettings = librarySettingsSchema.parse(
      (await this.database.get('settings', 'library')) ?? initialLibrarySettings()
    );
    const rollbackPayload = await this.captureLibraryBackupPayload(
      input.restoredAt,
      currentSettings
    );
    const eligibleAfter = new Date(
      Date.parse(input.restoredAt) + 7 * 24 * 60 * 60 * 1_000
    ).toISOString();
    const rollback = rollbackGenerationSchema.parse({
      id: input.rollbackGenerationId,
      createdAt: input.restoredAt,
      eligibleAfter,
      replacementOpenedAt: null,
      laterBackupAt: null,
      payload: rollbackPayload
    });
    const settings = librarySettingsSchema.parse({
      ...payload.settings,
      activeGenerationId: input.activeGenerationId,
      rollbackGenerationId: input.rollbackGenerationId
    });
    const transaction = this.database.transaction(
      [
        'projects',
        'assets',
        'checkpoints',
        'namedSnapshots',
        'templates',
        'trash',
        'quarantine',
        'settings',
        'diagnostics',
        'generations'
      ],
      'readwrite'
    );
    await transaction.objectStore('generations').put(rollback);
    for (const storeName of [
      'projects',
      'assets',
      'checkpoints',
      'namedSnapshots',
      'templates',
      'trash',
      'quarantine',
      'diagnostics'
    ] as const) {
      await transaction.objectStore(storeName).clear();
    }
    for (const project of payload.projects) {
      await transaction.objectStore('projects').put(structuredClone(project));
    }
    for (const asset of payload.assets) {
      await transaction.objectStore('assets').put(structuredClone(asset));
    }
    for (const namedSnapshot of payload.namedSnapshots) {
      await transaction.objectStore('namedSnapshots').put(structuredClone(namedSnapshot));
    }
    for (const template of payload.templates) {
      await transaction.objectStore('templates').put(structuredClone(template));
    }
    await transaction.objectStore('settings').put(settings);
    await transaction.objectStore('diagnostics').put({
      id: crypto.randomUUID(),
      kind: 'restore',
      recordedAt: input.restoredAt,
      message: `Replaced the active library with generation ${input.activeGenerationId}`
    });
    await transaction.done;
    return { restored: true, projectCount: payload.projects.length };
  }

  async listRollbackGenerations(): Promise<readonly RollbackGeneration[]> {
    const generations = await this.database.getAll('generations');
    return generations
      .map((generation) => rollbackGenerationSchema.parse(generation))
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
      );
  }

  async markReplacementOpened(openedAt: string): Promise<{ marked: boolean }> {
    const transaction = this.database.transaction(['settings', 'generations'], 'readwrite');
    const settings = await transaction.objectStore('settings').get('library');
    const rollbackId = settings?.rollbackGenerationId;
    if (!rollbackId) {
      await transaction.done;
      return { marked: false };
    }
    const rollback = await transaction.objectStore('generations').get(rollbackId);
    if (!rollback) {
      await transaction.done;
      return { marked: false };
    }

    await transaction
      .objectStore('generations')
      .put(rollbackGenerationSchema.parse({ ...rollback, replacementOpenedAt: openedAt }));
    await transaction.done;
    return { marked: true };
  }

  async reclaimRollbackGenerations(input: {
    now: string;
  }): Promise<{ deletedGenerations: number }> {
    const transaction = this.database.transaction(['settings', 'generations'], 'readwrite');
    const settings = librarySettingsSchema.parse(
      (await transaction.objectStore('settings').get('library')) ?? initialLibrarySettings()
    );
    let deletedGenerations = 0;
    for (const unknownGeneration of await transaction.objectStore('generations').getAll()) {
      const generation = rollbackGenerationSchema.parse(unknownGeneration);
      if (
        !generation.replacementOpenedAt ||
        !generation.laterBackupAt ||
        Date.parse(generation.eligibleAfter) > Date.parse(input.now)
      ) {
        continue;
      }
      await transaction.objectStore('generations').delete(generation.id);
      deletedGenerations += 1;
      if (settings.rollbackGenerationId === generation.id) {
        await transaction.objectStore('settings').put({
          ...settings,
          rollbackGenerationId: null
        });
      }
    }
    await transaction.done;
    return { deletedGenerations };
  }

  async listQuarantine(): Promise<readonly QuarantinedRecord[]> {
    const records = await this.database.getAll('quarantine');
    return records
      .map((record) => quarantinedRecordSchema.parse(record))
      .sort(
        (left, right) =>
          left.quarantinedAt.localeCompare(right.quarantinedAt) || left.id.localeCompare(right.id)
      );
  }

  async createRedactedDiagnostics(generatedAt: string): Promise<RedactedLibraryDiagnostics> {
    const diagnostics = (await this.database.getAll('diagnostics'))
      .map((diagnostic) => libraryDiagnosticSchema.parse(diagnostic))
      .sort(
        (left, right) =>
          left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id)
      );
    const retained = diagnostics.slice(-200);
    return {
      schemaVersion: 1,
      generatedAt,
      redaction: 'project-values-omitted',
      retainedEntryLimit: 200,
      omittedEntryCount: diagnostics.length - retained.length,
      entries: retained.map(({ kind, recordedAt }) => ({ kind, recordedAt }))
    };
  }

  async quarantineImport(input: {
    sourceId: string;
    raw: string;
    reason: string;
    quarantinedAt: string;
  }): Promise<{ quarantined: true; quarantineId: string }> {
    const quarantineId = crypto.randomUUID();
    const record = quarantinedRecordSchema.parse({
      id: quarantineId,
      sourceKind: 'import',
      sourceId: input.sourceId.slice(0, 160) || 'unnamed-import',
      quarantinedAt: input.quarantinedAt,
      reason: input.reason.slice(0, 2_000),
      raw: input.raw
    });
    const transaction = this.database.transaction(['quarantine', 'diagnostics'], 'readwrite');
    await transaction.objectStore('quarantine').put(record);
    await transaction.objectStore('diagnostics').put({
      id: crypto.randomUUID(),
      kind: 'quarantine',
      recordedAt: input.quarantinedAt,
      message: `${record.sourceId}: ${record.reason}`
    });
    await transaction.done;
    return { quarantined: true, quarantineId };
  }

  async exportQuarantinedRaw(quarantineId: string): Promise<string | undefined> {
    const record = await this.database.get('quarantine', quarantineId);
    return record ? quarantinedRecordSchema.parse(record).raw : undefined;
  }

  async recordProjectExport(input: { projectId: string; exportedAt: string }): Promise<void> {
    const transaction = this.database.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');
    const settings = librarySettingsSchema.parse(
      (await store.get('library')) ?? initialLibrarySettings()
    );
    await store.put(
      librarySettingsSchema.parse({
        ...settings,
        lastProjectExports: [
          ...settings.lastProjectExports.filter((entry) => entry.projectId !== input.projectId),
          input
        ].sort((left, right) => left.projectId.localeCompare(right.projectId)),
        acceptedActionsSinceExport: 0
      })
    );
    await transaction.done;
  }

  async setMigrationPending(migrationPending: boolean): Promise<void> {
    const transaction = this.database.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');
    const settings = librarySettingsSchema.parse(
      (await store.get('library')) ?? initialLibrarySettings()
    );
    await store.put({ ...settings, migrationPending });
    await transaction.done;
  }

  async readBackupHealth(input: { now: string }): Promise<{
    lastLibraryBackupAt: string | null;
    lastProjectExports: readonly Readonly<{ projectId: string; exportedAt: string }>[];
    acceptedActionsSinceExport: number;
    reminders: readonly ('backup-overdue' | 'substantial-editing' | 'migration-pending')[];
    deviceLossBoundary: 'downloaded-library-backup';
  }> {
    const settings = librarySettingsSchema.parse(
      (await this.database.get('settings', 'library')) ?? initialLibrarySettings()
    );
    const reminders: Array<'backup-overdue' | 'substantial-editing' | 'migration-pending'> = [];
    const sevenDaysAgo = Date.parse(input.now) - 7 * 24 * 60 * 60 * 1_000;
    if (
      settings.lastLibraryBackupAt === null ||
      Date.parse(settings.lastLibraryBackupAt) <= sevenDaysAgo
    ) {
      reminders.push('backup-overdue');
    }
    if (settings.acceptedActionsSinceExport >= SUBSTANTIAL_EDIT_ACTION_COUNT) {
      reminders.push('substantial-editing');
    }
    if (settings.migrationPending) reminders.push('migration-pending');
    return {
      lastLibraryBackupAt: settings.lastLibraryBackupAt,
      lastProjectExports: settings.lastProjectExports,
      acceptedActionsSinceExport: settings.acceptedActionsSinceExport,
      reminders,
      deviceLossBoundary: 'downloaded-library-backup'
    };
  }

  countAssets(): Promise<number> {
    return this.database.count('assets');
  }

  async loadAssets(assetHashes: readonly string[]): Promise<readonly StoredAsset[]> {
    const assets: StoredAsset[] = [];
    for (const assetHash of assetHashes) {
      const asset = await this.database.get('assets', assetHash);
      if (asset) assets.push(asset);
    }

    return assets;
  }

  close(): void {
    this.database.close();
  }
}

export async function openProjectLibrary(): Promise<BrowserProjectLibrary> {
  const database = await openDB<ProjectLibraryDatabase>(
    PROJECT_LIBRARY_DATABASE_NAME,
    PROJECT_LIBRARY_DATABASE_VERSION,
    {
      upgrade(upgradeDatabase, oldVersion) {
        if (oldVersion < 1) {
          upgradeDatabase.createObjectStore('projects', { keyPath: 'projectId' });
          upgradeDatabase.createObjectStore('assets', { keyPath: 'sha256' });
          const checkpoints = upgradeDatabase.createObjectStore('checkpoints', { keyPath: 'id' });
          checkpoints.createIndex('by-project', 'projectId');
        }
        if (oldVersion < 2) {
          const namedSnapshots = upgradeDatabase.createObjectStore('namedSnapshots', {
            keyPath: 'id'
          });
          namedSnapshots.createIndex('by-project', 'projectId');
          const templates = upgradeDatabase.createObjectStore('templates', { keyPath: 'key' });
          templates.createIndex('by-template', 'templateId');
          const trash = upgradeDatabase.createObjectStore('trash', { keyPath: 'id' });
          trash.createIndex('by-kind', 'kind');
          const quarantine = upgradeDatabase.createObjectStore('quarantine', { keyPath: 'id' });
          quarantine.createIndex('by-source-kind', 'sourceKind');
          upgradeDatabase.createObjectStore('settings', { keyPath: 'key' });
          const diagnostics = upgradeDatabase.createObjectStore('diagnostics', { keyPath: 'id' });
          diagnostics.createIndex('by-kind', 'kind');
          upgradeDatabase.createObjectStore('generations', { keyPath: 'id' });
        }
      }
    }
  );
  if (!(await database.get('settings', 'library'))) {
    await database.put('settings', initialLibrarySettings());
  }
  return new BrowserProjectLibrary(database);
}
