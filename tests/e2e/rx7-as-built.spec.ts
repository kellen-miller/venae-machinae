import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-ACC-010 keeps RX-7 procurement and as-built evidence on topology identity', async ({
  page
}) => {
  await openBundledRx7Example(page);
  await page.getByRole('button', { name: 'BOM view' }).click();

  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await expect(lens.getByText('2 procurement choices · 2 installation records')).toBeVisible();
  await expect(lens.getByText('Original unknown fan')).toBeVisible();
  await expect(lens.getByText('Illustrative 12 V replacement fan')).toBeVisible();

  await lens
    .getByLabel('Procurement Part Definition')
    .selectOption({ label: 'TXL primary wire · r1' });
  await lens.getByLabel('Procurement variant').fill('18 AWG red');
  await lens.getByLabel('Purchased quantity').fill('12');
  await lens.getByLabel('Procurement unit').fill('m');
  await lens.getByLabel('Procurement method').selectOption('spares');
  await lens.getByLabel('Spare percent').fill('20');
  await lens.getByLabel('Procurement note').fill('Explicit workshop spare quantity');
  await lens.getByLabel('Procurement provenance').fill('Workshop purchase record');
  await lens.getByRole('button', { name: 'Record procurement choice' }).click();

  await expect(
    lens.getByRole('region', { name: 'Procurement' }).getByText('12 m · spares')
  ).toBeVisible();

  await lens
    .getByLabel('Installation subject')
    .selectOption({ label: 'Auxiliary cooling fan replacement · Component' });
  await lens
    .getByLabel('Installed Part Definition')
    .selectOption({ label: 'Auxiliary cooling fan · r1' });
  await lens.getByLabel('Installed variant').fill('Workshop verified replacement');
  await lens
    .getByLabel('Observation evidence')
    .selectOption({ label: 'Replacement fan installation' });
  await lens.getByLabel('Installation photo').selectOption({ index: 1 });
  await lens.getByLabel('Installation notes').fill('Verified on the retained topology identity');
  await lens.getByLabel('Installation provenance').fill('Workshop inspection');
  await lens.getByRole('button', { name: 'Record installation' }).click();

  await expect(lens.getByText('Workshop verified replacement')).toBeVisible();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
});
