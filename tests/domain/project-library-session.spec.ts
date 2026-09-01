import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { applyProjectAction } from '../../src/lib/project/apply-action';
import { createBlankProject } from '../../src/lib/project/project';
import { PROJECT_LIBRARY_DATABASE_NAME } from '../../src/lib/persistence/database-schema';
import {
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from '../../src/lib/persistence/project-document';
import { openProjectLibrary } from '../../src/lib/persistence/project-library';
import { createWritablePersistedSessionBacking } from '../../src/lib/persistence/persisted-session-backing';
import { createProjectSession } from '../../src/lib/session/project-session.svelte';

import type { ProjectAction } from '../../src/lib/project/action';
import type { ProjectSnapshot } from '../../src/lib/project/project';
import type { ProjectLease } from '../../src/lib/persistence/project-lease';

function accept(snapshot: ProjectSnapshot, action: ProjectAction): ProjectSnapshot {
  const outcome = applyProjectAction(snapshot, action);
  if (!outcome.accepted) throw new Error(outcome.rejection.message);
  return outcome.snapshot;
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

describe('MVP-ARCH-003 persisted and live project boundaries', () => {
  it('round-trips the complete current aggregate through the strict document mapper', () => {
    let snapshot = createBlankProject({
      id: 'project-round-trip',
      name: 'Round-trip fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    snapshot = accept(snapshot, {
      type: 'add-fluid-system',
      causationId: 'cause-system',
      system: {
        id: 'system-coolant',
        label: 'Coolant',
        domain: 'fluid',
        mediumId: 'medium-coolant'
      },
      medium: {
        id: 'medium-coolant',
        label: 'Coolant',
        composition: 'coolant fixture medium',
        provenance: 'independent persistence fixture'
      },
      purpose: 'round-trip coolant'
    });
    snapshot = accept(snapshot, {
      type: 'add-component',
      causationId: 'cause-component',
      component: {
        id: 'component-pump',
        label: 'Pump',
        kind: 'part',
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '12.5', y: '-4' },
        ports: [
          {
            id: 'port-pump-out',
            componentId: 'component-pump',
            label: 'Outlet',
            domain: 'fluid',
            mediumId: 'medium-coolant',
            interfaceKey: 'barb-16mm'
          }
        ]
      }
    });
    snapshot = accept(snapshot, {
      type: 'record-evidence',
      causationId: 'cause-evidence',
      evidence: {
        id: 'evidence-pump-label',
        subjectId: 'component-pump',
        label: 'Pump label',
        state: 'known',
        value: 'asset-label-photo',
        unit: null,
        provenance: 'user-recorded',
        conflictValues: []
      }
    });

    const document = projectSnapshotToDocument(snapshot);
    expect(document).not.toBe(snapshot);
    expect(document).toMatchObject({
      schemaVersion: 5,
      project: { id: 'project-round-trip', revision: 3 },
      topology: {
        systems: [{ id: 'system-coolant', mediumId: 'medium-coolant' }],
        components: [{ id: 'component-pump', position: { x: '12.5', y: '-4' } }]
      },
      evidence: [{ id: 'evidence-pump-label', state: 'known' }]
    });
    expect(projectDocumentToSnapshot(structuredClone(document))).toEqual(snapshot);
  });

  it('creates, lists, and reopens a blank project through the concrete browser library', async () => {
    const library = await openProjectLibrary();
    const created = await library.createBlankProject({
      id: 'project-blank',
      name: 'Blank vehicle',
      createdAt: '2026-09-01T00:00:00Z'
    });

    expect(created).toMatchObject({
      created: true,
      snapshot: { id: 'project-blank', revision: 0 }
    });
    expect(await library.listProjects()).toEqual([
      {
        id: 'project-blank',
        name: 'Blank vehicle',
        revision: 0,
        createdAt: '2026-09-01T00:00:00Z'
      }
    ]);
    expect(await library.openProject('project-blank')).toEqual(
      createBlankProject({
        id: 'project-blank',
        name: 'Blank vehicle',
        createdAt: '2026-09-01T00:00:00Z'
      })
    );
    library.close();
  });

  it('persists an accepted session revision through the production browser backing', async () => {
    const library = await openProjectLibrary();
    const created = await library.createBlankProject({
      id: 'project-session-save',
      name: 'Before session',
      createdAt: '2026-09-01T00:00:00Z'
    });
    if (!created.created) throw new Error(created.reason);
    let released = false;
    const lease: ProjectLease = {
      projectId: created.snapshot.id,
      onTakeoverRequested() {
        return () => undefined;
      },
      async release() {
        released = true;
      }
    };
    const session = createProjectSession({
      initialSnapshot: created.snapshot,
      backing: createWritablePersistedSessionBacking({
        library,
        lease,
        durableRevision: created.snapshot.revision
      }),
      evaluation: {
        schedule() {},
        close() {}
      },
      presentation: 'desktop',
      runtimeCapabilities: { indexedDb: true, webWorker: true, webLocks: true },
      initialAssets: [],
      undoLimit: 20,
      autosaveDelayMs: 60_000
    });
    session.execute({
      type: 'rename-project',
      causationId: 'cause-persisted-name',
      name: 'After session'
    });

    await expect(session.flush('explicit')).resolves.toEqual({ saved: true, revision: 1 });
    await session.close();
    expect(released).toBe(true);
    expect(await library.openProject(created.snapshot.id)).toMatchObject({
      id: 'project-session-save',
      name: 'After session',
      revision: 1
    });
    library.close();
  });
});
