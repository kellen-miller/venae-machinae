import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-DATA-018 blocks durable output after save failure and labels consented emergency output', async ({
  page
}, testInfo) => {
  await openBundledRx7Example(page);
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    Object.defineProperty(window, '__restoreRx7ProjectPut', {
      value: () => {
        IDBObjectStore.prototype.put = originalPut;
      },
      configurable: true
    });
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'projects')
        throw new DOMException('Simulated quota limit', 'QuotaExceededError');
      return originalPut.apply(this, args as Parameters<IDBObjectStore['put']>);
    };
  });

  await page.getByRole('button', { name: 'Apply project edit' }).click();
  const failure = page.getByRole('alert');
  await expect(failure).toContainText('Unsaved changes remain in memory and are not durable');
  const workingRevision = Number(
    await page.locator('[data-project-revision]').getAttribute('data-project-revision')
  );

  await page.getByRole('button', { name: 'BOM view' }).click();
  await page
    .getByRole('dialog', { name: 'Lens Stack' })
    .getByRole('button', { name: 'Download BOM CSV' })
    .click();
  await expect(
    page.getByText('Output blocked: the current Project revision could not be saved.')
  ).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  const downloadPromise = page.waitForEvent('download');
  await failure.getByRole('button', { name: 'Export unsaved working state' }).click();
  const download = await downloadPromise;
  const emergencyPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(emergencyPath);
  const emergency = JSON.parse(await readFile(emergencyPath, 'utf8')) as {
    identity: { projectRevision: number };
    exportMetadata: { revisionState: string };
  };
  expect(emergency.identity.projectRevision).toBe(workingRevision);
  expect(emergency.exportMetadata.revisionState).toBe('Unsaved working state');

  await page.evaluate(() => {
    const restore = (window as Window & { __restoreRx7ProjectPut?: () => void })
      .__restoreRx7ProjectPut;
    restore?.();
  });
  await failure.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
});
