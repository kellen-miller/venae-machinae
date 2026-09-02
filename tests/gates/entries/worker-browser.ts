import { EvaluationClient } from '../../../src/lib/evaluation/evaluation-client';
import {
  createEvaluationProject,
  evaluationIdentityMatches,
  workerResultSchema
} from '../../../src/lib/evaluation/protocol';
import { generateRx7CapacityProject } from '../../fixtures/rx7-capacity-project';

import type {
  EvaluateChangeSet,
  InitializeEvaluation,
  ProjectSystemAction
} from '../../../src/lib/evaluation/protocol';

const fingerprintOne = '1'.repeat(64);
const fingerprintTwo = '2'.repeat(64);

function createInitialization(
  scale: 1 | 2 | 5,
  requestId: string,
  fingerprint: string
): InitializeEvaluation {
  const project = createEvaluationProject(generateRx7CapacityProject(scale));

  return {
    type: 'initialize-evaluation',
    requestId,
    projectRevision: project.projectRevision,
    inputFingerprint: fingerprint,
    formulaCatalogVersion: 1,
    validationRuleCatalogVersion: 1,
    schemaVersion: 8,
    scope: { kind: 'incremental', subjectIds: [] },
    project
  };
}

function createIncrementalChange(
  requestId: string,
  initialization: InitializeEvaluation
): EvaluateChangeSet {
  const projectRevision = initialization.projectRevision + 1;
  return {
    type: 'evaluate-change-set',
    requestId,
    projectRevision,
    inputFingerprint: fingerprintTwo,
    formulaCatalogVersion: 1,
    validationRuleCatalogVersion: 1,
    schemaVersion: 8,
    scope: { kind: 'incremental', subjectIds: [] },
    changeSet: {
      baseRevision: initialization.projectRevision,
      upsertSystems: [],
      removeSystemIds: [],
      upsertComponents: [],
      removeComponentIds: [],
      upsertConnections: [],
      removeConnectionIds: [],
      upsertCircuits: [],
      removeCircuitIds: [],
      upsertEvidence: [],
      removeEvidenceIds: [],
      upsertEngineeringValues: [
        {
          id: `${initialization.project.projectId}-gate-voltage`,
          decimal: '12.8',
          unit: 'V',
          provenance: 'RX-7 capacity gate incremental evidence'
        }
      ],
      removeEngineeringValueIds: [],
      upsertOperatingStates: [],
      removeOperatingStateIds: [],
      upsertCalculations: [],
      removeCalculationIds: [],
      upsertScreenings: [],
      removeScreeningIds: [],
      validationHistory: initialization.project.validationHistory,
      validationApplicabilityDecisions: initialization.project.validationApplicabilityDecisions,
      tombstones: initialization.project.tombstones
    }
  };
}

function workerFromSource(source: string, urls: string[], diagnostics: string[]): Worker {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  urls.push(url);
  const worker = new Worker(url, { type: 'module' });
  worker.addEventListener('error', (event) => {
    diagnostics.push(
      `${event.message || 'worker error'} at ${event.filename || 'worker'}:${event.lineno}:${event.colno}`
    );
  });
  worker.addEventListener('messageerror', () => diagnostics.push('worker message clone failed'));
  worker.addEventListener('message', (event) => {
    const message = event.data as { type?: unknown; reason?: unknown; message?: unknown };
    const parsed = workerResultSchema.safeParse(event.data);
    diagnostics.push(
      `worker message ${String(message?.type)}${message?.reason ? ` ${String(message.reason)}` : ''}${message?.message ? `: ${String(message.message)}` : ''}${parsed.success ? '' : `; ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`}`
    );
  });
  return worker;
}

function nextPublication(label: string, diagnostics: string[]) {
  let resolve!: (action: ProjectSystemAction) => void;
  const promise = new Promise<ProjectSystemAction>((complete, reject) => {
    const timeout = setTimeout(
      () =>
        reject(
          new Error(
            `Timed out waiting for ${label} publication${diagnostics.length > 0 ? `: ${diagnostics.join('; ')}` : ''}`
          )
        ),
      10_000
    );
    resolve = (action) => {
      clearTimeout(timeout);
      complete(action);
    };
  });

  return { promise, resolve };
}

async function probeProductionWorker(
  productionWorkerSource: string,
  urls: string[],
  diagnostics: string[]
): Promise<void> {
  const request = createInitialization(1, 'rx7-production-probe', fingerprintOne);
  const worker = workerFromSource(productionWorkerSource, urls, diagnostics);
  const result = await new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Production worker probe timed out: ${diagnostics.join('; ')}`)),
      10_000
    );
    worker.addEventListener(
      'message',
      (event) => {
        clearTimeout(timeout);
        resolve(event.data);
      },
      { once: true }
    );
    worker.postMessage(request);
  });
  worker.terminate();

  const parsed = workerResultSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(
      `Production worker probe returned an invalid result: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ')}`
    );
  }
  if (!evaluationIdentityMatches(request, parsed.data)) {
    throw new Error('Production worker probe returned a mismatched result identity');
  }
}

export async function runWorkerGate(productionWorkerSource: string) {
  const urls: string[] = [];
  const diagnostics: string[] = [];
  await probeProductionWorker(productionWorkerSource, urls, diagnostics);
  const measurements = [];
  const publicationRequestIds: string[] = [];
  let pendingPublication: ReturnType<typeof nextPublication>;
  const measurementClient = new EvaluationClient({
    createWorker: () => workerFromSource(productionWorkerSource, urls, diagnostics),
    isServerConnected: () => true,
    publish: (action) => {
      publicationRequestIds.push(action.outcome.requestId);
      pendingPublication.resolve(action);
    }
  });

  for (const scale of [1, 2, 5] as const) {
    const initialization = createInitialization(
      scale,
      `measurement-${scale}x-initial`,
      fingerprintOne
    );
    pendingPublication = nextPublication(`measurement ${scale}x initialization`, diagnostics);
    const initializationStartedAt = performance.now();
    measurementClient.schedule({ request: initialization, initialization });
    const initializationDispatchMs = performance.now() - initializationStartedAt;
    const initialized = await pendingPublication.promise;

    const incremental = createIncrementalChange(
      `measurement-${scale}x-incremental`,
      initialization
    );
    const incrementalValue = incremental.changeSet.upsertEngineeringValues[0]!;
    const fallback = {
      ...initialization,
      requestId: incremental.requestId,
      projectRevision: incremental.projectRevision,
      inputFingerprint: incremental.inputFingerprint,
      project: {
        ...initialization.project,
        projectRevision: incremental.projectRevision,
        engineeringValues: [...initialization.project.engineeringValues, incrementalValue]
      }
    } satisfies InitializeEvaluation;
    pendingPublication = nextPublication(`measurement ${scale}x incremental`, diagnostics);
    const incrementalStartedAt = performance.now();
    measurementClient.schedule({ request: incremental, initialization: fallback });
    const incrementalDispatchMs = performance.now() - incrementalStartedAt;
    const incremented = await pendingPublication.promise;
    measurements.push({
      scale,
      initializationBytes: new TextEncoder().encode(JSON.stringify(initialization)).byteLength,
      incrementalBytes: new TextEncoder().encode(JSON.stringify(incremental)).byteLength,
      initializationDispatchMs,
      incrementalDispatchMs,
      initializationPublished: initialized.outcome.requestId === initialization.requestId,
      incrementalPublished: incremented.outcome.requestId === incremental.requestId
    });
  }
  measurementClient.close();

  const cooperativePublications: ProjectSystemAction[] = [];
  const cooperativePublication = nextPublication('cooperative replacement', diagnostics);
  const cooperativeClient = new EvaluationClient({
    createWorker: () => workerFromSource(productionWorkerSource, urls, diagnostics),
    isServerConnected: () => true,
    publish: (action) => {
      cooperativePublications.push(action);
      cooperativePublication.resolve(action);
    }
  });
  const superseded = createInitialization(5, 'cooperative-superseded', fingerprintOne);
  const replacement = createInitialization(1, 'cooperative-replacement', fingerprintTwo);
  cooperativeClient.schedule({ request: superseded, initialization: superseded });
  cooperativeClient.schedule({ request: replacement, initialization: replacement });
  await cooperativePublication.promise;
  cooperativeClient.close();

  const staleSource = `${productionWorkerSource}\nself.addEventListener('message', (event) => { const message = event.data; if (message.type !== 'initialize-evaluation') return; self.postMessage({ type: 'evaluation-succeeded', requestId: message.requestId, projectRevision: message.projectRevision, inputFingerprint: '${'9'.repeat(64)}', formulaCatalogVersion: message.formulaCatalogVersion, validationRuleCatalogVersion: message.validationRuleCatalogVersion, schemaVersion: message.schemaVersion, summary: { componentCount: 0, connectionCount: 0, engineeringValueCount: 0, operatingStateCount: 0 }, results: [] }); }, { once: true });`;
  const stalePublications: ProjectSystemAction[] = [];
  const stalePublication = nextPublication('stale rejection', diagnostics);
  const staleClient = new EvaluationClient({
    createWorker: () => workerFromSource(staleSource, urls, diagnostics),
    isServerConnected: () => true,
    publish: (action) => {
      stalePublications.push(action);
      stalePublication.resolve(action);
    }
  });
  const staleRequest = createInitialization(1, 'stale-rejection', fingerprintOne);
  staleClient.schedule({ request: staleRequest, initialization: staleRequest });
  await stalePublication.promise;
  await new Promise((resolve) => setTimeout(resolve, 20));
  staleClient.close();

  const blockingSource =
    "self.addEventListener('message', () => { const until = performance.now() + 500; while (performance.now() < until) {} });";
  let forcedWorkerCount = 0;
  const forcedPublication = nextPublication('forced restart', diagnostics);
  const forcedClient = new EvaluationClient({
    createWorker: () => {
      forcedWorkerCount += 1;
      return workerFromSource(
        forcedWorkerCount === 1 ? blockingSource : productionWorkerSource,
        urls,
        diagnostics
      );
    },
    isServerConnected: () => true,
    publish: (action) => forcedPublication.resolve(action),
    cancellationGraceMs: 25
  });
  const blocked = createInitialization(5, 'forced-blocked', fingerprintOne);
  const forcedReplacement = createInitialization(1, 'forced-replacement', fingerprintTwo);
  forcedClient.schedule({ request: blocked, initialization: blocked });
  forcedClient.schedule({ request: forcedReplacement, initialization: forcedReplacement });
  const forcedOutcome = await forcedPublication.promise;
  forcedClient.close();

  const crashingSource =
    "self.addEventListener('message', () => { throw new Error('gate fault'); });";
  let crashWorkerCount = 0;
  const crashPublication = nextPublication('crash restart', diagnostics);
  const crashClient = new EvaluationClient({
    createWorker: () => {
      crashWorkerCount += 1;
      return workerFromSource(
        crashWorkerCount === 1 ? crashingSource : productionWorkerSource,
        urls,
        diagnostics
      );
    },
    isServerConnected: () => true,
    publish: (action) => crashPublication.resolve(action)
  });
  const crashRequest = createInitialization(1, 'crash-restart', fingerprintOne);
  crashClient.schedule({ request: crashRequest, initialization: crashRequest });
  const crashOutcome = await crashPublication.promise;
  crashClient.close();

  let serverConnected = true;
  let serverWorkerCount = 0;
  let crashObserved!: () => void;
  const crashObservedPromise = new Promise<void>((resolve) => {
    crashObserved = resolve;
  });
  const serverPublication = nextPublication('server-loss retry', diagnostics);
  const serverLossClient = new EvaluationClient({
    createWorker: () => {
      serverWorkerCount += 1;
      const worker = workerFromSource(
        serverWorkerCount === 1 ? crashingSource : productionWorkerSource,
        urls,
        diagnostics
      );
      if (serverWorkerCount === 1)
        worker.addEventListener('error', () => crashObserved(), { once: true });
      return worker;
    },
    isServerConnected: () => serverConnected,
    publish: (action) => serverPublication.resolve(action)
  });
  const serverLossRequest = createInitialization(1, 'server-loss-retry', fingerprintOne);
  const retainedInitialization = structuredClone(serverLossRequest);
  serverLossClient.schedule({ request: serverLossRequest, initialization: serverLossRequest });
  serverConnected = false;
  await crashObservedPromise;
  await new Promise((resolve) => setTimeout(resolve, 0));
  const retryWhileDisconnected = serverLossClient.retry();
  serverConnected = true;
  const retryAfterReconnect = serverLossClient.retry();
  const serverLossOutcome = await serverPublication.promise;
  serverLossClient.close();

  for (const url of urls) URL.revokeObjectURL(url);

  return {
    measurements,
    publicationRequestIds,
    cooperative: {
      publishedRequestIds: cooperativePublications.map((action) => action.outcome.requestId),
      replacementOnly:
        cooperativePublications.length === 1 &&
        cooperativePublications[0]?.outcome.requestId === replacement.requestId
    },
    staleRejection: {
      publicationCount: stalePublications.length,
      matchingRequestId: stalePublications[0]?.outcome.requestId === staleRequest.requestId
    },
    forcedRestart: {
      workerCount: forcedWorkerCount,
      publishedRequestId: forcedOutcome.outcome.requestId
    },
    crashRestart: {
      workerCount: crashWorkerCount,
      publishedRequestId: crashOutcome.outcome.requestId
    },
    serverLoss: {
      workerCount: serverWorkerCount,
      retryWhileDisconnected,
      retryAfterReconnect,
      retainedInitialization:
        JSON.stringify(serverLossRequest) === JSON.stringify(retainedInitialization),
      publishedRequestId: serverLossOutcome.outcome.requestId
    }
  };
}
