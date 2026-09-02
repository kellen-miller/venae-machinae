import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { commitStagedExchange } from '../../src/lib/exchange/commit-exchange';
import {
  createProjectExchange,
  projectExchangeEnvelopeSchema
} from '../../src/lib/exchange/project-exchange';
import { MEASURED_EXCHANGE_LIMITS } from '../../src/lib/exchange/measured-limits';
import { stageExchange } from '../../src/lib/exchange/stage-exchange';
import { canonicalJson, sha256Hex } from '../../src/lib/exchange/canonical-json';
import { PROJECT_LIBRARY_DATABASE_NAME } from '../../src/lib/persistence/database-schema';
import { openProjectLibrary } from '../../src/lib/persistence/project-library';
import { generateCapacityProject } from '../fixtures/capacity-project';

async function createEnvelope() {
  return createProjectExchange({
    project: generateCapacityProject(1),
    assets: [
      {
        mimeType: 'image/png',
        bytes: new Uint8Array([137, 80, 78, 71])
      }
    ],
    exportedAt: '2026-09-01T00:00:00Z'
  });
}

function asBlob(value: unknown): Blob {
  return new Blob([JSON.stringify(value)], { type: 'application/json' });
}

function deleteProjectLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(PROJECT_LIBRARY_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Project Library deletion was blocked'));
  });
}

beforeEach(async () => {
  await deleteProjectLibrary();
});

describe('MVP-GATE-004 exchange limits', () => {
  it('creates a strict self-contained version-1 project envelope', async () => {
    const envelope = await createEnvelope();
    const parsed = projectExchangeEnvelopeSchema.parse(structuredClone(envelope));

    expect(parsed.format).toBe('venae-project');
    expect(parsed.exchangeVersion).toBe(1);
    expect(parsed.applicationVersion).toBe('0.1.0');
    expect(parsed.identity).toEqual({ projectId: 'capacity-project-1x', projectRevision: 1 });
    expect(parsed.payload.project.id).toBe('capacity-project-1x');
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.assets[0]).toEqual({
      sha256: '0f4636c78f65d3639ece5a064b5ae753e3408614a14fb18ab4d7540d2c248543',
      mimeType: 'image/png',
      byteLength: 4,
      base64: 'iVBORw=='
    });
    expect(() => projectExchangeEnvelopeSchema.parse({ ...parsed, unexpected: true })).toThrow();
  });

  it('stages parse, validation, payload, export metadata, and asset integrity before commit', async () => {
    const envelope = await createEnvelope();
    const outcome = await stageExchange(asBlob(envelope), MEASURED_EXCHANGE_LIMITS);

    expect(outcome.staged).toBe(true);
    if (!outcome.staged) throw new Error(outcome.reason);
    expect(outcome.summary).toEqual({
      format: 'venae-project',
      projectId: 'capacity-project-1x',
      projectRevision: 1,
      assetCount: 1,
      originalAssetBytes: 4,
      componentCount: 300,
      connectionCount: 1200,
      warnings: []
    });
    expect(outcome.measurements.envelopeBytes).toBeGreaterThan(250_000);
    expect(outcome.measurements.maxNestingDepth).toBe(7);
    expect(outcome.measurements.collectionEntries).toBe(3_007);
  });

  it('rejects payload mutation even when export metadata is unchanged', async () => {
    const envelope = await createEnvelope();
    envelope.payload.project.name = 'Mutated after hashing';

    await expect(stageExchange(asBlob(envelope), MEASURED_EXCHANGE_LIMITS)).resolves.toEqual(
      expect.objectContaining({ staged: false, reason: 'payload-integrity' })
    );
  });

  it('hashes changing export metadata separately from the canonical payload', async () => {
    const envelope = await createEnvelope();
    const originalPayloadHash = envelope.integrity.payloadSha256;
    envelope.exportMetadata.exportedAt = '2026-09-02T00:00:00Z';

    await expect(stageExchange(asBlob(envelope), MEASURED_EXCHANGE_LIMITS)).resolves.toEqual(
      expect.objectContaining({ staged: false, reason: 'export-metadata-integrity' })
    );

    envelope.integrity.exportMetadataSha256 = await sha256Hex(
      canonicalJson(envelope.exportMetadata)
    );
    const restaged = await stageExchange(asBlob(envelope), MEASURED_EXCHANGE_LIMITS);
    expect(restaged.staged).toBe(true);
    expect(envelope.integrity.payloadSha256).toBe(originalPayloadHash);
  });

  it('rejects corrupt asset bytes without interpreting the asset', async () => {
    const envelope = await createEnvelope();
    envelope.assets[0]!.base64 = 'iVBORg==';

    await expect(stageExchange(asBlob(envelope), MEASURED_EXCHANGE_LIMITS)).resolves.toEqual(
      expect.objectContaining({ staged: false, reason: 'asset-integrity' })
    );
  });

  it('blocks envelope, asset, combined-asset, count, depth, and collection limits', async () => {
    const envelope = await createEnvelope();
    const oversizedEnvelope = new Blob([
      new Uint8Array(MEASURED_EXCHANGE_LIMITS.maxEnvelopeBytes + 1)
    ]);
    await expect(stageExchange(oversizedEnvelope, MEASURED_EXCHANGE_LIMITS)).resolves.toEqual(
      expect.objectContaining({ staged: false, reason: 'envelope-size' })
    );

    envelope.assets[0]!.byteLength = MEASURED_EXCHANGE_LIMITS.maxIndividualAssetBytes + 1;
    await expect(stageExchange(asBlob(envelope), MEASURED_EXCHANGE_LIMITS)).resolves.toEqual(
      expect.objectContaining({ staged: false, reason: 'individual-asset-size' })
    );

    envelope.assets[0]!.byteLength = MEASURED_EXCHANGE_LIMITS.maxCombinedAssetBytes + 1;
    await expect(
      stageExchange(asBlob(envelope), {
        ...MEASURED_EXCHANGE_LIMITS,
        maxIndividualAssetBytes: Number.MAX_SAFE_INTEGER
      })
    ).resolves.toEqual(expect.objectContaining({ staged: false, reason: 'combined-asset-size' }));

    const counted = await createEnvelope();
    await expect(
      stageExchange(asBlob(counted), { ...MEASURED_EXCHANGE_LIMITS, maxAssets: 0 })
    ).resolves.toEqual(expect.objectContaining({ staged: false, reason: 'asset-count' }));

    await expect(
      stageExchange(asBlob(counted), { ...MEASURED_EXCHANGE_LIMITS, maxNestingDepth: 6 })
    ).resolves.toEqual(expect.objectContaining({ staged: false, reason: 'nesting-depth' }));

    await expect(
      stageExchange(asBlob(counted), { ...MEASURED_EXCHANGE_LIMITS, maxCollectionEntries: 3_004 })
    ).resolves.toEqual(expect.objectContaining({ staged: false, reason: 'collection-count' }));
  });

  it('defaults commit to cancel and mutates only after explicit replacement', async () => {
    const outcome = await stageExchange(asBlob(await createEnvelope()), MEASURED_EXCHANGE_LIMITS);
    if (!outcome.staged) throw new Error(outcome.reason);
    const library = await openProjectLibrary();

    expect(await commitStagedExchange(outcome, undefined, library)).toEqual({
      committed: false,
      reason: 'canceled'
    });
    expect(await library.loadProject('capacity-project-1x')).toBeUndefined();
    expect(await commitStagedExchange(outcome, 'replace', library)).toEqual({
      committed: true,
      decision: 'replace',
      projectId: 'capacity-project-1x',
      revision: 1
    });
    expect(await library.loadProject('capacity-project-1x')).toEqual(outcome.envelope.payload);
    library.close();
  });

  it('imports a copy by rekeying every provisional project-owned identity', async () => {
    const project = generateCapacityProject(1);
    project.results.push({
      id: 'result-original',
      sourceRevision: 1,
      status: 'current',
      kind: 'evaluation-summary',
      detail: null
    });
    const envelope = await createProjectExchange({
      project,
      assets: [],
      exportedAt: '2026-09-01T00:00:00Z'
    });
    const outcome = await stageExchange(asBlob(envelope), MEASURED_EXCHANGE_LIMITS);
    if (!outcome.staged) throw new Error(outcome.reason);
    const library = await openProjectLibrary();
    const committed = await commitStagedExchange(outcome, 'import-copy', library);

    expect(committed).toEqual({
      committed: true,
      decision: 'import-copy',
      projectId: expect.not.stringMatching(/^capacity-project-1x$/),
      revision: 1
    });
    if (!committed.committed) throw new Error(committed.reason);
    const copied = await library.loadProject(committed.projectId);
    expect(copied?.topology.components[0]?.id).not.toBe('component-1x-0');
    expect(copied?.topology.components[0]?.ports[0]?.id).not.toBe('port-1x-0');
    expect(copied?.topology.connections[0]?.sourcePortId).toBe(
      copied?.topology.components[0]?.ports[0]?.id
    );
    expect(copied?.results).toEqual([
      expect.objectContaining({
        id: expect.not.stringMatching(/^result-original$/),
        status: 'stale'
      })
    ]);
    expect(await library.loadProject('capacity-project-1x')).toBeUndefined();
    library.close();
  });
});
