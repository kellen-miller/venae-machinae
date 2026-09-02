import type { SessionBacking } from './session-backing';

export type PresentationMode = 'desktop' | 'tablet' | 'mobile';

export type RuntimeCapabilities = Readonly<{
  indexedDb: boolean;
  webWorker: boolean;
  webLocks: boolean;
}>;

export type AuthoringBlockReason =
  | 'lease-held'
  | 'transient-review'
  | 'mobile-review'
  | 'missing-indexeddb'
  | 'missing-worker'
  | 'missing-web-locks';

export type AuthoringCapability =
  | Readonly<{ mode: 'author'; reason: null }>
  | Readonly<{ mode: 'review'; reason: AuthoringBlockReason }>;

export function resolveAuthoringCapability(input: {
  backing: SessionBacking;
  presentation: PresentationMode;
  runtimeCapabilities: RuntimeCapabilities;
}): AuthoringCapability {
  if (input.presentation === 'mobile') return { mode: 'review', reason: 'mobile-review' };
  if (input.backing.kind === 'transient-review') {
    return { mode: 'review', reason: 'transient-review' };
  }
  if (!input.runtimeCapabilities.indexedDb) {
    return { mode: 'review', reason: 'missing-indexeddb' };
  }
  if (!input.runtimeCapabilities.webWorker) return { mode: 'review', reason: 'missing-worker' };
  if (!input.runtimeCapabilities.webLocks) {
    return { mode: 'review', reason: 'missing-web-locks' };
  }
  if (input.backing.access === 'read-only') return { mode: 'review', reason: 'lease-held' };

  return { mode: 'author', reason: null };
}
