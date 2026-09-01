import { projectSnapshotToDocument } from './project-document';
import { requestProjectTakeover } from './project-lease';

import type { ProjectLease } from './project-lease';
import type { BrowserProjectLibrary } from './project-library';
import type {
  PersistedSessionBacking,
  ReadOnlyPersistedSessionBacking
} from '../session/session-backing';

export function createWritablePersistedSessionBacking(input: {
  library: BrowserProjectLibrary;
  lease: ProjectLease;
  durableRevision: number;
}): PersistedSessionBacking {
  return {
    kind: 'persisted',
    access: 'writable',
    durableRevision: input.durableRevision,
    async save(snapshot, expectedRevision) {
      const outcome = await input.library.saveProject({
        projectId: snapshot.id,
        expectedRevision,
        snapshot: projectSnapshotToDocument(snapshot),
        newAssets: []
      });
      if (outcome.saved) return { saved: true, revision: outcome.revision };
      return outcome;
    },
    async createCheckpoint(reason) {
      try {
        const outcome = await input.library.createCheckpoint({
          projectId: input.lease.projectId,
          reason
        });
        return outcome.created ? { created: true } : { created: false, reason: 'missing-project' };
      } catch {
        return { created: false, reason: 'storage-error' };
      }
    },
    async requestTakeover() {
      return { requested: false, reason: 'already-writable' };
    },
    async close() {
      await input.lease.release();
    }
  };
}

export function createReadOnlyPersistedSessionBacking(input: {
  projectId: string;
  durableRevision: number;
}): ReadOnlyPersistedSessionBacking {
  return {
    kind: 'persisted',
    access: 'read-only',
    durableRevision: input.durableRevision,
    async requestTakeover() {
      return requestProjectTakeover(input.projectId)
        ? { requested: true }
        : { requested: false, reason: 'unsupported' };
    },
    async close() {}
  };
}
