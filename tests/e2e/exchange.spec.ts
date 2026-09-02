import { readFile, writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { seedWorkspaceProject } from '../fixtures/workspace-project';

test('MVP-DATA-011 MVP-DATA-012 MVP-DATA-013 MVP-DATA-014 MVP-DATA-015 MVP-DATA-016 stages project exchange before explicit copy commit', async ({
  page
}, testInfo) => {
  await seedWorkspaceProject(page);
  await page.goto('/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export RX-7 workshop study as .venae.json' }).click();
  const download = await downloadPromise;
  const exportPath = testInfo.outputPath('rx7.venae.json');
  await download.saveAs(exportPath);
  const envelope = JSON.parse(await readFile(exportPath, 'utf8')) as {
    format: string;
    integrity: { payloadSha256: string; exportMetadataSha256: string };
  };
  expect(envelope.format).toBe('venae-project');
  expect(envelope.integrity.payloadSha256).not.toBe(envelope.integrity.exportMetadataSha256);

  await page.getByLabel('Import exchange file').setInputFiles(exportPath);
  await expect(page.getByRole('heading', { name: 'Staged project import' })).toBeVisible();
  await expect(page.getByText('RX-7 workshop study', { exact: true })).toHaveCount(1);
  await expect(page.getByText('No library changes until you confirm.')).toBeVisible();
  await page.getByRole('button', { name: 'Import as copy' }).click();
  await expect(page.getByRole('link', { name: /RX-7 workshop study copy/ })).toBeVisible();

  const tamperedPath = testInfo.outputPath('tampered.venae.json');
  const tampered = JSON.parse(await readFile(exportPath, 'utf8')) as {
    payload: { project: { name: string } };
  };
  tampered.payload.project.name = 'Tampered after hashing';
  await writeFile(tamperedPath, JSON.stringify(tampered));
  await page.getByLabel('Import exchange file').setInputFiles(tamperedPath);
  await expect(page.getByRole('alert')).toContainText(/corruption detection|payload-integrity/i);

  const quarantineDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download raw tampered.venae.json' }).click();
  const quarantineDownload = await quarantineDownloadPromise;
  const quarantinePath = testInfo.outputPath('quarantined-raw.json');
  await quarantineDownload.saveAs(quarantinePath);
  expect(await readFile(quarantinePath, 'utf8')).toContain('Tampered after hashing');
});
