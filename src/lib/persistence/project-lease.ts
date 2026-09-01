const LIBRARY_LOCK_NAME = 'venae-machinae:library';

export interface ProjectLease {
  readonly projectId: string;
  onTakeoverRequested(listener: () => void): () => void;
  release(): Promise<void>;
}

export type ProjectLeaseOutcome =
  { acquired: true; lease: ProjectLease } | { acquired: false; reason: 'held' | 'unsupported' };

export async function acquireProjectLease(projectId: string): Promise<ProjectLeaseOutcome> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.locks ||
    typeof BroadcastChannel === 'undefined'
  ) {
    return { acquired: false, reason: 'unsupported' };
  }

  let resolveAcquisition!: (outcome: ProjectLeaseOutcome) => void;
  const acquisition = new Promise<ProjectLeaseOutcome>((resolve) => {
    resolveAcquisition = resolve;
  });
  let acquisitionSettled = false;

  const lifecycle = navigator.locks.request(
    LIBRARY_LOCK_NAME,
    { mode: 'shared' },
    async (libraryLock) => {
      if (!libraryLock) {
        acquisitionSettled = true;
        resolveAcquisition({ acquired: false, reason: 'unsupported' });
        return;
      }

      await navigator.locks.request(
        `venae-machinae:project:${projectId}`,
        { mode: 'exclusive', ifAvailable: true },
        async (projectLock) => {
          if (!projectLock) {
            acquisitionSettled = true;
            resolveAcquisition({ acquired: false, reason: 'held' });
            return;
          }

          const takeoverListeners = new Set<() => void>();
          const channel = new BroadcastChannel(`venae-machinae:project:${projectId}`);
          channel.onmessage = (event: MessageEvent<unknown>) => {
            const message = event.data;
            if (
              typeof message !== 'object' ||
              message === null ||
              !('type' in message) ||
              !('projectId' in message) ||
              message.type !== 'takeover-request' ||
              message.projectId !== projectId
            ) {
              return;
            }

            for (const listener of takeoverListeners) listener();
          };

          let releaseLock!: () => void;
          const released = new Promise<void>((resolve) => {
            releaseLock = resolve;
          });
          let releaseStarted = false;
          const lease: ProjectLease = {
            projectId,
            onTakeoverRequested(listener) {
              takeoverListeners.add(listener);
              return () => takeoverListeners.delete(listener);
            },
            async release() {
              if (releaseStarted) return;
              releaseStarted = true;
              channel.close();
              releaseLock();
              await lifecycle;
            }
          };
          acquisitionSettled = true;
          resolveAcquisition({ acquired: true, lease });
          await released;
        }
      );
    }
  );
  void lifecycle.catch(() => {
    if (!acquisitionSettled) {
      acquisitionSettled = true;
      resolveAcquisition({ acquired: false, reason: 'unsupported' });
    }
  });

  return acquisition;
}

export function requestProjectTakeover(projectId: string): boolean {
  if (typeof BroadcastChannel === 'undefined') return false;
  const channel = new BroadcastChannel(`venae-machinae:project:${projectId}`);
  channel.postMessage({ type: 'takeover-request', projectId });
  channel.close();
  return true;
}
