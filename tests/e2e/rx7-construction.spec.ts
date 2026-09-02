import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ACC-001 through MVP-ACC-004 copies the bundled RX-7 construction record', async ({
  page
}) => {
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await expect(page.getByText(/illustrative assumptions and unknowns/i)).toBeVisible();
  await openBundledRx7Example(page);
  await page.getByRole('button', { name: 'Systems view' }).click();

  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await expect(lens.getByText('4 Systems · 26 Components')).toBeVisible();
  await expect(lens.getByRole('heading', { name: 'Auxiliary cooling electrical' })).toBeVisible();
  await expect(lens.getByRole('heading', { name: 'Engine coolant' })).toBeVisible();
  await expect(lens.getByRole('heading', { name: 'Thermostatic engine oil' })).toBeVisible();
  await expect(lens.getByRole('heading', { name: 'Return-style fuel' })).toBeVisible();
});
