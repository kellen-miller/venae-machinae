import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { evaluateBundledRx7Example, openBundledRx7Example } from '../fixtures/rx7-example';
import { readStoredZipEntries } from '../fixtures/stored-zip';

test('MVP-ACC-014 derives every RX-7 output from one durable revision', async ({
  page
}, testInfo) => {
  await openBundledRx7Example(page);
  await evaluateBundledRx7Example(page);
  const revision = Number(
    await page.locator('[data-project-revision]').getAttribute('data-project-revision')
  );
  await page.getByRole('button', { name: 'BOM view' }).click();
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });

  await lens.getByRole('button', { name: 'Preview printable report' }).click();
  const preview = page.getByRole('dialog', { name: 'Printable Project Report' });
  await expect(preview).toContainText(`Revision ${revision}`);
  await expect(preview).toContainText('Durable revision');
  await expect(preview).toContainText('Visible Findings');
  await preview.getByRole('button', { name: 'Close print preview' }).click();

  const csvPromise = page.waitForEvent('download');
  await lens.getByRole('button', { name: 'Download BOM CSV' }).click();
  const csvDownload = await csvPromise;
  const csvPath = testInfo.outputPath(csvDownload.suggestedFilename());
  await csvDownload.saveAs(csvPath);
  expect((await readFile(csvPath, 'utf8')).split('\r\n')[1]?.startsWith(`${revision},`)).toBe(true);

  const zipPromise = page.waitForEvent('download');
  await lens.getByRole('button', { name: 'Download Export All ZIP' }).click();
  const zipDownload = await zipPromise;
  const zipPath = testInfo.outputPath(zipDownload.suggestedFilename());
  await zipDownload.saveAs(zipPath);
  const zip = readStoredZipEntries(await readFile(zipPath));
  expect(JSON.parse(zip.get('manifest.json') ?? '{}').projectRevision).toBe(revision);
  expect(zip.size).toBe(18);

  const validationPromise = page.waitForEvent('download');
  await lens.getByRole('button', { name: 'Download Validation Report' }).click();
  const validationDownload = await validationPromise;
  const validationPath = testInfo.outputPath(validationDownload.suggestedFilename());
  await validationDownload.saveAs(validationPath);
  expect(JSON.parse(await readFile(validationPath, 'utf8')).projectRevision).toBe(revision);

  const projectPromise = page.waitForEvent('download');
  await lens.getByRole('button', { name: 'Download round-trip Project JSON' }).click();
  const projectDownload = await projectPromise;
  const projectPath = testInfo.outputPath(projectDownload.suggestedFilename());
  await projectDownload.saveAs(projectPath);
  const envelope = JSON.parse(await readFile(projectPath, 'utf8')) as {
    identity: { projectRevision: number };
    exportMetadata: { revisionState: string };
    payload: { build: { installations: unknown[] }; assetHashes: string[] };
  };
  expect(envelope.identity.projectRevision).toBe(revision);
  expect(envelope.exportMetadata.revisionState).toBe('Durable revision');
  expect(envelope.payload.build.installations).toHaveLength(2);
  expect(envelope.payload.assetHashes).toHaveLength(1);
});
