import { expect, test, type Locator, type Page } from '@playwright/test';

type FluidSystemInput = Readonly<{
  label: string;
  medium: string;
  composition: string;
  purpose: string;
}>;

async function addFluidSystem(page: Page, input: FluidSystemInput): Promise<void> {
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await lens.getByLabel('Fluid System label').fill(input.label);
  await lens.getByLabel('Fluid Medium').fill(input.medium);
  await lens.getByLabel('Medium composition').fill(input.composition);
  await lens.getByLabel('System purpose').fill(input.purpose);
  await lens.getByRole('button', { name: 'Add Fluid System' }).click();
  await expect(lens.getByRole('heading', { name: input.label })).toBeVisible();
}

async function addPrimitive(
  page: Page,
  systemLabel: string,
  name: RegExp,
  count = 1
): Promise<void> {
  await page
    .getByLabel('Fluid System for new fluid primitive')
    .selectOption({ label: systemLabel });
  for (let index = 0; index < count; index += 1) {
    await page.getByRole('button', { name }).click();
  }
}

async function addLine(
  lens: Locator,
  input: {
    systemLabel: string;
    label: string;
    kind: 'fluid-hose' | 'fluid-tube' | 'fluid-pipe';
    sourcePortIndex: number;
    targetPortIndex: number;
  }
): Promise<void> {
  await lens.getByLabel('Fluid System').selectOption({ label: input.systemLabel });
  await lens.getByLabel('Line label').fill(input.label);
  await lens.getByLabel('Construction kind').selectOption(input.kind);
  await lens.getByLabel('Fluid source Port').selectOption({ index: input.sourcePortIndex });
  await lens.getByLabel('Fluid target Port').selectOption({ index: input.targetPortIndex });
  await lens.getByRole('button', { name: 'Add Fluid Line' }).click();
  await expect(
    lens.locator('.register-grid li strong').filter({ hasText: input.label })
  ).toBeVisible();
}

async function setRoute(
  lens: Locator,
  input: { lineLabel: string; segmentLabel: string; sharedSegmentLabel?: string }
): Promise<void> {
  const routeSelect = lens.getByLabel('Routed Connection');
  const optionValue = await routeSelect
    .locator('option')
    .filter({ hasText: `${input.lineLabel} ·` })
    .getAttribute('value');
  expect(optionValue).not.toBeNull();
  await routeSelect.selectOption(optionValue!);
  await lens.getByLabel('New Segment label').fill(input.segmentLabel);
  await lens
    .getByLabel('Prepend shared Segment')
    .selectOption(input.sharedSegmentLabel ? { label: input.sharedSegmentLabel } : '');
  await lens.getByRole('button', { name: 'Set independent Route' }).click();
  await expect(lens.locator('ol li').filter({ hasText: input.lineLabel })).toBeVisible();
}

async function configureLine(
  lens: Locator,
  input: {
    label: string;
    routeLength: string;
    hydraulicLength: string;
    cutLength: string;
    elevationStart: string;
    elevationEnd: string;
  }
): Promise<void> {
  const section = lens.locator('details').filter({
    hasText: 'Record Line construction and length evidence'
  });
  const lineSelect = section.getByLabel('Fluid Line');
  const optionValue = await lineSelect
    .locator('option')
    .filter({ hasText: `${input.label} ·` })
    .getAttribute('value');
  expect(optionValue).not.toBeNull();
  await lineSelect.selectOption(optionValue!);
  await section.getByLabel('Route Length (m)').fill(input.routeLength);
  await section.getByLabel('Hydraulic Length (m)').fill(input.hydraulicLength);
  await section.getByLabel('Cut Length (m)').fill(input.cutLength);
  await section.getByLabel('Elevation start (m)').fill(input.elevationStart);
  await section.getByLabel('Elevation end (m)').fill(input.elevationEnd);
  await section.getByRole('button', { name: 'Save Fluid Line record' }).click();
}

test('MVP-FLUID-001..005 builds coolant, oil, and fuel construction', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Blank project' }).click();
  await expect(page.locator('[data-workspace-mode="select"]')).toBeVisible();
  const projectId = new URL(page.url()).pathname.split('/').at(-1)!;
  const launcher = page.getByRole('navigation', { name: 'View Launcher' });

  await launcher.getByRole('button', { name: 'Systems view' }).click();
  await addFluidSystem(page, {
    label: 'Engine coolant',
    medium: '50/50 coolant',
    composition: 'ethylene glycol and water, 50/50 by volume',
    purpose: 'engine heat transport'
  });
  await addFluidSystem(page, {
    label: 'Engine oil',
    medium: 'SAE 10W-30 oil',
    composition: 'lubricating oil',
    purpose: 'engine lubrication'
  });
  await addFluidSystem(page, {
    label: 'Fuel supply and return',
    medium: 'Gasoline',
    composition: 'commercial gasoline',
    purpose: 'fuel delivery and return topology'
  });

  await page.getByRole('button', { name: 'Add mode' }).click();
  await addPrimitive(page, 'Engine coolant', /^Add fluid endpoint/, 2);
  await addPrimitive(page, 'Engine coolant', /^Add fluid fitting/);
  await addPrimitive(page, 'Engine coolant', /^Add fluid pump/);
  await addPrimitive(page, 'Engine oil', /^Add fluid endpoint/, 2);
  await addPrimitive(page, 'Engine oil', /^Add fluid valve/);
  await addPrimitive(page, 'Fuel supply and return', /^Add fluid volume/);
  await addPrimitive(page, 'Fuel supply and return', /^Add fluid pump/);
  await addPrimitive(page, 'Fuel supply and return', /^Add fluid valve/);
  await expect(page.locator('[data-renderer-node]')).toHaveCount(10);

  await launcher.getByRole('button', { name: 'Circuits & Lines view' }).click();
  let lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await addLine(lens, {
    systemLabel: 'Engine coolant',
    label: 'Radiator outlet hose',
    kind: 'fluid-hose',
    sourcePortIndex: 1,
    targetPortIndex: 3
  });
  await addLine(lens, {
    systemLabel: 'Engine coolant',
    label: 'Fitting to pump tube',
    kind: 'fluid-tube',
    sourcePortIndex: 4,
    targetPortIndex: 5
  });
  await addLine(lens, {
    systemLabel: 'Engine coolant',
    label: 'Pump to radiator hose',
    kind: 'fluid-hose',
    sourcePortIndex: 6,
    targetPortIndex: 2
  });
  await addLine(lens, {
    systemLabel: 'Engine oil',
    label: 'Oil feed hose',
    kind: 'fluid-hose',
    sourcePortIndex: 1,
    targetPortIndex: 3
  });
  await addLine(lens, {
    systemLabel: 'Engine oil',
    label: 'Oil return pipe',
    kind: 'fluid-pipe',
    sourcePortIndex: 4,
    targetPortIndex: 2
  });
  await addLine(lens, {
    systemLabel: 'Fuel supply and return',
    label: 'Tank to fuel pump',
    kind: 'fluid-hose',
    sourcePortIndex: 2,
    targetPortIndex: 3
  });
  await addLine(lens, {
    systemLabel: 'Fuel supply and return',
    label: 'Fuel feed tube',
    kind: 'fluid-tube',
    sourcePortIndex: 4,
    targetPortIndex: 5
  });
  await addLine(lens, {
    systemLabel: 'Fuel supply and return',
    label: 'Fuel return hose',
    kind: 'fluid-hose',
    sourcePortIndex: 6,
    targetPortIndex: 1
  });
  await expect(page.locator('[data-physical-kind="hose"]')).toHaveCount(5);
  await expect(page.locator('[data-physical-kind="tube"]')).toHaveCount(2);
  await expect(page.locator('[data-physical-kind="pipe"]')).toHaveCount(1);

  await launcher.getByRole('button', { name: 'Routes view' }).click();
  lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await setRoute(lens, { lineLabel: 'Radiator outlet hose', segmentLabel: 'Coolant trunk' });
  await setRoute(lens, {
    lineLabel: 'Fitting to pump tube',
    segmentLabel: 'Pump branch',
    sharedSegmentLabel: 'Coolant trunk'
  });
  await setRoute(lens, { lineLabel: 'Pump to radiator hose', segmentLabel: 'Coolant return' });

  await launcher.getByRole('button', { name: 'Circuits & Lines view' }).click();
  lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await lens.getByText('Record Line construction and length evidence', { exact: true }).click();
  await configureLine(lens, {
    label: 'Radiator outlet hose',
    routeLength: '0.80',
    hydraulicLength: '0.86',
    cutLength: '0.92',
    elevationStart: '0.44',
    elevationEnd: '0.31'
  });
  await configureLine(lens, {
    label: 'Fitting to pump tube',
    routeLength: '0.62',
    hydraulicLength: '0.66',
    cutLength: '0.71',
    elevationStart: '0.31',
    elevationEnd: '0.20'
  });
  await configureLine(lens, {
    label: 'Pump to radiator hose',
    routeLength: '0.94',
    hydraulicLength: '1.02',
    cutLength: '1.08',
    elevationStart: '0.20',
    elevationEnd: '0.44'
  });

  await lens.getByText('Compose Component Behavior', { exact: true }).click();
  const behaviorSection = lens.locator('details').filter({ hasText: 'Compose Component Behavior' });
  await behaviorSection.getByLabel('Fluid Component').selectOption({ index: 4 });
  await behaviorSection.getByLabel('Behavior role').selectOption('pump');
  await behaviorSection.getByLabel('Behavior description').fill('Circulates engine coolant');
  await behaviorSection.getByRole('button', { name: 'Add Component Behavior' }).click();

  await lens.getByText('Record explicit Boundary Condition', { exact: true }).click();
  const boundarySection = lens.locator('details').filter({
    hasText: 'Record explicit Boundary Condition'
  });
  await boundarySection.getByLabel('Operating State name').fill('Warm idle');
  await boundarySection
    .getByLabel('Operating State description')
    .fill('Engine warm at stable idle');
  await boundarySection.getByRole('button', { name: 'Add Operating State' }).click();
  await boundarySection
    .getByLabel('Component Behavior')
    .selectOption({ label: 'pump · Circulates engine coolant' });
  await boundarySection.getByLabel('Boundary Operating State').selectOption({ label: 'Warm idle' });
  await boundarySection
    .getByLabel('Boundary subject')
    .selectOption({ label: 'Fluid pump · Outlet' });
  await boundarySection.getByLabel('Boundary quantity').selectOption('temperature');
  await boundarySection.getByLabel('Boundary value').fill('88');
  await boundarySection.getByLabel('Boundary unit').fill('degC');
  await boundarySection.getByRole('button', { name: 'Record Boundary Condition' }).click();

  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
  const canvasRevision = await page
    .locator('[data-canvas-revision]')
    .getAttribute('data-canvas-revision');
  await expect(page.locator('[data-dense-revision]')).toHaveAttribute(
    'data-dense-revision',
    canvasRevision!
  );

  const stored = await page.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('venae-machinae', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('projects', 'readonly');
    const record = await new Promise<{
      snapshot: {
        schemaVersion: number;
        topology: {
          systems: { domain: string }[];
          connections: { kind: string; routeId: string | null }[];
          routes: { segmentIds: string[] }[];
        };
        fluid: {
          media: unknown[];
          systems: unknown[];
          components: unknown[];
          lines: {
            construction: { kind: string };
            routeLength: { decimal: string } | null;
            hydraulicLength: { decimal: string } | null;
            cutLength: { decimal: string } | null;
            elevation: unknown;
          }[];
          behaviors: unknown[];
          boundaryConditions: unknown[];
        };
        operatingStates: unknown[];
      };
    }>((resolve, reject) => {
      const request = transaction.objectStore('projects').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {
      schemaVersion: record.snapshot.schemaVersion,
      fluidSystemCount: record.snapshot.topology.systems.filter(
        (system) => system.domain === 'fluid'
      ).length,
      mediumCount: record.snapshot.fluid.media.length,
      fluidRecordCount: record.snapshot.fluid.systems.length,
      componentCount: record.snapshot.fluid.components.length,
      lineKinds: record.snapshot.fluid.lines.map((line) => line.construction.kind),
      lengths: record.snapshot.fluid.lines.map((line) => [
        line.routeLength?.decimal ?? null,
        line.hydraulicLength?.decimal ?? null,
        line.cutLength?.decimal ?? null
      ]),
      elevations: record.snapshot.fluid.lines.filter((line) => line.elevation !== null).length,
      routedConnections: record.snapshot.topology.connections.filter(
        (connection) => connection.routeId !== null
      ).length,
      sharedRouteSegments: record.snapshot.topology.routes.map((route) => route.segmentIds.length),
      behaviorCount: record.snapshot.fluid.behaviors.length,
      boundaryCount: record.snapshot.fluid.boundaryConditions.length,
      operatingStateCount: record.snapshot.operatingStates.length
    };
  }, projectId);
  expect(stored).toEqual({
    schemaVersion: 8,
    fluidSystemCount: 3,
    mediumCount: 3,
    fluidRecordCount: 3,
    componentCount: 10,
    lineKinds: ['hose', 'tube', 'hose'],
    lengths: [
      ['0.80', '0.86', '0.92'],
      ['0.62', '0.66', '0.71'],
      ['0.94', '1.02', '1.08']
    ],
    elevations: 3,
    routedConnections: 3,
    sharedRouteSegments: [1, 2, 1],
    behaviorCount: 1,
    boundaryCount: 1,
    operatingStateCount: 1
  });
});
