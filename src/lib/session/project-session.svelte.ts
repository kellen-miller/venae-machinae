import { applyProjectAction, previewProjectActionImpact } from '../project/apply-action';
import { resolveAuthoringCapability } from './authoring-capability';

import type { ActionRejection } from '../project/apply-action';
import type { ProjectAction, DestructiveProjectAction, ImpactPreview } from '../project/action';
import type { ProjectResult, ProjectSnapshot } from '../project/project';
import type { SubjectId } from '../topology/topology';
import type {
  AuthoringBlockReason,
  AuthoringCapability,
  PresentationMode,
  RuntimeCapabilities
} from './authoring-capability';
import type { SessionBacking, SessionBackingSaveOutcome, TakeoverOutcome } from './session-backing';

export type EvaluationScope =
  | Readonly<{ kind: 'all' }>
  | Readonly<{ kind: 'changed-subjects'; subjectIds: readonly SubjectId[] }>;

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

export type OutputRequest = Readonly<{ allowUnsavedWorkingState: boolean }>;

export type OutputRevisionOutcome =
  | Readonly<{
      acquired: true;
      snapshot: ProjectSnapshot;
      source: 'durable' | 'transient-review' | 'unsaved-working-state';
    }>
  | Readonly<{ acquired: false; reason: 'save-failed' }>;

export type CloseOutcome = Readonly<{ closed: true; save: SaveOutcome | null }>;

export type ProjectSessionView = Readonly<{
  snapshot: ProjectSnapshot;
  capability: AuthoringCapability;
  save: Readonly<{
    status: 'saved' | 'queued' | 'saving' | 'failed' | 'not-durable';
    durableRevision: number | null;
    message: string | null;
  }>;
  evaluation: Readonly<{
    status: 'idle' | 'queued' | 'current' | 'stale';
    sourceRevision: number | null;
  }>;
  canUndo: boolean;
  canRedo: boolean;
}>;

export interface ProjectSession {
  readonly view: ProjectSessionView;
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
  undoLimit: number;
  autosaveDelayMs: number;
}): ProjectSession {
  if (!Number.isSafeInteger(dependencies.undoLimit) || dependencies.undoLimit < 1) {
    throw new Error('Project Session undo limit must be a positive safe integer');
  }
  if (!Number.isFinite(dependencies.autosaveDelayMs) || dependencies.autosaveDelayMs < 0) {
    throw new Error('Project Session autosave delay must be a nonnegative finite duration');
  }

  const capability = resolveAuthoringCapability(dependencies);
  let snapshot = $state.raw(dependencies.initialSnapshot);
  let save = $state.raw<ProjectSessionView['save']>(
    dependencies.backing.kind === 'transient-review'
      ? { status: 'not-durable', durableRevision: null, message: 'transient-review' }
      : {
          status: 'saved',
          durableRevision: dependencies.backing.durableRevision,
          message: null
        }
  );
  let evaluation = $state.raw<ProjectSessionView['evaluation']>({
    status: 'idle',
    sourceRevision: null
  });
  let undoFrames: readonly UndoFrame[] = [];
  let redoFrames: readonly UndoFrame[] = [];
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let savePromise: Promise<SaveOutcome> | null = null;
  let closed = false;

  const view: ProjectSessionView = {
    get snapshot() {
      return snapshot;
    },
    capability,
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

  function capabilityRejection(): ExecuteResult | null {
    if (closed) return { accepted: false, rejection: { code: 'session-closed' } };
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

    save = { status: 'queued', durableRevision: save.durableRevision, message: null };
    if (autosaveTimer !== null) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void flush('autosave');
    }, dependencies.autosaveDelayMs);
    if (typeof autosaveTimer === 'object') autosaveTimer.unref?.();
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
    evaluation = { status: 'current', sourceRevision };
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
      results: frameSnapshot.results.map((result) =>
        result.status === 'current' ? { ...result, status: 'stale' as const } : result
      )
    };
    queueSave();
    scheduleEvaluation({ kind: 'changed-subjects', subjectIds: [snapshot.id] }, causationId);
    return { accepted: true, revision: snapshot.revision, changedSubjects: [snapshot.id] };
  }

  function execute(action: ProjectAction): ExecuteResult {
    const rejected = capabilityRejection();
    if (rejected) return rejected;

    const before = snapshot;
    const outcome = applyProjectAction(before, action);
    if (!outcome.accepted) return outcome;

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
      save = { status: 'saving', durableRevision: save.durableRevision, message: null };
      const outcome = await backing.save(savingSnapshot, save.durableRevision);
      if (!outcome.saved) {
        save = {
          status: 'failed',
          durableRevision: save.durableRevision,
          message: outcome.reason
        };
        return outcome;
      }
      if (outcome.revision !== savingSnapshot.revision) {
        save = {
          status: 'failed',
          durableRevision: save.durableRevision,
          message: 'storage-error'
        };
        return { saved: false, reason: 'storage-error' };
      }

      save = { status: 'saved', durableRevision: outcome.revision, message: null };
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
    if (closed) return;
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

  async function close(): Promise<CloseOutcome> {
    if (closed) return { closed: true, save: null };
    closed = true;
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    const closeSave =
      dependencies.backing.kind === 'persisted' && dependencies.backing.access === 'writable'
        ? await flush('close')
        : null;
    dependencies.evaluation.close();
    await dependencies.backing.close();
    return { closed: true, save: closeSave };
  }

  return {
    view,
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
