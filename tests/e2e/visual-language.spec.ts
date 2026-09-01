import { expect, test } from '@playwright/test';

import { seedWorkspaceProject, WORKSPACE_PROJECT_ID } from '../fixtures/workspace-project';

const rasterBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const rasterHash = '431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460';

test.beforeEach(async ({ page }) => {
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await expect(page.locator('[data-workspace-mode="select"]')).toBeVisible();
});

test('MVP-UX-006 keeps physical construction and overlay channels additive', async ({ page }) => {
  const wire = page.locator('[data-renderer-connection="wire-fan"]');
  const hose = page.locator('[data-renderer-connection="hose-upper"]');
  const tube = page.locator('[data-renderer-connection="tube-return"]');
  const pipe = page.locator('[data-renderer-connection="pipe-oil"]');

  await expect(wire).toHaveAttribute('data-physical-kind', 'wire');
  await expect(wire.locator('[data-physical-layer="outer"]')).toHaveAttribute('stroke-width', '6');
  await expect(wire.locator('[data-physical-layer="stripe"]')).toHaveCount(1);
  await expect(hose).toHaveAttribute('data-physical-kind', 'hose');
  await expect(tube).toHaveAttribute('data-physical-kind', 'tube');
  await expect(pipe).toHaveAttribute('data-physical-kind', 'pipe');
  for (const fluid of [hose, tube, pipe]) {
    await expect(fluid.locator('[data-physical-layer="outer"]')).toHaveAttribute(
      'stroke-width',
      '13'
    );
  }

  const constructionCues = await Promise.all(
    [hose, tube, pipe].map((connection) =>
      connection.locator('[data-physical-layer="medium"]').evaluate((path) => {
        const style = getComputedStyle(path);
        return { dash: style.strokeDasharray, cap: style.strokeLinecap };
      })
    )
  );
  expect(constructionCues).toEqual([
    { dash: '2px, 3px', cap: 'round' },
    { dash: 'none', cap: 'butt' },
    { dash: '18px, 3px', cap: 'square' }
  ]);

  async function channels(connectionId: string): Promise<string[]> {
    return page
      .locator(`[data-renderer-connection="${connectionId}"] [data-overlay-channel]`)
      .evaluateAll((marks) =>
        marks.map((mark) => mark.getAttribute('data-overlay-channel')!).sort()
      );
  }

  expect(await channels('hose-upper')).toEqual(['direction', 'provenance', 'temperature']);
  expect(await channels('tube-return')).toEqual(['direction', 'finding', 'unknown']);
  expect(await channels('pipe-oil')).toEqual(['conflict', 'direction', 'provenance']);

  await page.getByRole('button', { name: 'Fan feed, wire' }).focus();
  await page.keyboard.press('Enter');
  expect(await channels('wire-fan')).toEqual(['provenance', 'selection']);
});

test('MVP-UX-007 persists and renders one calibrated inert raster by content hash', async ({
  page
}) => {
  await page.getByText('Vehicle background', { exact: true }).click();
  await page.getByLabel('Background raster file').setInputFiles({
    name: 'vehicle-reference.png',
    mimeType: 'image/png',
    buffer: rasterBytes
  });
  await expect(page.getByText(`SHA-256 ${rasterHash}`)).toBeVisible();
  await page.getByLabel('Position X').fill('24');
  await page.getByLabel('Position Y').fill('36');
  await page.getByLabel('Distance').fill('250');
  await page.getByLabel('Opacity').fill('0.28');
  await page.getByRole('button', { name: 'Apply background reference' }).click();

  const background = page.getByLabel('Calibrated vehicle background reference');
  await expect(background).toHaveAttribute('data-background-hash', rasterHash);
  await expect(background).toHaveAttribute('data-background-locked', 'true');
  await expect(background).toHaveAttribute('data-calibration-distance', '250 mm');
  await expect(background).toHaveCSS('opacity', '0.28');
  await expect(background.locator('img')).toHaveJSProperty('naturalWidth', 1);
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();

  const storedAsset = await page.evaluate(async (hash) => {
    const request = indexedDB.open('venae-machinae', 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('assets', 'readonly');
    const stored = await new Promise<{ sha256: string; mimeType: string; bytes: Uint8Array }>(
      (resolve, reject) => {
        const get = transaction.objectStore('assets').get(hash);
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      }
    );
    database.close();
    return {
      sha256: stored.sha256,
      mimeType: stored.mimeType,
      byteLength: stored.bytes.byteLength
    };
  }, rasterHash);
  expect(storedAsset).toEqual({ sha256: rasterHash, mimeType: 'image/png', byteLength: 68 });

  await page.reload();
  await expect(background).toHaveAttribute('data-background-hash', rasterHash);
  await expect(background.locator('img')).toHaveJSProperty('naturalWidth', 1);
  await page.getByText('Vehicle background', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Replace background reference' })).toBeVisible();
});

test('MVP-NFR-002/MVP-ARCH-008 exposes mobile review and same-origin lease blockers without permissions UI', async ({
  page,
  context
}) => {
  const secondPage = await context.newPage();
  await secondPage.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await expect(secondPage.locator('[data-capability-reason="lease-held"]')).toContainText(
    'another window owns this Project’s authoring lease'
  );
  await expect(secondPage.getByRole('button', { name: 'Add mode' })).toBeDisabled();
  await secondPage.close();

  await page.setViewportSize({ width: 699, height: 900 });
  await page.reload();
  await expect(page.locator('[data-capability-reason="mobile-review"]')).toContainText(
    'Project mutation remains blocked below 700 CSS pixels'
  );
  await expect(page.getByRole('button', { name: 'Add mode' })).toBeDisabled();
  await page.locator('[data-renderer-node="battery"] .node-shell').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-primary-selection="battery"]')).toBeVisible();
});
