import { describe, expect, it } from 'vitest';

import {
  captureOutputRevision,
  createCsvTables,
  createExportAllZip,
  createPrintableReport,
  createValidationReport
} from '../../src/lib/reporting/generate-output';
import { createBlankProject } from '../../src/lib/project/project';

import type { Finding, FindingDisposition } from '../../src/lib/validation/finding';
import type { ProjectSnapshot } from '../../src/lib/project/project';

function listZipEntries(archive: Uint8Array): string[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder();
  const names: string[] = [];
  for (let offset = 0; offset <= archive.byteLength - 46; offset += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    const nameLength = view.getUint16(offset + 28, true);
    names.push(decoder.decode(archive.slice(offset + 46, offset + 46 + nameLength)));
  }
  return names;
}

function finding(
  id: string,
  lifecycle: 'active' | 'resolved',
  disposition: FindingDisposition
): Finding {
  return {
    id,
    ruleId: 'rule-interface-known',
    ruleRevision: 3,
    subjectId: 'project-output',
    scopeKey: 'profile:build-preparation',
    claim: id === 'finding-acknowledged' ? '=SUM(A1:A2) is untrusted evidence' : `${id} claim`,
    severity: 'warning',
    severityRationale: 'Fixture severity',
    evaluation: 'current',
    lifecycle,
    unknownReason: 'missing',
    knownEvidence: [],
    unknownEvidence: ['fixture unknown'],
    affectedOperation: 'Build preparation',
    inputIds: [],
    assumptions: [],
    trace: {
      ruleId: 'rule-interface-known',
      ruleRevision: 3,
      subjectId: 'project-output',
      scopeKey: 'profile:build-preparation',
      inputIds: [],
      evidenceIds: [],
      resultIds: [],
      assumptions: [],
      tombstone: null
    },
    disposition,
    occurrences: [
      {
        number: 1,
        openedAtRevision: 3,
        resolvedAtRevision: lifecycle === 'resolved' ? 4 : null,
        resolutionReason: lifecycle === 'resolved' ? 'reevaluated-passed' : null
      }
    ],
    correctiveActions: ['Record evidence'],
    invalidationKey: '0123456789abcdef'
  };
}

function outputProject(): ProjectSnapshot {
  const base = createBlankProject({
    id: 'project-output',
    name: 'Output, =unsafe',
    createdAt: '2026-09-01T00:00:00Z'
  });
  const acknowledged: FindingDisposition = {
    kind: 'acknowledged',
    ruleId: 'rule-interface-known',
    ruleRevision: 3,
    subjectId: 'project-output',
    scopeKey: 'profile:build-preparation',
    occurrenceNumber: 1,
    recordedAtRevision: 4,
    rationale: 'Known workshop gap',
    invalidationKey: '0123456789abcdef'
  };
  const suppressed: FindingDisposition = {
    ...acknowledged,
    kind: 'suppressed',
    rationale: 'Not visible in this build'
  };

  return {
    ...base,
    revision: 4,
    topology: {
      systems: [
        { id: 'system-electrical', label: 'Aux fan', domain: 'electrical', mediumId: null }
      ],
      components: [
        {
          id: 'component-fan',
          label: '+Fan',
          kind: 'part',
          definitionId: 'definition-fan',
          predecessorId: null,
          successorId: null,
          position: { x: '-12.5', y: '40' },
          ports: []
        }
      ],
      connections: [],
      routes: [],
      segments: []
    },
    partDefinitions: [
      {
        id: 'definition-fan',
        label: 'Fan',
        revision: 2,
        provenance: 'project catalog'
      }
    ],
    partRequirements: [
      {
        id: 'requirement-fan',
        subjectId: 'component-fan',
        partDefinitionId: 'definition-fan',
        variant: '12 V',
        label: '@fan requirement',
        quantity: '1',
        unit: 'ea',
        domain: 'electrical',
        systemId: 'system-electrical'
      }
    ],
    results: [
      {
        id: 'result-validation',
        sourceRevision: 4,
        status: 'current',
        kind: 'validation',
        detail: {
          type: 'validation',
          history: {
            findings: [
              finding('finding-acknowledged', 'active', acknowledged),
              finding('finding-suppressed', 'active', suppressed),
              finding('finding-resolved', 'resolved', { kind: 'unreviewed' })
            ],
            runs: [
              {
                id: 'run-build',
                projectRevision: 4,
                scope: { kind: 'review-profile', profileId: 'build-preparation' },
                scopeKey: 'profile:build-preparation',
                profileId: 'build-preparation',
                status: 'current',
                evaluatedAt: '2026-09-01T11:59:00Z',
                ruleIds: ['rule-interface-known'],
                findingIds: ['finding-acknowledged', 'finding-suppressed', 'finding-resolved'],
                coverage: {
                  applicable: 3,
                  evaluated: 3,
                  passed: 1,
                  activeFinding: 2,
                  unknown: 0,
                  stale: 0,
                  unsupported: 0,
                  failed: 0,
                  excluded: 0,
                  notApplicable: 0,
                  entries: []
                }
              }
            ],
            currentRunIds: ['run-build']
          }
        }
      }
    ]
  };
}

describe('MVP-BUILD-004 MVP-BUILD-005 immutable output revision', () => {
  it('identifies every print boundary from one captured revision', () => {
    const output = captureOutputRevision(outputProject(), {
      source: 'durable',
      generatedAt: '2026-09-01T12:00:00Z',
      view: 'bom',
      operatingStateId: null,
      domainFilter: 'electrical',
      systemFilterId: 'system-electrical',
      overlayChannels: ['potential', 'finding'],
      legend: ['Solid: known', 'Hatched: unknown'],
      pagination: 'A4 portrait · repeat table headers'
    });
    const print = createPrintableReport(output);

    expect(print.metadata).toMatchObject({
      projectId: 'project-output',
      projectRevision: 4,
      revisionState: 'Durable revision',
      view: 'bom',
      operatingState: null,
      filters: { domain: 'electrical', systemId: 'system-electrical' },
      overlayChannels: ['potential', 'finding'],
      unitSystem: 'metric',
      generatedAt: '2026-09-01T12:00:00Z',
      pagination: 'A4 portrait · repeat table headers'
    });
    expect(print.metadata.legend).toEqual(['Solid: known', 'Hatched: unknown']);
    expect(print.metadata.provenanceSummary).toContain('project catalog');
    expect(print.visibleFindings.map(({ id }) => id)).toEqual([
      'finding-acknowledged',
      'finding-suppressed'
    ]);
    expect(print.bom).toEqual([
      expect.objectContaining({ exactDemand: '1', consumingSubjectIds: ['component-fan'] })
    ]);
  });
});

describe('MVP-BUILD-006 stable and safe CSV', () => {
  it('emits raw/unit/provenance/status columns and neutralizes formula-like text', () => {
    const output = captureOutputRevision(outputProject(), {
      source: 'transient-review',
      generatedAt: '2026-09-01T12:00:00Z',
      view: 'bom',
      operatingStateId: null,
      domainFilter: 'all',
      systemFilterId: null,
      overlayChannels: [],
      legend: [],
      pagination: 'A4 portrait'
    });
    const tables = createCsvTables(output);

    expect(Object.keys(tables)).toEqual([...Object.keys(tables)].sort());
    expect(tables['metadata.csv']).toContain('project_revision,4');
    expect(tables['components.csv']).toContain("'+Fan");
    expect(tables['components.csv']).toContain(',-12.5,40,');
    expect(tables['bom.csv']).toContain('raw_value,unit,provenance,status');
    expect(tables['findings.csv']).toContain("'=SUM(A1:A2) is untrusted evidence");
    expect(tables['metadata.csv']).toContain('Transient review');
  });

  it('packages the stable tables in a derived non-round-trip ZIP', () => {
    const output = captureOutputRevision(outputProject(), {
      source: 'durable',
      generatedAt: '2026-09-01T12:00:00Z',
      view: 'bom',
      operatingStateId: null,
      domainFilter: 'all',
      systemFilterId: null,
      overlayChannels: [],
      legend: [],
      pagination: 'A4 portrait'
    });
    const archive = createExportAllZip(output);

    expect(Array.from(archive.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(listZipEntries(archive)).toEqual(
      expect.arrayContaining([
        'bom.csv',
        'components.csv',
        'evidence.csv',
        'findings.csv',
        'installations.csv',
        'manifest.json',
        'systems.csv'
      ])
    );
    expect(listZipEntries(archive)).not.toContain('project.venae.json');
  });
});

describe('MVP-BUILD-007 validation reporting', () => {
  it('includes active acknowledged and suppressed findings by default and labels resolved opt-in', () => {
    const output = captureOutputRevision(outputProject(), {
      source: 'durable',
      generatedAt: '2026-09-01T12:00:00Z',
      view: 'findings',
      operatingStateId: null,
      domainFilter: 'all',
      systemFilterId: null,
      overlayChannels: ['finding'],
      legend: [],
      pagination: 'A4 portrait'
    });

    expect(createValidationReport(output)).toMatchObject({
      projectRevision: 4,
      runScopes: ['profile:build-preparation'],
      reviewProfiles: ['build-preparation'],
      operatingStateIds: [],
      filters: { domain: 'all', systemId: null },
      ruleRevisions: [{ ruleId: 'rule-interface-known', revision: 3 }],
      generatedAt: '2026-09-01T12:00:00Z',
      findings: [
        { id: 'finding-acknowledged', lifecycleLabel: 'Active · acknowledged' },
        { id: 'finding-suppressed', lifecycleLabel: 'Active · suppressed' }
      ]
    });
    expect(createValidationReport(output, { includeResolved: true }).findings.at(-1)).toMatchObject(
      {
        id: 'finding-resolved',
        lifecycleLabel: 'Resolved'
      }
    );
  });
});
