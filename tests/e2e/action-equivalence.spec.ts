import { expect, test } from '@playwright/test';

import { seedWorkspaceProject, WORKSPACE_PROJECT_ID } from '../fixtures/workspace-project';

test.beforeEach(async ({ page }) => {
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await expect(page.locator('[data-workspace-mode="select"]')).toBeVisible();
});

test('MVP-UX-012 sends direct manipulation and Inspector edits through one action', async ({
  page
}) => {
  const battery = page.locator('[data-renderer-node="battery"] .node-shell');
  const bounds = await battery.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + 40, bounds!.y + 36);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 72, bounds!.y + 52);
  await page.mouse.up();

  await expect(page.getByText(/move-component accepted at revision \d+/)).toBeVisible();
  const directRevision = Number(
    await page.locator('[data-project-revision]').getAttribute('data-project-revision')
  );
  expect(directRevision).toBeGreaterThan(7);

  await page.locator('[data-renderer-node="fan"] .node-shell').click();
  await page.getByLabel('Component X position').fill('512');
  await page.getByLabel('Component Y position').fill('144');
  await page.getByRole('button', { name: 'Apply position' }).click();

  await expect(page.getByText(/move-component accepted at revision \d+/)).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.locator('[data-project-revision]').getAttribute('data-project-revision'))
    )
    .toBeGreaterThan(directRevision);
  await expect(page.locator('[data-renderer-node="fan"]')).toHaveAttribute(
    'transform',
    'translate(512 144)'
  );
});

test('MVP-UX-009/011 creates project-owned primitives and exposes keyboard-visible actions', async ({
  page
}) => {
  const fan = page.locator('[data-renderer-node="fan"] .node-shell');
  await fan.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-primary-selection="fan"]')).toBeVisible();

  await page.keyboard.press('a');
  await expect(page.locator('[data-workspace-mode="add"]')).toBeVisible();
  await page.getByRole('button', { name: /^Add electrical source/ }).click();
  await expect
    .poll(async () =>
      Number(await page.locator('[data-project-revision]').getAttribute('data-project-revision'))
    )
    .toBeGreaterThan(7);
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toContainText(
    'Project-owned primitive'
  );
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();

  const storedPrimitive = await page.evaluate(async (projectId) => {
    const request = indexedDB.open('venae-machinae');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('projects', 'readonly');
    const stored = await new Promise<{
      snapshot: {
        topology: { components: { id: string; label: string; definitionId: string | null }[] };
        evidence: { subjectId: string }[];
        partDefinitions: unknown[];
      };
    }>((resolve, reject) => {
      const get = transaction.objectStore('projects').get(projectId);
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    database.close();
    const component = stored.snapshot.topology.components.find(
      (candidate) => candidate.label === 'Electrical source'
    );
    return {
      component,
      hasEvidence: stored.snapshot.evidence.some(
        (evidence) => evidence.subjectId === component?.id
      ),
      definitionCount: stored.snapshot.partDefinitions.length
    };
  }, WORKSPACE_PROJECT_ID);
  expect(storedPrimitive).toEqual({
    component: expect.objectContaining({ label: 'Electrical source', definitionId: null }),
    hasEvidence: false,
    definitionCount: 0
  });

  await page.getByRole('button', { name: 'Search project subjects' }).click();
  await page.getByRole('textbox', { name: 'Search project subjects' }).fill('cooling fan');
  await page
    .getByRole('dialog', { name: 'Project search' })
    .getByRole('button', { name: /Cooling fan/ })
    .click();
  await expect(page.locator('[data-primary-selection="fan"]')).toBeVisible();
  await expect(page.locator('[data-active-view="systems"]')).toBeVisible();

  await page.keyboard.press('Control+k');
  await page.getByLabel('Filter commands').fill('Route mode');
  await page.getByRole('button', { name: /Use Route mode/ }).click();
  await expect(page.locator('[data-workspace-mode="route"]')).toBeVisible();
});
