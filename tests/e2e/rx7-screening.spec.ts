import { expect, test } from '@playwright/test';

import { evaluateBundledRx7Example, openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ACC-007 MVP-FLUID-014 screens every bundled RX-7 candidate class without ranking', async ({
  page
}) => {
  await openBundledRx7Example(page);
  await evaluateBundledRx7Example(page);
  await page.getByRole('button', { name: 'Calculations view' }).click();

  const outcomes = page
    .getByRole('dialog', { name: 'Lens Stack' })
    .getByRole('region', { name: 'Candidate screening outcomes' });
  for (const label of [
    'TXL primary wire',
    'Low-voltage blade fuse',
    'Coolant hose',
    'Fluid transition fitting',
    'Serviceable fluid coupling'
  ]) {
    await expect(outcomes.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(outcomes.locator('[data-comparison="pass"]')).not.toHaveCount(0);
  await expect(outcomes.locator('[data-comparison="fail"]')).not.toHaveCount(0);
  await expect(outcomes.locator('[data-comparison="indeterminate"]')).toContainText(
    'bound overlap'
  );
  await expect(outcomes.locator('[data-comparison="unevaluated"]')).toContainText(
    'missing evidence'
  );
  await expect(page.getByRole('dialog', { name: 'Lens Stack' })).toContainText(
    'does not rank, recommend, or declare aggregate suitability'
  );
});
