import { createProjectExchange } from '../../../src/lib/exchange/project-exchange';
import { MEASURED_EXCHANGE_LIMITS } from '../../../src/lib/exchange/measured-limits';
import { stageExchange } from '../../../src/lib/exchange/stage-exchange';
import { commitStagedExchange } from '../../../src/lib/exchange/commit-exchange';
import { PROJECT_LIBRARY_DATABASE_NAME } from '../../../src/lib/persistence/database-schema';
import { openProjectLibrary } from '../../../src/lib/persistence/project-library';
import { generateCapacityProject } from '../../fixtures/capacity-project';

import type { CapacityScale } from '../../fixtures/capacity-project';

function deleteProjectLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(PROJECT_LIBRARY_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Project Library deletion was blocked'));
  });
}

function deterministicAssetBytes(byteLength: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * 31 + seed * 17) % 251;
  }

  return bytes;
}

export async function runExchangeGate() {
  const results = [];
  const assetSizes = {
    1: [64 * 1024],
    2: [512 * 1024],
    5: [6 * 1024 * 1024, 6 * 1024 * 1024]
  } as const;
  await deleteProjectLibrary();

  for (const scale of [1, 2, 5] as const satisfies readonly CapacityScale[]) {
    const project = generateCapacityProject(scale);
    const assets = assetSizes[scale].map((byteLength, index) => ({
      mimeType: index % 2 === 0 ? ('image/png' as const) : ('image/jpeg' as const),
      bytes: deterministicAssetBytes(byteLength, scale + index)
    }));
    const encodeStartedAt = performance.now();
    const envelope = await createProjectExchange({
      project,
      assets,
      exportedAt: '2026-09-01T00:00:00Z'
    });
    const encoded = JSON.stringify(envelope);
    const encodeMs = performance.now() - encodeStartedAt;
    const blob = new Blob([encoded], { type: 'application/json' });
    const stageStartedAt = performance.now();
    const staged = await stageExchange(blob, MEASURED_EXCHANGE_LIMITS);
    const stageTotalMs = performance.now() - stageStartedAt;
    if (!staged.staged) throw new Error(`${staged.reason}: ${staged.message}`);

    const library = await openProjectLibrary();
    const commitStartedAt = performance.now();
    const saveOutcome = await commitStagedExchange(staged, 'replace', library);
    const commitMs = performance.now() - commitStartedAt;
    library.close();

    const reopened = await openProjectLibrary();
    const recovered = await reopened.loadProject(staged.envelope.payload.project.id);
    const persistedAssetCount = await reopened.countAssets();
    reopened.close();
    results.push({
      scale,
      componentCount: staged.envelope.payload.topology.components.length,
      portCount: staged.envelope.payload.topology.components.reduce(
        (count, component) => count + component.ports.length,
        0
      ),
      connectionCount: staged.envelope.payload.topology.connections.length,
      envelopeBytes: blob.size,
      originalAssetBytes: staged.summary.originalAssetBytes,
      assetCount: staged.summary.assetCount,
      encodeMs,
      stageTotalMs,
      parseMs: staged.measurements.parseMs,
      validationMs: staged.measurements.validationMs,
      hashingMs: staged.measurements.hashingMs,
      cloneMs: staged.measurements.cloneMs,
      commitMs,
      estimatedPeakBytes: staged.measurements.estimatedPeakBytes,
      estimatedPhasePeakBytes: staged.measurements.estimatedPhasePeakBytes,
      maxNestingDepth: staged.measurements.maxNestingDepth,
      collectionEntries: staged.measurements.collectionEntries,
      saved: saveOutcome.committed,
      assetWrites: saveOutcome.committed ? staged.summary.assetCount : -1,
      persistedAssetCount,
      recoveredExactly: JSON.stringify(recovered) === JSON.stringify(staged.envelope.payload)
    });
  }

  return { limits: MEASURED_EXCHANGE_LIMITS, results };
}
