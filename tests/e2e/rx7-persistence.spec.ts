import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ACC-011 autosaves, reopens, duplicates, snapshots, trashes, and restores RX-7', async ({
  page
}) => {
  await openBundledRx7Example(page);
  const projectPath = new URL(page.url()).pathname;
  const initialRevision = Number(
    await page.locator('[data-project-revision]').getAttribute('data-project-revision')
  );
  const projectName = `Vehicle project r${initialRevision + 1}`;
  await page.getByRole('button', { name: 'Apply project edit' }).click();
  await expect(page.getByRole('heading', { name: projectName })).toBeVisible();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();

  await page.getByRole('link', { name: 'Back to Project Library' }).click();
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await page.getByRole('link', { name: new RegExp(projectName) }).click();
  await expect(page).toHaveURL(projectPath);
  await page.getByRole('button', { name: 'Systems view' }).click();
  await expect(page.getByRole('dialog', { name: 'Lens Stack' })).toContainText(
    '4 Systems · 26 Components'
  );

  await page.getByRole('link', { name: 'Back to Project Library' }).click();
  await page.getByRole('button', { name: `Create Named Snapshot for ${projectName}` }).click();
  await expect(page.getByText(`${projectName} snapshot`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Duplicate ${projectName}` }).click();
  await expect(page.getByRole('heading', { name: `${projectName} copy` })).toBeVisible();
  await expect(page.locator('[data-project-revision="0"]')).toBeVisible();

  await page.getByRole('link', { name: 'Back to Project Library' }).click();
  await page.getByRole('button', { name: `Move ${projectName} to Trash` }).click();
  await expect(page.getByRole('heading', { name: 'Trash' })).toBeVisible();
  await page.getByRole('button', { name: `Restore ${projectName}` }).click();
  await expect(
    page.getByRole('link').filter({ has: page.getByText(projectName, { exact: true }) })
  ).toBeVisible();
  await page.getByRole('button', { name: `Restore ${projectName} snapshot` }).click();
  await expect(
    page.getByRole('button', { name: `Duplicate ${projectName}`, exact: true })
  ).toBeVisible();
});

test('MVP-ACC-011 checkpoints the RX-7 session and transfers its authoring lease', async ({
  page,
  context
}) => {
  await openBundledRx7Example(page);
  const projectPath = new URL(page.url()).pathname;
  const checkpointReasons = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('venae-machinae', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('checkpoints', 'readonly');
    const request = transaction.objectStore('checkpoints').getAll();
    const checkpoints = await new Promise<Array<{ reason: string }>>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return checkpoints.map((checkpoint) => checkpoint.reason);
  });
  expect(checkpointReasons).toContain('session-open');

  const contender = await context.newPage();
  await contender.goto(projectPath, { waitUntil: 'domcontentloaded' });
  await expect(contender.getByRole('button', { name: 'Apply project edit' })).toBeDisabled();
  await contender.getByRole('button', { name: 'Request authoring takeover' }).click();
  await expect(contender.getByRole('button', { name: 'Apply project edit' })).toBeEnabled({
    timeout: 10_000
  });
});
