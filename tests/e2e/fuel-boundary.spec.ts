import { expect, test } from '@playwright/test';

test('MVP-FLUID-014 keeps return-style fuel work topology-only', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Blank project' }).click();
  await page.getByRole('button', { name: 'Systems view' }).click();
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });

  await lens.getByLabel('Fluid System label').fill('Return-style fuel');
  await lens.getByLabel('Fluid Medium').fill('Gasoline');
  await lens.getByLabel('Medium composition').fill('commercial gasoline');
  await lens.getByLabel('System purpose').fill('fuel delivery and return topology');
  await lens.getByRole('button', { name: 'Add Fluid System' }).click();

  await page.getByRole('button', { name: 'Add mode' }).click();
  await page
    .getByLabel('Fluid System for new fluid primitive')
    .selectOption({ label: 'Return-style fuel' });
  await page.getByRole('button', { name: /^Add fluid volume/ }).click();
  await page.getByRole('button', { name: /^Add fluid pump/ }).click();
  await page.getByRole('button', { name: /^Add fluid valve/ }).click();

  await page.getByRole('button', { name: 'Circuits & Lines view' }).click();
  const fluidPanel = page.getByRole('dialog', { name: 'Lens Stack' });
  for (const input of [
    { label: 'Tank to pump', kind: 'fluid-hose', source: 2, target: 3 },
    { label: 'Pump to engine', kind: 'fluid-tube', source: 4, target: 5 },
    { label: 'Engine return to tank', kind: 'fluid-hose', source: 6, target: 1 }
  ] as const) {
    await fluidPanel.getByLabel('Fluid System').selectOption({ label: 'Return-style fuel' });
    await fluidPanel.getByLabel('Line label').fill(input.label);
    await fluidPanel.getByLabel('Construction kind').selectOption(input.kind);
    await fluidPanel.getByLabel('Fluid source Port').selectOption({ index: input.source });
    await fluidPanel.getByLabel('Fluid target Port').selectOption({ index: input.target });
    await fluidPanel.getByRole('button', { name: 'Add Fluid Line' }).click();
  }

  await expect(fluidPanel.getByText('Tank to pump', { exact: true })).toBeVisible();
  await expect(fluidPanel.getByText('Pump to engine', { exact: true })).toBeVisible();
  await expect(fluidPanel.getByText('Engine return to tank', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /injector sizing/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /pressure regulation/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /fire protection/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /legal compliance/i })).toHaveCount(0);
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
});
