import { expect, test } from '@playwright/test';

import { evaluateBundledRx7Example, openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ACC-005 switches five RX-7 states and compares traced overlays', async ({ page }) => {
  await openBundledRx7Example(page);
  await evaluateBundledRx7Example(page);

  const stateSelector = page.getByLabel('Operating State');
  await expect(stateSelector.getByRole('option')).toHaveCount(6);
  await stateSelector.selectOption({ label: 'Run Hot / Fan On' });
  await expect(page.locator('[data-evaluation-status="current"]')).toBeVisible();

  await page.getByRole('button', { name: 'State Compare view' }).click();
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await lens.getByLabel('Compare Operating State A').selectOption({ label: 'Key Off / Cold' });
  await lens.getByLabel('Compare Operating State B').selectOption({ label: 'Run Hot / Fan On' });
  await expect(lens.getByRole('region', { name: 'State Compare differences' })).not.toContainText(
    'No evaluated differences available.'
  );
  await expect(lens.locator('[data-state-binding-record]')).not.toHaveCount(0);
});
