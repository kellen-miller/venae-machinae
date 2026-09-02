import { projectDocumentSchema } from '../persistence/project-document';
import { APPLICATION_VERSIONS } from '../version/version-registry';

import type { ProjectDocument } from '../persistence/project-document';

type ReleasedProjectDocumentMigration = Readonly<{
  fromVersion: number;
  toVersion: number;
  migrate(document: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
}>;

export const RELEASED_PROJECT_DOCUMENT_MIGRATIONS: readonly ReleasedProjectDocumentMigration[] =
  Object.freeze([]);

export type ProjectDocumentMigrationOutcome =
  | Readonly<{
      migrated: true;
      document: ProjectDocument;
      appliedVersions: readonly number[];
    }>
  | Readonly<{
      migrated: false;
      reason: 'structure' | 'newer-schema' | 'unsupported-schema';
    }>;

export function migrateProjectDocument(value: unknown): ProjectDocumentMigrationOutcome {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { migrated: false, reason: 'structure' };
  }
  const sourceVersion = (value as Record<string, unknown>).schemaVersion;
  if (typeof sourceVersion !== 'number' || !Number.isInteger(sourceVersion)) {
    return { migrated: false, reason: 'structure' };
  }
  if (sourceVersion > APPLICATION_VERSIONS.projectDocumentSchema) {
    return { migrated: false, reason: 'newer-schema' };
  }

  let current = structuredClone(value) as Readonly<Record<string, unknown>>;
  let currentVersion = sourceVersion;
  const appliedVersions: number[] = [];
  while (currentVersion < APPLICATION_VERSIONS.projectDocumentSchema) {
    const migration = RELEASED_PROJECT_DOCUMENT_MIGRATIONS.find(
      (candidate) =>
        candidate.fromVersion === currentVersion && candidate.toVersion === currentVersion + 1
    );
    if (!migration) return { migrated: false, reason: 'unsupported-schema' };
    current = migration.migrate(current);
    currentVersion += 1;
    if (current.schemaVersion !== currentVersion) {
      return { migrated: false, reason: 'structure' };
    }
    appliedVersions.push(currentVersion);
  }

  const parsed = projectDocumentSchema.safeParse(current);
  if (!parsed.success) return { migrated: false, reason: 'structure' };
  return { migrated: true, document: parsed.data, appliedVersions };
}
