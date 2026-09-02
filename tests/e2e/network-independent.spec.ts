import { expect, test } from '@playwright/test';

import { seedWorkspaceProject, WORKSPACE_PROJECT_ID } from '../fixtures/workspace-project';

test('MVP-PROD-001/MVP-ARCH-007 evaluates through loopback when navigator reports offline', async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  });
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);

  await expect(page.locator('[data-delivery-state="connected"]')).toBeVisible();
  await page.getByRole('button', { name: 'Apply project edit' }).click();
  await expect(page.locator('[data-evaluation-status="current"]')).toBeVisible();
});

test('MVP-PROD-001/MVP-ARCH-007 preserves loaded editing and persistence under network denial', async ({
  page,
  context
}) => {
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await expect(page.getByRole('button', { name: 'Apply project edit' })).toBeEnabled();
  const initialRevision = Number(
    await page.locator('[data-project-revision]').getAttribute('data-project-revision')
  );

  await context.setOffline(true);
  await expect(page.locator('[data-delivery-state="disconnected"]')).toContainText(
    'Loaded editing, undo, browser-local save, and export remain available'
  );
  await page.getByRole('button', { name: 'Apply project edit' }).click();
  await expect(page.locator(`[data-project-revision="${initialRevision + 1}"]`)).toBeVisible();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator(`[data-project-revision="${initialRevision + 2}"]`)).toBeVisible();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();

  await context.setOffline(false);
  await expect(page.locator('[data-delivery-state="connected"]')).toBeVisible();
});
