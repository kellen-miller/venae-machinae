import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';

import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';

import type { ChildProcessWithoutNullStreams } from 'node:child_process';

async function reserveAvailablePort(): Promise<number> {
  const probe = createServer();
  probe.listen({ host: '127.0.0.1', port: 0, exclusive: true });
  await once(probe, 'listening');
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a test port');
  probe.close();
  await once(probe, 'close');
  return address.port;
}

async function startProductionServer(
  port: number
): Promise<{ child: ChildProcessWithoutNullStreams; origin: string }> {
  const origin = `http://localhost:${port}`;
  const child = spawn(process.execPath, ['scripts/start-production-server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: 'localhost', ORIGIN: origin, PORT: String(port) },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += String(chunk)));
  child.stderr.on('data', (chunk) => (output += String(chunk)));

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Production server exited before readiness (${child.exitCode}): ${output}`);
    }

    try {
      const response = await fetch(`${origin}/health`);
      if (response.ok) return { child, origin };
    } catch {
      // The child has not bound the loopback port yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  child.kill('SIGTERM');
  await once(child, 'exit');
  throw new Error(`Production server did not become ready: ${output}`);
}

async function stopProductionServer(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}

test('MVP-ACC-016/MVP-PROD-001/MVP-ARCH-007/008 keeps loaded RX-7 work local through production server loss', async ({
  browser
}, testInfo) => {
  test.setTimeout(45_000);
  const port = await reserveAvailablePort();
  let server = await startProductionServer(port);
  const context = await browser.newContext({ baseURL: server.origin });
  const page = await context.newPage();

  try {
    await openBundledRx7Example(page);
    const sharedOrigin = testInfo.project.use.baseURL;
    if (typeof sharedOrigin !== 'string') throw new Error('Expected the configured test origin');
    const independentPage = await context.newPage();
    await independentPage.goto(sharedOrigin);
    await expect(independentPage.locator('[data-library-state="ready"]')).toBeVisible();
    await expect(
      independentPage.getByText('Illustrative RX-7 vehicle systems study copy', { exact: true })
    ).toHaveCount(0);
    await expect(
      independentPage.getByRole('button', { name: 'Copy illustrative example' })
    ).toBeVisible();
    await independentPage.close();

    const initialRevision = Number(
      await page.locator('[data-project-revision]').getAttribute('data-project-revision')
    );

    await stopProductionServer(server.child);
    await expect(page.locator('[data-delivery-state="disconnected"]')).toContainText(
      'Loaded editing, undo, browser-local save, and export remain available',
      { timeout: 10_000 }
    );
    await page.getByRole('button', { name: 'Apply project edit' }).click();
    await expect(page.locator(`[data-project-revision="${initialRevision + 1}"]`)).toBeVisible();
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator(`[data-project-revision="${initialRevision + 2}"]`)).toBeVisible();
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible();

    await page.getByRole('button', { name: 'BOM view' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('dialog', { name: 'Lens Stack' })
      .getByRole('button', { name: 'Download round-trip Project JSON' })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.venae\.json$/);
    await page.getByRole('button', { name: 'Close Lens Stack and return to Canvas' }).click();

    const coldPage = await context.newPage();
    let coldLaunchUnavailable = false;
    try {
      await coldPage.goto('/', { timeout: 2_000 });
    } catch {
      coldLaunchUnavailable = true;
    }
    expect(coldLaunchUnavailable).toBe(true);
    await coldPage.close();

    server = await startProductionServer(port);
    await expect(page.locator('[data-delivery-state="connected"]')).toBeVisible({
      timeout: 10_000
    });
    const reconnectRevision = Number(
      await page.locator('[data-project-revision]').getAttribute('data-project-revision')
    );
    expect(reconnectRevision).toBeGreaterThanOrEqual(initialRevision + 2);
    await expect(
      page.getByRole('heading', {
        name: 'Illustrative RX-7 vehicle systems study copy',
        exact: true
      })
    ).toBeVisible();
  } finally {
    await stopProductionServer(server.child);
    await context.close();
  }
});
