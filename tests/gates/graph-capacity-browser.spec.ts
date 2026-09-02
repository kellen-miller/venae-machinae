import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { build } from 'vite';

import { generateRendererCapacityProject } from '../fixtures/renderer-capacity';

import type { Page } from '@playwright/test';
import type { ProjectDocument } from '../../src/lib/persistence/project-document';

type CapacityScale = 1 | 2 | 5;

type CapacityState = Readonly<{
  identityFingerprint: string;
  nodeCount: number;
  portCount: number;
  connectionCount: number;
  overlayCount: number;
  selectedNodeIds: readonly string[];
  firstNodePosition: Readonly<{ x: number; y: number }>;
  firstRoutePointPosition: Readonly<{ x: number; y: number }>;
  intentCount: number;
}>;

type CapacityGateAPI = Readonly<{
  mountCapacityGate(scale: CapacityScale): Promise<{
    scale: CapacityScale;
    initialPaintMs: number;
    snapshotToInteractiveMs: number;
    state: CapacityState;
  }>;
  readCapacityGateState(): CapacityState;
}>;

const cases = [
  { scale: 1 as const, components: 300, ports: 1_500, connections: 1_200, overlays: 120 },
  { scale: 2 as const, components: 600, ports: 3_000, connections: 2_400, overlays: 240 },
  { scale: 5 as const, components: 1_500, ports: 7_500, connections: 6_000, overlays: 600 }
];
const lockedThresholds = {
  pointerFeedbackMsExclusive: 100,
  oneAndTwoTimesFpsMinimum: 55,
  fiveTimesFpsExclusiveMinimum: 30,
  oneAndTwoTimesSnapshotToInteractiveMsExclusive: 2_000
} as const;

let browserBundle = '';
let browserStyles = '';

async function seedProductionCapacityProject(page: Page, document: ProjectDocument): Promise<void> {
  await page.goto('/health');
  await page.evaluate(async (snapshot) => {
    await new Promise<void>((resolveDelete, rejectDelete) => {
      const request = indexedDB.deleteDatabase('venae-machinae');
      request.onsuccess = () => resolveDelete();
      request.onerror = () => rejectDelete(request.error);
      request.onblocked = () => rejectDelete(new Error('Capacity database deletion was blocked'));
    });

    const database = await new Promise<IDBDatabase>((resolveDatabase, rejectDatabase) => {
      const request = indexedDB.open('venae-machinae', 2);
      request.onupgradeneeded = () => {
        const projects = request.result.createObjectStore('projects', { keyPath: 'projectId' });
        request.result.createObjectStore('assets', { keyPath: 'sha256' });
        const checkpoints = request.result.createObjectStore('checkpoints', { keyPath: 'id' });
        checkpoints.createIndex('by-project', 'projectId');
        const namedSnapshots = request.result.createObjectStore('namedSnapshots', {
          keyPath: 'id'
        });
        namedSnapshots.createIndex('by-project', 'projectId');
        const templates = request.result.createObjectStore('templates', { keyPath: 'key' });
        templates.createIndex('by-template', 'templateId');
        const trash = request.result.createObjectStore('trash', { keyPath: 'id' });
        trash.createIndex('by-kind', 'kind');
        const quarantine = request.result.createObjectStore('quarantine', { keyPath: 'id' });
        quarantine.createIndex('by-source-kind', 'sourceKind');
        request.result.createObjectStore('settings', { keyPath: 'key' });
        const diagnostics = request.result.createObjectStore('diagnostics', { keyPath: 'id' });
        diagnostics.createIndex('by-kind', 'kind');
        request.result.createObjectStore('generations', { keyPath: 'id' });
        void projects;
      };
      request.onsuccess = () => resolveDatabase(request.result);
      request.onerror = () => rejectDatabase(request.error);
    });
    const transaction = database.transaction(['projects', 'settings'], 'readwrite');
    transaction.objectStore('projects').put({
      projectId: snapshot.project.id,
      revision: snapshot.project.revision,
      snapshot
    });
    transaction.objectStore('settings').put({
      key: 'library',
      activeGenerationId: crypto.randomUUID(),
      rollbackGenerationId: null,
      lastLibraryBackupAt: null,
      lastProjectExports: [],
      acceptedActionsSinceExport: 0,
      migrationPending: false
    });
    await new Promise<void>((resolveTransaction, rejectTransaction) => {
      transaction.oncomplete = () => resolveTransaction();
      transaction.onerror = () => rejectTransaction(transaction.error);
      transaction.onabort = () => rejectTransaction(transaction.error);
    });
    database.close();
  }, document);
}

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
        entry: resolve('tests/gates/entries/graph-capacity-browser.ts'),
        formats: ['iife'],
        name: 'VenaeCapacityGate'
      }
    }
  });
  const outputs = Array.isArray(result) ? result : 'output' in result ? [result] : [];
  const emitted = outputs.flatMap((output) => output.output);
  const chunk = emitted.find((entry) => entry.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Capacity browser bundle is absent');
  browserBundle = chunk.code;
  for (const entry of emitted) {
    if (entry.type === 'asset' && entry.fileName.endsWith('.css')) {
      browserStyles += `${String(entry.source)}\n`;
    }
  }

  if (!browserStyles) throw new Error('Capacity browser styles are absent');
});

test('MVP-GATE-002 exercises selected-renderer capacity locally', async ({
  browser,
  page
}, testInfo) => {
  test.setTimeout(300_000);
  const cspViolations: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) cspViolations.push(message.text());
  });
  await page.route('**/__capacity-gate.js', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript; charset=utf-8',
      body: `${browserBundle}\nwindow.VenaeCapacityGate = VenaeCapacityGate;`
    });
  });
  await page.route('**/__capacity-gate.css', async (route) => {
    await route.fulfill({ contentType: 'text/css; charset=utf-8', body: browserStyles });
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  cspViolations.length = 0;
  await page.evaluate(
    () =>
      new Promise<void>((resolveStyle, rejectStyle) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/__capacity-gate.css';
        link.onload = () => resolveStyle();
        link.onerror = () => rejectStyle(new Error('Capacity browser styles failed to load'));
        document.head.append(link);
      })
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolveScript, rejectScript) => {
        const script = document.createElement('script');
        script.src = '/__capacity-gate.js';
        script.onload = () => resolveScript();
        script.onerror = () => rejectScript(new Error('Capacity browser script failed to load'));
        document.head.append(script);
      })
  );
  await page.setViewportSize({ width: 1_280, height: 900 });
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send('Performance.enable');

  const measurements = [];
  for (const fixture of cases) {
    const mounted = await page.evaluate(
      (scale) =>
        (
          window as unknown as {
            VenaeCapacityGate: CapacityGateAPI;
          }
        ).VenaeCapacityGate.mountCapacityGate(scale),
      fixture.scale
    );
    await expect(page.locator('[data-capacity-gate-ready="true"]')).toBeVisible();
    expect(mounted.state).toMatchObject({
      nodeCount: fixture.components,
      portCount: fixture.ports,
      connectionCount: fixture.connections,
      overlayCount: fixture.overlays
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const renderer = document.querySelector('[data-rendered-connection-count]');
          const declared = Number(renderer?.getAttribute('data-rendered-connection-count'));
          return declared === document.querySelectorAll('[data-renderer-connection]').length;
        })
      )
      .toBe(true);

    const renderedCounts = await page.evaluate(() => ({
      visibleNodeLabels: document.querySelectorAll('.node-label').length,
      visiblePortLabels: document.querySelectorAll('.port-label').length,
      visibleConnections: document.querySelectorAll('[data-renderer-connection]').length,
      visibleRoutePoints: document.querySelectorAll('[data-renderer-route-point]').length,
      visibleOverlays: document.querySelectorAll('[data-overlay-mark]').length,
      semanticComponents: document.querySelectorAll('.component-list > li').length,
      semanticConnections: document.querySelectorAll('.connection-list > li').length,
      domElements: document.querySelectorAll('*').length
    }));
    expect(renderedCounts).toMatchObject({
      visibleNodeLabels: 20,
      visiblePortLabels: 100,
      visibleRoutePoints: 80,
      semanticComponents: 40,
      semanticConnections: 60
    });
    expect(renderedCounts.visibleConnections).toBeGreaterThanOrEqual(155);
    expect(renderedCounts.visibleConnections).toBeLessThanOrEqual(160);
    expect(renderedCounts.visibleOverlays).toBeGreaterThan(0);
    expect(renderedCounts.domElements).toBeLessThan(10_000);

    const componentPages = page.getByRole('navigation', { name: 'Component pages' });
    await componentPages.getByRole('button', { name: 'Last', exact: true }).click();
    await expect(page.locator('.component-list > li').last()).toContainText(
      `Capacity component ${fixture.components}`
    );
    await componentPages.getByRole('button', { name: 'First', exact: true }).click();
    const connectionPages = page.getByRole('navigation', { name: 'Connection pages' });
    await connectionPages.getByRole('button', { name: 'Last', exact: true }).click();
    await expect(page.locator('.connection-list > li').last()).toContainText(
      `Capacity path ${fixture.connections}`
    );
    await connectionPages.getByRole('button', { name: 'First', exact: true }).click();

    const nodeId = `renderer-component-${fixture.scale}x-0`;
    const pointerFeedbackMs = await page.evaluate(async (selectedNodeId) => {
      const node = document.querySelector(`[data-renderer-node="${selectedNodeId}"]`);
      const shell = node?.querySelector('.node-shell');
      if (!(shell instanceof SVGRectElement)) throw new Error('Capacity Node shell is absent');
      const startedAt = performance.now();
      shell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      while (node?.getAttribute('data-selected') !== 'true') {
        if (performance.now() - startedAt > 10_000) {
          throw new Error('Capacity selection feedback timed out');
        }
        await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
      }

      return performance.now() - startedAt;
    }, nodeId);

    const firstNodeShell = page.locator(`[data-renderer-node="${nodeId}"] .node-shell`);
    const nodeBounds = await firstNodeShell.boundingBox();
    if (!nodeBounds) throw new Error('Capacity Node bounds are absent');
    const initialNodePosition = mounted.state.firstNodePosition;
    const dragStartedAt = Date.now();
    await page.mouse.move(
      nodeBounds.x + nodeBounds.width * 0.7,
      nodeBounds.y + nodeBounds.height * 0.8
    );
    await page.mouse.down();
    await page.mouse.move(
      nodeBounds.x + nodeBounds.width * 0.7 + 40,
      nodeBounds.y + nodeBounds.height * 0.8 + 24
    );
    await page.mouse.up();
    await expect
      .poll(async () => {
        const state = await page.evaluate(() =>
          (
            window as unknown as {
              VenaeCapacityGate: CapacityGateAPI;
            }
          ).VenaeCapacityGate.readCapacityGateState()
        );
        return state.firstNodePosition;
      })
      .not.toEqual(initialNodePosition);
    const dragFeedbackMs = Date.now() - dragStartedAt;

    const routePoint = page.locator('[data-renderer-route-point]').first();
    const initialRoutePointPosition = mounted.state.firstRoutePointPosition;
    const routeEditStartedAt = Date.now();
    await routePoint.focus();
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => {
        const state = await page.evaluate(() =>
          (
            window as unknown as {
              VenaeCapacityGate: CapacityGateAPI;
            }
          ).VenaeCapacityGate.readCapacityGateState()
        );
        return state.firstRoutePointPosition;
      })
      .toEqual({ x: initialRoutePointPosition.x + 8, y: initialRoutePointPosition.y });
    const routeEditFeedbackMs = Date.now() - routeEditStartedAt;

    const panSurface = page.locator('[data-pan-surface]');
    const panBounds = await panSurface.boundingBox();
    if (!panBounds) throw new Error('Capacity pan surface bounds are absent');
    const panStart = { x: panBounds.x + 12, y: panBounds.y + panBounds.height - 12 };
    await page.mouse.move(panStart.x, panStart.y);
    await page.mouse.down();
    const panFrames = await page.evaluate(async (start) => {
      const svg = document.querySelector('[data-renderer-adapter="svg"] svg');
      const content = svg?.querySelector(':scope > g');
      if (!(svg instanceof SVGSVGElement) || !(content instanceof SVGGElement)) {
        throw new Error('Capacity SVG content is absent');
      }
      const initialTransform = content.getAttribute('transform');
      const frameTimes: number[] = [];
      for (let frame = 0; frame < 60; frame += 1) {
        await new Promise<void>((resolveFrame) =>
          requestAnimationFrame((time) => {
            frameTimes.push(time);
            svg.dispatchEvent(
              new PointerEvent('pointermove', {
                bubbles: true,
                buttons: 1,
                clientX: start.x + frame,
                clientY: start.y - frame / 2,
                pointerId: 1
              })
            );
            resolveFrame();
          })
        );
      }
      await Promise.resolve();
      const deltas = frameTimes.slice(1).map((time, index) => time - (frameTimes[index] ?? time));

      return {
        changed: content.getAttribute('transform') !== initialTransform,
        averageFps: Math.min(
          60,
          1_000 / (deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length)
        ),
        maxFrameMs: Math.max(...deltas)
      };
    }, panStart);
    await page.mouse.up();
    expect(panFrames.changed).toBe(true);

    const zoomFrames = await page.evaluate(async () => {
      const svg = document.querySelector('[data-renderer-adapter="svg"] svg');
      const content = svg?.querySelector(':scope > g');
      if (!(svg instanceof SVGSVGElement) || !(content instanceof SVGGElement)) {
        throw new Error('Capacity SVG content is absent');
      }
      const initialTransform = content.getAttribute('transform');
      const frameTimes: number[] = [];
      for (let frame = 0; frame < 60; frame += 1) {
        await new Promise<void>((resolveFrame) =>
          requestAnimationFrame((time) => {
            frameTimes.push(time);
            svg.dispatchEvent(
              new WheelEvent('wheel', {
                bubbles: true,
                deltaY: frame % 2 === 0 ? -1 : 1
              })
            );
            resolveFrame();
          })
        );
      }
      await Promise.resolve();
      const deltas = frameTimes.slice(1).map((time, index) => time - (frameTimes[index] ?? time));

      return {
        changed: content.getAttribute('transform') !== initialTransform,
        averageFps: Math.min(
          60,
          1_000 / (deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length)
        ),
        maxFrameMs: Math.max(...deltas)
      };
    });
    expect(zoomFrames.changed).toBe(true);

    const finalState = await page.evaluate(() =>
      (
        window as unknown as {
          VenaeCapacityGate: CapacityGateAPI;
        }
      ).VenaeCapacityGate.readCapacityGateState()
    );
    expect(finalState.identityFingerprint).toBe(mounted.state.identityFingerprint);
    expect(finalState).toMatchObject({
      nodeCount: fixture.components,
      portCount: fixture.ports,
      connectionCount: fixture.connections,
      overlayCount: fixture.overlays,
      selectedNodeIds: [nodeId]
    });

    await cdpSession.send('HeapProfiler.collectGarbage');
    const [performanceMetrics, domCounters] = await Promise.all([
      cdpSession.send('Performance.getMetrics'),
      cdpSession.send('Memory.getDOMCounters')
    ]);
    const retainedJSHeapBytes =
      performanceMetrics.metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? null;
    measurements.push({
      scale: fixture.scale,
      ...renderedCounts,
      identityFingerprint: mounted.state.identityFingerprint,
      initialPaintMs: mounted.initialPaintMs,
      snapshotToInteractiveMs: mounted.snapshotToInteractiveMs,
      pointerFeedbackMs,
      dragFeedbackMs,
      routeEditFeedbackMs,
      panAverageFps: panFrames.averageFps,
      panMaxFrameMs: panFrames.maxFrameMs,
      zoomAverageFps: zoomFrames.averageFps,
      zoomMaxFrameMs: zoomFrames.maxFrameMs,
      retainedJSHeapBytes,
      retainedDomNodes: domCounters.nodes,
      retainedDocuments: domCounters.documents,
      retainedEventListeners: domCounters.jsEventListeners,
      structuralIntegrityPreserved: true
    });
  }

  expect(cspViolations).toEqual([]);
  const evidenceScope = process.env.CAPACITY_EVIDENCE_SCOPE ?? 'authoritative-current-local';
  expect(['authoritative-current-local', 'ci-smoke']).toContain(evidenceScope);
  if (evidenceScope === 'authoritative-current-local') {
    for (const measurement of measurements) {
      expect(measurement.pointerFeedbackMs).toBeLessThan(
        lockedThresholds.pointerFeedbackMsExclusive
      );
      if (measurement.scale === 5) {
        expect(measurement.panAverageFps).toBeGreaterThan(
          lockedThresholds.fiveTimesFpsExclusiveMinimum
        );
        expect(measurement.zoomAverageFps).toBeGreaterThan(
          lockedThresholds.fiveTimesFpsExclusiveMinimum
        );
      } else {
        expect(measurement.panAverageFps).toBeGreaterThanOrEqual(
          lockedThresholds.oneAndTwoTimesFpsMinimum
        );
        expect(measurement.zoomAverageFps).toBeGreaterThanOrEqual(
          lockedThresholds.oneAndTwoTimesFpsMinimum
        );
        expect(measurement.snapshotToInteractiveMs).toBeLessThan(
          lockedThresholds.oneAndTwoTimesSnapshotToInteractiveMsExclusive
        );
      }
      expect(measurement.retainedJSHeapBytes).not.toBeNull();
    }
  }
  console.log(
    `MVP_GATE_002_LOCAL_MEASUREMENT ${JSON.stringify({
      evidenceScope:
        evidenceScope === 'authoritative-current-local'
          ? 'authoritative recorded current local environment'
          : 'non-authoritative CI harness smoke',
      project: testInfo.project.name,
      browserVersion: browser.version(),
      thresholds: lockedThresholds,
      measurements
    })}`
  );
});

test('MVP-NFR-007 measures the final persistence, session, renderer, and worker stack', async ({
  browser
}) => {
  test.setTimeout(300_000);
  const productionMeasurements = [];

  for (const fixture of cases) {
    const context = await browser.newContext({ viewport: { width: 1_280, height: 900 } });
    const page = await context.newPage();
    const projectDocument = generateRendererCapacityProject(fixture.scale);
    await seedProductionCapacityProject(page, projectDocument);
    await page.goto(`/projects/${projectDocument.project.id}`);
    const workspace = page.locator('[data-project-revision]');
    await expect(workspace).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('[data-renderer-adapter="svg"]')).toBeVisible();

    const snapshotToInteractiveMs = await page.evaluate(() => {
      const measure = performance.getEntriesByName('venae:snapshot-to-interactive').at(-1);
      return measure?.duration ?? null;
    });
    expect(snapshotToInteractiveMs).not.toBeNull();
    if (fixture.scale !== 5) {
      expect(snapshotToInteractiveMs).toBeLessThan(
        lockedThresholds.oneAndTwoTimesSnapshotToInteractiveMsExclusive
      );
    }

    let evaluationDispatchAndEdit: Readonly<{
      dispatchMs: number;
      editMs: number;
      totalMs: number;
    }> | null = null;
    if (fixture.scale === 5) {
      await page.getByRole('button', { name: 'Findings view' }).click();
      await expect(page.getByRole('button', { name: 'Validate Project' })).toBeVisible();
      evaluationDispatchAndEdit = await page.evaluate(async () => {
        const workspace = document.querySelector('[data-project-revision]');
        const buttons = [...document.querySelectorAll('button')];
        const validate = buttons.find(
          (button) => button.textContent?.trim() === 'Validate Project'
        );
        const edit = buttons.find((button) => button.textContent?.trim() === 'Apply project edit');
        if (!(workspace instanceof HTMLElement) || !validate || !edit) {
          throw new Error('Final-stack evaluation controls are absent');
        }

        const revision = Number(workspace.dataset.projectRevision);
        const startedAt = performance.now();
        validate.click();
        const dispatchedAt = performance.now();
        edit.click();
        const editedAt = performance.now();
        await Promise.resolve();
        if (Number(workspace.dataset.projectRevision) !== revision + 1) {
          throw new Error('Editing waited for final-stack evaluation');
        }
        if (workspace.dataset.evaluationStatus !== 'queued') {
          throw new Error('Final-stack evaluation completed before the edit boundary was observed');
        }
        return {
          dispatchMs: dispatchedAt - startedAt,
          editMs: editedAt - dispatchedAt,
          totalMs: performance.now() - startedAt
        };
      });
    }

    productionMeasurements.push({
      scale: fixture.scale,
      snapshotToInteractiveMs,
      evaluationDispatchAndEdit,
      projectRevision: Number(await workspace.getAttribute('data-project-revision')),
      productionStack: [
        'IndexedDB v2',
        'Project Session',
        'production evaluation worker',
        'raw SVG'
      ]
    });
    await context.close();
  }

  console.log(
    `MVP_GATE_002_FINAL_STACK_MEASUREMENT ${JSON.stringify({ measurements: productionMeasurements })}`
  );
});
