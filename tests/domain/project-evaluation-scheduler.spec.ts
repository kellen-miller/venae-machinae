import { describe, expect, it, vi } from 'vitest';

import { BrowserProjectEvaluationScheduler } from '../../src/lib/evaluation/evaluation-client';
import { createOperatingState } from '../../src/lib/operating-state/operating-state';
import { applyProjectAction } from '../../src/lib/project/apply-action';
import { createBlankProject } from '../../src/lib/project/project';

import type { WorkerRequest, WorkerResult } from '../../src/lib/evaluation/protocol';

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
}

describe('MVP-ARCH-004 Project evaluation adapter', () => {
  it('schedules a versioned domain snapshot and maps one matching worker result', async () => {
    const initial = createBlankProject({
      id: 'project-evaluation-adapter',
      name: 'Evaluation adapter',
      createdAt: '2026-09-01T00:00:00Z'
    });
    const changed = applyProjectAction(initial, {
      type: 'add-component',
      causationId: 'cause-component',
      component: {
        id: 'component-load',
        label: 'Load',
        kind: 'part',
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '0', y: '0' },
        ports: []
      }
    });
    if (!changed.accepted) throw new Error(changed.rejection.message);

    const workers: ControlledWorker[] = [];
    const scheduler = new BrowserProjectEvaluationScheduler({
      createWorker() {
        const worker = new ControlledWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
      isServerConnected: () => true
    });
    const publish = vi.fn(() => ({ published: true as const, revision: 2 }));
    scheduler.schedule({
      sourceRevision: 1,
      causationId: 'cause-component',
      snapshot: changed.snapshot,
      scope: { kind: 'changed-subjects', subjectIds: ['component-load'] },
      publish
    });

    await vi.waitFor(() => expect(workers[0]?.sent).toHaveLength(1));
    const request = workers[0]?.sent[0];
    expect(request).toMatchObject({
      type: 'initialize-evaluation',
      projectRevision: 1,
      schemaVersion: 7,
      formulaCatalogVersion: 1,
      validationRuleCatalogVersion: 1,
      project: {
        schemaVersion: 7,
        projectRevision: 1,
        components: [{ id: 'component-load', ports: [] }]
      }
    });
    expect(request?.inputFingerprint).toMatch(/^[a-f0-9]{64}$/);
    if (!request || request.type !== 'initialize-evaluation') {
      throw new Error('Expected initialization request');
    }

    workers[0]?.respond({
      type: 'evaluation-succeeded',
      requestId: request.requestId,
      projectRevision: request.projectRevision,
      inputFingerprint: request.inputFingerprint,
      formulaCatalogVersion: request.formulaCatalogVersion,
      validationRuleCatalogVersion: request.validationRuleCatalogVersion,
      schemaVersion: request.schemaVersion,
      summary: {
        componentCount: 1,
        connectionCount: 0,
        engineeringValueCount: 0,
        operatingStateCount: 0
      },
      results: []
    });
    expect(publish).toHaveBeenCalledWith([
      {
        id: 'result-evaluation-summary',
        sourceRevision: 1,
        status: 'current',
        kind: 'evaluation-summary',
        detail: null
      }
    ]);

    const withState = applyProjectAction(changed.snapshot, {
      type: 'add-operating-state',
      causationId: 'cause-state',
      state: createOperatingState({
        id: 'state-run-hot',
        name: 'Run Hot / Fan On',
        description: 'Static fixture'
      })
    });
    if (!withState.accepted) throw new Error(withState.rejection.message);
    const withCalculation = applyProjectAction(withState.snapshot, {
      type: 'configure-calculation',
      causationId: 'cause-calculation',
      calculation: {
        id: 'calculation-voltage-drop',
        subjectId: 'component-load',
        operatingStateId: 'state-run-hot',
        formulaId: 'electrical.voltage-drop.v1',
        pathId: null,
        inputs: [
          {
            name: 'current',
            quantity: {
              id: 'value-current',
              semantic: 'electric-current',
              decimal: '12.5',
              unit: 'ampere',
              applicability: 'Run Hot / Fan On',
              uncertainty: null,
              bounds: null,
              origin: 'entered',
              provenance: 'independent scheduler fixture'
            }
          },
          {
            name: 'resistance',
            quantity: {
              id: 'value-resistance',
              semantic: 'electrical-resistance',
              decimal: '0.032',
              unit: 'ohm',
              applicability: 'Run Hot / Fan On',
              uncertainty: null,
              bounds: null,
              origin: 'entered',
              provenance: 'independent scheduler fixture'
            }
          }
        ],
        assumptions: ['steady DC'],
        conditions: { currentClass: 'continuous' },
        omissions: [],
        desiredOutputUnit: 'volt'
      }
    });
    if (!withCalculation.accepted) throw new Error(withCalculation.rejection.message);
    const incrementalPublish = vi.fn(() => ({ published: true as const, revision: 4 }));
    scheduler.schedule({
      sourceRevision: withCalculation.snapshot.revision,
      causationId: 'cause-calculation',
      snapshot: withCalculation.snapshot,
      scope: { kind: 'changed-subjects', subjectIds: ['calculation-voltage-drop'] },
      publish: incrementalPublish
    });

    await vi.waitFor(() => expect(workers[0]?.sent).toHaveLength(2));
    const incremental = workers[0]?.sent[1];
    expect(incremental).toMatchObject({
      type: 'evaluate-change-set',
      projectRevision: 3,
      changeSet: {
        baseRevision: 1,
        upsertComponents: [],
        upsertOperatingStates: [{ id: 'state-run-hot' }],
        upsertCalculations: [{ id: 'calculation-voltage-drop' }]
      }
    });
    if (!incremental || incremental.type !== 'evaluate-change-set') {
      throw new Error('Expected incremental evaluation request');
    }
    workers[0]?.respond({
      type: 'evaluation-succeeded',
      requestId: incremental.requestId,
      projectRevision: incremental.projectRevision,
      inputFingerprint: incremental.inputFingerprint,
      formulaCatalogVersion: incremental.formulaCatalogVersion,
      validationRuleCatalogVersion: incremental.validationRuleCatalogVersion,
      schemaVersion: incremental.schemaVersion,
      summary: {
        componentCount: 1,
        connectionCount: 0,
        engineeringValueCount: 0,
        operatingStateCount: 1
      },
      results: []
    });
    expect(incrementalPublish).toHaveBeenCalledWith([
      {
        id: 'result-evaluation-summary',
        sourceRevision: 3,
        status: 'current',
        kind: 'evaluation-summary',
        detail: null
      }
    ]);

    scheduler.close();
    expect(workers[0]?.terminated).toBe(true);
  });
});
