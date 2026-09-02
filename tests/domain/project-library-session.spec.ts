import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { applyProjectAction } from '../../src/lib/project/apply-action';
import { createBlankProject } from '../../src/lib/project/project';
import { PROJECT_LIBRARY_DATABASE_NAME } from '../../src/lib/persistence/database-schema';
import {
  projectDocumentSchema,
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

function putRawStoredProject(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PROJECT_LIBRARY_DATABASE_NAME);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('projects', 'readwrite');
      transaction.objectStore('projects').put(value);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

beforeEach(async () => {
  await deleteProjectLibrary();
});

describe('MVP-ARCH-003 persisted and live project boundaries', () => {
  it('MVP-DATA-006 persists the complete aggregate without generated Overlay marks', () => {
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
    snapshot = {
      ...snapshot,
      results: [
        {
          id: 'result-generated-overlay',
          sourceRevision: snapshot.revision,
          status: 'current',
          kind: 'overlay',
          detail: {
            type: 'overlay',
            overlay: {
              id: 'overlay-generated',
              operatingStateId: 'state-transient',
              operatingStateName: 'Transient state',
              sourceRevision: snapshot.revision,
              inputFingerprint: 'a'.repeat(64),
              status: 'current',
              systems: [],
              marks: []
            }
          }
        }
      ]
    };

    const document = projectSnapshotToDocument(snapshot);
    expect(document).not.toBe(snapshot);
    expect(document).toMatchObject({
      schemaVersion: 8,
      project: { id: 'project-round-trip', revision: 3 },
      topology: {
        systems: [{ id: 'system-coolant', mediumId: 'medium-coolant' }],
        components: [{ id: 'component-pump', position: { x: '12.5', y: '-4' } }]
      },
      evidence: [{ id: 'evidence-pump-label', state: 'known' }],
      results: []
    });
    expect(projectDocumentToSnapshot(structuredClone(document))).toEqual({
      ...snapshot,
      results: []
    });
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

describe('Milestone 5 Project Library recovery records', () => {
  it('MVP-DATA-007 MVP-DATA-008 restores an immutable Named Snapshot through a checkpoint', async () => {
    const library = await openProjectLibrary();
    const created = await library.createBlankProject({
      id: 'project-named-snapshot',
      name: 'Named snapshot source',
      createdAt: '2026-09-01T00:00:00Z'
    });
    if (!created.created) throw new Error(created.reason);

    await expect(
      library.createNamedSnapshot({
        id: 'named-before-change',
        projectId: created.snapshot.id,
        name: 'Before change',
        note: 'Known rollback point',
        createdAt: '2026-09-01T01:00:00Z'
      })
    ).resolves.toMatchObject({ created: true, projectRevision: 0 });
    await library.updateNamedSnapshotMetadata({
      id: 'named-before-change',
      name: 'Before change renamed',
      note: 'Metadata may change; content may not.'
    });

    const renamed = accept(created.snapshot, {
      type: 'rename-project',
      causationId: 'rename-after-named-snapshot',
      name: 'Changed after snapshot'
    });
    await expect(
      library.saveProject({
        projectId: renamed.id,
        expectedRevision: 0,
        snapshot: projectSnapshotToDocument(renamed),
        newAssets: []
      })
    ).resolves.toMatchObject({ saved: true, revision: 1 });

    await expect(
      library.restoreNamedSnapshot({
        id: 'named-before-change',
        checkpointId: 'checkpoint-before-restore',
        restoredAt: '2026-09-01T02:00:00Z'
      })
    ).resolves.toMatchObject({ restored: true, projectId: created.snapshot.id, revision: 2 });
    expect(await library.openProject(created.snapshot.id)).toMatchObject({
      id: created.snapshot.id,
      name: 'Named snapshot source',
      revision: 2
    });
    expect(await library.listNamedSnapshots(created.snapshot.id)).toMatchObject([
      {
        id: 'named-before-change',
        name: 'Before change renamed',
        note: 'Metadata may change; content may not.',
        projectRevision: 0,
        snapshot: { project: { revision: 0, name: 'Named snapshot source' } }
      }
    ]);
    expect(await library.listCheckpoints(created.snapshot.id)).toMatchObject([
      {
        id: 'checkpoint-before-restore',
        reason: 'before-named-snapshot-restore',
        projectRevision: 1,
        snapshot: { project: { revision: 1, name: 'Changed after snapshot' } }
      }
    ]);
    library.close();
  });

  it('MVP-DATA-009 retains Trash and prunes only out-of-policy Recovery Checkpoints', async () => {
    const library = await openProjectLibrary();
    const created = await library.createBlankProject({
      id: 'project-trash-retention',
      name: 'Trash retention',
      createdAt: '2026-08-01T00:00:00Z'
    });
    if (!created.created) throw new Error(created.reason);

    for (let day = 0; day < 35; day += 1) {
      await library.createCheckpoint({
        checkpointId: `checkpoint-${day}`,
        projectId: created.snapshot.id,
        reason: 'retention-fixture',
        createdAt: new Date(Date.UTC(2026, 7, day + 1, 12)).toISOString()
      });
    }
    const cleanup = await library.reclaimDisposableRecords({ now: '2026-09-05T12:00:00Z' });
    expect(cleanup.deletedCheckpoints).toBe(5);
    expect(await library.listCheckpoints(created.snapshot.id)).toHaveLength(30);

    await expect(
      library.trashProject({
        projectId: created.snapshot.id,
        trashId: 'trash-project',
        deletedAt: '2026-09-05T12:00:00Z'
      })
    ).resolves.toMatchObject({ trashed: true });
    expect(await library.listProjects()).toEqual([]);
    expect(await library.listTrash()).toMatchObject([
      { id: 'trash-project', kind: 'project', sourceId: created.snapshot.id }
    ]);

    await expect(library.restoreTrash('trash-project')).resolves.toMatchObject({ restored: true });
    expect(await library.openProject(created.snapshot.id)).toMatchObject({
      id: created.snapshot.id,
      revision: 0
    });
    library.close();
  });

  it('MVP-DATA-001 MVP-DATA-017 keeps template revisions immutable and project copies independent', async () => {
    const library = await openProjectLibrary();
    try {
      const created = await library.createBlankProject({
        id: 'project-template-copy',
        name: 'Template copy project',
        createdAt: '2026-09-01T00:00:00Z'
      });
      if (!created.created) throw new Error(created.reason);

      await expect(
        library.createTemplateRevision({
          templateId: 'template-pump',
          revision: 1,
          label: 'Pump template',
          createdAt: '2026-09-01T01:00:00Z',
          definition: {
            id: 'template-pump-definition',
            label: 'Pump definition',
            revision: 1,
            provenance: 'Recorded template source'
          }
        })
      ).resolves.toEqual({ created: true });
      await expect(
        library.createTemplateRevision({
          templateId: 'template-pump',
          revision: 1,
          label: 'Attempted overwrite',
          createdAt: '2026-09-01T02:00:00Z',
          definition: {
            id: 'template-pump-definition-overwrite',
            label: 'Overwritten definition',
            revision: 1,
            provenance: 'Must not replace revision one'
          }
        })
      ).resolves.toEqual({ created: false, reason: 'already-exists' });

      const copied = await library.copyTemplateDefinition({
        templateId: 'template-pump',
        revision: 1,
        definitionId: 'project-pump-definition'
      });
      expect(copied).toMatchObject({
        copied: true,
        definition: {
          id: 'project-pump-definition',
          label: 'Pump definition',
          revision: 1,
          provenance: expect.stringContaining('template-pump revision 1')
        }
      });
      if (!copied.copied) throw new Error(copied.reason);
      const withCopy = accept(created.snapshot, {
        type: 'add-part-definition',
        causationId: 'copy-template-definition',
        definition: copied.definition
      });
      await library.saveProject({
        projectId: withCopy.id,
        expectedRevision: 0,
        snapshot: projectSnapshotToDocument(withCopy),
        newAssets: []
      });

      await library.createTemplateRevision({
        templateId: 'template-pump',
        revision: 2,
        label: 'Pump template revised',
        createdAt: '2026-09-01T03:00:00Z',
        definition: {
          id: 'template-pump-definition-v2',
          label: 'Pump definition revised',
          revision: 2,
          provenance: 'Later template source'
        }
      });
      await library.trashTemplate({
        templateId: 'template-pump',
        trashId: 'trash-template-pump',
        deletedAt: '2026-09-01T04:00:00Z'
      });
      expect(await library.listTemplateRevisions('template-pump')).toEqual([]);
      expect(await library.openProject(created.snapshot.id)).toMatchObject({
        partDefinitions: [
          {
            id: 'project-pump-definition',
            label: 'Pump definition',
            revision: 1
          }
        ]
      });
      await library.restoreTrash('trash-template-pump');
      expect(await library.listTemplateRevisions('template-pump')).toHaveLength(2);
    } finally {
      library.close();
    }
  });

  it('MVP-DATA-010 previews cancel or atomic replacement and retains a guarded rollback', async () => {
    const library = await openProjectLibrary();
    try {
      const original = await library.createBlankProject({
        id: 'project-before-backup',
        name: 'Before backup',
        createdAt: '2026-09-01T00:00:00Z'
      });
      if (!original.created) throw new Error(original.reason);
      await library.createNamedSnapshot({
        id: 'named-in-backup',
        projectId: original.snapshot.id,
        name: 'Named in backup',
        note: '',
        createdAt: '2026-09-01T00:30:00Z'
      });
      const backup = await library.createLibraryBackup({
        createdAt: '2026-09-01T01:00:00Z'
      });

      const later = await library.createBlankProject({
        id: 'project-after-backup',
        name: 'After backup',
        createdAt: '2026-09-01T02:00:00Z'
      });
      if (!later.created) throw new Error(later.reason);
      expect(library.previewLibraryBackup(backup.payload)).toMatchObject({
        valid: true,
        projectCount: 1,
        namedSnapshotCount: 1,
        defaultDecision: 'cancel'
      });
      await expect(
        library.restoreLibraryBackup({
          payload: backup.payload,
          decision: 'cancel',
          activeGenerationId: 'generation-canceled',
          rollbackGenerationId: 'rollback-canceled',
          restoredAt: '2026-09-01T03:00:00Z'
        })
      ).resolves.toEqual({ restored: false, reason: 'canceled' });
      expect(await library.openProject(later.snapshot.id)).toBeDefined();

      await expect(
        library.restoreLibraryBackup({
          payload: backup.payload,
          decision: 'replace',
          activeGenerationId: 'generation-restored',
          rollbackGenerationId: 'rollback-before-restore',
          restoredAt: '2026-09-01T03:00:00Z'
        })
      ).resolves.toMatchObject({ restored: true, projectCount: 1 });
      expect(await library.openProject(original.snapshot.id)).toBeDefined();
      expect(await library.openProject(later.snapshot.id)).toBeUndefined();
      expect(await library.listRollbackGenerations()).toMatchObject([
        {
          id: 'rollback-before-restore',
          replacementOpenedAt: null,
          laterBackupAt: null
        }
      ]);

      await library.markReplacementOpened('2026-09-01T04:00:00Z');
      await library.createLibraryBackup({ createdAt: '2026-09-02T04:00:00Z' });
      await expect(
        library.reclaimRollbackGenerations({ now: '2026-09-07T02:59:59Z' })
      ).resolves.toEqual({ deletedGenerations: 0 });
      await expect(
        library.reclaimRollbackGenerations({ now: '2026-09-08T03:00:00Z' })
      ).resolves.toEqual({ deletedGenerations: 1 });
    } finally {
      library.close();
    }
  });

  it('MVP-DATA-016 MVP-DATA-019 quarantines invalid records and reports bounded copy reminders', async () => {
    const library = await openProjectLibrary();
    try {
      const created = await library.createBlankProject({
        id: 'project-reminder',
        name: 'Reminder project',
        createdAt: '2026-09-01T00:00:00Z'
      });
      if (!created.created) throw new Error(created.reason);
      await putRawStoredProject({
        projectId: 'project-corrupt',
        revision: 0,
        snapshot: { schemaVersion: 999, project: { id: 'project-corrupt' } }
      });

      expect(await library.listProjects()).toMatchObject([{ id: created.snapshot.id }]);
      const quarantine = await library.listQuarantine();
      expect(quarantine).toMatchObject([
        {
          sourceKind: 'stored-project',
          sourceId: 'project-corrupt',
          reason: expect.stringContaining('invalid')
        }
      ]);
      expect(await library.exportQuarantinedRaw(quarantine[0]!.id)).toContain(
        '"schemaVersion":999'
      );

      const revisionOneHundred = projectDocumentSchema.parse({
        ...projectSnapshotToDocument(created.snapshot),
        project: {
          ...projectSnapshotToDocument(created.snapshot).project,
          revision: 100
        }
      });
      await library.saveProject({
        projectId: created.snapshot.id,
        expectedRevision: 0,
        snapshot: revisionOneHundred,
        newAssets: []
      });
      await expect(
        library.readBackupHealth({ now: '2026-09-09T00:00:00Z' })
      ).resolves.toMatchObject({
        lastLibraryBackupAt: null,
        reminders: ['backup-overdue', 'substantial-editing']
      });
      await library.recordProjectExport({
        projectId: created.snapshot.id,
        exportedAt: '2026-09-09T01:00:00Z'
      });
      await library.setMigrationPending(true);
      expect(await library.readBackupHealth({ now: '2026-09-09T02:00:00Z' })).toMatchObject({
        lastProjectExports: [
          { projectId: created.snapshot.id, exportedAt: '2026-09-09T01:00:00Z' }
        ],
        reminders: ['backup-overdue', 'migration-pending'],
        deviceLossBoundary: 'downloaded-library-backup'
      });
    } finally {
      library.close();
    }
  });
});
