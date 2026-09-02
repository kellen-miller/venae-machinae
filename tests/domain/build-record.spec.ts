import { describe, expect, it } from 'vitest';

import { aggregateProjectBom } from '../../src/lib/build/build-record';
import { applyProjectAction, previewProjectActionImpact } from '../../src/lib/project/apply-action';
import { createBlankProject } from '../../src/lib/project/project';
import {
  projectDocumentToSnapshot,
  projectSnapshotToDocument
} from '../../src/lib/persistence/project-document';

import type { ProjectAction } from '../../src/lib/project/action';
import type { ProjectSnapshot } from '../../src/lib/project/project';

function accept(snapshot: ProjectSnapshot, action: ProjectAction): ProjectSnapshot {
  const outcome = applyProjectAction(snapshot, action);
  expect(outcome.accepted).toBe(true);
  if (!outcome.accepted) throw new Error(outcome.rejection.message);
  return outcome.snapshot;
}

describe('MVP-BUILD-001 MVP-BUILD-002 unified BOM', () => {
  it('aggregates only identical definitions and variants while tracing cross-domain consumers', () => {
    const snapshot: ProjectSnapshot = {
      ...createBlankProject({
        id: 'project-bom',
        name: 'BOM fixture',
        createdAt: '2026-09-01T00:00:00Z'
      }),
      partDefinitions: [
        {
          id: 'definition-clamp',
          label: 'Cushioned clamp',
          revision: 1,
          provenance: 'fixture catalog'
        }
      ],
      partRequirements: [
        {
          id: 'requirement-wire-clamp',
          subjectId: 'wire-fan',
          partDefinitionId: 'definition-clamp',
          variant: '12 mm',
          label: 'Harness clamp',
          quantity: '2.5',
          unit: 'ea',
          domain: 'electrical',
          systemId: 'system-electrical'
        },
        {
          id: 'requirement-hose-clamp',
          subjectId: 'hose-coolant',
          partDefinitionId: 'definition-clamp',
          variant: '12 mm',
          label: 'Coolant clamp',
          quantity: '3',
          unit: 'ea',
          domain: 'fluid',
          systemId: 'system-coolant'
        },
        {
          id: 'requirement-fuel-clamp',
          subjectId: 'hose-fuel',
          partDefinitionId: 'definition-clamp',
          variant: '16 mm',
          label: 'Fuel clamp',
          quantity: '1',
          unit: 'ea',
          domain: 'fluid',
          systemId: 'system-fuel'
        }
      ]
    };

    expect(aggregateProjectBom(snapshot)).toEqual([
      expect.objectContaining({
        partDefinitionId: 'definition-clamp',
        variant: '12 mm',
        exactDemand: '5.5',
        consumingSubjectIds: ['hose-coolant', 'wire-fan'],
        domains: ['electrical', 'fluid'],
        systemIds: ['system-coolant', 'system-electrical']
      }),
      expect.objectContaining({
        partDefinitionId: 'definition-clamp',
        variant: '16 mm',
        exactDemand: '1',
        consumingSubjectIds: ['hose-fuel']
      })
    ]);
    expect(aggregateProjectBom(snapshot, { domains: ['electrical'] })).toEqual([
      expect.objectContaining({
        exactDemand: '2.5',
        consumingSubjectIds: ['wire-fan']
      })
    ]);
    expect(aggregateProjectBom(snapshot, { systemIds: ['system-coolant'] })).toEqual([
      expect.objectContaining({ exactDemand: '3', consumingSubjectIds: ['hose-coolant'] })
    ]);
  });

  it('keeps exact demand separate from every explicit procurement choice', () => {
    let snapshot = createBlankProject({
      id: 'project-procurement',
      name: 'Procurement fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    snapshot = accept(snapshot, {
      type: 'add-part-definition',
      causationId: 'definition-wire',
      definition: {
        id: 'definition-wire',
        label: 'TXL wire',
        revision: 1,
        provenance: 'fixture catalog'
      }
    });
    snapshot = accept(snapshot, {
      type: 'add-part-requirement',
      causationId: 'requirement-wire',
      requirement: {
        id: 'requirement-wire',
        subjectId: 'definition-wire',
        partDefinitionId: 'definition-wire',
        variant: '18 AWG red',
        label: 'Fan feed wire',
        quantity: '7.25',
        unit: 'm',
        domain: 'electrical',
        systemId: 'system-fan'
      }
    });
    snapshot = accept(snapshot, {
      type: 'set-procurement-choice',
      causationId: 'procurement-wire',
      choice: {
        id: 'procurement-wire',
        partDefinitionId: 'definition-wire',
        variant: '18 AWG red',
        unit: 'm',
        purchasedQuantity: '10',
        method: 'spool',
        packageSize: '10',
        sparePercent: null,
        wasteQuantity: null,
        consumableQuantity: null,
        note: 'One explicit ten metre spool',
        provenance: 'user procurement choice'
      }
    });

    expect(aggregateProjectBom(snapshot)).toEqual([
      expect.objectContaining({
        exactDemand: '7.25',
        procurementChoices: [
          expect.objectContaining({
            purchasedQuantity: '10',
            method: 'spool',
            packageSize: '10'
          })
        ]
      })
    ]);
  });
});

describe('MVP-BUILD-003 MVP-MODEL-004 MVP-MODEL-005 as-built evidence', () => {
  it('records exact installation evidence and preserves it across physical successor identity', () => {
    let snapshot = createBlankProject({
      id: 'project-install',
      name: 'Install fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    snapshot = accept(snapshot, {
      type: 'add-part-definition',
      causationId: 'definition-fan',
      definition: {
        id: 'definition-fan',
        label: 'Cooling fan',
        revision: 1,
        provenance: 'fixture catalog'
      }
    });
    snapshot = accept(snapshot, {
      type: 'add-component',
      causationId: 'component-fan-old',
      component: {
        id: 'component-fan-old',
        label: 'Cooling fan',
        kind: 'part',
        definitionId: 'definition-fan',
        predecessorId: null,
        successorId: null,
        position: { x: '0', y: '0' },
        ports: []
      }
    });
    snapshot = accept(snapshot, {
      type: 'record-evidence',
      causationId: 'evidence-length',
      evidence: {
        id: 'evidence-length',
        subjectId: 'component-fan-old',
        label: 'Installed lead length',
        state: 'known',
        value: '425',
        unit: 'mm',
        provenance: 'workshop measurement',
        conflictValues: []
      }
    });
    snapshot = {
      ...snapshot,
      assetHashes: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']
    };
    snapshot = accept(snapshot, {
      type: 'record-installation',
      causationId: 'install-fan',
      installation: {
        id: 'installation-fan-old',
        subjectId: 'component-fan-old',
        status: 'installed',
        installedPartDefinitionId: 'definition-fan',
        installedVariant: 'SPAL 30102082',
        quantity: '1',
        unit: 'ea',
        measuredEvidenceIds: ['evidence-length'],
        observationEvidenceIds: [],
        substitution: {
          intendedPartDefinitionId: 'definition-fan',
          installedPartDefinitionId: 'definition-fan',
          reason: 'Exact catalog product recorded after inspection'
        },
        photoAssetHashes: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
        notes: 'Mounted on radiator brackets',
        recordedAt: '2026-09-01T12:00:00Z',
        provenance: 'workshop installation record'
      }
    });

    const replacementAction: Extract<ProjectAction, { type: 'replace-component' }> = {
      type: 'replace-component',
      causationId: 'replace-fan',
      componentId: 'component-fan-old',
      replacement: {
        id: 'component-fan-new',
        label: 'Cooling fan replacement',
        kind: 'part',
        definitionId: 'definition-fan',
        predecessorId: null,
        successorId: null,
        position: { x: '0', y: '0' },
        ports: []
      },
      portSuccessors: [],
      confirmedImpactSubjectIds: []
    };
    const impact = previewProjectActionImpact(snapshot, replacementAction);
    expect(impact.subjectIds).toContain('installation-fan-old');
    snapshot = accept(snapshot, {
      ...replacementAction,
      confirmedImpactSubjectIds: impact.subjectIds
    });

    expect(snapshot.topology.components.map(({ id }) => id)).toEqual(['component-fan-new']);
    expect(snapshot.tombstones).toContainEqual({
      subjectId: 'component-fan-old',
      subjectKind: 'component',
      successorId: 'component-fan-new'
    });
    expect(snapshot.build.installations).toEqual([
      expect.objectContaining({
        id: 'installation-fan-old',
        subjectId: 'component-fan-old',
        status: 'installed',
        installedVariant: 'SPAL 30102082',
        measuredEvidenceIds: ['evidence-length'],
        photoAssetHashes: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']
      })
    ]);
    expect(projectDocumentToSnapshot(projectSnapshotToDocument(snapshot))).toEqual(snapshot);
  });
});
