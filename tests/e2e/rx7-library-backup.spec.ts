import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ACC-013 backs up and atomically restores RX-7, snapshots, assets, and templates', async ({
  page
}, testInfo) => {
  await openBundledRx7Example(page);
  await page.getByRole('button', { name: 'Interfaces view' }).click();
  await page
    .getByRole('dialog', { name: 'Lens Stack' })
    .getByRole('button', { name: 'Promote TXL primary wire revision 1 as Template' })
    .click();
  await page.getByRole('link', { name: 'Back to Project Library' }).click();
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  const projectName = 'Illustrative RX-7 vehicle systems study copy';
  await page.getByRole('button', { name: `Create Named Snapshot for ${projectName}` }).click();

  const backupPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Library Backup' }).click();
  const backupDownload = await backupPromise;
  const backupPath = testInfo.outputPath(backupDownload.suggestedFilename());
  await backupDownload.saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8')) as {
    format: string;
    payload: {
      projects: unknown[];
      namedSnapshots: unknown[];
      templates: unknown[];
      assetHashes: string[];
    };
    assets: unknown[];
  };
  expect(backup.format).toBe('venae-backup');
  expect(backup.payload.projects).toHaveLength(1);
  expect(backup.payload.namedSnapshots).toHaveLength(1);
  expect(backup.payload.templates).toHaveLength(1);
  expect(backup.payload.assetHashes).toHaveLength(1);
  expect(backup.assets).toHaveLength(1);

  await page.getByRole('button', { name: `Duplicate ${projectName}` }).click();
  await page.getByRole('link', { name: 'Back to Project Library' }).click();
  await expect(page.locator('.project-library > ol > li')).toHaveCount(2);
  await page.getByLabel('Import exchange file').setInputFiles(backupPath);
  await expect(page.getByRole('heading', { name: 'Staged Library Backup restore' })).toBeVisible();
  await page.getByRole('button', { name: 'Replace Library' }).click();
  await expect(page.locator('.project-library > ol > li')).toHaveCount(1);
  await expect(page.getByText(`${projectName} snapshot`, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '1 immutable revisions' })).toBeVisible();

  const templatesPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export template revisions' }).click();
  const templatesDownload = await templatesPromise;
  const templatesPath = testInfo.outputPath(templatesDownload.suggestedFilename());
  await templatesDownload.saveAs(templatesPath);
  await page.getByLabel('Import exchange file').setInputFiles(templatesPath);
  await expect(page.getByRole('heading', { name: 'Staged template import' })).toBeVisible();
  await page.getByRole('button', { name: 'Import as copy' }).click();
  await expect(page.getByRole('heading', { name: '2 immutable revisions' })).toBeVisible();
});
