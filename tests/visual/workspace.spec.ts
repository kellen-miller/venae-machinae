import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';
import { seedWorkspaceProject, WORKSPACE_PROJECT_ID } from '../fixtures/workspace-project';

test('records the synchronized desktop canvas and dense Lens Stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await page.getByRole('button', { name: 'Systems view' }).click();
  await expect(page.getByRole('dialog', { name: 'Lens Stack' })).toBeVisible();
  await page.screenshot({
    path: 'evidence/frontend/milestone-3a-workspace-desktop.png',
    animations: 'disabled',
    scale: 'css'
  });
});

test('records scoped Finding evidence at desktop and tablet boundaries', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await page.getByRole('button', { name: 'Findings view' }).click();
  await expect(
    page.getByRole('article', { name: 'Caution Finding for tube-return' })
  ).toBeVisible();
  await page.screenshot({
    path: 'evidence/frontend/M4C-findings-desktop.png',
    animations: 'disabled',
    scale: 'css'
  });

  await page.setViewportSize({ width: 820, height: 1000 });
  await page.reload();
  await page.getByRole('button', { name: 'Findings view' }).click();
  await expect(page.getByRole('region', { name: 'Validation Coverage' })).toBeVisible();
  await page.screenshot({
    path: 'evidence/frontend/M4C-findings-tablet.png',
    animations: 'disabled',
    scale: 'css'
  });
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeHidden();
  await page.getByRole('button', { name: 'Close Lens Stack and return to Canvas' }).click();
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible();
});

test('records the RX-7 BOM and revision-locked output preview', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openBundledRx7Example(page);
  await page.getByRole('button', { name: 'BOM view' }).click();
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await expect(lens.getByRole('heading', { name: 'Exact design demand' })).toBeVisible();
  await expect(lens.getByText('2 procurement choices · 2 installation records')).toBeVisible();
  await page.screenshot({
    path: 'evidence/frontend/M6-rx7-bom-desktop.png',
    animations: 'disabled',
    scale: 'css'
  });

  await page.setViewportSize({ width: 820, height: 1000 });
  await lens.getByRole('button', { name: 'Preview printable report' }).click();
  const preview = page.getByRole('dialog', { name: 'Printable Project Report' });
  await expect(preview.getByRole('heading', { name: 'BOM · exact design demand' })).toBeVisible();
  await expect(preview.getByText('Durable revision', { exact: false }).first()).toBeVisible();
  await page.screenshot({
    path: 'evidence/frontend/M6-rx7-output-tablet.png',
    animations: 'disabled',
    scale: 'css'
  });
});

test('records the 1120, 700, and mobile-review workspace boundaries', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await page.getByRole('button', { name: 'Routes view' }).click();
  await page.screenshot({
    path: 'evidence/frontend/milestone-3a-workspace-1120.png',
    animations: 'disabled',
    scale: 'css'
  });

  await page.setViewportSize({ width: 700, height: 900 });
  await page.reload();
  await page.getByRole('button', { name: 'State Compare view' }).click();
  await page.screenshot({
    path: 'evidence/frontend/milestone-3a-workspace-700.png',
    animations: 'disabled',
    scale: 'css'
  });

  await page.setViewportSize({ width: 699, height: 900 });
  await page.reload();
  await expect(page.locator('[data-capability-reason="mobile-review"]')).toBeVisible();
  await page.screenshot({
    path: 'evidence/frontend/milestone-3a-workspace-mobile-review.png',
    animations: 'disabled',
    scale: 'css'
  });
});

test('records Project Library empty, loading, and persistent error states', async ({
  page,
  browser
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await page.screenshot({
    path: 'evidence/frontend/milestone-3a-library-empty.png',
    fullPage: true,
    animations: 'disabled',
    scale: 'css'
  });

  const loadingContext = await browser.newContext({ javaScriptEnabled: false });
  const loadingPage = await loadingContext.newPage();
  await loadingPage.setViewportSize({ width: 1440, height: 1000 });
  await loadingPage.goto('/');
  await expect(loadingPage.locator('[data-library-state="loading"]')).toBeVisible();
  await loadingPage.screenshot({
    path: 'evidence/frontend/milestone-3a-library-loading.png',
    fullPage: true,
    animations: 'disabled',
    scale: 'css'
  });
  await loadingContext.close();

  const errorPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await errorPage.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {
        open() {
          throw new Error('IndexedDB intentionally unavailable');
        }
      }
    });
  });
  await errorPage.goto('/');
  await expect(errorPage.getByRole('alert')).toBeVisible();
  await errorPage.screenshot({
    path: 'evidence/frontend/milestone-3a-library-error.png',
    fullPage: true,
    animations: 'disabled',
    scale: 'css'
  });
  await errorPage.close();
});

test('records save-failed and lease-held review states', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'projects') {
        throw new DOMException('Simulated quota limit', 'QuotaExceededError');
      }

      return originalPut.apply(this, args as Parameters<IDBObjectStore['put']>);
    };
  });
  await page.getByRole('button', { name: 'Apply project edit' }).click();
  await expect(page.getByRole('alert')).toContainText('Save failed');
  await page.screenshot({
    path: 'evidence/frontend/milestone-3a-workspace-save-failed.png',
    animations: 'disabled',
    scale: 'css'
  });

  const reviewPage = await context.newPage();
  await reviewPage.setViewportSize({ width: 1120, height: 900 });
  await reviewPage.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await expect(reviewPage.locator('[data-capability-reason="lease-held"]')).toBeVisible();
  await reviewPage.screenshot({
    path: 'evidence/frontend/milestone-3a-workspace-read-only.png',
    animations: 'disabled',
    scale: 'css'
  });
  await reviewPage.close();
});
