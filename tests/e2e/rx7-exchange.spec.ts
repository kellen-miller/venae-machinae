import { readFile, writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { evaluateBundledRx7Example, openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ACC-012 round-trips the complete RX-7 envelope through cancel, copy, and replace', async ({
  page
}, testInfo) => {
  await openBundledRx7Example(page);
  await evaluateBundledRx7Example(page);
  const projectId = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.getByRole('link', { name: 'Back to Project Library' }).click();
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', {
      name: 'Export Illustrative RX-7 vehicle systems study copy as .venae.json'
    })
    .click();
  const download = await downloadPromise;
  const exchangePath = testInfo.outputPath('complete-rx7.venae.json');
  await download.saveAs(exchangePath);
  const envelope = JSON.parse(await readFile(exchangePath, 'utf8')) as {
    format: string;
    identity: { projectId: string; projectRevision: number };
    payload: {
      topology: {
        systems: unknown[];
        components: unknown[];
        connections: unknown[];
        routes: unknown[];
      };
      operatingStates: unknown[];
      results: unknown[];
      evidence: unknown[];
      build: { installations: unknown[] };
      assetHashes: string[];
    };
    assets: unknown[];
  };
  expect(envelope.format).toBe('venae-project');
  expect(envelope.identity.projectId).toBe(projectId);
  expect(envelope.payload.topology.systems).toHaveLength(4);
  expect(envelope.payload.topology.components).toHaveLength(26);
  expect(envelope.payload.topology.connections).toHaveLength(32);
  expect(envelope.payload.topology.routes).toHaveLength(32);
  expect(envelope.payload.operatingStates).toHaveLength(5);
  expect(envelope.payload.results.length).toBeGreaterThan(20);
  expect(envelope.payload.evidence).toHaveLength(12);
  expect(envelope.payload.build.installations).toHaveLength(2);
  expect(envelope.payload.assetHashes).toHaveLength(1);
  expect(envelope.assets).toHaveLength(1);

  await page.getByLabel('Import exchange file').setInputFiles(exchangePath);
  await expect(page.getByRole('heading', { name: 'Staged project import' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel import' }).click();
  await expect(
    page.getByText('Import canceled without changing the Project Library.')
  ).toBeVisible();
  await expect(page.locator('.project-library > ol > li')).toHaveCount(1);

  await page.getByLabel('Import exchange file').setInputFiles(exchangePath);
  await page.getByRole('button', { name: 'Import as copy' }).click();
  await expect(page.locator('.project-library > ol > li')).toHaveCount(2);
  await expect(page.getByRole('link', { name: /study copy copy/ })).toBeVisible();

  await page.getByLabel('Import exchange file').setInputFiles(exchangePath);
  await page.getByRole('button', { name: 'Replace existing' }).click();
  await expect(page.locator('.project-library > ol > li')).toHaveCount(2);
  await expect(page.getByRole('link', { name: /study copy/ }).first()).toContainText(
    `Revision ${envelope.identity.projectRevision}`
  );

  const corruptedPath = testInfo.outputPath('corrupted-rx7.venae.json');
  envelope.payload.topology.components.pop();
  await writeFile(corruptedPath, JSON.stringify(envelope));
  await page.getByLabel('Import exchange file').setInputFiles(corruptedPath);
  await expect(page.getByRole('alert')).toContainText(/corruption detection|payload-integrity/i);
  await expect(page.locator('.project-library > ol > li')).toHaveCount(2);
});
