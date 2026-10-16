import { expect, test } from '@playwright/test';

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
  const anchor = { x: bounds.x + bounds.width * 0.4, y: bounds.y + bounds.height * 0.4 };
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
