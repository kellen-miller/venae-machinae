import { expect, test, type Page } from '@playwright/test';

import {
  OPERATING_STATE_PROJECT_ID,
  seedOperatingStateProject
} from '../fixtures/operating-state-project';

async function openOperatingStateProject(page: Page): Promise<void> {
  await seedOperatingStateProject(page);
  await page.goto(`/projects/${OPERATING_STATE_PROJECT_ID}`);
  await expect(page.locator('[data-workspace-mode="select"]')).toBeVisible();
}

async function activateState(page: Page, label: string): Promise<void> {
  await page.getByLabel('Operating State', { exact: true }).selectOption({ label });
  await expect(page.locator('[data-overlay-status="current"]')).toBeVisible({ timeout: 15_000 });
}

test('MVP-STATE-001 MVP-STATE-002 MVP-STATE-003 MVP-STATE-004 MVP-STATE-006 MVP-STATE-007 MVP-STATE-008 MVP-STATE-009 MVP-STATE-010 MVP-STATE-011 evaluates traced channels', async ({
  page
}) => {
  await openOperatingStateProject(page);
  const workspace = page.locator('[data-overlay-status]');
  const stateSelect = page.getByLabel('Operating State', { exact: true });
  await expect(stateSelect.locator('option')).toHaveCount(6);

  await page.locator('[data-renderer-node="battery"] .node-shell').click();
  await page.locator('svg[aria-label="Topology canvas"]').hover();
  await page.mouse.wheel(0, -120);
  const viewportBeforeStateSwitch = await workspace.getAttribute('data-canvas-viewport');

  await workspace.evaluate((element) => {
    const statusHistory: string[] = [];
    const record = () =>
      statusHistory.push(element.getAttribute('data-overlay-status') ?? 'absent');
    record();
    const observer = new MutationObserver(record);
    observer.observe(element, { attributes: true, attributeFilter: ['data-overlay-status'] });
    (
      window as unknown as {
        operatingStateStatusHistory: string[];
        operatingStateStatusObserver: MutationObserver;
      }
    ).operatingStateStatusHistory = statusHistory;
    (
      window as unknown as {
        operatingStateStatusHistory: string[];
        operatingStateStatusObserver: MutationObserver;
      }
    ).operatingStateStatusObserver = observer;
  });

  await activateState(page, 'Run Hot / Fan On');
  const statusHistory = await page.evaluate(
    () =>
      (
        window as unknown as {
          operatingStateStatusHistory: string[];
          operatingStateStatusObserver: MutationObserver;
        }
      ).operatingStateStatusHistory
  );
  expect(statusHistory).toContain('stale');
  expect(statusHistory.at(-1)).toBe('current');
  await expect(workspace).toHaveAttribute('data-primary-selection', 'battery');
  await expect(workspace).toHaveAttribute('data-canvas-viewport', viewportBeforeStateSwitch!);

  const inspector = page.getByRole('complementary', { name: 'Operating State Overlay' });
  await expect(inspector).toContainText('Run Hot / Fan On');
  await expect(inspector).toContainText(/Revision 7 · fingerprint [a-f0-9]{12}/);
  await expect(inspector.getByRole('list', { name: 'Overlay availability' })).toContainText(
    'conflicting · current'
  );

  for (const cue of [
    '→ forward',
    '← reverse',
    '← load-to-return',
    '↔ bidirectional',
    '0 explicitly zero',
    '? unknown',
    '⇄ conflicting',
    '× excluded'
  ]) {
    await expect(inspector).toContainText(cue);
  }

  const potentialTrace = inspector.locator(
    '[data-overlay-trace="overlay-mark:state-run-hot:binding-hot-potential:wire-fan"]'
  );
  await potentialTrace.locator('summary').click();
  await expect(potentialTrace).toContainText('wire-fan');
  await expect(potentialTrace).toContainText('Selected path');
  await expect(potentialTrace).toContainText('binding-hot-potential');
  await expect(potentialTrace).toContainText('explicitly absent');
  await expect(potentialTrace).toContainText('Measured in vehicle');
  await expect(potentialTrace).toContainText('steady battery source');
  await expect(potentialTrace).toContainText('ground-side voltage drop');
  await expect(potentialTrace).toContainText('independent operating-state fixture');
  await expect(potentialTrace).toContainText('±0.1 V');
  await expect(potentialTrace).toContainText(
    'overlay-mark:state-run-hot:binding-hot-potential:wire-fan'
  );

  await expect(
    page.locator(
      '[data-overlay-mark="overlay-mark:state-run-hot:binding-hot-flow-forward:hose-upper"]'
    )
  ).toHaveAttribute('aria-label', /→ forward/);
  await expect(
    page.locator(
      '[data-overlay-mark="overlay-mark:state-run-hot:binding-hot-temperature:hose-upper"]'
    )
  ).toHaveAttribute('aria-label', /88 degC/);
  await expect(
    page.locator(
      '[data-overlay-mark*="binding-hot-temperature"][data-overlay-channel="temperature"]'
    )
  ).toHaveCount(1);

  await activateState(page, 'Run Cold');
  await expect(workspace).toHaveAttribute('data-primary-selection', 'battery');
  await expect(workspace).toHaveAttribute('data-canvas-viewport', viewportBeforeStateSwitch!);
  await expect(inspector).toContainText('unavailable · current');
  await expect(inspector).toContainText('unsupported · current');
  await expect(inspector).toContainText('partial · current');

  for (const state of ['Key Off / Cold', 'Fuel Prime', 'Heat Soak / Key Off']) {
    await activateState(page, state);
    await expect(workspace).toHaveAttribute('data-primary-selection', 'battery');
    await expect(workspace).toHaveAttribute('data-canvas-viewport', viewportBeforeStateSwitch!);
  }
  await expect(inspector).toContainText('Conflicting temperature: 96 / 103 degC');
  await activateState(page, 'Run Hot / Fan On');
});

test('MVP-STATE-005 MVP-STATE-012 authors states and compares synchronized projections', async ({
  page
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 800, height: 1000 });
  await openOperatingStateProject(page);
  await activateState(page, 'Run Hot / Fan On');

  await page.getByText('Overlay channels', { exact: true }).click();
  const potential = page.getByRole('checkbox', { name: 'Electrical potential Overlay Channel' });
  const current = page.getByRole('checkbox', { name: 'Electrical current Overlay Channel' });
  const signal = page.getByRole('checkbox', { name: 'Signal direction Overlay Channel' });
  const direction = page.getByRole('checkbox', { name: 'Fluid direction Overlay Channel' });
  const temperature = page.getByRole('checkbox', { name: 'Temperature Overlay Channel' });
  const findings = page.getByRole('checkbox', { name: 'Findings Overlay Channel' });
  const selection = page.getByRole('checkbox', { name: 'Selection Overlay Channel' });

  await potential.check();
  await expect(potential).toBeChecked();
  await expect(current).not.toBeChecked();
  await expect(signal).not.toBeChecked();
  await current.check();
  await expect(potential).not.toBeChecked();
  await expect(current).toBeChecked();
  await signal.check();
  await expect(current).not.toBeChecked();
  await expect(signal).toBeChecked();
  await expect(direction).toBeChecked();
  await expect(temperature).toBeChecked();
  await expect(findings).toBeChecked();
  await expect(selection).toBeChecked();

  await page.getByRole('button', { name: 'State Compare view' }).click();
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await expect(lens.locator('[data-operating-state-record]')).toHaveCount(5);
  await lens.getByLabel('State Compare Operating State name').fill('Service Check');
  await lens
    .getByLabel('State Compare Operating State description')
    .fill('Independent service review state.');
  await lens.getByRole('button', { name: 'Create Operating State', exact: true }).click();
  await expect(lens.locator('[data-operating-state-record]')).toHaveCount(6);

  let serviceState = lens.getByLabel('Service Check editable name').locator('..').locator('..');
  await serviceState.getByRole('button', { name: 'Clone' }).click();
  await expect(lens.getByLabel('Service Check copy editable name')).toBeVisible();
  await lens.getByLabel('Service Check editable name').fill('Service Check Edited');
  await serviceState.getByRole('button', { name: 'Save' }).click();
  await expect(lens.getByLabel('Service Check Edited editable name')).toBeVisible();
  serviceState = lens.getByLabel('Service Check Edited editable name').locator('..').locator('..');
  await serviceState.getByRole('button', { name: 'Delete' }).click();
  await lens
    .getByLabel('Service Check copy editable name')
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(lens.locator('[data-operating-state-record]')).toHaveCount(5);

  await lens
    .getByText('Commands, conditions, measurements, assumptions, and State Bindings', {
      exact: true
    })
    .click();
  const revisionBeforeStatement = Number(
    await page.locator('[data-project-revision]').getAttribute('data-project-revision')
  );
  await lens.getByLabel('Statement Operating State').selectOption({ label: 'Run Hot / Fan On' });
  await lens.getByLabel('State statement kind').selectOption('measurements');
  await lens.getByLabel('State statement subject').selectOption({ label: 'Upper hose' });
  await lens.getByLabel('State statement label').fill('Spot temperature');
  await lens.getByLabel('State statement value').fill('88');
  await lens.getByLabel('State statement unit').fill('degC');
  await lens.getByRole('button', { name: 'Add explicit statement' }).click();
  await expect(page.locator('.interaction-status')).toContainText(
    'update-operating-state accepted'
  );
  await expect
    .poll(async () =>
      Number(await page.locator('[data-project-revision]').getAttribute('data-project-revision'))
    )
    .toBeGreaterThan(revisionBeforeStatement);
  await expect(page.locator('[data-overlay-status="current"]')).toBeVisible({ timeout: 15_000 });

  const bindingCount = await lens.locator('[data-state-binding-record]').count();
  await lens.getByLabel('Binding Operating State').selectOption({ label: 'Run Hot / Fan On' });
  await lens.getByLabel('Binding physical connection').selectOption({ label: 'Fan feed' });
  await lens.getByLabel('Binding Overlay Channel').selectOption('current');
  await lens.getByLabel('Binding evidence state').selectOption('known');
  await lens.getByLabel('Binding value').fill('11.8');
  await lens.getByLabel('Binding unit').fill('ampere');
  await lens.getByLabel('Binding direction').selectOption('source-to-load');
  await lens
    .getByLabel('Binding path connections')
    .selectOption([{ label: 'Fan feed' }, { label: 'Fan return' }]);
  await lens
    .getByLabel('Binding Calculation Result')
    .selectOption({ label: 'result-calculation-hot-current' });
  await lens.getByLabel('Binding assumptions').fill('steady fan load');
  await lens.getByLabel('Binding omissions').fill('connector heating');
  await lens.getByLabel('Binding uncertainty').fill('±0.2 A');
  await lens.getByRole('button', { name: 'Add explicit State Binding' }).click();
  await expect(lens.locator('[data-state-binding-record]')).toHaveCount(bindingCount + 1);
  await expect(page.locator('[data-overlay-status="current"]')).toBeVisible({ timeout: 15_000 });
  await expect(
    page
      .getByRole('complementary', { name: 'Operating State Overlay' })
      .locator('[data-overlay-trace]')
      .filter({ hasText: 'result-calculation-hot-current' })
  ).toHaveCount(1);

  await lens.getByLabel('Compare Operating State A').selectOption({ label: 'Run Hot / Fan On' });
  await lens.getByLabel('Compare Operating State B').selectOption({ label: 'Key Off / Cold' });
  const differences = lens.getByRole('region', { name: 'State Compare differences' });
  await expect(differences).toContainText('wire-fan');
  await expect(differences).toContainText('value-changed');
  await expect(differences).not.toContainText(/caused by|because/i);
  await lens.getByRole('button', { name: 'Increase left comparison zoom' }).click();
  await expect(lens.locator('[data-compare-viewport="left"]')).toHaveAttribute('data-zoom', '1.1');
  await expect(lens.locator('[data-compare-viewport="right"]')).toHaveAttribute('data-zoom', '1.1');
  await page.getByRole('button', { name: 'Canvas view' }).click();
  await page.getByRole('button', { name: 'State Compare view' }).click();
  await expect(lens.getByLabel('Compare Operating State A')).toHaveValue('state-run-hot');
  await expect(lens.getByLabel('Compare Operating State B')).toHaveValue('state-key-off-cold');
  await expect(lens.locator('[data-compare-viewport="left"]')).toHaveAttribute('data-zoom', '1.1');
  await expect(lens.locator('[data-compare-viewport="right"]')).toHaveAttribute('data-zoom', '1.1');
});

test('MVP-STATE-013 preserves stale overlays and topology when evaluation fails', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openOperatingStateProject(page);
  await activateState(page, 'Run Hot / Fan On');
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
  await page.getByText('Overlay channels', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Pause direction motion' }).uncheck();
  await expect(page.locator('[data-motion-paused="true"]')).toBeVisible();

  await page.addInitScript(() => {
    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: class BrokenEvaluationWorker {
        constructor() {
          throw new Error('intentional operating-state worker failure');
        }
      }
    });
  });
  await page.reload();
  await expect(page.locator('[data-workspace-mode="select"]')).toBeVisible();
  await page
    .getByLabel('Operating State', { exact: true })
    .selectOption({ label: 'Run Hot / Fan On' });
  await expect(page.locator('[data-overlay-status="failed"]')).toBeVisible({ timeout: 15_000 });

  const retainedMark = page.locator(
    '[data-overlay-mark="overlay-mark:state-run-hot:binding-hot-flow-forward:hose-upper"]'
  );
  await expect(retainedMark).toHaveAttribute('aria-label', /stale/);
  await expect(page.locator('[data-physical-layer="outer"]')).toHaveCount(5);
  const inspector = page.getByRole('complementary', { name: 'Operating State Overlay' });
  await expect(inspector).toContainText('Run Hot / Fan On');
  await expect(inspector).toContainText('failed');
  await expect(inspector.locator('[data-overlay-trace]')).not.toHaveCount(0);
});
