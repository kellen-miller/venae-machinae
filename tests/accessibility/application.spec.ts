import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { openBundledRx7Example } from '../fixtures/rx7-example';

type AxeViolation = Readonly<{
  id: string;
  impact: string | null;
  nodes: readonly Readonly<{ target: readonly string[]; failureSummary: string | undefined }>[];
}>;

async function installAxe(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/__venae-axe.js', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript; charset=utf-8',
      body: readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8')
    });
  });
  await page.addScriptTag({ url: '/__venae-axe.js' });
}

async function wcagViolations(page: import('@playwright/test').Page): Promise<AxeViolation[]> {
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run(options: unknown): Promise<{ violations: AxeViolation[] }>;
        };
      }
    ).axe;
    const result = await axe.run({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
      }
    });
    return result.violations;
  });
}

test('MVP-NFR-005 Project Library has WCAG AA semantics, focus, and 320px reflow', async ({
  browserName,
  page
}) => {
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await installAxe(page);
  expect(await wcagViolations(page)).toEqual([]);

  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  expect(await focused.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    'none'
  );

  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});

test('MVP-NFR-005 RX-7 review retains semantics, reduced motion, and non-color meaning', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await openBundledRx7Example(page);
  await page.getByRole('button', { name: 'BOM view' }).click();
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await expect(lens.getByRole('heading', { name: 'Exact design demand' })).toBeVisible();
  await lens.getByRole('button', { name: 'Preview printable report' }).click();
  const report = page.getByRole('dialog', { name: 'Printable Project Report' });
  await expect(report.getByRole('table')).toBeVisible();
  await expect(page.locator('[data-motion-paused="true"]')).toBeVisible();
  await installAxe(page);
  expect(await wcagViolations(page)).toEqual([]);

  await report.getByRole('button', { name: 'Close print preview' }).click();
  await page.getByRole('button', { name: 'Close Lens Stack and return to Canvas' }).click();
  await expect(page.locator('[data-physical-kind="wire"]').first()).toBeVisible();
  await expect(page.getByRole('application', { name: 'Topology canvas' })).toBeVisible();
  await expect(page.getByRole('button', { name: /, wire$/ }).first()).toBeVisible();

  await page.setViewportSize({ width: 699, height: 900 });
  await expect(page.locator('[data-capability-reason="mobile-review"]')).toBeVisible();
  expect(await wcagViolations(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});
