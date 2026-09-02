import { expect, test } from '@playwright/test';

import { seedWorkspaceProject } from '../fixtures/workspace-project';

test('MVP-UX-008 exposes loading, empty guidance, and honest creation affordances', async ({
  page,
  request
}) => {
  const initialDocument = await request.get('/');
  const initialMarkup = await initialDocument.text();
  expect(initialMarkup).toContain('data-library-state="loading"');
  expect(initialMarkup).toContain('Opening the browser Project Library');

  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No browser-local projects yet' })).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Start a vehicle project' }).getByRole('listitem')
  ).toHaveCount(4);

  await expect(page.getByRole('button', { name: 'Blank project' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Duplicate project' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Import \.venae\.json/ })).toBeEnabled();
  const exampleButton = page.getByRole('button', { name: 'Copy illustrative example' });
  await expect(exampleButton).toBeEnabled();
  await expect(exampleButton).toContainText(
    'Illustrative assumptions and unknowns remain explicit'
  );
  await expect(exampleButton).toContainText(
    'not a safety endorsement or recommended vehicle design'
  );
  await expect(page.getByText('Strictly validate and stage before confirmation')).toBeVisible();
});

test('MVP-UX-008 duplicates a whole browser-local project without a wizard', async ({ page }) => {
  await seedWorkspaceProject(page);
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();

  await page.getByRole('button', { name: 'Duplicate RX-7 workshop study' }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'RX-7 workshop study copy' })).toBeVisible();
  await expect(page.locator('[data-project-revision="0"]')).toBeVisible();
  await expect(page.locator('[data-renderer-node="battery"]')).toBeVisible();
});

test('MVP-UX-008 keeps Project Library failure visible', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {
        open() {
          throw new Error('IndexedDB intentionally unavailable');
        }
      }
    });
  });

  await page.goto('/');
  const failure = page.getByRole('alert');
  await expect(failure).toContainText('Project Library unavailable');
  await expect(failure).toContainText('IndexedDB intentionally unavailable');
  await expect(page.getByRole('button', { name: 'Blank project' })).toBeDisabled();
});
