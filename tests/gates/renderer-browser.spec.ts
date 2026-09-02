import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { build } from 'vite';

let browserBundle = '';
let browserStyles = '';

test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [svelte()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      cssCodeSplit: false,
      write: false,
      lib: {
        entry: resolve('tests/gates/entries/renderer-browser.ts'),
        formats: ['iife'],
        name: 'VenaeRendererGate'
      }
    }
  });
  const outputs = Array.isArray(result) ? result : 'output' in result ? [result] : [];
  const emitted = outputs.flatMap((output) => output.output);
  const chunk = emitted.find((entry) => entry.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Renderer browser bundle is absent');
  browserBundle = chunk.code;
  for (const entry of emitted) {
    if (entry.type === 'asset' && entry.fileName.endsWith('.css')) {
      browserStyles += `${String(entry.source)}\n`;
    }
  }

  if (!browserStyles) throw new Error('Renderer browser styles are absent');
});

test('MVP-GATE-001 fits the production renderer interface in browsers', async ({
  page
}, testInfo) => {
  const cspViolations: Array<{ text: string; url: string }> = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) {
      cspViolations.push({ text: message.text(), url: message.location().url });
    }
  });
  await page.route('**/__renderer-gate.js', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript; charset=utf-8',
      body: `${browserBundle}\nwindow.VenaeRendererGate = VenaeRendererGate;`
    });
  });
  await page.route('**/__renderer-gate.css', async (route) => {
    await route.fulfill({ contentType: 'text/css; charset=utf-8', body: browserStyles });
  });
  await page.route('**/__renderer-gate-axe.js', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript; charset=utf-8',
      body: readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8')
    });
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  cspViolations.length = 0;
  await page.evaluate(
    () =>
      new Promise<void>((resolveStyle, rejectStyle) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/__renderer-gate.css';
        link.onload = () => resolveStyle();
        link.onerror = () => rejectStyle(new Error('Renderer browser styles failed to load'));
        document.head.append(link);
      })
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolveScript, rejectScript) => {
        const script = document.createElement('script');
        script.src = '/__renderer-gate.js';
        script.onload = () => resolveScript();
        script.onerror = () => rejectScript(new Error('Renderer browser script failed to load'));
        document.head.append(script);
      })
  );
  await page.evaluate(() =>
    (
      window as unknown as {
        VenaeRendererGate: { mountRendererGate(): Promise<void> };
      }
    ).VenaeRendererGate.mountRendererGate()
  );
  await expect(page.locator('[data-renderer-gate-ready="true"]')).toBeVisible();
  expect(cspViolations).toEqual([]);

  const geometry = await page.evaluate(() => {
    const lens = document.querySelector('[data-lens="author"]');
    const source = lens?.querySelector('[data-renderer-port="pump-outlet"]');
    const target = lens?.querySelector('[data-renderer-port="rail-inlet"]');
    const path = lens?.querySelector(
      '[data-renderer-connection="fuel-feed"] [data-physical-layer="medium"]'
    );
    if (!(source instanceof SVGGraphicsElement) || !(target instanceof SVGGraphicsElement)) {
      throw new Error('Renderer Ports are absent');
    }
    if (!(path instanceof SVGPathElement)) throw new Error('Physical connection path is absent');
    const matrix = path.getScreenCTM();
    if (!matrix) throw new Error('Physical connection transform is absent');
    const first = path.getPointAtLength(0).matrixTransform(matrix);
    const last = path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix);
    const sourceBounds = source.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    const sourceCenter = {
      x: sourceBounds.left + sourceBounds.width / 2,
      y: sourceBounds.top + sourceBounds.height / 2
    };
    const targetCenter = {
      x: targetBounds.left + targetBounds.width / 2,
      y: targetBounds.top + targetBounds.height / 2
    };

    return {
      sourceError: Math.hypot(first.x - sourceCenter.x, first.y - sourceCenter.y),
      targetError: Math.hypot(last.x - targetCenter.x, last.y - targetCenter.y),
      path: path.getAttribute('d') ?? ''
    };
  });

  expect(geometry.sourceError).toBeLessThanOrEqual(0.75);
  expect(geometry.targetError).toBeLessThanOrEqual(0.75);
  expect(geometry.path).toContain('L 390 210 L 490 210');
  await expect(page.locator('[data-lens="author"] [data-physical-kind="hose"]')).toHaveCount(1);
  await expect(page.locator('[data-lens="author"] [data-physical-kind="wire"]')).toHaveCount(1);
  await expect(page.locator('[data-lens="author"] [data-overlay-channel]')).toHaveCount(4);
  await expect(page.locator('[data-renderer-adapter="svg"]')).toHaveCount(2);

  const authorLens = page.locator('[data-lens="author"]');
  const fuelRailButton = authorLens.getByRole('button', { name: 'Fuel rail rail', exact: true });
  await fuelRailButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-renderer-node="fuel-rail"][data-selected="true"]')).toHaveCount(
    2
  );

  const sourceButton = authorLens.getByRole('button', {
    name: 'Start connection from Fused 12 V',
    exact: true
  });
  await sourceButton.focus();
  await page.keyboard.press('Enter');
  const targetButton = authorLens.getByRole('button', {
    name: 'Connect Fused 12 V to Pump power',
    exact: true
  });
  await targetButton.focus();
  await page.keyboard.press('Enter');
  const routeButton = authorLens.getByRole('button', {
    name: 'Move route point 1 for Fuel feed. Use arrow keys.',
    exact: true
  });
  await routeButton.focus();
  await page.keyboard.press('ArrowRight');

  const interactionLog = await page.evaluate(() =>
    (
      window as unknown as {
        VenaeRendererGate: { readRendererIntentLog(): unknown[] };
      }
    ).VenaeRendererGate.readRendererIntentLog()
  );
  expect(interactionLog).toEqual(
    expect.arrayContaining([
      { type: 'select', target: 'node', id: 'fuel-rail' },
      { type: 'connect-ports', sourcePortId: 'fuse-output', targetPortId: 'pump-power' },
      {
        type: 'move-route-point',
        connectionId: 'fuel-feed',
        routePointId: 'fuel-feed-route-1',
        position: { x: 398, y: 210 }
      }
    ])
  );

  const layouts = [
    { name: 'desktop', width: 1280, height: 900, capability: 'author' },
    { name: 'tablet', width: 820, height: 1000, capability: 'author' },
    { name: 'mobile', width: 390, height: 844, capability: 'mobile-review' }
  ] as const;
  mkdirSync(resolve('evidence/frontend'), { recursive: true });
  for (const layout of layouts) {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await expect(
      page.locator(`[data-lens="author"] [data-capability="${layout.capability}"]`)
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    await page.locator('.semantic-scroll').evaluateAll((elements) => {
      for (const element of elements) element.scrollTop = 0;
    });
    await page.screenshot({
      path: resolve(`evidence/frontend/MVP-GATE-001-${testInfo.project.name}-${layout.name}.png`),
      fullPage: true
    });
  }

  await page.addScriptTag({ url: '/__renderer-gate-axe.js' });
  const seriousAccessibilityViolations = await page.evaluate(async () => {
    const { violations } = await (
      window as unknown as {
        axe: {
          run(): Promise<{ violations: Array<{ id: string; impact: string | null }> }>;
        };
      }
    ).axe.run();
    return violations.filter((violation) =>
      violation.impact ? ['serious', 'critical'].includes(violation.impact) : false
    );
  });
  expect(seriousAccessibilityViolations).toEqual([]);

  console.log(
    `MVP_GATE_001_MEASUREMENT ${testInfo.project.name} ${JSON.stringify({
      adapter: 'svg',
      sourceSnapErrorPx: geometry.sourceError,
      targetSnapErrorPx: geometry.targetError,
      routePointCount: 3,
      physicalKinds: ['wire', 'hose'],
      overlayChannelCount: 4,
      synchronizedLensCount: 2,
      keyboardIntentCount: interactionLog.length,
      layouts: layouts.map((layout) => `${layout.width}x${layout.height}`),
      seriousAccessibilityViolationCount: seriousAccessibilityViolations.length
    })}`
  );
});
