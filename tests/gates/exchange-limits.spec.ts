import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  commitStagedExchange,
  commitStagedLibraryBackupExchange,
  commitStagedTemplateExchange
} from '../../src/lib/exchange/commit-exchange';
import {
  createLibraryBackupExchange,
  createProjectExchange,
  createTemplateExchange,
  libraryBackupExchangeEnvelopeSchema,
  projectExchangeEnvelopeSchema,
  templateExchangeEnvelopeSchema
} from '../../src/lib/exchange/project-exchange';
import { MEASURED_EXCHANGE_LIMITS } from '../../src/lib/exchange/measured-limits';
import {
  stageExchange,
  stageLibraryBackupExchange,
  stageTemplateExchange
} from '../../src/lib/exchange/stage-exchange';
import { canonicalJson, sha256Hex } from '../../src/lib/exchange/canonical-json';
import {
  migrateProjectDocument,
  RELEASED_PROJECT_DOCUMENT_MIGRATIONS
} from '../../src/lib/exchange/project-document-migration';
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
    project.partDefinitions.push({
      id: 'definition-original',
      label: 'Original definition',
      revision: 1,
      provenance: 'Entered source'
    });
    project.topology.components[0]!.definitionId = 'definition-original';
    project.evidence.push({
      id: 'evidence-original',
      subjectId: 'component-1x-0',
      label: 'Observed current',
      state: 'known',
      value: '8.2',
      unit: 'A',
      provenance: 'Bench measurement',
      conflictValues: []
    });
    project.operatingStates.push({
      id: 'state-original',
      name: 'Run',
      description: 'Copy identity fixture',
      commands: [
        {
          id: 'statement-original',
          subjectId: 'component-1x-0',
          label: 'Command',
          value: 'on',
          unit: null,
          provenance: 'Entered command'
        }
      ],
      conditions: [],
      measurements: [],
      assumptions: [],
      applicableEvidenceIds: ['evidence-original'],
      bindings: [
        {
          id: 'binding-original',
          subjectId: 'connection-1x-0',
          systemId: 'system-capacity-power',
          channel: 'current',
          evidenceState: 'known',
          value: '8.2',
          unit: 'A',
          direction: 'source-to-load',
          referenceSubjectId: 'component-1x-0',
          pathConnectionIds: ['connection-1x-0'],
          behavior: {
            id: 'binding-behavior-original',
            componentId: 'component-1x-0',
            description: 'Closed path',
            provenance: 'Entered behavior'
          },
          calculationResultId: 'result-original',
          evidenceIds: ['evidence-original'],
          assumptions: ['steady DC'],
          omissions: [],
          applicability: 'Run',
          uncertainty: null,
          conflictValues: [],
          provenance: ['Bench measurement']
        }
      ]
    });
    project.calculations.push({
      id: 'calculation-original',
      subjectId: 'connection-1x-0',
      operatingStateId: 'state-original',
      formulaId: 'electrical.voltage-drop.v1',
      pathId: null,
      inputs: [
        {
          name: 'current',
          quantity: {
            id: 'quantity-original',
            semantic: 'electric-current',
            decimal: '8.2',
            unit: 'ampere',
            applicability: 'Run',
            uncertainty: null,
            bounds: null,
            origin: 'measured',
            provenance: 'Bench measurement'
          }
        }
      ],
      assumptions: ['steady DC'],
      conditions: {},
      omissions: [],
      desiredOutputUnit: 'volt'
    });
    project.electrical.circuits.push({
      id: 'circuit-original',
      label: 'Feed',
      systemId: 'system-capacity-power',
      connectionIds: ['connection-1x-0'],
      componentIds: ['component-1x-0'],
      protectionComponentIds: []
    });
    project.fluid.behaviors.push({
      id: 'fluid-behavior-original',
      componentId: 'component-1x-1',
      role: 'passage',
      portIds: ['port-1x-5'],
      mediumIds: ['medium-capacity-fluid'],
      description: 'Fluid passage',
      provenance: 'Entered behavior'
    });
    project.results.push({
      id: 'result-original',
      sourceRevision: 1,
      status: 'current',
      kind: 'validation',
      detail: {
        type: 'validation',
        history: {
          findings: [
            {
              id: 'finding-original',
              ruleId: 'topology.interface-conflict',
              ruleRevision: 1,
              subjectId: 'connection-1x-0',
              scopeKey: 'incremental',
              claim: 'Review the connection',
              severity: 'warning',
              severityRationale: 'Connection evidence is incomplete.',
              evaluation: 'current',
              lifecycle: 'active',
              unknownReason: null,
              knownEvidence: ['Known connection'],
              unknownEvidence: [],
              affectedOperation: 'topology review',
              inputIds: ['evidence-original'],
              assumptions: [],
              trace: {
                ruleId: 'topology.interface-conflict',
                ruleRevision: 1,
                subjectId: 'connection-1x-0',
                scopeKey: 'incremental',
                inputIds: ['evidence-original'],
                evidenceIds: ['evidence-original'],
                resultIds: [],
                assumptions: [],
                tombstone: null
              },
              disposition: {
                kind: 'suppressed',
                ruleId: 'topology.interface-conflict',
                ruleRevision: 1,
                subjectId: 'connection-1x-0',
                scopeKey: 'incremental',
                occurrenceNumber: 1,
                recordedAtRevision: 1,
                rationale: 'Reviewed before copy',
                invalidationKey: '0123456789abcdef'
              },
              occurrences: [
                {
                  number: 1,
                  openedAtRevision: 1,
                  resolvedAtRevision: null,
                  resolutionReason: null
                }
              ],
              correctiveActions: ['Review connector evidence.'],
              invalidationKey: '0123456789abcdef'
            }
          ],
          runs: [
            {
              id: 'validation-run-original',
              projectRevision: 1,
              scope: { kind: 'incremental', subjectIds: ['connection-1x-0'] },
              scopeKey: 'incremental',
              profileId: null,
              status: 'current',
              evaluatedAt: '2026-09-01T00:00:00Z',
              ruleIds: ['topology.interface-conflict'],
              findingIds: ['finding-original'],
              coverage: null
            }
          ],
          currentRunIds: ['validation-run-original']
        }
      }
    });
    project.validationApplicabilityDecisions.push({
      ruleId: 'build.route-defined',
      subjectId: 'connection-1x-0',
      scopeKey: 'profile:build-preparation',
      classification: 'excluded',
      rationale: 'Reviewed before copy',
      evidenceIds: ['evidence-original'],
      recordedAtRevision: 1
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
    expect(copied?.electrical.circuits[0]).toMatchObject({
      id: expect.not.stringMatching(/^circuit-original$/),
      systemId: copied?.topology.systems[0]?.id,
      connectionIds: [copied?.topology.connections[0]?.id],
      componentIds: [copied?.topology.components[0]?.id]
    });
    expect(copied?.fluid.behaviors[0]).toMatchObject({
      id: expect.not.stringMatching(/^fluid-behavior-original$/),
      componentId: copied?.topology.components[1]?.id,
      portIds: [copied?.topology.components[1]?.ports[0]?.id],
      mediumIds: [copied?.fluid.media[0]?.id]
    });
    expect(copied?.calculations[0]).toMatchObject({
      id: expect.not.stringMatching(/^calculation-original$/),
      subjectId: copied?.topology.connections[0]?.id,
      operatingStateId: copied?.operatingStates[0]?.id,
      inputs: [
        {
          quantity: {
            id: expect.not.stringMatching(/^quantity-original$/),
            provenance: expect.stringContaining('capacity-project-1x')
          }
        }
      ]
    });
    expect(copied?.operatingStates[0]?.bindings[0]).toMatchObject({
      id: expect.not.stringMatching(/^binding-original$/),
      subjectId: copied?.topology.connections[0]?.id,
      calculationResultId: copied?.results[0]?.id,
      evidenceIds: [copied?.evidence[0]?.id]
    });
    const validation = copied?.results[0]?.detail;
    expect(copied?.results[0]).toMatchObject({
      id: expect.not.stringMatching(/^result-original$/),
      status: 'stale',
      sourceRevision: 1
    });
    expect(validation?.type === 'validation' ? validation.history : null).toMatchObject({
      findings: [
        {
          id: expect.not.stringMatching(/^finding-original$/),
          subjectId: copied?.topology.connections[0]?.id,
          evaluation: 'stale',
          disposition: { kind: 'unreviewed' }
        }
      ],
      runs: [{ id: expect.not.stringMatching(/^validation-run-original$/), status: 'stale' }],
      currentRunIds: []
    });
    expect(copied?.validationApplicabilityDecisions).toEqual([]);
    expect(copied?.partDefinitions[0]?.provenance).toContain('capacity-project-1x');
    expect(copied?.evidence[0]?.provenance).toContain('capacity-project-1x');
    expect(await library.loadProject('capacity-project-1x')).toBeUndefined();
    library.close();
  });

  it('MVP-DATA-011 stages strict self-contained template and Library Backup envelopes', async () => {
    const library = await openProjectLibrary();
    await library.createTemplateRevision({
      templateId: 'template-fuse',
      revision: 1,
      label: 'Fuse',
      createdAt: '2026-09-01T00:00:00Z',
      definition: {
        id: 'definition-fuse',
        label: 'Fuse',
        revision: 1,
        provenance: 'Entered from manufacturer data'
      }
    });
    const templateRevisions = await library.listTemplateRevisions('template-fuse');
    const templateEnvelope = await createTemplateExchange({
      templateRevisions,
      assets: [
        {
          mimeType: 'image/webp',
          bytes: new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80])
        }
      ],
      exportedAt: '2026-09-01T01:00:00Z'
    });

    expect(templateExchangeEnvelopeSchema.parse(structuredClone(templateEnvelope))).toMatchObject({
      format: 'venae-templates',
      exchangeVersion: 1,
      identity: { templateIds: ['template-fuse'], latestRevision: 1 },
      payload: { schemaVersion: 1, templateRevisions }
    });
    const stagedTemplates = await stageTemplateExchange(
      asBlob(templateEnvelope),
      MEASURED_EXCHANGE_LIMITS
    );
    expect(stagedTemplates).toMatchObject({
      staged: true,
      summary: {
        format: 'venae-templates',
        templateCount: 1,
        revisionCount: 1,
        assetCount: 1
      }
    });
    if (!stagedTemplates.staged) throw new Error(stagedTemplates.reason);
    await expect(
      commitStagedTemplateExchange(stagedTemplates, undefined, library)
    ).resolves.toEqual({ committed: false, reason: 'canceled' });
    const copiedTemplates = await commitStagedTemplateExchange(
      stagedTemplates,
      'import-copy',
      library
    );
    expect(copiedTemplates).toMatchObject({
      committed: true,
      decision: 'import-copy',
      templateIds: [expect.not.stringMatching(/^template-fuse$/)]
    });
    if (!copiedTemplates.committed) throw new Error(copiedTemplates.reason);
    const copiedTemplate = await library.listTemplateRevisions(copiedTemplates.templateIds[0]!);
    expect(copiedTemplate[0]?.definition).toMatchObject({
      id: expect.not.stringMatching(/^definition-fuse$/),
      provenance: expect.stringContaining('template-fuse revision 1')
    });

    const project = generateCapacityProject(1);
    const assetBytes = new Uint8Array([137, 80, 78, 71]);
    const assetHash = await sha256Hex(assetBytes);
    project.assetHashes = [assetHash];
    await library.saveProject({
      projectId: project.project.id,
      expectedRevision: null,
      snapshot: project,
      newAssets: [{ sha256: assetHash, mimeType: 'image/png', bytes: assetBytes }]
    });
    const backup = await library.createLibraryBackup({ createdAt: '2026-09-01T02:00:00Z' });
    const backupEnvelope = await createLibraryBackupExchange({
      backup: backup.payload,
      exportedAt: '2026-09-01T02:00:00Z'
    });

    expect(
      libraryBackupExchangeEnvelopeSchema.parse(structuredClone(backupEnvelope))
    ).toMatchObject({
      format: 'venae-backup',
      exchangeVersion: 1,
      identity: {
        generationId: backup.payload.settings.activeGenerationId,
        libraryRevision: 1
      },
      payload: {
        schemaVersion: 1,
        projects: expect.any(Array),
        namedSnapshots: [],
        templates: expect.arrayContaining([...templateRevisions]),
        settings: expect.any(Object),
        assetHashes: expect.arrayContaining([assetHash])
      },
      assets: expect.arrayContaining([
        expect.objectContaining({ sha256: assetHash, mimeType: 'image/png' })
      ])
    });
    expect(backupEnvelope.payload).not.toHaveProperty('assets');
    const stagedBackup = await stageLibraryBackupExchange(
      asBlob(backupEnvelope),
      MEASURED_EXCHANGE_LIMITS
    );
    expect(stagedBackup).toMatchObject({
      staged: true,
      summary: {
        format: 'venae-backup',
        projectCount: 1,
        templateRevisionCount: 2,
        assetCount: 2
      }
    });
    if (!stagedBackup.staged) throw new Error(stagedBackup.reason);
    await library.createBlankProject({
      id: 'project-after-backup',
      name: 'Created after backup',
      createdAt: '2026-09-01T02:30:00Z'
    });
    await expect(
      commitStagedLibraryBackupExchange(stagedBackup, undefined, library)
    ).resolves.toEqual({ committed: false, reason: 'canceled' });
    expect(await library.loadProject('project-after-backup')).toBeDefined();
    await expect(
      commitStagedLibraryBackupExchange(stagedBackup, 'replace', library)
    ).resolves.toMatchObject({ committed: true, projectCount: 1 });
    expect(await library.loadProject('project-after-backup')).toBeUndefined();
    expect(await library.loadProject(project.project.id)).toEqual(project);
    expect(await library.listRollbackGenerations()).toHaveLength(1);
    library.close();
  });

  it('MVP-DATA-014 MVP-DATA-016 blocks unknown schemas and MIME-spoofed active content', async () => {
    expect(RELEASED_PROJECT_DOCUMENT_MIGRATIONS).toEqual([]);
    expect(migrateProjectDocument(generateCapacityProject(1))).toMatchObject({
      migrated: true,
      appliedVersions: [],
      document: { schemaVersion: 8 }
    });

    const newerExchange = structuredClone(await createEnvelope()) as unknown as Record<
      string,
      unknown
    >;
    newerExchange.exchangeVersion = 2;
    await expect(stageExchange(asBlob(newerExchange), MEASURED_EXCHANGE_LIMITS)).resolves.toEqual(
      expect.objectContaining({ staged: false, reason: 'newer-schema' })
    );

    const newerProject = structuredClone(await createEnvelope()) as unknown as {
      payload: { schemaVersion: number };
    };
    newerProject.payload.schemaVersion = 9;
    await expect(stageExchange(asBlob(newerProject), MEASURED_EXCHANGE_LIMITS)).resolves.toEqual(
      expect.objectContaining({ staged: false, reason: 'newer-schema' })
    );

    const unreleasedProject = structuredClone(await createEnvelope()) as unknown as {
      payload: { schemaVersion: number };
    };
    unreleasedProject.payload.schemaVersion = 7;
    await expect(
      stageExchange(asBlob(unreleasedProject), MEASURED_EXCHANGE_LIMITS)
    ).resolves.toEqual(expect.objectContaining({ staged: false, reason: 'unsupported-schema' }));

    const disguisedHtml = await createProjectExchange({
      project: generateCapacityProject(1),
      assets: [
        {
          mimeType: 'image/png',
          bytes: new TextEncoder().encode('<html><script>alert(1)</script></html>')
        }
      ],
      exportedAt: '2026-09-01T03:00:00Z'
    });
    await expect(stageExchange(asBlob(disguisedHtml), MEASURED_EXCHANGE_LIMITS)).resolves.toEqual(
      expect.objectContaining({ staged: false, reason: 'asset-content' })
    );

    const pathBearingAsset = structuredClone(await createEnvelope()) as unknown as {
      assets: Array<Record<string, unknown>>;
    };
    pathBearingAsset.assets[0]!.path = '../../startup.html';
    await expect(
      stageExchange(asBlob(pathBearingAsset), MEASURED_EXCHANGE_LIMITS)
    ).resolves.toEqual(expect.objectContaining({ staged: false, reason: 'structure' }));
  });
});
