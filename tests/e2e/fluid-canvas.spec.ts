import { expect, test } from '@playwright/test';
import { seedWorkspaceProject, WORKSPACE_PROJECT_ID } from '../fixtures/workspace-project';

test('line sizes edit immediately, trace endpoints, undo, and survive reload', async ({ page }) => {
  await page.goto('/examples/rx7-fd');
  await expect(
    page.getByRole('heading', { name: 'RX-7 FD · Stock fluid systems copy', exact: true })
  ).toBeVisible();
  const lines = page.locator('[data-renderer-connection]');
  await expect(lines).toHaveCount(12);
  await expect(page.locator('[data-nominal-size="unknown"]')).toHaveCount(12);
  const line = lines.nth(1);
  const lineId = await line.getAttribute('data-renderer-connection');
  await line.focus();
  await page.keyboard.press('Enter');
  const size = page.getByLabel('Nominal AN size', { exact: true });
  await expect(size).toHaveValue('');
  await expect(page.getByLabel('Line size provenance')).toBeHidden();
  await size.selectOption('6');
  await expect(line).toHaveAttribute('data-nominal-size', '6');
  const sixWidth = Number(
    await line.locator('[data-physical-layer="medium"]').getAttribute('stroke-width')
  );
  await size.selectOption('8');
  await expect(line).toHaveAttribute('data-nominal-size', '8');
  expect(
    Number(await line.locator('[data-physical-layer="medium"]').getAttribute('stroke-width'))
  ).toBeGreaterThan(sixWidth);
  await expect(page.locator('.system-node.trace-active')).toHaveCount(2);
  await expect(page.locator('.connection-layer > .trace-muted')).toHaveCount(11);

  await page.getByRole('button', { name: 'Undo last Project action' }).click();
  await expect(size).toHaveValue('6');
  await page.getByRole('button', { name: 'Redo Project action' }).click();
  await expect(size).toHaveValue('8');
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
  await page.reload();
  const reloadedLine = page.locator(`[data-renderer-connection="${lineId}"]`);
  await expect(reloadedLine).toHaveAttribute('data-nominal-size', '8');
  await reloadedLine.focus();
  await page.keyboard.press('Enter');
  await expect(size).toHaveValue('8');
  await size.selectOption('');
  await expect(reloadedLine).toHaveAttribute('data-nominal-size', 'unknown');
});

test('zoom stays under the cursor and connections follow a dragged part', async ({ page }) => {
  await page.goto('/examples/rx7-fd');
  await expect(
    page.getByRole('heading', { name: 'RX-7 FD · Stock fluid systems copy', exact: true })
  ).toBeVisible();
  const canvas = page.locator('[data-renderer-adapter="svg"] > svg');
  const bounds = (await canvas.boundingBox())!;
  // Browser pointer/wheel coordinates use whole CSS pixels.
  const anchor = {
    x: Math.round(bounds.x + bounds.width * 0.4),
    y: Math.round(bounds.y + bounds.height * 0.4)
  };
  const worldPoint = () =>
    canvas.evaluate((svg, point) => {
      const content = svg.querySelector('.connection-layer')
        ?.parentElement as unknown as SVGGraphicsElement;
      const result = new DOMPoint(point.x, point.y).matrixTransform(
        content.getScreenCTM()!.inverse()
      );
      return { x: result.x, y: result.y };
    }, anchor);
  const before = await worldPoint();
  const zoom = await page.getByLabel('Canvas zoom', { exact: true }).innerText();
  await page.mouse.move(anchor.x, anchor.y);
  await page.mouse.wheel(0, -120);
  await expect(page.getByLabel('Canvas zoom', { exact: true })).not.toHaveText(zoom);
  const after = await worldPoint();
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.5);
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();

  const node = page
    .locator('[data-renderer-node]')
    .filter({ has: page.getByRole('button', { name: 'Water pump, part', exact: true }) });
  const shell = node.locator('.node-shell');
  const body = (await shell.boundingBox())!;
  const line = page.locator('[data-renderer-connection]').first();
  const oldPath = await line.locator('[data-physical-layer="medium"]').getAttribute('d');
  const oldRevision = await page
    .locator('[data-project-revision]')
    .getAttribute('data-project-revision');
  await page.mouse.move(body.x + body.width / 2, body.y + body.height - 15);
  await page.mouse.down();
  await page.mouse.move(body.x + body.width / 2 - 35, body.y + body.height + 10, { steps: 4 });
  await expect(line.locator('[data-physical-layer="medium"]')).not.toHaveAttribute('d', oldPath!);
  expect(await page.locator('[data-project-revision]').getAttribute('data-project-revision')).toBe(
    oldRevision
  );
  const snapError = await line.evaluate((group) => {
    const port = document.querySelector(
      `[data-renderer-port="${group.getAttribute('data-source-port')}"]`
    ) as unknown as SVGCircleElement;
    const path = group.querySelector('[data-physical-layer="medium"]') as SVGPathElement;
    const first = path.getPointAtLength(0).matrixTransform(path.getScreenCTM()!);
    const rect = port.getBoundingClientRect();
    return Math.hypot(first.x - rect.x - rect.width / 2, first.y - rect.y - rect.height / 2);
  });
  expect(snapError).toBeLessThan(0.75);
  await page.mouse.up();
  await expect(page.locator('[data-project-revision]')).not.toHaveAttribute(
    'data-project-revision',
    oldRevision!
  );
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.flow-cue.flowing')).toHaveCount(0);
});

test('tidy coordinates nodes, ports and sized labels; undo and durable reload preserve geometry', async ({
  page
}) => {
  const errors: string[] = [];
  const workerRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('elk-worker')) workerRequests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/rx7-fd');
  await expect(
    page.getByRole('heading', { name: 'RX-7 FD · Stock fluid systems copy', exact: true })
  ).toBeVisible();
  const lines = page.locator('[data-renderer-connection]');
  await lines.first().focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Nominal AN size', { exact: true }).selectOption('8');
  const geometry = () =>
    page.evaluate(() => ({
      nodes: Array.from(document.querySelectorAll('[data-renderer-node]')).map((node) => ({
        id: node.getAttribute('data-renderer-node'),
        transform: node.getAttribute('transform'),
        width: node.querySelector('.node-shell')?.getAttribute('width'),
        height: node.querySelector('.node-shell')?.getAttribute('height')
      })),
      edges: Array.from(document.querySelectorAll('[data-renderer-connection]')).map((edge) => ({
        id: edge.getAttribute('data-renderer-connection'),
        path: edge.querySelector('[data-physical-layer="medium"]')?.getAttribute('d')
      }))
    }));
  const before = await geometry();
  const tidy = page.getByRole('button', { name: 'Tidy diagram', exact: true });
  expect(workerRequests).toEqual([]);
  await tidy.click();
  await expect(page.locator('.interaction-status')).toHaveText(
    'Diagram tidied. Undo restores your previous arrangement.'
  );
  await expect(tidy).toBeEnabled();
  expect(workerRequests).toHaveLength(1);
  const arranged = await geometry();
  expect(arranged).not.toEqual(before);
  await expect(page.locator('.line-badge')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Undo last Project action' }).click();
  expect(await geometry()).toEqual(before);
  await page.getByRole('button', { name: 'Redo Project action' }).click();
  expect(await geometry()).toEqual(arranged);
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'RX-7 FD · Stock fluid systems copy', exact: true })
  ).toBeVisible();
  expect(await geometry()).toEqual(arranged);
  expect(errors).toEqual([]);
});

test('filtered tidy clears hidden authored routes that extend below their cards', async ({
  page
}) => {
  await seedWorkspaceProject(page);
  await page.evaluate(async (projectId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('venae-machinae');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');
    const request = store.get(projectId);
    request.onsuccess = () => {
      const record = request.result;
      const route = record.snapshot.topology.routes.find(
        (candidate: { id: string }) => candidate.id === 'route-wire'
      );
      for (const segment of record.snapshot.topology.segments) {
        if (route.segmentIds.includes(segment.id)) {
          segment.start.y = '10000';
          segment.end.y = '10000';
        }
      }
      store.put(record);
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, WORKSPACE_PROJECT_ID);
  await page.goto(`/projects/${WORKSPACE_PROJECT_ID}?system=system-coolant`);
  await expect(page.locator('[data-renderer-node="pump"]')).toBeVisible();
  await page.getByRole('button', { name: 'Tidy diagram', exact: true }).click();
  await expect(page.locator('.interaction-status')).toHaveText(
    'Diagram tidied. Undo restores your previous arrangement.'
  );
  const positions = await page.locator('[data-renderer-node]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const matrix = (node as unknown as SVGGraphicsElement).transform.baseVal.consolidate()!
        .matrix;
      return matrix.f;
    })
  );
  expect(positions.length).toBe(3);
  expect(positions.every((y) => y > 10000)).toBe(true);
});
