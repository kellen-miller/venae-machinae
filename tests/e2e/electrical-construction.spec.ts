import { expect, test, type Locator, type Page } from '@playwright/test';

async function addPrimitive(page: Page, name: RegExp, count = 1): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await page.getByRole('button', { name }).click();
  }
}

async function addPartDefinition(page: Page, label: string): Promise<void> {
  const lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await lens.getByLabel('Part label').fill(label);
  await lens.getByRole('button', { name: 'Add Part Definition' }).click();
  await expect(lens.locator('.part-register strong').filter({ hasText: label })).toBeVisible();
}

async function addConnection(
  lens: Locator,
  label: string,
  sourcePortIndex: number,
  targetPortIndex: number,
  kind: 'electrical-wire' | 'electrical-mate' = 'electrical-wire'
): Promise<void> {
  await lens.getByLabel('Connection label').fill(label);
  await lens
    .getByLabel('Electrical System')
    .first()
    .selectOption({ label: 'Auxiliary cooling power' });
  await lens.getByLabel('Source Port', { exact: true }).selectOption({ index: sourcePortIndex });
  await lens.getByLabel('Target Port', { exact: true }).selectOption({ index: targetPortIndex });
  await lens
    .getByLabel('Connection kind')
    .selectOption(kind === 'electrical-wire' ? 'electrical-wire' : 'electrical-mate');
  await lens.getByRole('button', { name: 'Add electrical Connection' }).click();
  await expect(lens.locator('.register-grid li strong').filter({ hasText: label })).toBeVisible();
}

async function configureWire(
  lens: Locator,
  input: {
    label: string;
    role: 'power' | 'return';
    routeLength: string;
    cutLength: string;
    serviceAllowance: string;
  }
): Promise<void> {
  const section = lens.locator('details').filter({ hasText: 'Record Wire construction' });
  await section.getByLabel('Wire').selectOption({ label: input.label });
  await section.getByLabel('Cable Part Definition').selectOption({ label: 'TXL cable' });
  await section.getByLabel('Conductor role').selectOption(input.role);
  await section.getByLabel('Route Length (m)').fill(input.routeLength);
  await section.getByLabel('Cut Length (m)').fill(input.cutLength);
  await section.getByLabel('Service allowance (m)').fill(input.serviceAllowance);
  await section.getByRole('button', { name: 'Save Wire record' }).click();
}

async function setRoute(
  lens: Locator,
  input: { wireLabel: string; segmentLabel: string; sharedSegmentLabel?: string }
): Promise<void> {
  const routeSelect = lens.getByLabel('Routed Connection');
  const optionValue = await routeSelect
    .locator('option')
    .filter({ hasText: `${input.wireLabel} ·` })
    .getAttribute('value');
  expect(optionValue).not.toBeNull();
  await routeSelect.selectOption(optionValue!);
  await lens.getByLabel('New Segment label').fill(input.segmentLabel);
  await lens
    .getByLabel('Prepend shared Segment')
    .selectOption(input.sharedSegmentLabel ? { label: input.sharedSegmentLabel } : '');
  await lens.getByRole('button', { name: 'Set independent Route' }).click();
  await expect(lens.locator('ol li').filter({ hasText: input.wireLabel })).toBeVisible();
}

test('builds and revises a complete auxiliary-cooling electrical construction', async ({
  page
}) => {
  await page.goto('/');
  await expect(page.locator('[data-library-state="ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Blank project' }).click();
  await expect(page.locator('[data-workspace-mode="select"]')).toBeVisible();
  const projectId = new URL(page.url()).pathname.split('/').at(-1)!;
  const launcher = page.getByRole('navigation', { name: 'View Launcher' });

  await launcher.getByRole('button', { name: 'Systems view' }).click();
  await page.getByRole('button', { name: 'Add electrical System' }).click();
  await expect(page.getByText(/add-system accepted at revision \d+/)).toBeVisible();

  await page.getByRole('button', { name: 'Add mode' }).click();
  await addPrimitive(page, /^Add electrical source/);
  await addPrimitive(page, /^Add fuse/);
  await addPrimitive(page, /^Add connector/, 2);
  await addPrimitive(page, /^Add electrical load/, 2);
  await addPrimitive(page, /^Add ground point/);
  await expect(page.locator('[data-renderer-node]')).toHaveCount(7);

  await launcher.getByRole('button', { name: 'Interfaces view' }).click();
  for (const label of ['TXL cable', 'Terminal', 'Seal', 'Cavity plug', 'Braided sleeve']) {
    await addPartDefinition(page, label);
  }

  await launcher.getByRole('button', { name: 'Circuits & Lines view' }).click();
  let lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await addConnection(lens, 'Source to fuse', 1, 2);
  await addConnection(lens, 'Fuse to connector A', 3, 4);
  await addConnection(lens, 'Connector A to B Mate', 4, 6, 'electrical-mate');
  await addConnection(lens, 'Connector B to main load', 6, 8);
  await addConnection(lens, 'Main load return', 9, 12);

  await lens.getByText('Record Wire construction', { exact: true }).click();
  await configureWire(lens, {
    label: 'Source to fuse',
    role: 'power',
    routeLength: '0.42',
    cutLength: '0.50',
    serviceAllowance: '0.08'
  });
  await configureWire(lens, {
    label: 'Fuse to connector A',
    role: 'power',
    routeLength: '0.62',
    cutLength: '0.70',
    serviceAllowance: '0.08'
  });
  await configureWire(lens, {
    label: 'Connector B to main load',
    role: 'power',
    routeLength: '1.40',
    cutLength: '1.55',
    serviceAllowance: '0.15'
  });
  await configureWire(lens, {
    label: 'Main load return',
    role: 'return',
    routeLength: '1.10',
    cutLength: '1.22',
    serviceAllowance: '0.12'
  });

  await launcher.getByRole('button', { name: 'Routes view' }).click();
  lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await setRoute(lens, { wireLabel: 'Fuse to connector A', segmentLabel: 'Shared trunk' });
  await setRoute(lens, {
    wireLabel: 'Connector B to main load',
    segmentLabel: 'Positive branch',
    sharedSegmentLabel: 'Shared trunk'
  });
  await setRoute(lens, { wireLabel: 'Main load return', segmentLabel: 'Return branch' });

  await launcher.getByRole('button', { name: 'Interfaces view' }).click();
  lens = page.getByRole('dialog', { name: 'Lens Stack' });
  for (const connectorIndex of [1, 2]) {
    await lens.getByLabel('Connector').selectOption({ index: connectorIndex });
    await lens.getByLabel('Terminal Part Definition').selectOption({ label: 'Terminal' });
    await lens.getByLabel('Seal Part Definition').selectOption({ label: 'Seal' });
    await lens.getByLabel('Unused-cavity requirement').selectOption('cavity-plug-required');
    await lens.getByLabel('Cavity plug Part Definition').selectOption({ label: 'Cavity plug' });
    await lens.getByRole('button', { name: 'Save all Connector cavities' }).click();
  }
  await expect(lens.getByText('Connector A to B Mate', { exact: true })).toHaveCount(2);

  await launcher.getByRole('button', { name: 'Circuits & Lines view' }).click();
  lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await lens.getByText('Create functional Circuit', { exact: true }).click();
  const circuitSection = lens.locator('details').filter({ hasText: 'Create functional Circuit' });
  await circuitSection
    .getByLabel('Electrical System')
    .selectOption({ label: 'Auxiliary cooling power' });
  await circuitSection.getByLabel('Protection Component').selectOption({ label: 'Fuse' });
  await circuitSection.getByRole('button', { name: 'Add electrical Circuit' }).click();
  await expect(lens.getByText('Auxiliary cooling circuit', { exact: true })).toBeVisible();

  await launcher.getByRole('button', { name: 'Harnesses & Bundles view' }).click();
  lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await lens.getByRole('button', { name: 'Create Harness' }).click();
  await expect(
    lens.locator('.construction-register article strong').filter({
      hasText: 'Auxiliary cooling harness'
    })
  ).toBeVisible();
  await lens.getByLabel('Covering Part Definition').selectOption({ label: 'Braided sleeve' });
  await lens.getByLabel('Drain Wire').selectOption({ label: 'Main load return' });
  await lens.getByRole('button', { name: 'Record Bundle construction' }).click();
  await expect(
    lens.locator('.construction-register article strong').filter({
      hasText: 'Auxiliary cooling trunk'
    })
  ).toBeVisible();
  await lens.getByText('Record cable evidence', { exact: true }).click();
  await lens.getByLabel('Cable Part Definition').selectOption({ label: 'TXL cable' });
  await lens.getByRole('button', { name: 'Record cable specification' }).click();

  await launcher.getByRole('button', { name: 'Circuits & Lines view' }).click();
  lens = page.getByRole('dialog', { name: 'Lens Stack' });
  await lens.getByText('Insert splice branch', { exact: true }).click();
  const branchSection = lens.locator('details').filter({ hasText: 'Insert splice branch' });
  await branchSection
    .getByLabel('Wire to replace')
    .selectOption({ label: 'Connector B to main load' });
  await branchSection.getByLabel('Branch target Port').selectOption({ index: 10 });
  const revisionBeforePreview = await page
    .locator('[data-project-revision]')
    .getAttribute('data-project-revision');
  await branchSection.getByRole('button', { name: 'Preview branch replacement' }).click();
  const preview = lens.getByRole('region', { name: 'Electrical branch impact preview' });
  await expect(preview).toContainText('source to splice');
  await expect(preview).toContainText('splice to original load');
  await expect(preview).toContainText('splice to branch');
  await expect(preview).toContainText('Route transfer');
  await expect(page.locator('[data-project-revision]')).toHaveAttribute(
    'data-project-revision',
    revisionBeforePreview!
  );
  await preview.getByRole('button', { name: 'Commit branch replacement' }).click();
  await expect(preview).not.toBeVisible();
  const connectionRegister = lens.locator('.register-grid li strong');
  await expect(
    connectionRegister.filter({ hasText: 'Connector B to main load · splice to branch' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo last Project action' }).click();
  await expect(connectionRegister.filter({ hasText: 'Connector B to main load' })).toBeVisible();
  await expect(
    connectionRegister.filter({ hasText: 'Connector B to main load · splice to branch' })
  ).not.toBeVisible();

  await expect
    .poll(async () => {
      const [canvasRevision, denseRevision] = await Promise.all([
        page.locator('[data-canvas-revision]').getAttribute('data-canvas-revision'),
        page.locator('[data-dense-revision]').getAttribute('data-dense-revision')
      ]);
      return canvasRevision !== null && canvasRevision === denseRevision;
    })
    .toBe(true);
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();

  const stored = await page.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('venae-machinae');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('projects', 'readonly');
    const record = await new Promise<{
      snapshot: {
        topology: { connections: { kind: string; routeId: string | null }[] };
        electrical: {
          wires: { role: string; routeLength: { decimal: string } | null }[];
          circuits: unknown[];
          connectors: { cavities: { plugPartDefinitionId: string | null }[] }[];
          harnesses: unknown[];
          bundles: { twistedPairs: unknown[]; concentric: unknown }[];
          cableSpecifications: {
            strandConstruction: { state: string };
            conductorAreaOrGauge: { value: string | null };
          }[];
        };
        tombstones: { subjectKind: string }[];
      };
    }>((resolve, reject) => {
      const request = transaction.objectStore('projects').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {
      connectionKinds: record.snapshot.topology.connections.map((connection) => connection.kind),
      routedConnections: record.snapshot.topology.connections.filter(
        (connection) => connection.routeId !== null
      ).length,
      wireRoles: record.snapshot.electrical.wires.map((wire) => wire.role),
      routeLengths: record.snapshot.electrical.wires.map(
        (wire) => wire.routeLength?.decimal ?? null
      ),
      circuitCount: record.snapshot.electrical.circuits.length,
      connectorCount: record.snapshot.electrical.connectors.length,
      plugDemandCount: record.snapshot.electrical.connectors
        .flatMap((connector) => connector.cavities)
        .filter((cavity) => cavity.plugPartDefinitionId !== null).length,
      harnessCount: record.snapshot.electrical.harnesses.length,
      bundle: record.snapshot.electrical.bundles[0],
      cable: record.snapshot.electrical.cableSpecifications[0],
      connectionTombstones: record.snapshot.tombstones.filter(
        (tombstone) => tombstone.subjectKind === 'connection'
      ).length
    };
  }, projectId);
  expect(stored).toMatchObject({
    connectionKinds: [
      'electrical-wire',
      'electrical-wire',
      'electrical-mate',
      'electrical-wire',
      'electrical-wire'
    ],
    routedConnections: 3,
    wireRoles: ['power', 'power', 'power', 'return'],
    routeLengths: ['0.42', '0.62', '1.40', '1.10'],
    circuitCount: 1,
    connectorCount: 2,
    plugDemandCount: 2,
    harnessCount: 1,
    bundle: { twistedPairs: [{}], concentric: {} },
    cable: {
      conductorAreaOrGauge: { value: '18' },
      strandConstruction: { state: 'unknown' }
    },
    connectionTombstones: 0
  });
});
