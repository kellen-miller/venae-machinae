import { PROJECT_LIBRARY_DATABASE_NAME } from '../../../src/lib/persistence/database-schema';
import { openProjectLibrary } from '../../../src/lib/persistence/project-library';
import { projectDocumentSchema } from '../../../src/lib/persistence/project-document';
import {
  generateRx7CapacityProject,
  RX7_CAPACITY_ASSETS
} from '../../fixtures/rx7-capacity-project';

import type { Rx7CapacityScale } from '../../fixtures/rx7-capacity-project';

function deleteProjectLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(PROJECT_LIBRARY_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function runPersistenceGate() {
  await deleteProjectLibrary();
  let library = await openProjectLibrary();
  const measurements = [];

  for (const scale of [1, 2, 5] as const satisfies readonly Rx7CapacityScale[]) {
    const snapshot = generateRx7CapacityProject(scale);
    const serializationStartedAt = performance.now();
    const serialized = JSON.stringify(snapshot);
    const serializationMs = performance.now() - serializationStartedAt;
    const validationStartedAt = performance.now();
    projectDocumentSchema.parse(JSON.parse(serialized));
    const validationMs = performance.now() - validationStartedAt;
    const cloneStartedAt = performance.now();
    structuredClone(snapshot);
    const cloneMs = performance.now() - cloneStartedAt;
    const saveStartedAt = performance.now();
    const saveOutcome = await library.saveProject({
      projectId: snapshot.project.id,
      expectedRevision: null,
      snapshot,
      newAssets: RX7_CAPACITY_ASSETS
    });
    const saveMs = performance.now() - saveStartedAt;
    library.close();

    const reopenStartedAt = performance.now();
    library = await openProjectLibrary();
    const recovered = await library.loadProject(snapshot.project.id);
    const reopenAndLoadMs = performance.now() - reopenStartedAt;
    measurements.push({
      scale,
      componentCount: snapshot.topology.components.length,
      portCount: snapshot.topology.components.reduce(
        (count, component) => count + component.ports.length,
        0
      ),
      connectionCount: snapshot.topology.connections.length,
      serializedBytes: new TextEncoder().encode(serialized).byteLength,
      serializationMs,
      validationMs,
      cloneMs,
      saveMs,
      reopenAndLoadMs,
      saved: saveOutcome.saved,
      assetWrites: saveOutcome.saved ? saveOutcome.assetWrites : -1,
      recoveredExactly: JSON.stringify(recovered) === serialized
    });
  }

  const firstProject = generateRx7CapacityProject(1);
  const checkpoint = await library.createCheckpoint({
    projectId: firstProject.project.id,
    reason: 'gate-browser-baseline'
  });
  const checkpoints = await library.listCheckpoints(firstProject.project.id);
  const assetCount = await library.countAssets();
  library.close();
  await deleteProjectLibrary();

  return {
    measurements,
    checkpointCreated: checkpoint.created,
    checkpointCount: checkpoints.length,
    checkpointRecoveredExactly:
      checkpoints.length === 1 &&
      JSON.stringify(checkpoints[0]?.snapshot) === JSON.stringify(firstProject),
    assetCount
  };
}
