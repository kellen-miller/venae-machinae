import type { ProjectSnapshot } from '../project/project';

export type SessionBackingSaveOutcome =
  | Readonly<{ saved: true; revision: number }>
  | Readonly<{
      saved: false;
      reason: 'revision-conflict' | 'quota-exceeded' | 'storage-error';
      currentRevision?: number;
    }>;

export type SessionCheckpointOutcome =
  | Readonly<{ created: true }>
  | Readonly<{ created: false; reason: 'missing-project' | 'storage-error' }>;

export type TakeoverOutcome =
  | Readonly<{ requested: true }>
  | Readonly<{
      requested: false;
      reason: 'already-writable' | 'unsupported' | 'transient-review';
    }>;

export type PersistedSessionBacking = Readonly<{
  kind: 'persisted';
  access: 'writable';
  durableRevision: number | null;
  save(
    snapshot: ProjectSnapshot,
    expectedRevision: number | null
  ): Promise<SessionBackingSaveOutcome>;
  createCheckpoint(reason: string): Promise<SessionCheckpointOutcome>;
  requestTakeover(): Promise<TakeoverOutcome>;
  close(): Promise<void>;
}>;

export type ReadOnlyPersistedSessionBacking = Readonly<{
  kind: 'persisted';
  access: 'read-only';
  durableRevision: number;
  requestTakeover(): Promise<TakeoverOutcome>;
  close(): Promise<void>;
}>;

export type TransientReviewSessionBacking = Readonly<{
  kind: 'transient-review';
  access: 'read-only';
  envelopeId: string;
  close(): Promise<void>;
}>;

export type SessionBacking =
  PersistedSessionBacking | ReadOnlyPersistedSessionBacking | TransientReviewSessionBacking;

export function createTransientReviewSessionBacking(
  envelopeId: string
): TransientReviewSessionBacking {
  return {
    kind: 'transient-review',
    access: 'read-only',
    envelopeId,
    async close() {}
  };
}
