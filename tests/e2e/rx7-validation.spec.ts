import { expect, test } from '@playwright/test';

import { evaluateBundledRx7Example, openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ACC-008 publishes scoped RX-7 validation history and dispositions', async ({ page }) => {
  await openBundledRx7Example(page);
  await evaluateBundledRx7Example(page);

  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await expect(lens.getByRole('region', { name: 'Validation Coverage' })).toBeVisible();
  await expect(lens.getByText('Radiator inlet compatibility is Unknown.')).toBeVisible();
  await expect(
    lens.getByText('Pressure-loss evidence omits radiator and fitting losses.')
  ).toBeVisible();
  await expect(lens.getByText('Wire color evidence conflicts.')).toBeVisible();
  await expect(
    lens.getByText('Fuel route was previously absent and is now resolved.')
  ).toBeVisible();
  await expect(lens.locator('[data-validation-result-status="current"]')).toBeVisible();
});
