import { expect, test } from '@playwright/test';

import { seedWorkspaceProject, WORKSPACE_PROJECT_ID } from '../fixtures/workspace-project';

test.beforeEach(async ({ page }) => {
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await expect(page.locator('[data-workspace-mode="select"]')).toBeVisible();
});

test('MVP-UX-001/002 keeps one full-bleed canvas under all eleven views', async ({ page }) => {
  const launcher = page.getByRole('navigation', { name: 'View Launcher' });
  await expect(launcher.getByRole('button')).toHaveCount(11);
  await expect(launcher.getByRole('button', { name: 'Canvas view' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  const canvas = page.locator('[data-canvas-geometry]');
  const before = await canvas.boundingBox();
  expect(before).not.toBeNull();
  await launcher.getByRole('button', { name: 'Systems view' }).click();
  await expect(page.getByRole('dialog', { name: 'Lens Stack' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Systems' })).toBeVisible();
  const after = await canvas.boundingBox();
  expect(after).toEqual(before);

  for (const name of [
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
    await launcher.getByRole('button', { name: `${name} view` }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
});

test('MVP-UX-003 synchronizes selection, preview, Follow, Reveal, and exact Return', async ({
  page
}) => {
  await page.locator('[data-renderer-node="battery"] .node-shell').click();
  await expect(page.locator('[data-primary-selection="battery"]')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toContainText('Battery');
  await page.getByRole('button', { name: 'Systems view' }).click();
  await expect(page.locator('[data-lens-subject="battery"]')).toHaveAttribute(
    'data-selected',
    'true'
  );

  await page.getByRole('button', { name: 'Preview Cooling fan' }).click();
  await expect(page.locator('[data-workspace-preview="fan"]')).toBeVisible();
  await expect(page.locator('[data-renderer-node="fan"]')).toHaveAttribute(
    'data-previewed',
    'true'
  );
  await page.getByRole('button', { name: 'Follow preview' }).click();
  await expect(page.locator('[data-primary-selection="fan"]')).toBeVisible();

  const workspace = page.locator('[data-canvas-viewport]');
  await page.getByRole('button', { name: 'Canvas view' }).click();
  await page.locator('svg[aria-label="Topology canvas"]').hover();
  await page.mouse.wheel(0, -120);
  const beforeReveal = await workspace.getAttribute('data-canvas-viewport');
  await page.getByRole('button', { name: 'Systems view' }).click();
  await page.getByRole('button', { name: 'Preview Radiator' }).click();
  await page.getByRole('button', { name: 'Reveal preview on canvas' }).click();
  await expect(page.locator('[data-active-view="canvas"]')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Return to prior canvas presentation' })
  ).toBeVisible();
  await expect(workspace).not.toHaveAttribute('data-canvas-viewport', beforeReveal!);
  await page.getByRole('button', { name: 'Return to prior canvas presentation' }).click();
  await expect(workspace).toHaveAttribute('data-canvas-viewport', beforeReveal!);
});

test('MVP-UX-003/004 keeps explicit modes and independent projection viewports', async ({
  page
}) => {
  const modeToolbar = page.getByRole('toolbar', { name: 'Workspace modes' });
  await modeToolbar.getByRole('button', { name: 'Pan mode' }).click();
  await expect(page.locator('[data-workspace-mode="pan"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-workspace-mode="select"]')).toBeVisible();

  await page.getByRole('button', { name: 'Routes view' }).click();
  await page.getByRole('button', { name: 'Increase Routes lens zoom' }).click();
  await expect(page.locator('[data-lens-viewport="routes"]')).toHaveAttribute('data-zoom', '1.1');
  await page.getByRole('button', { name: 'Systems view' }).click();
  await expect(page.locator('[data-lens-viewport="systems"]')).toHaveAttribute('data-zoom', '1');
  await page.getByRole('button', { name: 'Routes view' }).click();
  await expect(page.locator('[data-lens-viewport="routes"]')).toHaveAttribute('data-zoom', '1.1');

  await page.getByRole('button', { name: 'State Compare view' }).click();
  await page.getByRole('button', { name: 'Increase left comparison zoom' }).click();
  await expect(page.locator('[data-compare-viewport="left"]')).toHaveAttribute('data-zoom', '1.1');
  await expect(page.locator('[data-compare-viewport="right"]')).toHaveAttribute('data-zoom', '1.1');
});
