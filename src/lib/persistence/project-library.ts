import { openDB } from 'idb';

import { PROJECT_LIBRARY_DATABASE_NAME, PROJECT_LIBRARY_DATABASE_VERSION } from './database-schema';
import { projectDocumentSchema } from './project-document';

import type { IDBPDatabase } from 'idb';
import type { ProjectLibraryDatabase, RecoveryCheckpoint, StoredAsset } from './database-schema';
import type { ProjectDocument } from './project-document';

export type SaveOutcome =
  | { saved: true; revision: number; assetWrites: number }
  | {
      saved: false;
      reason: 'revision-conflict';
      currentRevision: number;
    }
  | { saved: false; reason: 'quota-exceeded' | 'storage-error' };

export class BrowserProjectLibrary {
  constructor(private readonly database: IDBPDatabase<ProjectLibraryDatabase>) {}

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

    const transaction = this.database.transaction(['projects', 'assets'], 'readwrite');
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
      for (const asset of input.newAssets) {
        if (!(await assetStore.get(asset.sha256))) {
          await assetStore.put(structuredClone(asset));
          assetWrites += 1;
        }
      }

      await transaction.objectStore('projects').put({
        projectId: input.projectId,
        revision: snapshot.project.revision,
        snapshot
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
    return stored ? projectDocumentSchema.parse(stored.snapshot) : undefined;
  }

  async createCheckpoint(input: {
    projectId: string;
    reason: string;
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

    const checkpointId = crypto.randomUUID();
    await transaction.objectStore('checkpoints').put({
      id: checkpointId,
      projectId: input.projectId,
      projectRevision: project.revision,
      reason: input.reason,
      createdAt: new Date().toISOString(),
      snapshot: structuredClone(project.snapshot)
    });
    await transaction.done;
    return { created: true, checkpointId, projectRevision: project.revision };
  }

  async listCheckpoints(projectId: string): Promise<readonly RecoveryCheckpoint[]> {
    const checkpoints = await this.database.getAllFromIndex('checkpoints', 'by-project', projectId);
    return checkpoints.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  countAssets(): Promise<number> {
    return this.database.count('assets');
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
      upgrade(upgradeDatabase) {
        upgradeDatabase.createObjectStore('projects', { keyPath: 'projectId' });
        upgradeDatabase.createObjectStore('assets', { keyPath: 'sha256' });
        const checkpoints = upgradeDatabase.createObjectStore('checkpoints', { keyPath: 'id' });
        checkpoints.createIndex('by-project', 'projectId');
      }
    }
  );
  return new BrowserProjectLibrary(database);
}
