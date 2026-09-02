import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { seedWorkspaceProject, WORKSPACE_PROJECT_ID } from '../fixtures/workspace-project';

function zipEntryNames(bytes: Buffer): string[] {
  const names: string[] = [];
  for (let offset = 0; offset <= bytes.length - 46; offset += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLength = bytes.readUInt16LE(offset + 28);
    names.push(bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'));
  }
  return names;
}

test('MVP-BUILD-004 MVP-BUILD-005 MVP-BUILD-006 MVP-BUILD-007 produces one durable revision across outputs', async ({
  page
}, testInfo) => {
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await page.getByRole('button', { name: 'BOM view' }).click();
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });

  await lens.getByRole('button', { name: 'Preview printable report' }).click();
  const preview = page.getByRole('dialog', { name: 'Printable Project Report' });
  await expect(preview.getByRole('heading', { name: 'RX-7 workshop study' })).toBeVisible();
  await expect(preview).toContainText('Revision 7');
  await expect(preview).toContainText('Durable revision');
  await expect(preview).toContainText('A4 portrait');
  await expect(preview).toContainText('Visible Findings');
  await preview.getByRole('button', { name: 'Close print preview' }).click();

  const csvDownloadPromise = page.waitForEvent('download');
  await lens.getByRole('button', { name: 'Download BOM CSV' }).click();
  const csvDownload = await csvDownloadPromise;
  const csvPath = testInfo.outputPath(csvDownload.suggestedFilename());
  await csvDownload.saveAs(csvPath);
  expect(csvDownload.suggestedFilename()).toMatch(/\.bom\.csv$/);
  const csv = await readFile(csvPath, 'utf8');
  expect(csv).toContain('project_revision,generated_at');
  expect(csv).toContain('raw_value,unit,provenance,status');

  const zipDownloadPromise = page.waitForEvent('download');
  await lens.getByRole('button', { name: 'Download Export All ZIP' }).click();
  const zipDownload = await zipDownloadPromise;
  const zipPath = testInfo.outputPath(zipDownload.suggestedFilename());
  await zipDownload.saveAs(zipPath);
  expect(zipDownload.suggestedFilename()).toMatch(/\.outputs\.zip$/);
  expect(zipEntryNames(await readFile(zipPath))).toEqual(
    expect.arrayContaining(['bom.csv', 'manifest.json', 'systems.csv'])
  );

  const validationDownloadPromise = page.waitForEvent('download');
  await lens.getByRole('button', { name: 'Download Validation Report' }).click();
  const validationDownload = await validationDownloadPromise;
  const validationPath = testInfo.outputPath(validationDownload.suggestedFilename());
  await validationDownload.saveAs(validationPath);
  const validation = JSON.parse(await readFile(validationPath, 'utf8')) as {
    projectRevision: number;
    findings: Array<{ lifecycleLabel: string }>;
  };
  expect(validation.projectRevision).toBe(7);
  expect(validation.findings).toEqual([
    expect.objectContaining({ lifecycleLabel: 'Active · unreviewed' })
  ]);

  const projectDownloadPromise = page.waitForEvent('download');
  await lens.getByRole('button', { name: 'Download round-trip Project JSON' }).click();
  const projectDownload = await projectDownloadPromise;
  const projectPath = testInfo.outputPath(projectDownload.suggestedFilename());
  await projectDownload.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8')) as {
    format: string;
    identity: { projectRevision: number };
  };
  expect(project.format).toBe('venae-project');
  expect(project.identity.projectRevision).toBe(7);
});
