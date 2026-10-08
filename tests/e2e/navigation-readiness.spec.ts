import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';
import { seedWorkspaceProject, WORKSPACE_PROJECT_ID } from '../fixtures/workspace-project';

test.beforeEach(async ({ page }) => {
  page.setDefaultNavigationTimeout(3_000);
  await page.route('**/navigation-stall.png', () => {
    // Hold the image request until context teardown to prevent the load event.
  });
});

test('opens the RX-7 example while a document resource is pending', async ({ page }) => {
  await page.route('**/', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '</body>',
      '<img src="/navigation-stall.png" alt=""> </body>'
    );
    await route.fulfill({ response, body });
  });

  await openBundledRx7Example(page);
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
});

test('seeds the workspace while a document resource is pending', async ({ page }) => {
  await page.route('**/health', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><img src="/navigation-stall.png" alt="">'
    })
  );

  await seedWorkspaceProject(page);
  expect(await page.evaluate(() => document.readyState)).toBe('interactive');
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`, { waitUntil: 'commit' });
  await expect(page.locator('[data-workspace-mode="select"]')).toBeVisible();
});
