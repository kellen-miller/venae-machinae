import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { aggregateProjectBom } from '../../src/lib/build/build-record';
import { createCsvTables, captureOutputRevision } from '../../src/lib/reporting/generate-output';
import { evaluateCalculation } from '../../src/lib/calculation/evaluate-calculation';
import { screenCandidates } from '../../src/lib/calculation/screen-candidates';
import { rekeyProjectCopy } from '../../src/lib/exchange/commit-exchange';
import { MEASURED_EXCHANGE_LIMITS } from '../../src/lib/exchange/measured-limits';
import { stageExchange } from '../../src/lib/exchange/stage-exchange';
import { createEvaluationProject } from '../../src/lib/evaluation/protocol';
import {
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from '../../src/lib/persistence/project-document';
import { applyProjectAction } from '../../src/lib/project/apply-action';

import type { ProjectExchangeEnvelope } from '../../src/lib/exchange/project-exchange';
import type { WorkerRequest, WorkerResult } from '../../src/lib/evaluation/protocol';

const referencePath = new URL('../../src/lib/reference/rx7-example.v1.venae.json', import.meta.url);

async function loadReference(): Promise<ProjectExchangeEnvelope> {
  return JSON.parse(await readFile(referencePath, 'utf8')) as ProjectExchangeEnvelope;
}

describe('MVP-UX-010 MVP-ACC-001 through MVP-ACC-010 bundled RX-7 example', () => {
  it('MVP-DATA-006 uses one strict envelope for construction, states, evidence, results, and as-built history', async () => {
    const envelope = await loadReference();
    const snapshot = projectDocumentToSnapshot(envelope.payload);

    expect(snapshot.topology.systems.map(({ id }) => id)).toEqual([
      'system-electrical',
      'system-coolant',
      'system-oil',
      'system-fuel'
    ]);
    expect(snapshot.electrical).toMatchObject({
      circuits: [{ id: 'circuit-aux-cooling' }],
      connectors: [{ componentId: 'connector-fan' }],
      harnesses: [{ id: 'harness-aux-cooling' }],
      bundles: [
        {
          id: 'bundle-aux-cooling',
          twistedPairs: [{ id: 'pair-fan-monitor' }],
          concentric: { layDirection: 'left' }
        }
      ]
    });
    expect(snapshot.fluid.systems).toHaveLength(3);
    expect(
      snapshot.topology.connections.filter(({ systemId }) => systemId === 'system-fuel')
    ).toHaveLength(5);
    expect(snapshot.operatingStates.map(({ name }) => name)).toEqual([
      'Key Off / Cold',
      'Fuel Prime',
      'Run Cold',
      'Run Hot / Fan On',
      'Heat Soak / Key Off'
    ]);
    expect(snapshot.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'result-calculation-voltage-drop', status: 'current' }),
        expect.objectContaining({
          id: 'result-calculation-pressure-incomplete',
          status: 'current'
        }),
        expect.objectContaining({ id: 'result-calculation-unknown-flow', status: 'current' }),
        expect.objectContaining({
          id: 'result-calculation-unsupported-voltage',
          status: 'current'
        }),
        expect.objectContaining({ id: 'result-failed-evaluator', status: 'failed' })
      ])
    );
    expect(snapshot.build.installations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subjectId: 'fan-original', status: 'removed' }),
        expect.objectContaining({ subjectId: 'fan-current', status: 'installed' })
      ])
    );
    expect(snapshot.tombstones).toContainEqual({
      subjectId: 'fan-original',
      subjectKind: 'component',
      successorId: 'fan-current'
    });
    expect(snapshot.assetHashes).toEqual([envelope.assets[0]?.sha256]);
  });

  it('executes every supported request and screens each candidate class from the bundled envelope', async () => {
    const snapshot = projectDocumentToSnapshot((await loadReference()).payload);
    const outcomes = snapshot.calculations.map((request) => ({
      id: request.id,
      outcome: evaluateCalculation(request, '2026-09-02T00:00:00.000Z')
    }));

    expect(outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'calculation-voltage-drop',
          outcome: expect.objectContaining({ status: 'calculated', completeness: 'known-subtotal' })
        }),
        expect.objectContaining({
          id: 'calculation-pressure-incomplete',
          outcome: expect.objectContaining({ status: 'calculated', completeness: 'known-subtotal' })
        }),
        expect.objectContaining({
          id: 'calculation-unknown-flow',
          outcome: expect.objectContaining({ status: 'unknown' })
        }),
        expect.objectContaining({
          id: 'calculation-unsupported-voltage',
          outcome: expect.objectContaining({ status: 'unsupported' })
        })
      ])
    );
    expect(snapshot.calculations.some((request) => request.subjectId.startsWith('fuel-'))).toBe(
      false
    );
    const screenings = snapshot.screenings.map(screenCandidates);
    expect(screenings.map(({ screeningId }) => screeningId)).toEqual([
      'screening-wire',
      'screening-fuse',
      'screening-hose',
      'screening-fitting',
      'screening-coupling'
    ]);
    expect(
      screenings.flatMap(({ candidates }) => candidates.flatMap(({ comparisons }) => comparisons))
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: 'pass' }),
        expect.objectContaining({ outcome: 'fail' }),
        expect.objectContaining({ outcome: 'indeterminate', reason: 'bound-overlap' }),
        expect.objectContaining({ outcome: 'unevaluated', reason: 'missing-evidence' })
      ])
    );
  });

  it('completes the fuel boundary through topology, screening, evidence, BOM, and output only', async () => {
    const snapshot = projectDocumentToSnapshot((await loadReference()).payload);
    const fuelBom = aggregateProjectBom(snapshot, { systemIds: ['system-fuel'] });
    const tables = createCsvTables(
      captureOutputRevision(snapshot, {
        source: 'durable',
        generatedAt: '2026-09-02T00:00:00.000Z',
        view: 'bom',
        operatingStateId: 'state-fuel-prime',
        domainFilter: 'fluid',
        systemFilterId: 'system-fuel',
        overlayChannels: ['fluid-direction'],
        legend: [],
        pagination: 'A4 portrait'
      })
    );

    expect(fuelBom.map(({ partDefinitionId }) => partDefinitionId)).toEqual([
      'definition-coupling',
      'definition-fitting',
      'definition-hose-fuel'
    ]);
    expect(snapshot.screenings.some(({ subjectId }) => subjectId === 'fuel-filter-rail')).toBe(
      true
    );
    expect(snapshot.evidence.some(({ subjectId }) => subjectId === 'fuel-filter-rail')).toBe(true);
    expect(tables['fluid-lines.csv']).toContain('fuel-regulator-tank');
    expect(tables['bom.csv']).toContain('definition-hose-fuel');
    expect(JSON.stringify(snapshot)).not.toMatch(
      /fuel-injection sizing|pressure-regulation recommendation|injector supply design|fire protection|legal compliance/i
    );
  });

  it('passes exchange integrity and rekeys owned identity while retaining origin provenance', async () => {
    const raw = await readFile(referencePath, 'utf8');
    const staged = await stageExchange(
      new Blob([raw], { type: 'application/json' }),
      MEASURED_EXCHANGE_LIMITS
    );
    expect(staged).toMatchObject({ staged: true, summary: { assetCount: 1 } });
    if (!staged.staged || staged.format !== 'venae-project')
      throw new Error('Reference did not stage');

    const copied = rekeyProjectCopy(staged.envelope.payload);
    expect(copied.project.id).not.toBe(staged.envelope.payload.project.id);
    expect(copied.topology.systems[0]?.id).not.toBe(
      staged.envelope.payload.topology.systems[0]?.id
    );
    expect(copied.build.installations[0]?.subjectId).not.toBe(
      staged.envelope.payload.build.installations[0]?.subjectId
    );
    const copiedCurrentResult = copied.results.find(
      (result) =>
        result.detail?.type === 'calculation' &&
        result.detail.outcome.trace.formulaId === 'electrical.current.voltage-resistance.v1' &&
        result.detail.outcome.status === 'calculated'
    );
    expect(copiedCurrentResult?.detail?.type).toBe('calculation');
    if (copiedCurrentResult?.detail?.type !== 'calculation') {
      throw new Error('Copied current calculation result is absent');
    }
    expect(copiedCurrentResult.id).toBe(
      `result-${copiedCurrentResult.detail.outcome.trace.calculationId}`
    );
    expect(
      copied.operatingStates
        .flatMap((state) => state.bindings)
        .find((binding) => binding.id !== '' && binding.calculationResultId)?.calculationResultId
    ).toBe(copiedCurrentResult.id);
    expect(copied.partDefinitions[0]?.provenance).toContain(
      'Imported as copy from reference-rx7-v1'
    );
  });

  it('evaluates the rekeyed bundled envelope through the production worker', async () => {
    const copied = rekeyProjectCopy((await loadReference()).payload);
    const project = createEvaluationProject(copied);
    const worker: { receive: ((event: MessageEvent<unknown>) => void) | null } = {
      receive: null
    };
    const result = new Promise<WorkerResult>((resolve) => {
      vi.stubGlobal('postMessage', resolve);
      vi.stubGlobal(
        'addEventListener',
        (_type: 'message', listener: (event: MessageEvent<unknown>) => void) => {
          worker.receive = listener;
        }
      );
    });

    try {
      vi.resetModules();
      await import('../../src/lib/evaluation/evaluation-worker');
      const receive = worker.receive;
      if (!receive) throw new Error('Production worker listener was not registered');
      const request: WorkerRequest = {
        type: 'initialize-evaluation',
        requestId: 'rx7-production-worker',
        projectRevision: copied.project.revision,
        inputFingerprint: 'a'.repeat(64),
        formulaCatalogVersion: 1,
        validationRuleCatalogVersion: 1,
        schemaVersion: 8,
        scope: { kind: 'validate-project' },
        project
      };
      receive({ data: request } as MessageEvent<unknown>);

      const outcome = await result;
      if (outcome.type === 'evaluation-failed') {
        throw new Error(`${outcome.reason}: ${outcome.message}`);
      }
      expect(outcome).toMatchObject({ type: 'evaluation-succeeded' });
      if (outcome.type !== 'evaluation-succeeded')
        throw new Error('Production evaluation did not succeed');
      const publication = applyProjectAction(projectDocumentToSnapshot(copied), {
        type: 'publish-evaluation',
        causationId: 'publish-rx7-production-worker',
        sourceRevision: copied.project.revision,
        results: outcome.results.map((derived) => ({
          ...derived,
          sourceRevision: copied.project.revision
        }))
      });
      expect(publication.accepted).toBe(true);
      if (!publication.accepted) throw new Error(publication.rejection.message);
      const publishedCalculations = publication.snapshot.results.filter(
        (published) => published.detail?.type === 'calculation'
      );
      expect(publishedCalculations).toHaveLength(11);
      expect(
        new Set(
          publishedCalculations.map((published) =>
            published.detail?.type === 'calculation'
              ? published.detail.outcome.trace.calculationId
              : null
          )
        ).size
      ).toBe(11);
      expect(() => projectSnapshotToDocument(publication.snapshot)).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
