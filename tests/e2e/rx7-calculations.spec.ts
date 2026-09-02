import { expect, test } from '@playwright/test';

import { evaluateBundledRx7Example, openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ACC-006 evaluates the bundled RX-7 calculation boundary', async ({ page }) => {
  await openBundledRx7Example(page);
  await evaluateBundledRx7Example(page);
  await page.getByRole('button', { name: 'Calculations view' }).click();

  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await expect(lens.getByText('11 configured · 5 screens')).toBeVisible();
  await expect(lens.locator('[data-calculation-result][data-status="calculated"]')).toHaveCount(9);
  await expect(lens.locator('[data-calculation-result][data-status="unknown"]')).toContainText(
    'missing input: area'
  );
  await expect(lens.locator('[data-calculation-result][data-status="unsupported"]')).toContainText(
    'outside low voltage envelope'
  );
  await expect(lens.getByText('0.28875 volt')).toBeVisible();
  await expect(lens.getByText('Omissions: unknown radiator and fitting losses')).toBeVisible();
});
