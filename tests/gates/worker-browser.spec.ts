import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import { build } from 'vite';

let browserBundle = '';
let workerBundle = '';

test.beforeAll(async () => {
  const [browserResult, workerResult] = await Promise.all([
    build({
      configFile: false,
      logLevel: 'silent',
      build: {
        write: false,
        lib: {
          entry: resolve('tests/gates/entries/worker-browser.ts'),
          formats: ['iife'],
          name: 'VenaeWorkerGate'
        }
      }
    }),
    build({
      configFile: false,
      logLevel: 'silent',
      build: {
        write: false,
        lib: {
          entry: resolve('src/lib/evaluation/evaluation-worker.ts'),
          formats: ['es']
        }
      }
    })
  ]);

  const browserOutputs = Array.isArray(browserResult)
    ? browserResult
    : 'output' in browserResult
      ? [browserResult]
      : [];
  const browserChunk = browserOutputs
    .flatMap((output) => output.output)
    .find((entry) => entry.type === 'chunk');
  if (!browserChunk || browserChunk.type !== 'chunk')
    throw new Error('Worker gate bundle is absent');
  browserBundle = browserChunk.code;

  const workerOutputs = Array.isArray(workerResult)
    ? workerResult
    : 'output' in workerResult
      ? [workerResult]
      : [];
  const workerChunk = workerOutputs
    .flatMap((output) => output.output)
    .find((entry) => entry.type === 'chunk');
  if (!workerChunk || workerChunk.type !== 'chunk')
    throw new Error('Evaluation worker bundle is absent');
  workerBundle = workerChunk.code;
});

test('MVP-GATE-005 preserves the evaluation worker boundary', async ({ page }, testInfo) => {
  await page.addInitScript({
    content: `${browserBundle}\nwindow.VenaeWorkerGate = VenaeWorkerGate;`
  });
  await page.goto('/');
  const result = await page.evaluate(
    (source) =>
      (
        window as unknown as {
          VenaeWorkerGate: {
            runWorkerGate(workerSource: string): Promise<{
              measurements: Array<{
                scale: 1 | 2 | 5;
                initializationBytes: number;
                incrementalBytes: number;
                initializationDispatchMs: number;
                incrementalDispatchMs: number;
                initializationPublished: boolean;
                incrementalPublished: boolean;
              }>;
              publicationRequestIds: string[];
              cooperative: { publishedRequestIds: string[]; replacementOnly: boolean };
              staleRejection: { publicationCount: number; matchingRequestId: boolean };
              forcedRestart: { workerCount: number; publishedRequestId: string };
              crashRestart: { workerCount: number; publishedRequestId: string };
              serverLoss: {
                workerCount: number;
                retryWhileDisconnected: boolean;
                retryAfterReconnect: boolean;
                retainedInitialization: boolean;
                publishedRequestId: string;
              };
            }>;
          };
        }
      ).VenaeWorkerGate.runWorkerGate(source),
    workerBundle
  );

  expect(result.measurements.map((measurement) => measurement.scale)).toEqual([1, 2, 5]);
  expect(result.measurements.map((measurement) => measurement.initializationPublished)).toEqual([
    true,
    true,
    true
  ]);
  expect(result.measurements.map((measurement) => measurement.incrementalPublished)).toEqual([
    true,
    true,
    true
  ]);
  for (const measurement of result.measurements) {
    expect(measurement.initializationDispatchMs).toBeLessThan(2_000);
    expect(measurement.incrementalDispatchMs).toBeLessThan(100);
    expect(measurement.incrementalBytes).toBeLessThan(measurement.initializationBytes / 5);
  }
  expect(result.cooperative).toEqual({
    publishedRequestIds: ['cooperative-replacement'],
    replacementOnly: true
  });
  expect(result.staleRejection).toEqual({ publicationCount: 1, matchingRequestId: true });
  expect(result.forcedRestart).toEqual({
    workerCount: 2,
    publishedRequestId: 'forced-replacement'
  });
  expect(result.crashRestart).toEqual({ workerCount: 2, publishedRequestId: 'crash-restart' });
  expect(result.serverLoss).toEqual({
    workerCount: 2,
    retryWhileDisconnected: false,
    retryAfterReconnect: true,
    retainedInitialization: true,
    publishedRequestId: 'server-loss-retry'
  });
  console.log(`MVP_GATE_005_MEASUREMENT ${testInfo.project.name} ${JSON.stringify(result)}`);
});
