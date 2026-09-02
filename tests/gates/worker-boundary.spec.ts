import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyEvaluationChangeSet,
  createEvaluationProject,
  workerRequestSchema,
  workerResultSchema
} from '../../src/lib/evaluation/protocol';
import { EvaluationClient } from '../../src/lib/evaluation/evaluation-client';
import { generateCapacityProject } from '../fixtures/capacity-project';

import type {
  EvaluateChangeSet,
  EvaluationSucceeded,
  InitializeEvaluation,
  ProjectSystemAction,
  WorkerRequest,
  WorkerResult
} from '../../src/lib/evaluation/protocol';

const fingerprintOne = '1'.repeat(64);
const fingerprintTwo = '2'.repeat(64);

function createInitialization(
  scale: 1 | 2 | 5,
  requestId = `initialize-${scale}x`,
  fingerprint = fingerprintOne
): InitializeEvaluation {
  const project = createEvaluationProject(generateCapacityProject(scale));

  return {
    type: 'initialize-evaluation',
    requestId,
    projectRevision: project.projectRevision,
    inputFingerprint: fingerprint,
    formulaCatalogVersion: 1,
    validationRuleCatalogVersion: 1,
    schemaVersion: 6,
    project
  };
}

function createSuccess(request: InitializeEvaluation | EvaluateChangeSet): EvaluationSucceeded {
  return {
    type: 'evaluation-succeeded',
    requestId: request.requestId,
    projectRevision: request.projectRevision,
    inputFingerprint: request.inputFingerprint,
    formulaCatalogVersion: request.formulaCatalogVersion,
    validationRuleCatalogVersion: request.validationRuleCatalogVersion,
    schemaVersion: request.schemaVersion,
    summary: {
      componentCount: 300,
      connectionCount: 1200,
      engineeringValueCount: 0,
      operatingStateCount: 0
    },
    results: []
  };
}

class ControlledWorker extends EventTarget {
  readonly sent: WorkerRequest[] = [];
  terminated = false;

  postMessage(message: WorkerRequest): void {
    this.sent.push(structuredClone(message));
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(result: WorkerResult): void {
    this.dispatchEvent(new MessageEvent('message', { data: structuredClone(result) }));
  }

  crash(): void {
    this.dispatchEvent(new Event('error', { cancelable: true }));
  }
}

function createHarness(options: { connected?: boolean; cancellationGraceMs?: number } = {}) {
  let connected = options.connected ?? true;
  const workers: ControlledWorker[] = [];
  const publications: ProjectSystemAction[] = [];
  const client = new EvaluationClient({
    createWorker: () => {
      const worker = new ControlledWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
    isServerConnected: () => connected,
    publish: (action) => publications.push(action),
    cancellationGraceMs: options.cancellationGraceMs
  });

  return {
    client,
    publications,
    workers,
    setConnected(value: boolean) {
      connected = value;
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('MVP-GATE-005 worker boundary', () => {
  it.each([
    [1, 300, 1200],
    [2, 600, 2400],
    [5, 1500, 6000]
  ] as const)(
    'builds a structured-cloneable evaluation-only %sx initialization',
    (scale, componentCount, connectionCount) => {
      const initialization = workerRequestSchema.parse(createInitialization(scale));
      const cloned = structuredClone(initialization);

      expect(cloned.type).toBe('initialize-evaluation');
      if (cloned.type !== 'initialize-evaluation') throw new Error('Expected initialization');
      expect(cloned.project.components).toHaveLength(componentCount);
      expect(cloned.project.connections).toHaveLength(connectionCount);
      expect(cloned.project.components[0]).toEqual({
        id: `component-${scale}x-0`,
        ports: [
          { id: `port-${scale}x-0`, domain: 'electrical' },
          { id: `port-${scale}x-1`, domain: 'electrical' },
          { id: `port-${scale}x-2`, domain: 'electrical' },
          { id: `port-${scale}x-3`, domain: 'electrical' },
          { id: `port-${scale}x-4`, domain: 'electrical' }
        ]
      });
      expect(cloned.project.components[0]).not.toHaveProperty('x');
      expect(cloned.project).not.toHaveProperty('assetHashes');
    }
  );

  it('applies a small revisioned change set without mutating the full mirror', () => {
    const initialization = createInitialization(1);
    const change: EvaluateChangeSet = {
      type: 'evaluate-change-set',
      requestId: 'incremental-2',
      projectRevision: 2,
      inputFingerprint: fingerprintTwo,
      formulaCatalogVersion: 1,
      validationRuleCatalogVersion: 1,
      schemaVersion: 6,
      changeSet: {
        baseRevision: 1,
        upsertComponents: [],
        removeComponentIds: [],
        upsertConnections: [],
        removeConnectionIds: [],
        upsertEngineeringValues: [
          { id: 'value-voltage', decimal: '12.8', unit: 'V', provenance: 'gate fixture' }
        ],
        removeEngineeringValueIds: [],
        upsertOperatingStates: [],
        removeOperatingStateIds: [],
        upsertCalculations: [],
        removeCalculationIds: [],
        upsertScreenings: [],
        removeScreeningIds: []
      }
    };

    const parsedChange = workerRequestSchema.parse(change);
    if (parsedChange.type !== 'evaluate-change-set') throw new Error('Expected change set');
    const changed = applyEvaluationChangeSet(initialization.project, parsedChange);

    expect(initialization.project.projectRevision).toBe(1);
    expect(initialization.project.engineeringValues).toEqual([]);
    expect(changed.projectRevision).toBe(2);
    expect(changed.engineeringValues).toEqual([
      { id: 'value-voltage', decimal: '12.8', unit: 'V', provenance: 'gate fixture' }
    ]);
    expect(JSON.stringify(parsedChange).length).toBeLessThan(
      JSON.stringify(initialization).length / 100
    );
    expect(() =>
      applyEvaluationChangeSet({ ...initialization.project, projectRevision: 0 }, parsedChange)
    ).toThrow('revision gap');
  });

  it('allows one active evaluation and cooperatively supersedes queued work', () => {
    const harness = createHarness();
    const first = createInitialization(5, 'first', fingerprintOne);
    const second = createInitialization(1, 'second', fingerprintTwo);

    harness.client.schedule({ request: first, initialization: first });
    harness.client.schedule({ request: second, initialization: second });

    expect(harness.workers).toHaveLength(1);
    expect(harness.workers[0]?.sent.map((message) => message.type)).toEqual([
      'initialize-evaluation',
      'cancel-evaluation'
    ]);
    harness.workers[0]?.respond({
      type: 'evaluation-canceled',
      requestId: 'first',
      projectRevision: 1,
      inputFingerprint: fingerprintOne,
      formulaCatalogVersion: 1,
      validationRuleCatalogVersion: 1,
      schemaVersion: 6
    });
    expect(harness.workers[0]?.sent.map((message) => message.requestId)).toEqual([
      'first',
      'first',
      'second'
    ]);
    harness.workers[0]?.respond(createSuccess(second));
    expect(harness.publications).toEqual([
      { type: 'publish-evaluation', outcome: createSuccess(second) }
    ]);
    harness.client.close();
  });

  it('rejects stale and version-mismatched results before publication', () => {
    const harness = createHarness();
    const request = createInitialization(1, 'current', fingerprintOne);
    harness.client.schedule({ request, initialization: request });

    harness.workers[0]?.respond({ ...createSuccess(request), projectRevision: 0 });
    harness.workers[0]?.respond({ ...createSuccess(request), formulaCatalogVersion: 2 });
    expect(harness.publications).toEqual([]);

    const parsed = workerResultSchema.parse(createSuccess(request));
    harness.workers[0]?.respond(parsed);
    expect(harness.publications).toHaveLength(1);
    harness.client.close();
  });

  it('terminates and recreates a worker that does not acknowledge cancellation', async () => {
    vi.useFakeTimers();
    const harness = createHarness({ cancellationGraceMs: 25 });
    const first = createInitialization(5, 'blocked', fingerprintOne);
    const second = createInitialization(1, 'replacement', fingerprintTwo);
    harness.client.schedule({ request: first, initialization: first });
    harness.client.schedule({ request: second, initialization: second });

    await vi.advanceTimersByTimeAsync(26);

    expect(harness.workers).toHaveLength(2);
    expect(harness.workers[0]?.terminated).toBe(true);
    expect(harness.workers[1]?.sent).toEqual([second]);
    harness.client.close();
  });

  it('restarts once after a crash, then requires explicit retry', () => {
    const harness = createHarness();
    const request = createInitialization(1, 'crash-retry', fingerprintOne);
    harness.client.schedule({ request, initialization: request });

    harness.workers[0]?.crash();
    expect(harness.workers).toHaveLength(2);
    expect(harness.workers[1]?.sent).toEqual([request]);
    harness.workers[1]?.crash();
    expect(harness.workers).toHaveLength(2);
    expect(harness.client.retry()).toBe(true);
    expect(harness.workers).toHaveLength(3);
    expect(harness.workers[2]?.sent).toEqual([request]);
    harness.client.close();
  });

  it('reinitializes once after a revision or catalog mismatch', () => {
    const harness = createHarness();
    const first = createInitialization(1, 'initial-mirror', fingerprintOne);
    harness.client.schedule({ request: first, initialization: first });
    harness.workers[0]?.respond(createSuccess(first));

    const fallback: InitializeEvaluation = {
      ...createInitialization(1, 'changed-revision', fingerprintTwo),
      projectRevision: 2,
      project: { ...first.project, projectRevision: 2 }
    };
    const change: EvaluateChangeSet = {
      type: 'evaluate-change-set',
      requestId: fallback.requestId,
      projectRevision: fallback.projectRevision,
      inputFingerprint: fallback.inputFingerprint,
      formulaCatalogVersion: fallback.formulaCatalogVersion,
      validationRuleCatalogVersion: fallback.validationRuleCatalogVersion,
      schemaVersion: fallback.schemaVersion,
      changeSet: {
        baseRevision: 1,
        upsertComponents: [],
        removeComponentIds: [],
        upsertConnections: [],
        removeConnectionIds: [],
        upsertEngineeringValues: [],
        removeEngineeringValueIds: [],
        upsertOperatingStates: [],
        removeOperatingStateIds: [],
        upsertCalculations: [],
        removeCalculationIds: [],
        upsertScreenings: [],
        removeScreeningIds: []
      }
    };
    harness.client.schedule({ request: change, initialization: fallback });
    expect(harness.workers[0]?.sent.at(-1)).toEqual(change);

    harness.workers[0]?.respond({
      type: 'evaluation-failed',
      requestId: change.requestId,
      projectRevision: change.projectRevision,
      inputFingerprint: change.inputFingerprint,
      formulaCatalogVersion: change.formulaCatalogVersion,
      validationRuleCatalogVersion: change.validationRuleCatalogVersion,
      schemaVersion: change.schemaVersion,
      reason: 'revision-gap',
      message: 'independent mismatch fixture',
      requiresInitialization: true
    });

    expect(harness.publications).toEqual([
      { type: 'publish-evaluation', outcome: createSuccess(first) }
    ]);
    expect(harness.workers).toHaveLength(2);
    expect(harness.workers[0]?.terminated).toBe(true);
    expect(harness.workers[1]?.sent).toEqual([fallback]);
    harness.workers[1]?.respond(createSuccess(fallback));
    expect(harness.publications.at(-1)).toEqual({
      type: 'publish-evaluation',
      outcome: createSuccess(fallback)
    });
    harness.client.close();
  });

  it('retains the initialization through server loss and resumes only after reconnect', () => {
    const harness = createHarness();
    const request = createInitialization(1, 'server-loss', fingerprintOne);
    const original = structuredClone(request);
    harness.client.schedule({ request, initialization: request });
    harness.setConnected(false);
    harness.workers[0]?.crash();

    expect(harness.workers).toHaveLength(1);
    expect(harness.client.retry()).toBe(false);
    expect(request).toEqual(original);

    harness.setConnected(true);
    expect(harness.client.retry()).toBe(true);
    expect(harness.workers).toHaveLength(2);
    expect(harness.workers[1]?.sent).toEqual([request]);
    harness.workers[1]?.respond(createSuccess(request));
    expect(harness.publications).toEqual([
      { type: 'publish-evaluation', outcome: createSuccess(request) }
    ]);
    harness.client.close();
  });
});
