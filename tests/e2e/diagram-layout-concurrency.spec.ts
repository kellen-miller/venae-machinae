import { expect, test } from '@playwright/test';

for (const change of ['metadata', 'line size'] as const) {
  test(`pending Tidy ${change === 'metadata' ? 'retains metadata and evaluation updates' : 'rejects changed layout inputs'}`, async ({
    page
  }) => {
    await page.goto('/examples/rx7-fd');
    await expect(
      page.getByRole('heading', { name: 'RX-7 FD · Stock fluid systems copy', exact: true })
    ).toBeVisible();
    await page.locator('[data-renderer-connection]').first().focus();
    await page.keyboard.press('Enter');
    const before = await page
      .locator('[data-renderer-node]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('transform')));
    let release = () => {};
    let requested = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const workerRequested = new Promise<void>((resolve) => {
      requested = resolve;
    });
    await page.route('**/*elk-worker*', async (route) => {
      requested();
      await gate;
      await route.continue();
    });
    try {
      await page.getByRole('button', { name: 'Tidy diagram', exact: true }).click();
      await workerRequested;
      if (change === 'metadata') {
        await page.getByRole('button', { name: 'Apply project edit' }).click();
        await expect(page.locator('[data-evaluation-status="current"]')).toBeVisible();
        const name = await page.getByRole('heading', { level: 1 }).innerText();
        release();
        await expect(page.locator('.interaction-status')).toHaveText(
          'Diagram tidied. Undo restores your previous arrangement.'
        );
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
      } else {
        await page.getByLabel('Nominal AN size', { exact: true }).selectOption('8');
        release();
        await expect(page.locator('.interaction-status')).toHaveText(
          'Diagram changed while tidying. Run Tidy diagram again.'
        );
        expect(
          await page
            .locator('[data-renderer-node]')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('transform')))
        ).toEqual(before);
        await expect(page.locator('[data-renderer-connection]').first()).toHaveAttribute(
          'data-nominal-size',
          '8'
        );
      }
    } finally {
      release();
    }
  });
}
