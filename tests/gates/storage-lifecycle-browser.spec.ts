import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import { build } from 'vite';

import type { Page } from '@playwright/test';

let browserBundle = '';

test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: resolve('tests/gates/entries/storage-lifecycle-browser.ts'),
        formats: ['iife'],
        name: 'VenaeStorageLifecycleGate'
      }
    }
  });
  const outputs = Array.isArray(result) ? result : 'output' in result ? [result] : [];
  const chunk = outputs.flatMap((output) => output.output).find((entry) => entry.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Storage lifecycle bundle is absent');
  browserBundle = chunk.code;
});

async function installGate(page: Page) {
  await page.addInitScript({
    content: `${browserBundle}\nwindow.VenaeStorageLifecycleGate = VenaeStorageLifecycleGate;`
  });
  await page.goto('/');
}

test('MVP-GATE-006 automates storage, lease, upgrade, and restore lifecycle', async ({
  page,
  context
}, testInfo) => {
  await installGate(page);
  const storageStatus = await page.evaluate(() =>
    window.VenaeStorageLifecycleGate.readActualStorageStatus()
  );
  expect(['granted', 'denied', 'unsupported', 'failed']).toContain(storageStatus.persistence);

  expect(
    await page.evaluate(() => window.VenaeStorageLifecycleGate.holdProjectLease('gate'))
  ).toEqual({
    acquired: true,
    reason: null
  });
  expect(await page.evaluate(() => window.VenaeStorageLifecycleGate.heldLockModes())).toEqual(
    expect.arrayContaining([
      { name: 'venae-machinae:library', mode: 'shared' },
      { name: 'venae-machinae:project:gate', mode: 'exclusive' }
    ])
  );

  const contender = await context.newPage();
  await installGate(contender);
  expect(
    await contender.evaluate(() => window.VenaeStorageLifecycleGate.holdProjectLease('gate'))
  ).toEqual({ acquired: false, reason: 'held' });
  expect(
    await contender.evaluate(() => window.VenaeStorageLifecycleGate.sendTakeoverRequest('gate'))
  ).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.VenaeStorageLifecycleGate.takeoverRequestCount()))
    .toBe(1);
  expect(await page.evaluate(() => window.VenaeStorageLifecycleGate.releaseProjectLease())).toBe(
    true
  );
  expect(
    await contender.evaluate(() => window.VenaeStorageLifecycleGate.holdProjectLease('gate'))
  ).toEqual({ acquired: true, reason: null });
  expect(
    await contender.evaluate(() => window.VenaeStorageLifecycleGate.releaseProjectLease())
  ).toBe(true);

  await page.evaluate(() => window.VenaeStorageLifecycleGate.openUpgradeBlocker());
  await page.evaluate(() => window.VenaeStorageLifecycleGate.beginBlockedUpgrade());
  await expect
    .poll(() => page.evaluate(() => window.VenaeStorageLifecycleGate.readUpgradeState()))
    .toBe('blocked');
  await page.evaluate(() => window.VenaeStorageLifecycleGate.releaseUpgradeBlocker());
  await expect
    .poll(() => page.evaluate(() => window.VenaeStorageLifecycleGate.readUpgradeState()))
    .toBe('completed');
  await page.evaluate(() => window.VenaeStorageLifecycleGate.closeUpgradedDatabase());

  const saved = await page.evaluate(() =>
    window.VenaeStorageLifecycleGate.storeLifecycleSnapshot()
  );
  expect(saved.saved).toBe(true);
  await contender.bringToFront();
  const backgroundVisibility = await page.evaluate(() => document.visibilityState);
  await page.close();

  const restored = await context.newPage();
  await installGate(restored);
  expect(
    await restored.evaluate(
      (projectId) => window.VenaeStorageLifecycleGate.recoverLifecycleSnapshot(projectId),
      saved.projectId
    )
  ).toEqual({ recovered: true, revision: 1 });
  console.log(
    `MVP_GATE_006_AUTOMATED ${testInfo.project.name} ${JSON.stringify({ storageStatus, backgroundVisibility })}`
  );
  await contender.close();
  await restored.close();
});

declare global {
  interface Window {
    VenaeStorageLifecycleGate: {
      readActualStorageStatus(): Promise<{
        persistence: string;
        usage: number | null;
        quota: number | null;
        pressure: string;
        message: string;
      }>;
      holdProjectLease(projectId: string): Promise<{ acquired: boolean; reason: string | null }>;
      heldLockModes(): Promise<Array<{ name: string; mode: string }>>;
      sendTakeoverRequest(projectId: string): boolean;
      takeoverRequestCount(): number;
      releaseProjectLease(): Promise<boolean>;
      openUpgradeBlocker(): Promise<void>;
      beginBlockedUpgrade(): void;
      readUpgradeState(): string;
      releaseUpgradeBlocker(): void;
      closeUpgradedDatabase(): void;
      storeLifecycleSnapshot(): Promise<{ saved: boolean; projectId: string }>;
      recoverLifecycleSnapshot(
        projectId: string
      ): Promise<{ recovered: boolean; revision: number | null }>;
    };
  }
}
