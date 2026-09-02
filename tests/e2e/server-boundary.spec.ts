import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ARCH-005 keeps the SvelteKit shell, version, and route errors delivery-only', async ({
  page,
  request
}) => {
  const shell = await request.get('/');
  expect(shell.status()).toBe(200);
  expect(await shell.text()).toContain('Your vehicle systems work stays in this browser.');

  const version = await request.get('/version');
  expect(version.status()).toBe(200);
  expect(version.headers()['cache-control']).toBe('no-store');
  expect(await version.json()).toEqual({ application: '0.1.0' });

  const privateValue = 'project-private-route-value';
  const missing = await page.goto(`/missing-local-route?detail=${privateValue}`);
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await expect(page.getByText('The requested local view could not be found.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(privateValue);

  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'One origin. No project endpoint.' })
  ).toBeVisible();
  await expect(page.getByText(/Loopback-only delivery/)).toBeVisible();
});

test('MVP-ARCH-005 flushes and closes the Project Session before application reload', async ({
  page
}) => {
  await openBundledRx7Example(page);
  const initialRevision = Number(
    await page.locator('[data-project-revision]').getAttribute('data-project-revision')
  );
  const editedName = `Vehicle project r${initialRevision + 1}`;
  await page.getByRole('button', { name: 'Apply project edit' }).click();
  await expect(page.getByRole('heading', { name: editedName })).toBeVisible();

  const reloaded = page.waitForEvent('domcontentloaded');
  expect(
    await page.evaluate(() =>
      window.dispatchEvent(new Event('venae:prepare-application-reload', { cancelable: true }))
    )
  ).toBe(false);
  await reloaded;
  await expect(page.getByRole('heading', { name: editedName })).toBeVisible();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();

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
  expect(checkpointReasons).toContain('session-close');
});
