import { expect, test } from '@playwright/test';

import { evaluateBundledRx7Example, openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ACC-009 preserves RX-7 projection context across all views and print', async ({
  page
}) => {
  await openBundledRx7Example(page);
  await evaluateBundledRx7Example(page);
  await page.getByRole('button', { name: 'Systems view' }).click();
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await lens.getByRole('button', { name: '12 V battery', exact: true }).click();
  await lens.getByRole('button', { name: 'Preview Radiator' }).click();
  await page.getByRole('button', { name: 'Follow preview' }).click();
  const selection = await page
    .locator('[data-primary-selection]')
    .getAttribute('data-primary-selection');

  await page.getByRole('button', { name: 'Canvas view' }).click();
  const workspace = page.locator('[data-canvas-viewport]');
  await page.locator('svg[aria-label="Topology canvas"]').hover();
  await page.mouse.wheel(0, -120);
  const viewport = await workspace.getAttribute('data-canvas-viewport');
  await page.getByRole('button', { name: 'Systems view' }).click();
  await lens.getByRole('button', { name: 'Preview 12 V battery' }).click();
  await page.getByRole('button', { name: 'Reveal preview on canvas' }).click();
  await page.getByRole('button', { name: 'Return to prior canvas presentation' }).click();
  await expect(workspace).toHaveAttribute('data-canvas-viewport', viewport!);

  await page.getByLabel('Domain filter').selectOption('fluid');
  await page.getByLabel('Operating State').selectOption({ label: 'Run Hot / Fan On' });
  await expect(page.locator('[data-evaluation-status="current"]')).toBeVisible();
  const operatingState = await page
    .locator('[data-operating-state]')
    .getAttribute('data-operating-state');

  for (const view of [
    'Systems',
    'Circuits & Lines',
    'Interfaces',
    'Routes',
    'Harnesses & Bundles',
    'Calculations',
    'Evidence',
    'BOM',
    'Findings',
    'State Compare'
  ]) {
    await page.getByRole('button', { name: `${view} view` }).click();
    await expect(page.getByRole('dialog', { name: 'Lens Stack' })).toBeVisible();
    await expect(page.locator('[data-primary-selection]')).toHaveAttribute(
      'data-primary-selection',
      selection!
    );
    await expect(page.getByLabel('Domain filter')).toHaveValue('fluid');
    await expect(page.locator('[data-operating-state]')).toHaveAttribute(
      'data-operating-state',
      operatingState!
    );
  }

  await page.getByRole('button', { name: 'BOM view' }).click();
  await page
    .getByRole('dialog', { name: 'Lens Stack' })
    .getByRole('button', { name: 'Preview printable report' })
    .click();
  const report = page.getByRole('dialog', { name: 'Printable Project Report' });
  await expect(report).toContainText('Run Hot / Fan On');
  await expect(report).toContainText('fluid · all systems');
  await expect(report).toContainText('Fuel-compatible hose');
});
