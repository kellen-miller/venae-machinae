import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { projectDocumentSchema } from '../../src/lib/persistence/project-document';
import { evaluateBundledRx7Example, openBundledRx7Example } from '../fixtures/rx7-example';

import type { Page } from '@playwright/test';
import type { ProjectDocument } from '../../src/lib/persistence/project-document';

type ProjectEnvelope = Readonly<{
  identity: Readonly<{ projectId: string; projectRevision: number }>;
  payload: ProjectDocument;
  assets: readonly Readonly<{ hash: string; mimeType: string; bytes: string }>[];
}>;

async function downloadRoundTripProject(page: Page, path: string): Promise<ProjectEnvelope> {
  await page.getByRole('button', { name: 'BOM view' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('dialog', { name: 'Lens Stack' })
    .getByRole('button', { name: 'Download round-trip Project JSON' })
    .click();
  const download = await downloadPromise;
  await download.saveAs(path);
  const envelope = JSON.parse(await readFile(path, 'utf8')) as ProjectEnvelope;
  projectDocumentSchema.parse(envelope.payload);
  return envelope;
}

function recordCounts(project: ProjectDocument): Record<string, number> {
  return {
    systems: project.topology.systems.length,
    components: project.topology.components.length,
    connections: project.topology.connections.length,
    routes: project.topology.routes.length,
    segments: project.topology.segments.length,
    electricalComponents: project.electrical.components.length,
    wires: project.electrical.wires.length,
    circuits: project.electrical.circuits.length,
    connectors: project.electrical.connectors.length,
    harnesses: project.electrical.harnesses.length,
    bundles: project.electrical.bundles.length,
    cableSpecifications: project.electrical.cableSpecifications.length,
    fluidMedia: project.fluid.media.length,
    fluidSystems: project.fluid.systems.length,
    fluidComponents: project.fluid.components.length,
    fluidLines: project.fluid.lines.length,
    behaviors: project.fluid.behaviors.length,
    boundaryConditions: project.fluid.boundaryConditions.length,
    calculations: project.calculations.length,
    screenings: project.screenings.length,
    partDefinitions: project.partDefinitions.length,
    partRequirements: project.partRequirements.length,
    procurementChoices: project.build.procurementChoices.length,
    installations: project.build.installations.length,
    evidence: project.evidence.length,
    results: project.results.length,
    tombstones: project.tombstones.length,
    engineeringValues: project.engineeringValues.length,
    operatingStates: project.operatingStates.length,
    assetHashes: project.assetHashes.length
  };
}

function topologyMeaning(project: ProjectDocument): unknown {
  return {
    systems: project.topology.systems.map(({ label, domain }) => ({ label, domain })),
    components: project.topology.components.map(({ label, kind, position, ports }) => ({
      label,
      kind,
      position,
      ports: ports.map(({ label: portLabel, domain, interfaceKey }) => ({
        label: portLabel,
        domain,
        interfaceKey
      }))
    })),
    connections: project.topology.connections.map(
      ({ label, domain, kind, interfaceAssessment }) => ({
        label,
        domain,
        kind,
        interfaceAssessment
      })
    ),
    routes: project.topology.routes.map((route) => route.segmentIds.length),
    segments: project.topology.segments.map(({ label, start, end }) => ({ label, start, end }))
  };
}

function evidenceMeaning(project: ProjectDocument): unknown {
  return project.evidence.map(({ label, state, value, unit, conflictValues }) => ({
    label,
    state,
    value,
    unit,
    conflictValues
  }));
}

function nonValidationResultMeaning(project: ProjectDocument): unknown {
  return project.results
    .filter((result) => result.detail?.type !== 'validation')
    .map((result) => ({
      kind: result.kind,
      type: result.detail?.type ?? null,
      status: result.status
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function validationFindings(project: ProjectDocument) {
  const result = project.results.find((candidate) => candidate.detail?.type === 'validation');
  if (result?.detail?.type !== 'validation') {
    throw new Error('Expected one validation Result in the complete RX-7 project');
  }
  return result.detail.history.findings;
}

function activeFindingMeaning(project: ProjectDocument): unknown {
  return validationFindings(project)
    .filter((finding) => finding.lifecycle === 'active')
    .map(({ ruleId, severity, evaluation, unknownReason }) => ({
      ruleId,
      severity,
      evaluation,
      unknownReason
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function topologyIdentities(project: ProjectDocument): Set<string> {
  return new Set([
    ...project.topology.systems.map(({ id }) => id),
    ...project.topology.components.flatMap((component) => [
      component.id,
      ...component.ports.map(({ id }) => id)
    ]),
    ...project.topology.connections.map(({ id }) => id),
    ...project.topology.routes.map(({ id }) => id),
    ...project.topology.segments.map(({ id }) => id)
  ]);
}

test('MVP-ACC-018 saves, reopens, copies, and revalidates the complete RX-7 project', async ({
  page
}, testInfo) => {
  await openBundledRx7Example(page);
  await evaluateBundledRx7Example(page);
  const originalPath = new URL(page.url()).pathname;
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();

  await page.getByRole('link', { name: 'Back to Project Library' }).click();
  await page.getByRole('link', { name: /Illustrative RX-7 vehicle systems study copy/ }).click();
  await expect(page).toHaveURL(originalPath);
  await page.getByRole('button', { name: 'Findings view' }).click();
  await expect(page.locator('[data-validation-result-status="current"]')).toBeVisible();

  const originalExchangePath = testInfo.outputPath('rx7-original.venae.json');
  const original = await downloadRoundTripProject(page, originalExchangePath);
  await page.getByRole('link', { name: 'Back to Project Library' }).click();
  await page.getByLabel('Import exchange file').setInputFiles(originalExchangePath);
  await page.getByRole('button', { name: 'Import as copy' }).click();
  await expect(page.locator('.project-library > ol > li')).toHaveCount(2);
  await page
    .getByRole('link', { name: /Illustrative RX-7 vehicle systems study copy copy/ })
    .click();

  await page.getByRole('button', { name: 'Findings view' }).click();
  await expect(page.locator('[data-validation-result-status="stale"]')).toBeVisible();
  await evaluateBundledRx7Example(page);
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
  const copyExchangePath = testInfo.outputPath('rx7-copy.venae.json');
  const copy = await downloadRoundTripProject(page, copyExchangePath);

  expect(copy.identity.projectId).not.toBe(original.identity.projectId);
  expect(recordCounts(copy.payload)).toEqual(recordCounts(original.payload));
  expect(topologyMeaning(copy.payload)).toEqual(topologyMeaning(original.payload));
  expect(evidenceMeaning(copy.payload)).toEqual(evidenceMeaning(original.payload));
  expect(nonValidationResultMeaning(copy.payload)).toEqual(
    nonValidationResultMeaning(original.payload)
  );
  expect(activeFindingMeaning(copy.payload)).toEqual(activeFindingMeaning(original.payload));
  const copiedFindingClaims = validationFindings(copy.payload).map(({ claim }) => claim);
  for (const { claim } of validationFindings(original.payload)) {
    expect(copiedFindingClaims).toContain(claim);
  }
  expect(copy.payload.assetHashes).toEqual(original.payload.assetHashes);
  expect(copy.assets).toEqual(original.assets);

  const originalTopologyIds = topologyIdentities(original.payload);
  const copyTopologyIds = topologyIdentities(copy.payload);
  expect(copyTopologyIds.size).toBe(originalTopologyIds.size);
  expect([...copyTopologyIds].filter((identity) => originalTopologyIds.has(identity))).toEqual([]);
});
