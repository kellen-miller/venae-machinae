import { SvelteDate } from 'svelte/reactivity';

import { applyProjectAction, previewProjectActionImpact } from '../project/apply-action';
import { retainStaleProjectResult } from '../project/project';
import { resolveAuthoringCapability } from './authoring-capability';

import type { ActionRejection } from '../project/apply-action';
import type { ProjectAction, DestructiveProjectAction, ImpactPreview } from '../project/action';
import type { ProjectResult, ProjectSnapshot } from '../project/project';
import type { SubjectId } from '../topology/topology';
import type { ReviewProfileId } from '../validation/finding';
import type {
  AuthoringBlockReason,
  AuthoringCapability,
  PresentationMode,
  RuntimeCapabilities
} from './authoring-capability';
import type {
  ProjectAsset,
  SessionBacking,
  SessionBackingSaveOutcome,
  TakeoverOutcome
} from './session-backing';

export type EvaluationScope =
  | Readonly<{ kind: 'all' }>
  | Readonly<{ kind: 'changed-subjects'; subjectIds: readonly SubjectId[] }>
  | Readonly<{ kind: 'review-profile'; profileId: ReviewProfileId }>;

export type EvaluationPublicationOutcome =
  | Readonly<{ published: true; revision: number }>
  | Readonly<{ published: false; reason: 'stale-result' | 'invalid-result' }>;

export type ProjectEvaluationRequest = Readonly<{
  sourceRevision: number;
  causationId: string;
  snapshot: ProjectSnapshot;
  scope: EvaluationScope;
  publish(results: readonly ProjectResult[]): EvaluationPublicationOutcome;
}>;

export interface ProjectEvaluationScheduler {
  schedule(request: ProjectEvaluationRequest): void;
  close(): void;
}

export type FlushReason = 'autosave' | 'explicit' | 'output' | 'close';

export type SaveOutcome =
  SessionBackingSaveOutcome | Readonly<{ saved: false; reason: 'read-only' | 'transient-review' }>;

export type ExecuteResult =
  | Readonly<{
      accepted: true;
      revision: number;
      changedSubjects: readonly SubjectId[];
    }>
  | Readonly<{
      accepted: false;
      rejection:
        | Readonly<{ code: 'capability-denied'; reason: AuthoringBlockReason }>
        | Readonly<{ code: 'nothing-to-undo' | 'nothing-to-redo' | 'session-closed' }>
        | ActionRejection;
    }>;

type ExecuteRejection = Extract<ExecuteResult, { accepted: false }>;

export type OutputRequest = Readonly<{ allowUnsavedWorkingState: boolean }>;

export type OutputRevisionOutcome =
  | Readonly<{
      acquired: true;
      snapshot: ProjectSnapshot;
      source: 'durable' | 'transient-review' | 'unsaved-working-state';
    }>
  | Readonly<{ acquired: false; reason: 'save-failed' }>;

export type CloseOutcome = Readonly<{ closed: true; save: SaveOutcome | null }>;

export type RegisterAssetOutcome =
  | Readonly<{ registered: true }>
  | Readonly<{
      registered: false;
      rejection:
        | Readonly<{ code: 'capability-denied'; reason: AuthoringBlockReason }>
        | Readonly<{ code: 'invalid-asset' | 'session-closed' }>;
    }>;

const RECOVERY_CHECKPOINT_ACTION_COUNT = 50;
const RECOVERY_CHECKPOINT_ACTIVE_MS = 5 * 60 * 1_000;

export type ProjectSessionView = Readonly<{
  snapshot: ProjectSnapshot;
  assets: readonly ProjectAsset[];
  capability: AuthoringCapability;
  save: Readonly<{
    status: 'saved' | 'queued' | 'saving' | 'failed' | 'not-durable';
    durableRevision: number | null;
    savedAt: string | null;
    message: string | null;
  }>;
  evaluation: Readonly<{
    status: 'idle' | 'queued' | 'current' | 'stale' | 'failed';
    sourceRevision: number | null;
  }>;
  canUndo: boolean;
  canRedo: boolean;
}>;

export interface ProjectSession {
  readonly view: ProjectSessionView;
  setPresentation(presentation: PresentationMode): Promise<PresentationChangeOutcome>;
  registerAsset(asset: ProjectAsset): RegisterAssetOutcome;
  execute(action: ProjectAction): ExecuteResult;
  previewImpact(action: DestructiveProjectAction): ImpactPreview;
  undo(): ExecuteResult;
  redo(): ExecuteResult;
  flush(reason: FlushReason): Promise<SaveOutcome>;
  requestEvaluation(scope: EvaluationScope): void;
  acquireOutputRevision(request: OutputRequest): Promise<OutputRevisionOutcome>;
  requestTakeover(): Promise<TakeoverOutcome>;
  close(): Promise<CloseOutcome>;
}

export type PresentationChangeOutcome = Readonly<{
  changed: boolean;
  presentation: PresentationMode;
  save: SaveOutcome | null;
}>;

type UndoFrame = Readonly<{
  causationId: string;
  before: ProjectSnapshot;
  after: ProjectSnapshot;
  label: string | null;
}>;

export function createProjectSession(dependencies: {
  initialSnapshot: ProjectSnapshot;
  backing: SessionBacking;
  evaluation: ProjectEvaluationScheduler;
  presentation: PresentationMode;
  runtimeCapabilities: RuntimeCapabilities;
  initialAssets: readonly ProjectAsset[];
  undoLimit: number;
  autosaveDelayMs: number;
}): ProjectSession {
  if (!Number.isSafeInteger(dependencies.undoLimit) || dependencies.undoLimit < 1) {
    throw new Error('Project Session undo limit must be a positive safe integer');
  }
  if (!Number.isFinite(dependencies.autosaveDelayMs) || dependencies.autosaveDelayMs < 0) {
    throw new Error('Project Session autosave delay must be a nonnegative finite duration');
  }

  let presentation = $state.raw(dependencies.presentation);
  let snapshot = $state.raw(dependencies.initialSnapshot);
  let assets = $state.raw<readonly ProjectAsset[]>(dependencies.initialAssets);
  let save = $state.raw<ProjectSessionView['save']>(
    dependencies.backing.kind === 'transient-review'
      ? {
          status: 'not-durable',
          durableRevision: null,
          savedAt: null,
          message: 'transient-review'
        }
      : {
          status: 'saved',
          durableRevision: dependencies.backing.durableRevision,
          savedAt: null,
          message: null
        }
  );
  let evaluation = $state.raw<ProjectSessionView['evaluation']>({
    status: 'idle',
    sourceRevision: null
  });
  let undoFrames = $state.raw<readonly UndoFrame[]>([]);
  let redoFrames = $state.raw<readonly UndoFrame[]>([]);
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let checkpointTimer: ReturnType<typeof setTimeout> | null = null;
  let acceptedActionsSinceCheckpoint = 0;
  let checkpointPromise = Promise.resolve();
  let savePromise: Promise<SaveOutcome> | null = null;
  let closed = false;
  let pendingAssets: readonly ProjectAsset[] = [];

  const view: ProjectSessionView = {
    get snapshot() {
      return snapshot;
    },
    get assets() {
      return assets;
    },
    get capability() {
      return resolveAuthoringCapability({
        backing: dependencies.backing,
        presentation,
        runtimeCapabilities: dependencies.runtimeCapabilities
      });
    },
    get save() {
      return save;
    },
    get evaluation() {
      return evaluation;
    },
    get canUndo() {
      return undoFrames.length > 0;
    },
    get canRedo() {
      return redoFrames.length > 0;
    }
  };

  function capabilityRejection(): ExecuteRejection | null {
    if (closed) return { accepted: false, rejection: { code: 'session-closed' } };
    const capability = view.capability;
    if (capability.mode === 'review') {
      return {
        accepted: false,
        rejection: { code: 'capability-denied', reason: capability.reason }
      };
    }

    return null;
  }

  function queueSave(): void {
    if (dependencies.backing.kind !== 'persisted' || dependencies.backing.access !== 'writable') {
      return;
    }

    save = {
      status: 'queued',
      durableRevision: save.durableRevision,
      savedAt: save.savedAt,
      message: null
    };
    if (autosaveTimer !== null) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void flush('autosave');
    }, dependencies.autosaveDelayMs);
    if (typeof autosaveTimer === 'object') autosaveTimer.unref?.();
  }

  function requestRecoveryCheckpoint(reason: string, checkpointSnapshot?: ProjectSnapshot): void {
    const writableBacking = dependencies.backing;
    if (writableBacking.kind !== 'persisted' || writableBacking.access !== 'writable') {
      return;
    }
    checkpointPromise = checkpointPromise.then(async () => {
      if (checkpointSnapshot) {
        await writableBacking.createCheckpoint(reason, checkpointSnapshot);
        return;
      }

      const saved = await flush('explicit');
      if (saved.saved) await writableBacking.createCheckpoint(reason);
    });
  }

  function recordAcceptedAction(): void {
    acceptedActionsSinceCheckpoint += 1;
    if (acceptedActionsSinceCheckpoint >= RECOVERY_CHECKPOINT_ACTION_COUNT) {
      acceptedActionsSinceCheckpoint = 0;
      if (checkpointTimer !== null) clearTimeout(checkpointTimer);
      checkpointTimer = null;
      requestRecoveryCheckpoint('50-accepted-actions');
      return;
    }
    if (checkpointTimer !== null) return;
    checkpointTimer = setTimeout(() => {
      checkpointTimer = null;
      acceptedActionsSinceCheckpoint = 0;
      requestRecoveryCheckpoint('five-active-minutes');
    }, RECOVERY_CHECKPOINT_ACTIVE_MS);
    if (typeof checkpointTimer === 'object') checkpointTimer.unref?.();
  }

  function publishEvaluation(
    sourceRevision: number,
    causationId: string,
    results: readonly ProjectResult[]
  ): EvaluationPublicationOutcome {
    const outcome = applyProjectAction(snapshot, {
      type: 'publish-evaluation',
      causationId,
      sourceRevision,
      results
    });
    if (!outcome.accepted) {
      return {
        published: false,
        reason: outcome.rejection.code === 'invalid-result' ? 'invalid-result' : 'stale-result'
      };
    }

    snapshot = outcome.snapshot;
    undoFrames = undoFrames.map((frame) =>
      frame.causationId === causationId && frame.after.revision === sourceRevision
        ? { ...frame, after: outcome.snapshot }
        : frame
    );
    evaluation = {
      status: results.some((result) => result.status === 'failed') ? 'failed' : 'current',
      sourceRevision
    };
    queueSave();
    return { published: true, revision: snapshot.revision };
  }

  function scheduleEvaluation(scope: EvaluationScope, causationId: string): void {
    const sourceRevision = snapshot.revision;
    evaluation = { status: 'queued', sourceRevision };
    dependencies.evaluation.schedule({
      sourceRevision,
      causationId,
      snapshot,
      scope,
      publish(results) {
        return publishEvaluation(sourceRevision, causationId, results);
      }
    });
  }

  function restore(frameSnapshot: ProjectSnapshot, causationId: string): ExecuteResult {
    snapshot = {
      ...frameSnapshot,
      revision: snapshot.revision + 1,
      results: frameSnapshot.results.map(retainStaleProjectResult)
    };
    queueSave();
    scheduleEvaluation({ kind: 'changed-subjects', subjectIds: [snapshot.id] }, causationId);
    return { accepted: true, revision: snapshot.revision, changedSubjects: [snapshot.id] };
  }

  function execute(action: ProjectAction): ExecuteResult {
    const rejected = capabilityRejection();
    if (rejected) return rejected;
    if (
      action.type === 'set-vehicle-background' &&
      action.background &&
      !assets.some((asset) => asset.sha256 === action.background?.assetHash)
    ) {
      return {
        accepted: false,
        rejection: {
          code: 'missing-asset',
          message: 'Vehicle background must reference a registered raster asset'
        }
      };
    }

    const before = snapshot;
    const outcome = applyProjectAction(before, action);
    if (!outcome.accepted) return outcome;
    if (
      action.type === 'delete-component' ||
      action.type === 'delete-connection' ||
      action.type === 'replace-component' ||
      action.type === 'insert-electrical-branch'
    ) {
      requestRecoveryCheckpoint('before-destructive-operation', before);
    }

    snapshot = outcome.snapshot;
    const previousFrame = undoFrames.at(-1);
    if (previousFrame?.causationId === action.causationId) {
      undoFrames = [
        ...undoFrames.slice(0, -1),
        { ...previousFrame, after: snapshot, label: outcome.undoLabel }
      ];
    } else {
      undoFrames = [
        ...undoFrames,
        {
          causationId: action.causationId,
          before,
          after: snapshot,
          label: outcome.undoLabel
        }
      ].slice(-dependencies.undoLimit);
    }
    redoFrames = [];
    queueSave();
    scheduleEvaluation(
      { kind: 'changed-subjects', subjectIds: outcome.changedSubjects },
      action.causationId
    );
    recordAcceptedAction();
    return {
      accepted: true,
      revision: snapshot.revision,
      changedSubjects: outcome.changedSubjects
    };
  }

  function undo(): ExecuteResult {
    const rejected = capabilityRejection();
    if (rejected) return rejected;

    const frame = undoFrames.at(-1);
    if (!frame) return { accepted: false, rejection: { code: 'nothing-to-undo' } };
    undoFrames = undoFrames.slice(0, -1);
    redoFrames = [...redoFrames, frame];
    return restore(frame.before, `undo:${frame.causationId}`);
  }

  function redo(): ExecuteResult {
    const rejected = capabilityRejection();
    if (rejected) return rejected;

    const frame = redoFrames.at(-1);
    if (!frame) return { accepted: false, rejection: { code: 'nothing-to-redo' } };
    redoFrames = redoFrames.slice(0, -1);
    undoFrames = [...undoFrames, frame].slice(-dependencies.undoLimit);
    return restore(frame.after, `redo:${frame.causationId}`);
  }

  async function drainSaves(): Promise<SaveOutcome> {
    const backing = dependencies.backing;
    if (backing.kind === 'transient-review') {
      return { saved: false, reason: 'transient-review' };
    }
    if (backing.access === 'read-only') return { saved: false, reason: 'read-only' };

    while (save.durableRevision !== snapshot.revision) {
      const savingSnapshot = snapshot;
      save = {
        status: 'saving',
        durableRevision: save.durableRevision,
        savedAt: save.savedAt,
        message: null
      };
      const savingAssets = pendingAssets.filter((asset) =>
        savingSnapshot.assetHashes.includes(asset.sha256)
      );
      const outcome = await backing.save(savingSnapshot, save.durableRevision, savingAssets);
      if (!outcome.saved) {
        save = {
          status: 'failed',
          durableRevision: save.durableRevision,
          savedAt: save.savedAt,
          message: outcome.reason
        };
        return outcome;
      }
      if (outcome.revision !== savingSnapshot.revision) {
        save = {
          status: 'failed',
          durableRevision: save.durableRevision,
          savedAt: save.savedAt,
          message: 'storage-error'
        };
        return { saved: false, reason: 'storage-error' };
      }

      pendingAssets = pendingAssets.filter(
        (asset) => !savingAssets.some((savedAsset) => savedAsset.sha256 === asset.sha256)
      );
      save = {
        status: 'saved',
        durableRevision: outcome.revision,
        savedAt: new SvelteDate().toISOString(),
        message: null
      };
    }

    return { saved: true, revision: snapshot.revision };
  }

  const flush: ProjectSession['flush'] = async () => {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    if (!savePromise) {
      savePromise = drainSaves().finally(() => {
        savePromise = null;
      });
    }

    return savePromise;
  };

  function requestEvaluation(scope: EvaluationScope): void {
    if (closed || view.capability.mode === 'review') return;
    scheduleEvaluation(scope, `explicit-evaluation:${snapshot.revision}`);
  }

  async function acquireOutputRevision(request: OutputRequest): Promise<OutputRevisionOutcome> {
    if (dependencies.backing.kind === 'transient-review') {
      return { acquired: true, snapshot, source: 'transient-review' };
    }
    if (dependencies.backing.access === 'read-only') {
      return { acquired: true, snapshot, source: 'durable' };
    }

    const outcome = await flush('output');
    if (outcome.saved) return { acquired: true, snapshot, source: 'durable' };
    if (request.allowUnsavedWorkingState) {
      return { acquired: true, snapshot, source: 'unsaved-working-state' };
    }

    return { acquired: false, reason: 'save-failed' };
  }

  async function requestTakeover(): Promise<TakeoverOutcome> {
    if (dependencies.backing.kind === 'transient-review') {
      return { requested: false, reason: 'transient-review' };
    }

    return dependencies.backing.requestTakeover();
  }

  async function setPresentation(
    nextPresentation: PresentationMode
  ): Promise<PresentationChangeOutcome> {
    if (presentation === nextPresentation) {
      return { changed: false, presentation, save: null };
    }

    presentation = nextPresentation;
    const save = nextPresentation === 'mobile' ? await flush('explicit') : null;
    return { changed: true, presentation, save };
  }

  async function close(): Promise<CloseOutcome> {
    if (closed) return { closed: true, save: null };
    closed = true;
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    if (checkpointTimer !== null) {
      clearTimeout(checkpointTimer);
      checkpointTimer = null;
    }
    const closeSave =
      dependencies.backing.kind === 'persisted' && dependencies.backing.access === 'writable'
        ? await flush('close')
        : null;
    await checkpointPromise;
    if (
      closeSave?.saved &&
      dependencies.backing.kind === 'persisted' &&
      dependencies.backing.access === 'writable'
    ) {
      await dependencies.backing.createCheckpoint('session-close');
    }
    dependencies.evaluation.close();
    await dependencies.backing.close();
    return { closed: true, save: closeSave };
  }

  return {
    view,
    setPresentation,
    registerAsset(asset) {
      const rejected = capabilityRejection();
      if (rejected) {
        return rejected.rejection.code === 'capability-denied'
          ? {
              registered: false,
              rejection: { code: 'capability-denied', reason: rejected.rejection.reason }
            }
          : { registered: false, rejection: { code: 'session-closed' } };
      }
      if (
        !/^[a-f0-9]{64}$/.test(asset.sha256) ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mimeType) ||
        asset.bytes.byteLength === 0
      ) {
        return { registered: false, rejection: { code: 'invalid-asset' } };
      }

      const registeredAsset: ProjectAsset = {
        sha256: asset.sha256,
        mimeType: asset.mimeType,
        bytes: new Uint8Array(asset.bytes)
      };
      const existing = assets.find((candidate) => candidate.sha256 === asset.sha256);
      if (
        existing &&
        (existing.mimeType !== registeredAsset.mimeType ||
          existing.bytes.byteLength !== registeredAsset.bytes.byteLength ||
          existing.bytes.some((byte, index) => byte !== registeredAsset.bytes[index]))
      ) {
        return { registered: false, rejection: { code: 'invalid-asset' } };
      }
      if (!existing) assets = [...assets, registeredAsset];
      pendingAssets = [
        ...pendingAssets.filter((asset) => asset.sha256 !== registeredAsset.sha256),
        registeredAsset
      ];
      return { registered: true };
    },
    execute,
    previewImpact(action) {
      return previewProjectActionImpact(snapshot, action);
    },
    undo,
    redo,
    flush,
    requestEvaluation,
    acquireOutputRevision,
    requestTakeover,
    close
  };
}
