import { expect, test } from '@playwright/test';

test('evaluates bounded calculations and selected candidates through the production worker', async ({
  page
}) => {
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Blank project' }).click();
  await expect(page.locator('[data-workspace-mode="select"]')).toBeVisible();

  const launcher = page.getByRole('navigation', { name: 'View Launcher' });
  await launcher.getByRole('button', { name: 'Calculations view' }).click();
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });

  await lens.getByLabel('Operating State name').fill('Run Hot / Fan On');
  await lens
    .getByLabel('Operating State description')
    .fill('Fan and coolant pump continuously active');
  await lens.getByRole('button', { name: 'Add Operating State' }).click();
  await expect(
    lens.locator('.state-register strong').filter({ hasText: 'Run Hot / Fan On' })
  ).toBeVisible();

  await lens.getByLabel('Formula').selectOption('electrical.voltage-drop.v1');
  await lens.getByLabel('current value').fill('12.5');
  await lens.getByLabel('current lower bound').fill('10');
  await lens.getByLabel('current upper bound').fill('15');
  await lens.getByLabel('resistance value').fill('0.032');
  await lens.getByLabel('resistance lower bound').fill('0.02');
  await lens.getByLabel('resistance upper bound').fill('0.04');
  await lens.getByLabel('Assumptions').fill('steady DC');
  await lens.getByRole('button', { name: 'Evaluate Calculation' }).click();

  await lens.getByLabel('Assumptions').fill('steady DC; continuous current');
  const calculationResult = lens.locator('[data-calculation-result]').first();
  await expect(calculationResult).toContainText('0.4 volt');
  await expect(calculationResult).toContainText('0.2–0.6');
  await expect(calculationResult).toContainText('complete for stated model');

  await lens.getByLabel('Omissions').fill('connector resistance; fuse-contact resistance');
  await lens.getByRole('button', { name: 'Evaluate Calculation' }).click();
  await expect(calculationResult).toContainText('known subtotal');
  await expect(calculationResult).toContainText('electrical.voltage-drop.v1 · r1');
  await expect(calculationResult).toContainText('connector resistance');

  await lens.getByLabel('Formula').selectOption('electrical.current.voltage-resistance.v1');
  await lens.getByLabel('voltage value').fill('72');
  await lens.getByLabel('resistance value').fill('2');
  await lens.getByLabel('Omissions').fill('');
  await lens.getByRole('button', { name: 'Evaluate Calculation' }).click();
  await expect(calculationResult).toContainText(/unsupported/i);
  await expect(calculationResult).toContainText('outside low voltage envelope');

  await lens.getByLabel('Formula').selectOption('electrical.voltage-drop.v1');
  await lens.getByLabel('resistance value').fill('');
  await lens.getByRole('button', { name: 'Evaluate Calculation' }).click();
  await expect(calculationResult).toContainText(/unknown/i);
  await expect(calculationResult).toContainText('missing input: resistance');

  await launcher.getByRole('button', { name: 'Interfaces view' }).click();
  await lens.getByLabel('Part label').fill('Hose Candidate A');
  await lens.getByRole('button', { name: 'Add Part Definition' }).click();
  await lens.getByLabel('Part label').fill('Hose Candidate B');
  await lens.getByRole('button', { name: 'Add Part Definition' }).click();

  await launcher.getByRole('button', { name: 'Calculations view' }).click();
  await lens.getByLabel('Screening Operating State').selectOption({
    label: 'Run Hot / Fan On'
  });
  await lens.getByLabel('Minimum working pressure').fill('150');
  await lens.getByRole('checkbox', { name: 'Hose Candidate A' }).check();
  await lens.getByRole('checkbox', { name: 'Hose Candidate B' }).check();
  await lens.getByLabel('Hose Candidate A working pressure').fill('220');
  await lens.getByRole('button', { name: 'Screen Selected Candidates' }).click();

  const screeningResult = lens.locator('[data-screening-result]').first();
  await expect(screeningResult).toContainText('Hose Candidate A');
  await expect(screeningResult).toContainText('pass');
  await expect(screeningResult).toContainText('Hose Candidate B');
  await expect(screeningResult).toContainText('unevaluated');
  await expect(screeningResult).not.toContainText(/best|rank|recommend/i);
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
});
