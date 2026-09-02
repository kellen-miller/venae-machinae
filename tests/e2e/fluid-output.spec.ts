import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { evaluateBundledRx7Example, openBundledRx7Example } from '../fixtures/rx7-example';
import { readStoredZipEntries } from '../fixtures/stored-zip';

test('MVP-FLUID-014 MVP-FLUID-015 exports fluid schedules and bounded fuel evidence', async ({
  page
}, testInfo) => {
  await openBundledRx7Example(page);
  await evaluateBundledRx7Example(page);
  await page.getByRole('button', { name: 'BOM view' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('dialog', { name: 'Lens Stack' })
    .getByRole('button', { name: 'Download Export All ZIP' })
    .click();
  const download = await downloadPromise;
  const archivePath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(archivePath);
  const entries = readStoredZipEntries(await readFile(archivePath));

  expect(entries.get('connections.csv')).toContain('Thermostat bypass');
  expect(entries.get('connections.csv')).toContain('Oil bypass');
  expect(entries.get('connections.csv')).toContain('Fuel return to tank');
  expect(entries.get('fluid-interfaces.csv')).toContain('interface_key,status');
  expect(entries.get('fluid-lines.csv')).toContain(
    'route_raw_value,route_unit,hydraulic_raw_value,hydraulic_unit,cut_raw_value,cut_unit'
  );
  expect(entries.get('routes.csv')).toContain('route_id,segment_id,segment_order');
  expect(entries.get('components.csv')).toContain('Recorded regulator boundary');
  expect(entries.get('ports.csv')).toContain('medium_id,interface_key,status');
  expect(entries.get('evidence.csv')).toContain('Hot coolant temperature');
  expect(entries.get('evidence.csv')).toContain('Radiator inlet interface');
  expect(entries.get('results.csv')).toContain('fluid.total-pressure-loss.v1');
  expect(entries.get('results.csv')).toContain('unknown radiator and fitting losses');
  expect(entries.get('bom.csv')).toContain('Fuel-compatible hose');
  expect(entries.get('findings.csv')).toContain('Radiator inlet compatibility is Unknown.');

  const completeOutput = [...entries.values()].join('\n').toLocaleLowerCase();
  for (const prohibited of [
    'fuel-injection sizing',
    'pressure-regulation recommendation',
    'injector supply design',
    'fire protection',
    'legal compliance'
  ]) {
    expect(completeOutput).not.toContain(prohibited);
  }
});
