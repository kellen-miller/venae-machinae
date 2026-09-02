import { z } from 'zod';

import { projectDocumentSchema } from './project-document';
import { APPLICATION_VERSIONS } from '../version/version-registry';

import type { DBSchema } from 'idb';

z.config({ jitless: true });

export const PROJECT_LIBRARY_DATABASE_NAME = 'venae-machinae';
export const PROJECT_LIBRARY_DATABASE_VERSION = APPLICATION_VERSIONS.indexedDbStructure;
export const RECOVERY_CHECKPOINT_NEWEST_COUNT = 25;
export const RECOVERY_CHECKPOINT_DAILY_DAYS = 30;
export const TRASH_RETENTION_DAYS = 30;

const identity = z.string().min(1).max(160);
const utcDateTime = z.iso.datetime({ offset: true });
const rasterMimeType = z.enum(['image/png', 'image/jpeg', 'image/webp']);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const storedProjectSchema = z.strictObject({
  projectId: identity,
  revision: z.number().int().nonnegative(),
  snapshot: projectDocumentSchema
});

export const storedAssetSchema = z.strictObject({
  sha256,
  mimeType: rasterMimeType,
  bytes: z.instanceof(Uint8Array)
});

export const recoveryCheckpointSchema = z.strictObject({
  id: identity,
  projectId: identity,
  projectRevision: z.number().int().nonnegative(),
  reason: z.string().min(1).max(240),
  createdAt: utcDateTime,
  snapshot: projectDocumentSchema
});

export const namedSnapshotSchema = z.strictObject({
  id: identity,
  projectId: identity,
  projectRevision: z.number().int().nonnegative(),
  name: z.string().min(1).max(240),
  note: z.string().max(4_000),
  createdAt: utcDateTime,
  snapshot: projectDocumentSchema
});

export const templateRevisionSchema = z.strictObject({
  key: z.string().min(3).max(340),
  templateId: identity,
  revision: z.number().int().positive(),
  label: z.string().min(1).max(240),
  createdAt: utcDateTime,
  definition: z.strictObject({
    id: identity,
    label: z.string().min(1).max(160),
    revision: z.number().int().positive(),
    provenance: z.string().min(1)
  })
});

const projectTrashEntrySchema = z.strictObject({
  id: identity,
  kind: z.literal('project'),
  sourceId: identity,
  deletedAt: utcDateTime,
  expiresAt: utcDateTime,
  project: storedProjectSchema,
  templateRevisions: z.array(templateRevisionSchema).length(0)
});

const templateTrashEntrySchema = z.strictObject({
  id: identity,
  kind: z.literal('template'),
  sourceId: identity,
  deletedAt: utcDateTime,
  expiresAt: utcDateTime,
  project: z.null(),
  templateRevisions: z.array(templateRevisionSchema).min(1)
});

export const trashEntrySchema = z.discriminatedUnion('kind', [
  projectTrashEntrySchema,
  templateTrashEntrySchema
]);

export const quarantinedRecordSchema = z.strictObject({
  id: identity,
  sourceKind: z.enum(['stored-project', 'import']),
  sourceId: identity,
  quarantinedAt: utcDateTime,
  reason: z.string().min(1).max(2_000),
  raw: z.string().min(1)
});

export const librarySettingsSchema = z.strictObject({
  key: z.literal('library'),
  activeGenerationId: identity,
  rollbackGenerationId: identity.nullable(),
  lastLibraryBackupAt: utcDateTime.nullable(),
  lastProjectExports: z.array(z.strictObject({ projectId: identity, exportedAt: utcDateTime })),
  acceptedActionsSinceExport: z.number().int().nonnegative(),
  migrationPending: z.boolean()
});

export const libraryDiagnosticSchema = z.strictObject({
  id: identity,
  kind: z.enum(['save-failure', 'quarantine', 'cleanup', 'restore']),
  recordedAt: utcDateTime,
  message: z.string().min(1).max(2_000)
});

export const libraryBackupPayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  createdAt: utcDateTime,
  projects: z.array(storedProjectSchema),
  namedSnapshots: z.array(namedSnapshotSchema),
  templates: z.array(templateRevisionSchema),
  assets: z.array(storedAssetSchema),
  settings: librarySettingsSchema
});

export const rollbackGenerationSchema = z.strictObject({
  id: identity,
  createdAt: utcDateTime,
  eligibleAfter: utcDateTime,
  replacementOpenedAt: utcDateTime.nullable(),
  laterBackupAt: utcDateTime.nullable(),
  payload: libraryBackupPayloadSchema
});

export type StoredProject = z.infer<typeof storedProjectSchema>;
export type StoredAsset = Readonly<{
  sha256: string;
  mimeType: string;
  bytes: Uint8Array;
}>;
export type RecoveryCheckpoint = z.infer<typeof recoveryCheckpointSchema>;
export type NamedSnapshot = z.infer<typeof namedSnapshotSchema>;
export type TemplateRevision = z.infer<typeof templateRevisionSchema>;
export type TrashEntry = z.infer<typeof trashEntrySchema>;
export type QuarantinedRecord = z.infer<typeof quarantinedRecordSchema>;
export type LibrarySettings = z.infer<typeof librarySettingsSchema>;
export type LibraryDiagnostic = z.infer<typeof libraryDiagnosticSchema>;
export type LibraryBackupPayload = z.infer<typeof libraryBackupPayloadSchema>;
export type RollbackGeneration = z.infer<typeof rollbackGenerationSchema>;

export interface ProjectLibraryDatabase extends DBSchema {
  projects: {
    key: string;
    value: StoredProject;
  };
  assets: {
    key: string;
    value: StoredAsset;
  };
  checkpoints: {
    key: string;
    value: RecoveryCheckpoint;
    indexes: { 'by-project': string };
  };
  namedSnapshots: {
    key: string;
    value: NamedSnapshot;
    indexes: { 'by-project': string };
  };
  templates: {
    key: string;
    value: TemplateRevision;
    indexes: { 'by-template': string };
  };
  trash: {
    key: string;
    value: TrashEntry;
    indexes: { 'by-kind': 'project' | 'template' };
  };
  quarantine: {
    key: string;
    value: QuarantinedRecord;
    indexes: { 'by-source-kind': 'stored-project' | 'import' };
  };
  settings: {
    key: string;
    value: LibrarySettings;
  };
  diagnostics: {
    key: string;
    value: LibraryDiagnostic;
    indexes: { 'by-kind': LibraryDiagnostic['kind'] };
  };
  generations: {
    key: string;
    value: RollbackGeneration;
  };
}
