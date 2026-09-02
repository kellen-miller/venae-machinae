import { afterEach, describe, expect, it, vi } from 'vitest';

import { readBrowserStorageStatus } from '../../src/lib/persistence/storage-lifecycle';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MVP-DATA-005 MVP-GATE-006 browser storage lifecycle', () => {
  it.each([
    {
      granted: true,
      expected: {
        persistence: 'granted',
        usage: 25,
        quota: 100,
        pressure: 'reported-capacity',
        message:
          'Browser reports persistent storage granted. Keep a Library Backup for profile or device loss.'
      }
    },
    {
      granted: false,
      expected: {
        persistence: 'denied',
        usage: 25,
        quota: 100,
        pressure: 'reported-capacity',
        message:
          'Browser reports persistent storage denied. Autosave remains origin-local; keep a Library Backup.'
      }
    }
  ])(
    'reports a browser persistence $expected.persistence result without a guarantee',
    async ({ granted, expected }) => {
      vi.stubGlobal('navigator', {
        storage: {
          persist: async () => granted,
          estimate: async () => ({ usage: 25, quota: 100 })
        }
      });
      expect(await readBrowserStorageStatus()).toEqual(expected);
    }
  );

  it('reports unsupported storage persistence without hiding recovery guidance', async () => {
    vi.stubGlobal('navigator', {});
    expect(await readBrowserStorageStatus()).toEqual({
      persistence: 'unsupported',
      usage: null,
      quota: null,
      pressure: 'unknown',
      message:
        'This browser does not expose persistent-storage controls. Keep a Library Backup for profile or device loss.'
    });
  });

  it('reports near-quota pressure and a bounded recovery action', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persist: async () => true,
        estimate: async () => ({ usage: 95, quota: 100 })
      }
    });
    expect(await readBrowserStorageStatus()).toEqual({
      persistence: 'granted',
      usage: 95,
      quota: 100,
      pressure: 'near-limit',
      message:
        'Storage is near the browser-reported quota. Save may fail; download a Library Backup and reclaim disposable data.'
    });
  });

  it('reports a persistent-storage request that never completes', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      storage: {
        persist: () => new Promise<boolean>(() => undefined),
        estimate: async () => ({ usage: 25, quota: 100 })
      }
    });
    const status = readBrowserStorageStatus();
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(status).resolves.toEqual({
      persistence: 'failed',
      usage: 25,
      quota: 100,
      pressure: 'reported-capacity',
      message:
        'The persistent-storage request failed. Autosave remains origin-local; keep a Library Backup.'
    });
  });
});
