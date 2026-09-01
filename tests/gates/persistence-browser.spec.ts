import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import { build } from 'vite';

import { CAPACITY_COUNTS } from '../fixtures/capacity-project';

let browserBundle = '';

test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: resolve('tests/gates/entries/persistence-browser.ts'),
        formats: ['iife'],
        name: 'VenaePersistenceGate'
      }
    }
  });
  const outputs = Array.isArray(result) ? result : 'output' in result ? [result] : [];
  const chunk = outputs.flatMap((output) => output.output).find((entry) => entry.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Persistence browser bundle is absent');
  browserBundle = chunk.code;
});

test('MVP-GATE-003 persists and recovers whole snapshots in a production browser', async ({
  page
}, testInfo) => {
  await page.addInitScript({
    content: `${browserBundle}\nwindow.VenaePersistenceGate = VenaePersistenceGate;`
  });
  await page.goto('/health');
  const result = await page.evaluate(() =>
    (
      window as unknown as {
        VenaePersistenceGate: {
          runPersistenceGate(): Promise<{
            measurements: Array<{
              scale: 1 | 2 | 5;
              componentCount: number;
              portCount: number;
              connectionCount: number;
              serializedBytes: number;
              serializationMs: number;
              validationMs: number;
              cloneMs: number;
              saveMs: number;
              reopenAndLoadMs: number;
              saved: boolean;
              assetWrites: number;
              recoveredExactly: boolean;
            }>;
            checkpointCreated: boolean;
            checkpointCount: number;
            checkpointRecoveredExactly: boolean;
            assetCount: number;
          }>;
        };
      }
    ).VenaePersistenceGate.runPersistenceGate()
  );

  for (const measurement of result.measurements) {
    expect({
      components: measurement.componentCount,
      ports: measurement.portCount,
      connections: measurement.connectionCount
    }).toEqual(CAPACITY_COUNTS[measurement.scale]);
    expect(measurement.saved).toBe(true);
    expect(measurement.recoveredExactly).toBe(true);
    expect(measurement.serializationMs).toBeLessThan(2_000);
    expect(measurement.validationMs).toBeLessThan(2_000);
    expect(measurement.cloneMs).toBeLessThan(2_000);
    expect(measurement.saveMs).toBeLessThan(2_000);
    expect(measurement.reopenAndLoadMs).toBeLessThan(2_000);
  }
  expect(result.measurements.map((measurement) => measurement.assetWrites)).toEqual([1, 0, 0]);
  expect(result.assetCount).toBe(1);
  expect(result.checkpointCreated).toBe(true);
  expect(result.checkpointCount).toBe(1);
  expect(result.checkpointRecoveredExactly).toBe(true);
  console.log(`MVP_GATE_003_MEASUREMENT ${testInfo.project.name} ${JSON.stringify(result)}`);
});
