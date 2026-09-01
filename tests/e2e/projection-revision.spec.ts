import { expect, test } from '@playwright/test';

test('MVP-PROD-003 projects one durable revision through canvas and dense views', async ({
  page
}) => {
  const projectRequests: string[] = [];
  page.on('request', (outgoing) => {
    if (
      outgoing.resourceType() !== 'document' &&
      /\/(?:api\/)?projects?(?:\/|\?|$)/.test(new URL(outgoing.url()).pathname)
    ) {
      projectRequests.push(outgoing.url());
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Blank project' }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);

  const workspace = page.locator('[data-project-revision]');
  const canvas = page.locator('[data-canvas-revision]');
  const dense = page.locator('[data-dense-revision]');
  await expect(canvas).toHaveAttribute('data-canvas-revision', '0');
  await expect(dense).toHaveAttribute('data-dense-revision', '0');

  await page.getByRole('button', { name: 'Apply project edit' }).click();
  await expect(workspace).toHaveAttribute('data-evaluation-status', 'current');
  await expect(workspace).toHaveAttribute('data-save-status', 'saved');
  const durableRevision = await canvas.getAttribute('data-canvas-revision');
  expect(Number(durableRevision)).toBeGreaterThan(0);
  await expect(dense).toHaveAttribute('data-dense-revision', durableRevision!);
  await expect(workspace).toHaveAttribute('data-project-revision', durableRevision!);
  await expect(page.getByRole('heading', { name: 'Vehicle project r1' })).toBeVisible();

  await page.reload();
  await expect(canvas).toHaveAttribute('data-canvas-revision', durableRevision!);
  await expect(dense).toHaveAttribute('data-dense-revision', durableRevision!);
  await expect(workspace).toHaveAttribute('data-save-status', 'saved');
  await expect(page.getByRole('heading', { name: 'Vehicle project r1' })).toBeVisible();
  expect(projectRequests).toEqual([]);
});
