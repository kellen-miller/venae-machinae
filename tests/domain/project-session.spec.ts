import { describe, expect, it, vi } from 'vitest';

import { createBlankProject } from '../../src/lib/project/project';
import { createProjectSession } from '../../src/lib/session/project-session.svelte';

import type { ProjectResult, ProjectSnapshot } from '../../src/lib/project/project';
import type {
  PersistedSessionBacking,
  SessionBacking,
  SessionBackingSaveOutcome
} from '../../src/lib/session/session-backing';
import type {
  ProjectEvaluationRequest,
  ProjectEvaluationScheduler
} from '../../src/lib/session/project-session.svelte';

function blankProject(name = 'Session fixture'): ProjectSnapshot {
  return createBlankProject({
    id: 'project-session',
    name,
    createdAt: '2026-09-01T00:00:00Z'
  });
}

function recordingEvaluation() {
  const requests: ProjectEvaluationRequest[] = [];
  let closed = false;
  const evaluation: ProjectEvaluationScheduler = {
    schedule(request) {
      requests.push(request);
    },
    close() {
      closed = true;
    }
  };

  return { evaluation, requests, isClosed: () => closed };
}

function writableBacking(
  options: {
    durableRevision?: number | null;
    save?: (
      snapshot: ProjectSnapshot,
      expectedRevision: number | null
    ) => Promise<SessionBackingSaveOutcome>;
  } = {}
) {
  const saved: Readonly<{ snapshot: ProjectSnapshot; expectedRevision: number | null }>[] = [];
  const checkpoints: string[] = [];
  let closed = false;
  const backing: PersistedSessionBacking = {
    kind: 'persisted',
    access: 'writable',
    durableRevision: options.durableRevision ?? null,
    async save(snapshot, expectedRevision) {
      saved.push({ snapshot, expectedRevision });
      return (
        options.save?.(snapshot, expectedRevision) ??
        Promise.resolve({ saved: true, revision: snapshot.revision })
      );
    },
    async createCheckpoint(reason) {
      checkpoints.push(reason);
      return { created: true };
    },
    async requestTakeover() {
      return { requested: false, reason: 'already-writable' };
    },
    async close() {
      closed = true;
    }
  };

  return { backing, saved, checkpoints, isClosed: () => closed };
}

function createWritableSession(
  input: {
    backing?: PersistedSessionBacking;
    initialSnapshot?: ProjectSnapshot;
    evaluation?: ProjectEvaluationScheduler;
    undoLimit?: number;
  } = {}
) {
  const backing = input.backing ?? writableBacking().backing;
  const evaluation = input.evaluation ?? recordingEvaluation().evaluation;
  return createProjectSession({
    initialSnapshot: input.initialSnapshot ?? blankProject(),
    backing,
    evaluation,
    presentation: 'desktop',
    runtimeCapabilities: { indexedDb: true, webWorker: true, webLocks: true },
    initialAssets: [],
    undoLimit: input.undoLimit ?? 20,
    autosaveDelayMs: 60_000
  });
}

describe('MVP-PROD-003 MVP-ARCH-002 Project Session revision lifecycle', () => {
  it('publishes only the current evaluation and joins it to the originating undo frame', () => {
    const evaluation = recordingEvaluation();
    const session = createWritableSession({ evaluation: evaluation.evaluation });

    expect(
      session.execute({
        type: 'rename-project',
        causationId: 'cause-rename',
        name: 'Edited project'
      })
    ).toMatchObject({ accepted: true, revision: 1 });
    expect(session.view).toMatchObject({
      snapshot: { revision: 1, name: 'Edited project' },
      evaluation: { status: 'queued', sourceRevision: 1 },
      save: { status: 'queued', durableRevision: null },
      canUndo: true,
      canRedo: false
    });

    const request = evaluation.requests[0];
    expect(request).toMatchObject({
      sourceRevision: 1,
      causationId: 'cause-rename',
      scope: { kind: 'changed-subjects', subjectIds: ['project-session'] }
    });
    const results: readonly ProjectResult[] = [
      {
        id: 'result-evaluation',
        sourceRevision: 1,
        status: 'current',
        kind: 'evaluation-summary',
        detail: null
      }
    ];
    expect(request?.publish(results)).toEqual({ published: true, revision: 2 });
    expect(session.view).toMatchObject({
      snapshot: { revision: 2, results },
      evaluation: { status: 'current', sourceRevision: 1 }
    });

    expect(session.undo()).toMatchObject({ accepted: true, revision: 3 });
    expect(session.view.snapshot).toMatchObject({
      revision: 3,
      name: 'Session fixture',
      results: []
    });
    expect(session.view.canUndo).toBe(false);
    expect(session.view.canRedo).toBe(true);

    expect(request?.publish(results)).toEqual({ published: false, reason: 'stale-result' });
    expect(session.view.snapshot.revision).toBe(3);
  });

  it('keeps bounded undo/redo revision-monotonic and coalesces one causation gesture', () => {
    const session = createWritableSession({ undoLimit: 2 });

    session.execute({ type: 'rename-project', causationId: 'gesture-name', name: 'Draft A' });
    session.execute({ type: 'rename-project', causationId: 'gesture-name', name: 'Draft B' });
    session.execute({ type: 'rename-project', causationId: 'command-final', name: 'Final' });
    expect(session.view.snapshot).toMatchObject({ revision: 3, name: 'Final' });

    expect(session.undo()).toMatchObject({ accepted: true, revision: 4 });
    expect(session.view.snapshot.name).toBe('Draft B');
    expect(session.undo()).toMatchObject({ accepted: true, revision: 5 });
    expect(session.view.snapshot.name).toBe('Session fixture');
    expect(session.undo()).toMatchObject({
      accepted: false,
      rejection: { code: 'nothing-to-undo' }
    });

    expect(session.redo()).toMatchObject({ accepted: true, revision: 6 });
    expect(session.view.snapshot.name).toBe('Draft B');
    expect(session.redo()).toMatchObject({ accepted: true, revision: 7 });
    expect(session.view.snapshot.name).toBe('Final');
  });
});

describe('MVP-ARCH-003 Project Session durability', () => {
  it('serializes whole-snapshot saves and keeps a failed edit visibly unsaved', async () => {
    let failNext = false;
    const records = writableBacking({
      save: async (snapshot) =>
        failNext
          ? { saved: false, reason: 'quota-exceeded' }
          : { saved: true, revision: snapshot.revision }
    });
    const session = createWritableSession({ backing: records.backing });
    session.execute({ type: 'rename-project', causationId: 'cause-first', name: 'Saved edit' });

    await expect(session.flush('explicit')).resolves.toEqual({ saved: true, revision: 1 });
    expect(records.saved).toEqual([
      { snapshot: expect.objectContaining({ revision: 1 }), expectedRevision: null }
    ]);
    expect(session.view.save).toEqual({ status: 'saved', durableRevision: 1, message: null });

    failNext = true;
    session.execute({ type: 'rename-project', causationId: 'cause-second', name: 'Unsaved edit' });
    await expect(session.flush('explicit')).resolves.toEqual({
      saved: false,
      reason: 'quota-exceeded'
    });
    expect(records.saved[1]).toEqual({
      snapshot: expect.objectContaining({ revision: 2, name: 'Unsaved edit' }),
      expectedRevision: 1
    });
    expect(session.view.save).toEqual({
      status: 'failed',
      durableRevision: 1,
      message: 'quota-exceeded'
    });

    await session.close();
    expect(records.isClosed()).toBe(true);
  });

  it('waits through an in-flight save and persists the latest accepted revision', async () => {
    let releaseFirst!: () => void;
    const firstSave = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let invocation = 0;
    const records = writableBacking({
      save: async (snapshot) => {
        invocation += 1;
        if (invocation === 1) await firstSave;
        return { saved: true, revision: snapshot.revision };
      }
    });
    const session = createWritableSession({ backing: records.backing });
    session.execute({ type: 'rename-project', causationId: 'cause-one', name: 'One' });
    const flushing = session.flush('autosave');
    await vi.waitFor(() => expect(records.saved).toHaveLength(1));

    session.execute({ type: 'rename-project', causationId: 'cause-two', name: 'Two' });
    releaseFirst();
    await expect(flushing).resolves.toEqual({ saved: true, revision: 2 });
    expect(records.saved.map((record) => record.snapshot.revision)).toEqual([1, 2]);
    expect(records.saved.map((record) => record.expectedRevision)).toEqual([null, 1]);
  });

  it('MVP-DATA-007 checkpoints after 50 actions, five active minutes, and session close', async () => {
    vi.useFakeTimers();
    const records = writableBacking({ durableRevision: 0 });
    const session = createWritableSession({ backing: records.backing });
    try {
      for (let revision = 1; revision <= 50; revision += 1) {
        session.execute({
          type: 'rename-project',
          causationId: `checkpoint-action-${revision}`,
          name: `Checkpoint revision ${revision}`
        });
      }
      await vi.runAllTicks();
      await session.flush('explicit');
      await vi.runAllTicks();
      expect(records.checkpoints).toContain('50-accepted-actions');

      session.execute({
        type: 'rename-project',
        causationId: 'checkpoint-active-time',
        name: 'Active timer checkpoint'
      });
      await vi.advanceTimersByTimeAsync(5 * 60 * 1_000);
      await session.flush('explicit');
      await vi.runAllTicks();
      expect(records.checkpoints).toContain('five-active-minutes');

      await session.close();
      expect(records.checkpoints).toContain('session-close');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('MVP-ARCH-004 Project Session authoring capability', () => {
  it.each([
    [
      'read-only lease',
      {
        kind: 'persisted',
        access: 'read-only',
        durableRevision: 0,
        requestTakeover: async () => ({ requested: true as const }),
        close: async () => undefined
      } satisfies SessionBacking,
      'desktop' as const,
      { indexedDb: true, webWorker: true, webLocks: true },
      'lease-held'
    ],
    [
      'transient review',
      {
        kind: 'transient-review',
        access: 'read-only',
        envelopeId: 'review-envelope',
        close: async () => undefined
      } satisfies SessionBacking,
      'desktop' as const,
      { indexedDb: true, webWorker: true, webLocks: true },
      'transient-review'
    ],
    [
      'mobile review',
      writableBacking().backing,
      'mobile' as const,
      { indexedDb: true, webWorker: true, webLocks: true },
      'mobile-review'
    ],
    [
      'missing IndexedDB',
      writableBacking().backing,
      'desktop' as const,
      { indexedDb: false, webWorker: true, webLocks: true },
      'missing-indexeddb'
    ],
    [
      'missing Worker',
      writableBacking().backing,
      'desktop' as const,
      { indexedDb: true, webWorker: false, webLocks: true },
      'missing-worker'
    ],
    [
      'missing Web Locks',
      writableBacking().backing,
      'desktop' as const,
      { indexedDb: true, webWorker: true, webLocks: false },
      'missing-web-locks'
    ]
  ])('rejects mutation for %s', (_, backing, presentation, runtimeCapabilities, reason) => {
    const session = createProjectSession({
      initialSnapshot: blankProject(),
      backing,
      evaluation: recordingEvaluation().evaluation,
      presentation,
      runtimeCapabilities,
      initialAssets: [],
      undoLimit: 20,
      autosaveDelayMs: 60_000
    });

    expect(session.view.capability).toEqual({ mode: 'review', reason });
    expect(
      session.execute({
        type: 'rename-project',
        causationId: 'blocked-cause',
        name: 'Must not change'
      })
    ).toMatchObject({ accepted: false, rejection: { code: 'capability-denied', reason } });
    expect(session.view.snapshot).toEqual(blankProject());
  });
});
