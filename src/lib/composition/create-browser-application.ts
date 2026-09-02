import { BrowserProjectEvaluationScheduler } from '../evaluation/evaluation-client';
import { browserDeliveryState } from '../delivery/browser-delivery-state';
import {
  commitStagedExchange,
  commitStagedLibraryBackupExchange,
  commitStagedTemplateExchange
} from '../exchange/commit-exchange';
import {
  createLibraryBackupExchange,
  createProjectExchange,
  createTemplateExchange
} from '../exchange/project-exchange';
import { MEASURED_EXCHANGE_LIMITS } from '../exchange/measured-limits';
import {
  stageExchange,
  stageLibraryBackupExchange,
  stageTemplateExchange
} from '../exchange/stage-exchange';
import { acquireProjectLease, withExclusiveLibraryLock } from '../persistence/project-lease';
import { openProjectLibrary } from '../persistence/project-library';
import {
  createReadOnlyPersistedSessionBacking,
  createWritablePersistedSessionBacking
} from '../persistence/persisted-session-backing';
import { readBrowserStorageStatus } from '../persistence/storage-lifecycle';
import { createProjectSession } from '../session/project-session.svelte';
import rx7ExampleSource from '../reference/rx7-example.v1.venae.json?raw';

import type { BrowserStorageStatus } from '../persistence/storage-lifecycle';
import type {
  StageExchangeOutcome,
  StageLibraryBackupExchangeOutcome,
  StageTemplateExchangeOutcome,
  StagedExchange,
  StagedLibraryBackupExchange,
  StagedTemplateExchange
} from '../exchange/stage-exchange';
import type { PartDefinition, ProjectSnapshot } from '../project/project';
import type { ProjectAsset } from '../session/session-backing';
import type { PresentationMode, RuntimeCapabilities } from '../session/authoring-capability';
import type { ProjectEvaluationScheduler, ProjectSession } from '../session/project-session.svelte';

export type StagedLibraryImport =
  StagedExchange | StagedTemplateExchange | StagedLibraryBackupExchange;

export type StageLibraryImportOutcome =
  StageExchangeOutcome | StageTemplateExchangeOutcome | StageLibraryBackupExchangeOutcome;

export type LibraryOverview = Readonly<{
  storage: BrowserStorageStatus;
  backupHealth: Readonly<{
    lastLibraryBackupAt: string | null;
    lastProjectExports: readonly Readonly<{ projectId: string; exportedAt: string }>[];
    acceptedActionsSinceExport: number;
    reminders: readonly ('backup-overdue' | 'substantial-editing' | 'migration-pending')[];
    deviceLossBoundary: 'downloaded-library-backup';
  }>;
  namedSnapshots: readonly Readonly<{
    id: string;
    projectId: string;
    projectRevision: number;
    name: string;
    note: string;
    createdAt: string;
  }>[];
  trash: readonly Readonly<{
    id: string;
    kind: 'project' | 'template';
    sourceId: string;
    label: string;
    expiresAt: string;
  }>[];
  templateRevisionCount: number;
  quarantineCount: number;
}>;

export type DownloadArtifact = Readonly<{
  filename: string;
  json: string;
}>;

export type LibraryImportCommitOutcome =
  | Readonly<{
      committed: true;
      format: StagedLibraryImport['format'];
      projectId?: string;
      templateIds?: readonly string[];
      projectCount?: number;
    }>
  | Readonly<{ committed: false; reason: string }>;

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
  copyIllustrativeExample(): Promise<
    { copied: true; projectId: string } | { copied: false; reason: string }
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
  readLibraryOverview(now: string): Promise<LibraryOverview>;
  createNamedSnapshot(
    projectId: string,
    createdAt: string
  ): Promise<{ created: true } | { created: false; reason: string }>;
  restoreNamedSnapshot(
    snapshotId: string,
    restoredAt: string
  ): Promise<{ restored: true } | { restored: false; reason: string }>;
  trashProject(
    projectId: string,
    deletedAt: string
  ): Promise<{ trashed: true } | { trashed: false; reason: string }>;
  restoreTrash(trashId: string): Promise<{ restored: true } | { restored: false; reason: string }>;
  promotePartDefinition(
    definition: PartDefinition,
    createdAt: string
  ): Promise<{ promoted: true } | { promoted: false; reason: string }>;
  createProjectDownload(
    projectId: string,
    exportedAt: string
  ): Promise<{ created: true; artifact: DownloadArtifact } | { created: false; reason: string }>;
  createTemplateDownload(
    exportedAt: string
  ): Promise<{ created: true; artifact: DownloadArtifact } | { created: false; reason: string }>;
  createLibraryBackupDownload(
    exportedAt: string
  ): Promise<{ created: true; artifact: DownloadArtifact } | { created: false; reason: string }>;
  createDiagnosticsDownload(generatedAt: string): Promise<DownloadArtifact>;
  stageLibraryImport(file: File): Promise<StageLibraryImportOutcome>;
  commitLibraryImport(
    staged: StagedLibraryImport,
    decision: 'replace' | 'import-copy' | 'cancel'
  ): Promise<LibraryImportCommitOutcome>;
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
    async copyIllustrativeExample() {
      const staged = await stageExchange(
        new Blob([rx7ExampleSource], { type: 'application/json' }),
        MEASURED_EXCHANGE_LIMITS
      );
      if (!staged.staged) {
        return { copied: false, reason: `${staged.reason}: ${staged.message}` };
      }

      const locked = await withExclusiveLibraryLock(() =>
        commitStagedExchange(staged, 'import-copy', library)
      );
      if (!locked.acquired) return { copied: false, reason: locked.reason };
      return locked.value.committed
        ? { copied: true, projectId: locked.value.projectId }
        : { copied: false, reason: locked.value.reason };
    },
    duplicateProject(input) {
      return library.duplicateProject(input);
    },
    async readLibraryOverview(now) {
      const projects = await library.listProjects();
      const [storage, backupHealth, snapshotsByProject, trash, templates, quarantine] =
        await Promise.all([
          readBrowserStorageStatus(),
          library.readBackupHealth({ now }),
          Promise.all(projects.map((project) => library.listNamedSnapshots(project.id))),
          library.listTrash(),
          library.listAllTemplateRevisions(),
          library.listQuarantine()
        ]);
      return {
        storage,
        backupHealth,
        namedSnapshots: snapshotsByProject.flat().map((snapshot) => ({
          id: snapshot.id,
          projectId: snapshot.projectId,
          projectRevision: snapshot.projectRevision,
          name: snapshot.name,
          note: snapshot.note,
          createdAt: snapshot.createdAt
        })),
        trash: trash.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          sourceId: entry.sourceId,
          label:
            entry.kind === 'project'
              ? entry.project.snapshot.project.name
              : (entry.templateRevisions[0]?.label ?? entry.sourceId),
          expiresAt: entry.expiresAt
        })),
        templateRevisionCount: templates.length,
        quarantineCount: quarantine.length
      };
    },
    async createNamedSnapshot(projectId, createdAt) {
      const locked = await withExclusiveLibraryLock(async () => {
        const project = await library.loadProject(projectId);
        if (!project) return { created: false as const, reason: 'missing-project' };
        return library.createNamedSnapshot({
          id: crypto.randomUUID(),
          projectId,
          name: `${project.project.name} snapshot`,
          note: 'User-retained recovery point',
          createdAt
        });
      });
      if (!locked.acquired) return { created: false, reason: locked.reason };
      return locked.value.created
        ? { created: true }
        : { created: false, reason: locked.value.reason };
    },
    async restoreNamedSnapshot(snapshotId, restoredAt) {
      const locked = await withExclusiveLibraryLock(() =>
        library.restoreNamedSnapshot({
          id: snapshotId,
          checkpointId: crypto.randomUUID(),
          restoredAt
        })
      );
      if (!locked.acquired) return { restored: false, reason: locked.reason };
      return locked.value.restored
        ? { restored: true }
        : { restored: false, reason: locked.value.reason };
    },
    async trashProject(projectId, deletedAt) {
      const locked = await withExclusiveLibraryLock(() =>
        library.trashProject({ projectId, trashId: crypto.randomUUID(), deletedAt })
      );
      if (!locked.acquired) return { trashed: false, reason: locked.reason };
      return locked.value.trashed
        ? { trashed: true }
        : { trashed: false, reason: locked.value.reason };
    },
    async restoreTrash(trashId) {
      const locked = await withExclusiveLibraryLock(() => library.restoreTrash(trashId));
      if (!locked.acquired) return { restored: false, reason: locked.reason };
      return locked.value.restored
        ? { restored: true }
        : { restored: false, reason: locked.value.reason };
    },
    async promotePartDefinition(definition, createdAt) {
      const created = await library.createTemplateRevision({
        templateId: `template-${definition.id}`,
        revision: definition.revision,
        label: definition.label,
        createdAt,
        definition
      });
      return created.created ? { promoted: true } : { promoted: false, reason: created.reason };
    },
    async createProjectDownload(projectId, exportedAt) {
      const project = await library.loadProject(projectId);
      if (!project) return { created: false, reason: 'missing-project' };
      const storedAssets = await library.loadAssets(project.assetHashes);
      if (storedAssets.length !== project.assetHashes.length) {
        return { created: false, reason: 'missing-asset' };
      }
      const assets = storedAssets.flatMap((asset) =>
        asset.mimeType === 'image/png' ||
        asset.mimeType === 'image/jpeg' ||
        asset.mimeType === 'image/webp'
          ? [
              {
                mimeType: asset.mimeType as ProjectAsset['mimeType'],
                bytes: new Uint8Array(asset.bytes)
              }
            ]
          : []
      );
      const envelope = await createProjectExchange({ project, assets, exportedAt });
      await library.recordProjectExport({ projectId, exportedAt });
      return {
        created: true,
        artifact: {
          filename: `${project.project.id}.venae.json`,
          json: JSON.stringify(envelope, null, 2)
        }
      };
    },
    async createTemplateDownload(exportedAt) {
      const revisions = await library.listAllTemplateRevisions();
      if (revisions.length === 0) return { created: false, reason: 'missing-templates' };
      const envelope = await createTemplateExchange({
        templateRevisions: revisions,
        assets: [],
        exportedAt
      });
      return {
        created: true,
        artifact: {
          filename: `part-definitions.venae-templates.json`,
          json: JSON.stringify(envelope, null, 2)
        }
      };
    },
    async createLibraryBackupDownload(exportedAt) {
      const locked = await withExclusiveLibraryLock(async () => {
        const backup = await library.createLibraryBackup({ createdAt: exportedAt });
        return createLibraryBackupExchange({ backup: backup.payload, exportedAt });
      });
      if (!locked.acquired) return { created: false, reason: locked.reason };
      return {
        created: true,
        artifact: {
          filename: `library-${exportedAt.slice(0, 10)}.venae-backup.json`,
          json: JSON.stringify(locked.value, null, 2)
        }
      };
    },
    async createDiagnosticsDownload(generatedAt) {
      const diagnostics = await library.createRedactedDiagnostics(generatedAt);
      return {
        filename: 'venae-machinae-diagnostics.json',
        json: JSON.stringify(diagnostics, null, 2)
      };
    },
    async stageLibraryImport(file) {
      const outcome = file.name.endsWith('.venae-templates.json')
        ? await stageTemplateExchange(file, MEASURED_EXCHANGE_LIMITS)
        : file.name.endsWith('.venae-backup.json')
          ? await stageLibraryBackupExchange(file, MEASURED_EXCHANGE_LIMITS)
          : await stageExchange(file, MEASURED_EXCHANGE_LIMITS);
      if (!outcome.staged && file.size <= MEASURED_EXCHANGE_LIMITS.maxEnvelopeBytes) {
        await withExclusiveLibraryLock(() =>
          file.text().then((raw) =>
            library.quarantineImport({
              sourceId: file.name,
              raw,
              reason: `${outcome.reason}: ${outcome.message}`,
              quarantinedAt: new Date().toISOString()
            })
          )
        );
      }
      return outcome;
    },
    async commitLibraryImport(staged, decision) {
      const locked = await withExclusiveLibraryLock(
        async (): Promise<LibraryImportCommitOutcome> => {
          if (staged.format === 'venae-project') {
            const outcome = await commitStagedExchange(staged, decision, library);
            return outcome.committed
              ? {
                  committed: true,
                  format: staged.format,
                  projectId: outcome.projectId
                }
              : { committed: false, reason: outcome.reason };
          }
          if (staged.format === 'venae-templates') {
            const outcome = await commitStagedTemplateExchange(staged, decision, library);
            return outcome.committed
              ? {
                  committed: true,
                  format: staged.format,
                  templateIds: outcome.templateIds
                }
              : { committed: false, reason: outcome.reason };
          }
          const outcome = await commitStagedLibraryBackupExchange(
            staged,
            decision === 'replace' ? 'replace' : 'cancel',
            library
          );
          return outcome.committed
            ? {
                committed: true,
                format: staged.format,
                projectCount: outcome.projectCount
              }
            : { committed: false, reason: outcome.reason };
        }
      );
      return locked.acquired ? locked.value : { committed: false, reason: locked.reason };
    },
    async openProject(projectId, presentation) {
      const snapshot = await library.openProject(projectId);
      if (!snapshot) return { opened: false, reason: 'missing-project' };
      performance.clearMarks('venae:snapshot-returned');
      performance.clearMarks('venae:workspace-interactive');
      performance.clearMeasures('venae:snapshot-to-interactive');
      performance.mark('venae:snapshot-returned');
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
      if (leaseOutcome.acquired) {
        await library.createCheckpoint({ projectId, reason: 'session-open' });
        await library.markReplacementOpened(new Date().toISOString());
      }
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
            createPreparationWorker: () =>
              new Worker(
                new URL('../evaluation/evaluation-preparation-worker.ts', import.meta.url),
                { type: 'module' }
              ),
            isServerConnected: () => browserDeliveryState.current === 'connected',
            onServerReconnect: (listener) => browserDeliveryState.onReconnect(listener)
          })
        : new UnavailableProjectEvaluationScheduler();
      const session = createProjectSession({
        initialSnapshot: snapshot,
        backing,
        evaluation,
        presentation,
        runtimeCapabilities,
        initialAssets,
        undoLimit: 100,
        autosaveDelayMs: 350
      });
      openSession = session;
      if (leaseOutcome.acquired) {
        leaseOutcome.lease.onTakeoverRequested(() => {
          void session.close().then(() => {
            if (openSession === session) openSession = null;
          });
        });
      }
      return { opened: true, session };
    },
    async close() {
      if (closed) return;
      closed = true;
      if (openSession) await openSession.close();
      library.close();
    }
  };
}
