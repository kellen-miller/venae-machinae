import { BrowserProjectEvaluationScheduler } from '../evaluation/evaluation-client';
import { acquireProjectLease } from '../persistence/project-lease';
import { openProjectLibrary } from '../persistence/project-library';
import {
  createReadOnlyPersistedSessionBacking,
  createWritablePersistedSessionBacking
} from '../persistence/persisted-session-backing';
import { createProjectSession } from '../session/project-session.svelte';

import type { ProjectSnapshot } from '../project/project';
import type { ProjectAsset } from '../session/session-backing';
import type { PresentationMode, RuntimeCapabilities } from '../session/authoring-capability';
import type { ProjectEvaluationScheduler, ProjectSession } from '../session/project-session.svelte';

export type BrowserApplication = Readonly<{
  listProjects(): Promise<
    readonly Readonly<{ id: string; name: string; revision: number; createdAt: string }>[]
  >;
  createBlankProject(input: {
    id: string;
    name: string;
    createdAt: string;
  }): Promise<
    | { created: true; snapshot: ProjectSnapshot }
    | { created: false; reason: 'already-exists' | 'quota-exceeded' | 'storage-error' }
  >;
  duplicateProject(input: {
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
  >;
  openProject(
    projectId: string,
    presentation: PresentationMode
  ): Promise<
    { opened: true; session: ProjectSession } | { opened: false; reason: 'missing-project' }
  >;
  close(): Promise<void>;
}>;

class UnavailableProjectEvaluationScheduler implements ProjectEvaluationScheduler {
  schedule(): void {
    throw new Error('Worker evaluation is unavailable in this browser');
  }

  close(): void {}
}

export async function createBrowserApplication(): Promise<BrowserApplication> {
  const library = await openProjectLibrary();
  let openSession: ProjectSession | null = null;
  let closed = false;

  return {
    listProjects() {
      return library.listProjects();
    },
    createBlankProject(input) {
      return library.createBlankProject(input);
    },
    duplicateProject(input) {
      return library.duplicateProject(input);
    },
    async openProject(projectId, presentation) {
      const snapshot = await library.openProject(projectId);
      if (!snapshot) return { opened: false, reason: 'missing-project' };
      if (openSession) await openSession.close();
      const initialAssets = (await library.loadAssets(snapshot.assetHashes)).flatMap((asset) =>
        asset.mimeType === 'image/png' ||
        asset.mimeType === 'image/jpeg' ||
        asset.mimeType === 'image/webp'
          ? [
              {
                sha256: asset.sha256,
                mimeType: asset.mimeType as ProjectAsset['mimeType'],
                bytes: new Uint8Array(asset.bytes)
              }
            ]
          : []
      );

      const runtimeCapabilities: RuntimeCapabilities = {
        indexedDb: typeof indexedDB !== 'undefined',
        webWorker: typeof Worker !== 'undefined',
        webLocks: typeof navigator !== 'undefined' && navigator.locks !== undefined
      };
      const mayAcquireWriteLease =
        presentation !== 'mobile' &&
        runtimeCapabilities.indexedDb &&
        runtimeCapabilities.webWorker &&
        runtimeCapabilities.webLocks;
      const leaseOutcome = mayAcquireWriteLease
        ? await acquireProjectLease(projectId)
        : ({ acquired: false, reason: 'unsupported' } as const);
      const backing = leaseOutcome.acquired
        ? createWritablePersistedSessionBacking({
            library,
            lease: leaseOutcome.lease,
            durableRevision: snapshot.revision
          })
        : createReadOnlyPersistedSessionBacking({
            projectId,
            durableRevision: snapshot.revision
          });
      const evaluation = runtimeCapabilities.webWorker
        ? new BrowserProjectEvaluationScheduler({
            createWorker: () =>
              new Worker(new URL('../evaluation/evaluation-worker.ts', import.meta.url), {
                type: 'module'
              }),
            isServerConnected: () => true
          })
        : new UnavailableProjectEvaluationScheduler();
      openSession = createProjectSession({
        initialSnapshot: snapshot,
        backing,
        evaluation,
        presentation,
        runtimeCapabilities,
        initialAssets,
        undoLimit: 100,
        autosaveDelayMs: 350
      });
      return { opened: true, session: openSession };
    },
    async close() {
      if (closed) return;
      closed = true;
      if (openSession) await openSession.close();
      library.close();
    }
  };
}
