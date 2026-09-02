import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PROJECT_LIBRARY_DATABASE_NAME } from '../../src/lib/persistence/database-schema';
import { openProjectLibrary } from '../../src/lib/persistence/project-library';
import { projectDocumentSchema } from '../../src/lib/persistence/project-document';
import { generateCapacityProject } from '../fixtures/capacity-project';
import {
  generateRx7CapacityProject,
  RX7_CAPACITY_ASSETS,
  RX7_CAPACITY_COUNTS
} from '../fixtures/rx7-capacity-project';

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

describe('MVP-DATA-006 MVP-GATE-003 whole-snapshot persistence', () => {
  it.each([1, 2, 5] as const)('validates the generated %sx fixture', (scale) => {
    const snapshot = projectDocumentSchema.parse(generateRx7CapacityProject(scale));
    expect(snapshot.topology.components).toHaveLength(RX7_CAPACITY_COUNTS[scale].components);
    expect(snapshot.topology.components.flatMap((component) => component.ports)).toHaveLength(
      RX7_CAPACITY_COUNTS[scale].ports
    );
    expect(snapshot.topology.connections).toHaveLength(RX7_CAPACITY_COUNTS[scale].connections);
  });

  it.each([1, 2, 5] as const)('saves and recovers the whole %sx snapshot', async (scale) => {
    const snapshot = generateRx7CapacityProject(scale);
    const library = await openProjectLibrary();
    const outcome = await library.saveProject({
      projectId: snapshot.project.id,
      expectedRevision: null,
      snapshot,
      newAssets: RX7_CAPACITY_ASSETS
    });
    expect(outcome).toEqual({ saved: true, revision: 42, assetWrites: 1 });
    library.close();

    const reopened = await openProjectLibrary();
    expect(await reopened.loadProject(snapshot.project.id)).toEqual(snapshot);
    reopened.close();
  });

  it('rejects a stale expected revision without replacing the current snapshot', async () => {
    const snapshot = generateCapacityProject(1);
    const library = await openProjectLibrary();
    await library.saveProject({
      projectId: snapshot.project.id,
      expectedRevision: null,
      snapshot,
      newAssets: []
    });

    const changed = structuredClone(snapshot);
    changed.project.revision = 2;
    changed.project.name = 'Stale write';
    expect(
      await library.saveProject({
        projectId: snapshot.project.id,
        expectedRevision: 0,
        snapshot: changed,
        newAssets: []
      })
    ).toEqual({ saved: false, reason: 'revision-conflict', currentRevision: 1 });
    expect((await library.loadProject(snapshot.project.id))?.project.name).toBe('Capacity 1x');
    library.close();
  });

  it('creates an immutable recovery checkpoint from the current snapshot', async () => {
    const snapshot = generateCapacityProject(1);
    const library = await openProjectLibrary();
    await library.saveProject({
      projectId: snapshot.project.id,
      expectedRevision: null,
      snapshot,
      newAssets: []
    });

    const checkpoint = await library.createCheckpoint({
      projectId: snapshot.project.id,
      reason: 'gate-baseline'
    });
    expect(checkpoint.created).toBe(true);
    expect(await library.listCheckpoints(snapshot.project.id)).toEqual([
      expect.objectContaining({
        projectId: snapshot.project.id,
        projectRevision: 1,
        reason: 'gate-baseline',
        snapshot
      })
    ]);
    library.close();
  });

  it('deduplicates hash-addressed asset bytes across whole-snapshot writes', async () => {
    const library = await openProjectLibrary();
    const asset = {
      sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      mimeType: 'image/png',
      bytes: new Uint8Array([137, 80, 78, 71])
    };
    const first = generateCapacityProject(1);
    const second = generateCapacityProject(2);

    expect(
      await library.saveProject({
        projectId: first.project.id,
        expectedRevision: null,
        snapshot: first,
        newAssets: [asset]
      })
    ).toEqual({ saved: true, revision: 1, assetWrites: 1 });
    expect(
      await library.saveProject({
        projectId: second.project.id,
        expectedRevision: null,
        snapshot: second,
        newAssets: [asset]
      })
    ).toEqual({ saved: true, revision: 1, assetWrites: 0 });
    expect(await library.countAssets()).toBe(1);
    library.close();
  });

  it('reports quota failure and retains the prior durable revision', async () => {
    const snapshot = generateCapacityProject(1);
    const library = await openProjectLibrary();
    await library.saveProject({
      projectId: snapshot.project.id,
      expectedRevision: null,
      snapshot,
      newAssets: []
    });
    const changed = structuredClone(snapshot);
    changed.project.revision = 2;
    changed.project.name = 'Must not persist';
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Quota exhausted', 'QuotaExceededError');
    });

    expect(
      await library.saveProject({
        projectId: snapshot.project.id,
        expectedRevision: 1,
        snapshot: changed,
        newAssets: []
      })
    ).toEqual({ saved: false, reason: 'quota-exceeded' });
    expect((await library.loadProject(snapshot.project.id))?.project).toEqual(snapshot.project);
    library.close();
  });
});
