import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('stock FD example link creates a durable copy in each browser library', async ({
  page,
  browser
}, testInfo) => {
  await page.goto('/examples/rx7-fd');
  const heading = page.getByRole('heading', {
    name: 'RX-7 FD · Stock fluid systems copy',
    exact: true
  });
  await expect(heading).toBeVisible();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
  const originalUrl = page.url();
  const exampleUrl = new URL('/examples/rx7-fd', originalUrl).href;

  await page.reload();
  await expect(heading).toBeVisible();
  await expect(page.getByLabel('System filter').locator('option')).toHaveText([
    'All systems',
    'Engine cooling',
    'Engine lubrication',
    'Fuel supply',
    'Brake hydraulics',
    'Clutch hydraulics',
    'Power steering'
  ]);

  await page.getByRole('button', { name: 'BOM view', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('dialog', { name: 'Lens Stack' })
    .getByRole('button', { name: 'Download round-trip Project JSON' })
    .click();
  const exportPath = testInfo.outputPath('stock-fd.venae.json');
  await (await downloadPromise).saveAs(exportPath);
  const exported = JSON.parse(await readFile(exportPath, 'utf8')) as {
    payload: {
      topology: { components: unknown[]; connections: unknown[] };
      fluid: { systems: unknown[] };
    };
  };
  expect(exported.payload.fluid.systems).toHaveLength(6);
  expect(exported.payload.topology.components).toHaveLength(35);
  expect(exported.payload.topology.connections).toHaveLength(41);

  const otherBrowser = await browser.newContext();
  try {
    const otherPage = await otherBrowser.newPage();
    await otherPage.goto(originalUrl);
    await expect(
      otherPage.getByText('This browser profile does not contain that Project.')
    ).toBeVisible();
    await otherPage.goto(exampleUrl);
    await expect(
      otherPage.getByRole('heading', { name: 'RX-7 FD · Stock fluid systems copy', exact: true })
    ).toBeVisible();
    expect(otherPage.url()).not.toBe(originalUrl);
    await expect(otherPage.locator('[data-save-status="saved"]')).toBeVisible();
  } finally {
    await otherBrowser.close();
  }

  await page.goto('/');
  await expect(page.locator('.project-library > ol > li')).toHaveCount(1);
});
