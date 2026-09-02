import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

export async function openBundledRx7Example(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Copy illustrative example' }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(
    page.getByRole('heading', {
      name: 'Illustrative RX-7 vehicle systems study copy',
      exact: true
    })
  ).toBeVisible();
}

export async function evaluateBundledRx7Example(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Findings view' }).click();
  await page
    .getByRole('dialog', { name: 'Lens Stack' })
    .getByRole('button', { name: 'Validate Project' })
    .click();
  await expect(page.locator('[data-evaluation-status="current"]')).toBeVisible();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
}
