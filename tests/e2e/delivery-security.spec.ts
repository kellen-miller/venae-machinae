import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('MVP-DATA-001 MVP-ARCH-005 MVP-ARCH-006 MVP-ARCH-009 keeps delivery strict, local, and project-stateless', async ({
  page
}) => {
  const cspViolations: string[] = [];
  const projectRequests: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to apply inline style/i.test(message.text())) {
      cspViolations.push(message.text());
    }
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/\/(?:api\/)?projects?(?:\/|\?|$)/.test(url.pathname)) projectRequests.push(request.url());
  });

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  const headers = response?.headers() ?? {};
  const policy = headers['content-security-policy'] ?? '';
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("worker-src 'self' blob:");
  expect(policy).not.toContain("'unsafe-inline'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['cross-origin-resource-policy']).toBe('same-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');

  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  expect(cspViolations).toEqual([]);
  expect(projectRequests).toEqual([]);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations())).toEqual([]);

  const serviceWorkerSources = await readFile('scripts/check-production-sources.mjs', 'utf8');
  expect(serviceWorkerSources).toContain('service worker');
});

test('MVP-ARCH-009 exports bounded diagnostics with project values redacted', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('venae-machinae', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('diagnostics', 'readwrite');
    transaction.objectStore('diagnostics').put({
      id: 'diagnostic-sensitive',
      kind: 'save-failure',
      recordedAt: '2026-09-02T05:45:00Z',
      message: 'project-secret: driver-name@example.com value 13.72'
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download redacted diagnostics' }).click();
  const download = await downloadPromise;
  const path = test.info().outputPath(download.suggestedFilename());
  await download.saveAs(path);
  const diagnostics = await readFile(path, 'utf8');

  expect(download.suggestedFilename()).toBe('venae-machinae-diagnostics.json');
  expect(diagnostics).toContain('project-values-omitted');
  expect(diagnostics).toContain('save-failure');
  expect(diagnostics).not.toContain('project-secret');
  expect(diagnostics).not.toContain('driver-name@example.com');
  expect(diagnostics).not.toContain('13.72');
});
