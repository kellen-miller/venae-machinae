import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import { build } from 'vite';

let browserBundle = '';

test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: resolve('tests/gates/entries/exchange-browser.ts'),
        formats: ['iife'],
        name: 'VenaeExchangeGate'
      }
    }
  });
  const outputs = Array.isArray(result) ? result : 'output' in result ? [result] : [];
  const chunk = outputs.flatMap((output) => output.output).find((entry) => entry.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Exchange browser bundle is absent');
  browserBundle = chunk.code;
});

test('MVP-GATE-004 stages measured exchange limits in production browsers', async ({
  page
}, testInfo) => {
  await page.addInitScript({
    content: `${browserBundle}\nwindow.VenaeExchangeGate = VenaeExchangeGate;`
  });
  await page.goto('/health');
  const result = await page.evaluate(() =>
    (
      window as unknown as {
        VenaeExchangeGate: {
          runExchangeGate(): Promise<{
            limits: {
              maxEnvelopeBytes: number;
              maxIndividualAssetBytes: number;
              maxCombinedAssetBytes: number;
              maxAssets: number;
              maxNestingDepth: number;
              maxCollectionEntries: number;
              maxEstimatedPeakBytes: number;
            };
            results: Array<{
              scale: 1 | 2 | 5;
              componentCount: number;
              portCount: number;
              connectionCount: number;
              envelopeBytes: number;
              originalAssetBytes: number;
              assetCount: number;
              encodeMs: number;
              stageTotalMs: number;
              parseMs: number;
              validationMs: number;
              hashingMs: number;
              cloneMs: number;
              commitMs: number;
              estimatedPeakBytes: number;
              estimatedPhasePeakBytes: Record<string, number>;
              maxNestingDepth: number;
              collectionEntries: number;
              saved: boolean;
              assetWrites: number;
              persistedAssetCount: number;
              recoveredExactly: boolean;
            }>;
          }>;
        };
      }
    ).VenaeExchangeGate.runExchangeGate()
  );

  expect(result.limits).toEqual({
    maxEnvelopeBytes: 20_971_520,
    maxIndividualAssetBytes: 6_291_456,
    maxCombinedAssetBytes: 12_582_912,
    maxAssets: 64,
    maxNestingDepth: 32,
    maxCollectionEntries: 50_000,
    maxEstimatedPeakBytes: 134_217_728
  });
  expect(
    result.results.map((measurement) => ({
      scale: measurement.scale,
      components: measurement.componentCount,
      ports: measurement.portCount,
      connections: measurement.connectionCount,
      originalAssetBytes: measurement.originalAssetBytes,
      assetCount: measurement.assetCount,
      maxNestingDepth: measurement.maxNestingDepth,
      collectionEntries: measurement.collectionEntries
    }))
  ).toEqual([
    {
      scale: 1,
      components: 26,
      ports: 65,
      connections: 32,
      originalAssetBytes: 68,
      assetCount: 1,
      maxNestingDepth: 10,
      collectionEntries: 732
    },
    {
      scale: 2,
      components: 52,
      ports: 130,
      connections: 64,
      originalAssetBytes: 524_288,
      assetCount: 2,
      maxNestingDepth: 10,
      collectionEntries: 1_464
    },
    {
      scale: 5,
      components: 130,
      ports: 325,
      connections: 160,
      originalAssetBytes: 12_582_912,
      assetCount: 3,
      maxNestingDepth: 10,
      collectionEntries: 3_654
    }
  ]);
  for (const measurement of result.results) {
    expect(measurement.envelopeBytes).toBeLessThanOrEqual(result.limits.maxEnvelopeBytes);
    expect(measurement.encodeMs).toBeLessThan(5_000);
    expect(measurement.stageTotalMs).toBeLessThan(5_000);
    expect(measurement.parseMs).toBeLessThan(2_000);
    expect(measurement.validationMs).toBeLessThan(2_000);
    expect(measurement.hashingMs).toBeLessThan(2_000);
    expect(measurement.cloneMs).toBeLessThan(2_000);
    expect(measurement.commitMs).toBeLessThan(2_000);
    expect(measurement.estimatedPeakBytes).toBeLessThanOrEqual(result.limits.maxEstimatedPeakBytes);
    expect(measurement.saved).toBe(true);
    expect(measurement.recoveredExactly).toBe(true);
  }
  expect(result.results.map((measurement) => measurement.assetWrites)).toEqual([1, 1, 2]);
  expect(result.results.map((measurement) => measurement.persistedAssetCount)).toEqual([1, 2, 4]);
  console.log(`MVP_GATE_004_MEASUREMENT ${testInfo.project.name} ${JSON.stringify(result)}`);
});
