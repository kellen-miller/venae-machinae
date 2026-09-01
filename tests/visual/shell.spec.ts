import { expect, test } from '@playwright/test';

test('records the Milestone 0 Project Library shell', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('[data-shell-state="baseline"]')).toBeVisible();
  await page.screenshot({
    path: `evidence/frontend/milestone-0-${testInfo.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
    scale: 'css'
  });
});
