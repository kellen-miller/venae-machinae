import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { seedWorkspaceProject, WORKSPACE_PROJECT_ID } from '../fixtures/workspace-project';

test('MVP-DATA-002 flushes pending autosave with Cmd/Ctrl+S', async ({ page }) => {
  await seedWorkspaceProject(page);
  await page.addInitScript(() => {
    const schedule = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]) =>
      schedule(
        handler,
        timeout === 350 ? 60_000 : timeout,
        ...arguments_
      )) as typeof window.setTimeout;
  });
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);

  await page.getByRole('button', { name: 'Apply project edit' }).click();
  await expect(page.locator('[data-evaluation-status="current"]')).toBeVisible();
  await expect(page.locator('[data-save-status="queued"]')).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible({ timeout: 1_000 });
  await expect(page.getByLabel('Project status')).toContainText('Saved at');
});

test('MVP-DATA-005 MVP-DATA-008 MVP-DATA-009 MVP-DATA-010 MVP-DATA-019 exposes recovery, Trash, and Library Backup lifecycle', async ({
  page
}, testInfo) => {
  await seedWorkspaceProject(page);
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await expect(page.locator('[data-storage-status]')).toContainText(/storage|quota/i);
  await expect(page.getByText(/Autosave.*profile or device loss/i)).toBeVisible();

  await page.getByRole('button', { name: 'Create Named Snapshot for RX-7 workshop study' }).click();
  await expect(page.getByText('RX-7 workshop study snapshot', { exact: true })).toBeVisible();
  await expect(page.getByText('Revision 7 · user-retained')).toBeVisible();
  await page.getByRole('button', { name: 'Restore RX-7 workshop study snapshot' }).click();
  await expect(page.getByRole('link', { name: /Revision 8/ })).toBeVisible();

  await page.getByRole('button', { name: 'Move RX-7 workshop study to Trash' }).click();
  await expect(page.getByRole('heading', { name: 'Trash' })).toBeVisible();
  await expect(page.getByText('RX-7 workshop study', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore RX-7 workshop study' }).click();
  await expect(page.getByRole('link', { name: /RX-7 workshop study/ })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Library Backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.venae-backup\.json$/);
  const backupPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8')) as { format: string };
  expect(backup.format).toBe('venae-backup');
  await expect(page.getByRole('heading', { name: /Last Library Backup: just now/i })).toBeVisible();
});

test('MVP-DATA-007 MVP-DATA-009 automatically enforces checkpoint retention', async ({ page }) => {
  await seedWorkspaceProject(page);
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await page.evaluate(async (projectId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('venae-machinae', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['projects', 'checkpoints'], 'readwrite');
    const projectRequest = transaction.objectStore('projects').get(projectId);
    const project = await new Promise<{
      revision: number;
      snapshot: unknown;
    }>((resolve, reject) => {
      projectRequest.onsuccess = () => resolve(projectRequest.result);
      projectRequest.onerror = () => reject(projectRequest.error);
    });
    for (let index = 0; index < 30; index += 1) {
      transaction.objectStore('checkpoints').put({
        id: `automatic-retention-${index.toString().padStart(2, '0')}`,
        projectId,
        projectRevision: project.revision,
        reason: 'automatic-retention-fixture',
        createdAt: `2026-07-01T12:${index.toString().padStart(2, '0')}:00.000Z`,
        snapshot: project.snapshot
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, WORKSPACE_PROJECT_ID);

  await page.reload();
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async (projectId) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('venae-machinae', 2);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction('checkpoints', 'readonly');
        const request = transaction.objectStore('checkpoints').index('by-project').count(projectId);
        const count = await new Promise<number>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        database.close();
        return count;
      }, WORKSPACE_PROJECT_ID)
    )
    .toBe(25);
});

test('MVP-DATA-003 MVP-DATA-007 checkpoints session open and yields a held authoring lease', async ({
  page,
  context
}) => {
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'RX-7 workshop study' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply project edit' })).toBeEnabled();
  const checkpointReasons = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('venae-machinae', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('checkpoints', 'readonly');
    const request = transaction.objectStore('checkpoints').getAll();
    const checkpoints = await new Promise<Array<{ reason: string }>>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return checkpoints.map((checkpoint) => checkpoint.reason);
  });
  expect(checkpointReasons).toContain('session-open');

  const contender = await context.newPage();
  await contender.goto(`/projects/${WORKSPACE_PROJECT_ID}`, { waitUntil: 'domcontentloaded' });
  await expect(contender.getByRole('button', { name: 'Apply project edit' })).toBeDisabled();
  await contender.getByRole('button', { name: 'Request authoring takeover' }).click();
  await expect(contender.getByRole('button', { name: 'Apply project edit' })).toBeEnabled({
    timeout: 10_000
  });
});

test('MVP-DATA-004 retains unsaved work for emergency export and safe retry', async ({
  page
}, testInfo) => {
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    Object.defineProperty(window, '__restoreProjectPut', {
      value: () => {
        IDBObjectStore.prototype.put = originalPut;
      },
      configurable: true
    });
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'projects') {
        throw new DOMException('Simulated quota limit', 'QuotaExceededError');
      }
      return originalPut.apply(this, args as Parameters<IDBObjectStore['put']>);
    };
  });

  await page.getByRole('button', { name: 'Apply project edit' }).click();
  const failure = page.getByRole('alert');
  await expect(failure).toContainText('Unsaved changes remain in memory and are not durable');
  await expect(failure.getByRole('button', { name: 'Retry save' })).toBeVisible();
  const navigationDialogPromise = page.waitForEvent('dialog');
  const navigationPromise = page.getByRole('link', { name: 'Back to Project Library' }).click();
  const navigationDialog = await navigationDialogPromise;
  await navigationDialog.dismiss();
  await navigationPromise;
  await expect(page).toHaveURL(new RegExp(`/projects/${WORKSPACE_PROJECT_ID}$`));
  await expect(failure).toBeVisible();
  const workingRevision = Number(
    await page.locator('[data-project-revision]').getAttribute('data-project-revision')
  );

  const exportDialogPromise = page.waitForEvent('dialog');
  const downloadPromise = page.waitForEvent('download');
  const exportClickPromise = failure
    .getByRole('button', { name: 'Export unsaved working state' })
    .click();
  const exportDialog = await exportDialogPromise;
  await exportDialog.accept();
  await exportClickPromise;
  const download = await downloadPromise;
  const emergencyPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(emergencyPath);
  const emergency = JSON.parse(await readFile(emergencyPath, 'utf8')) as {
    identity: { projectRevision: number };
    exportMetadata: { revisionState: string };
  };
  expect(download.suggestedFilename()).toMatch(/\.unsaved\.venae\.json$/);
  expect(emergency.identity.projectRevision).toBe(workingRevision);
  expect(workingRevision).toBeGreaterThan(7);
  expect(emergency.exportMetadata.revisionState).toBe('Unsaved working state');

  await page.evaluate(() => {
    const restore = (window as Window & { __restoreProjectPut?: () => void }).__restoreProjectPut;
    restore?.();
  });
  await failure.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
});

test('MVP-MODEL-009 MVP-VAL-012 confirms connection deletion, retains a tombstone, and undoes', async ({
  page
}) => {
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await page.getByRole('button', { name: 'Fan feed, wire' }).focus();
  await page.keyboard.press('Enter');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete connection' }).click();
  await expect(page.getByRole('button', { name: 'Fan feed, wire' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Fan feed, wire' })).toBeVisible();
});

test('MVP-DATA-017 promotes a Project Part Definition as an immutable Template revision', async ({
  page
}) => {
  await seedWorkspaceProject(page);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}`);
  await page.getByRole('button', { name: 'Interfaces view' }).click();

  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await lens.getByLabel('Part label').fill('Workshop pump');
  await lens.getByRole('button', { name: 'Add Part Definition' }).click();
  await lens.getByRole('button', { name: 'Promote Workshop pump revision 1 as Template' }).click();
  await expect(lens.getByRole('status')).toHaveText(
    'Promoted Workshop pump revision 1 as an immutable Template.'
  );

  await page.getByRole('link', { name: 'Back to Project Library' }).click();
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '1 immutable revisions' })).toBeVisible();
});
