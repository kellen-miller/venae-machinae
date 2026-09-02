import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';

test('MVP-NFR-001 MVP-NFR-002 MVP-NFR-004 MVP-ACC-015 crosses desktop, tablet, and mobile live', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openBundledRx7Example(page);
  await expect(page.getByRole('button', { name: 'Add mode' })).toBeEnabled();
  await page.getByRole('button', { name: 'Apply project edit' }).click();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();

  await page.setViewportSize({ width: 1120, height: 900 });
  await expect(page.getByRole('button', { name: 'Add mode' })).toBeEnabled();
  const tabletRevision = Number(
    await page.locator('[data-project-revision]').getAttribute('data-project-revision')
  );
  await page.getByRole('button', { name: 'Add mode' }).click();
  await page.getByRole('button', { name: /^Add electrical source/ }).click();
  expect(
    Number(await page.locator('[data-project-revision]').getAttribute('data-project-revision'))
  ).toBeGreaterThan(tabletRevision);
  await expect(page.locator('[data-evaluation-status="current"]')).toBeVisible();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
  await page.getByRole('button', { name: 'Systems view' }).click();
  await expect(page.getByRole('dialog', { name: 'Lens Stack' })).toContainText(
    '4 Systems · 27 Components'
  );
  await page.getByRole('button', { name: 'Canvas view' }).click();
  const durableRevision = await page
    .locator('[data-project-revision]')
    .getAttribute('data-project-revision');
  const touchTargets = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons.slice(0, 24).map((button) => ({
      label: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
      width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height
    }))
  );
  expect(touchTargets.filter((target) => target.width < 44 || target.height < 44)).toEqual([]);

  await page.setViewportSize({ width: 699, height: 900 });
  const mobileNotice = page.locator('[data-capability-reason="mobile-review"]');
  await expect(mobileNotice).toBeVisible();
  await expect(page.locator(`[data-project-revision="${durableRevision}"]`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply project edit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add mode' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Connect mode' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Route mode' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Operating State' }).selectOption({
    label: 'Run Hot / Fan On'
  });
  await expect(page.locator('[data-operating-state]')).not.toHaveAttribute(
    'data-operating-state',
    ''
  );

  await page.getByRole('button', { name: 'Findings view' }).click();
  await expect(page.getByRole('button', { name: 'Validate Project' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Run Build Preparation' })).toBeDisabled();

  await page.getByRole('button', { name: 'BOM view' }).click();
  await expect(page.getByRole('button', { name: 'Preview printable report' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Record procurement choice' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Record installation' })).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download round-trip Project JSON' }).click();
  await downloadPromise;

  await page.setViewportSize({ width: 700, height: 900 });
  await expect(mobileNotice).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add mode' })).toBeEnabled();
});

test('MVP-NFR-003 explains missing authoring APIs while retaining review', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Worker', { configurable: true, value: undefined });
  });
  await openBundledRx7Example(page);

  const notice = page.locator('[data-capability-reason="missing-worker"]');
  await expect(notice).toContainText('Web Worker');
  await expect(notice).toContainText('review and durable export remain available');
  await expect(page.getByRole('button', { name: 'Apply project edit' })).toBeDisabled();
  await page.getByRole('button', { name: 'BOM view' }).click();
  await expect(page.getByRole('button', { name: 'Preview printable report' })).toBeEnabled();
});
