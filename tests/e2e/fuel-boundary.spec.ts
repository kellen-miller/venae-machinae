import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-FLUID-014 keeps return-style fuel work topology-only', async ({ page }) => {
  await openBundledRx7Example(page);
  await page.getByRole('button', { name: 'Circuits & Lines view' }).click();
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });

  for (const label of [
    'Fuel tank supply',
    'Fuel pump to filter',
    'Fuel filter to rail',
    'Fuel rail return',
    'Fuel return to tank'
  ]) {
    await expect(lens.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /injector sizing/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /pressure regulation/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /fire protection/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /legal compliance/i })).toHaveCount(0);
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
});
