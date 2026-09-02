import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { evaluateBundledRx7Example, openBundledRx7Example } from '../fixtures/rx7-example';
import { readStoredZipEntries } from '../fixtures/stored-zip';

test('MVP-ELEC-014 exports the complete RX-7 wiring record at one revision', async ({
  page
}, testInfo) => {
  await openBundledRx7Example(page);
  await evaluateBundledRx7Example(page);
  const revision = await page
    .locator('[data-project-revision]')
    .getAttribute('data-project-revision');
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

  expect(JSON.parse(entries.get('manifest.json') ?? '{}')).toMatchObject({
    format: 'venae-derived-output',
    roundTrip: false,
    projectRevision: Number(revision)
  });
  expect(entries.get('connections.csv')).toContain('Battery to fuse');
  expect(entries.get('connections.csv')).toContain('ECU fan command');
  expect(entries.get('electrical-circuits.csv')).toContain('Auxiliary cooling fan');
  expect(entries.get('ports.csv')).toContain('Cavity A');
  expect(entries.get('electrical-wires.csv')).toContain('connection_id,role,part_definition_id');
  expect(entries.get('electrical-construction.csv')).toContain('Auxiliary cooling harness');
  expect(entries.get('electrical-construction.csv')).toContain('Front harness bundle');
  expect(entries.get('bom.csv')).toContain('TXL primary wire');
  expect(entries.get('evidence.csv')).toContain('System voltage');
  expect(entries.get('results.csv')).toContain('electrical.voltage-drop.v1');
  expect(entries.get('findings.csv')).toContain('Wire color evidence conflicts.');
});
