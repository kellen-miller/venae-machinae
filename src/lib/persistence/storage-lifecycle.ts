export interface BrowserStorageStatus {
  persistence: 'granted' | 'denied' | 'unsupported' | 'failed';
  usage: number | null;
  quota: number | null;
  pressure: 'reported-capacity' | 'near-limit' | 'unknown';
  message: string;
}

export async function readBrowserStorageStatus(): Promise<BrowserStorageStatus> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.persist !== 'function'
  ) {
    return {
      persistence: 'unsupported',
      usage: null,
      quota: null,
      pressure: 'unknown',
      message:
        'This browser does not expose persistent-storage controls. Keep a Library Backup for profile or device loss.'
    };
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const persistence = await Promise.race<BrowserStorageStatus['persistence']>([
    navigator.storage.persist().then(
      (granted) => (granted ? 'granted' : 'denied'),
      () => 'failed'
    ),
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve('failed'), 2_000);
    })
  ]);
  clearTimeout(timeout);

  let usage: number | null = null;
  let quota: number | null = null;
  try {
    const estimate = await navigator.storage.estimate();
    usage = estimate.usage ?? null;
    quota = estimate.quota ?? null;
  } catch {
    // Persistence state is still reportable when an estimate is unavailable.
  }

  const pressure =
    usage !== null && quota !== null && quota > 0
      ? usage / quota >= 0.9
        ? 'near-limit'
        : 'reported-capacity'
      : 'unknown';
  if (pressure === 'near-limit') {
    return {
      persistence,
      usage,
      quota,
      pressure,
      message:
        'Storage is near the browser-reported quota. Save may fail; download a Library Backup and reclaim disposable data.'
    };
  }

  const message = {
    granted:
      'Browser reports persistent storage granted. Keep a Library Backup for profile or device loss.',
    denied:
      'Browser reports persistent storage denied. Autosave remains origin-local; keep a Library Backup.',
    failed:
      'The persistent-storage request failed. Autosave remains origin-local; keep a Library Backup.',
    unsupported:
      'This browser does not expose persistent-storage controls. Keep a Library Backup for profile or device loss.'
  }[persistence];

  return { persistence, usage, quota, pressure, message };
}
