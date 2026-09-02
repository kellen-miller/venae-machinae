import { describe, expect, it } from 'vitest';

import { applyProjectAction } from '../../src/lib/project/apply-action';
import { createBlankProject } from '../../src/lib/project/project';

import type { ProjectAction, ProjectSystemAction } from '../../src/lib/project/action';
import type { ProjectSnapshot } from '../../src/lib/project/project';

function accept(
  snapshot: ProjectSnapshot,
  action: ProjectAction | ProjectSystemAction
): ProjectSnapshot {
  const outcome = applyProjectAction(snapshot, action);
  expect(outcome.accepted).toBe(true);
  if (!outcome.accepted) throw new Error(outcome.rejection.message);
  return outcome.snapshot;
}

describe('MVP-PROD-002 MVP-PROD-004 MVP-MODEL-004 project aggregate', () => {
  it('preserves electrical/fluid work, project-owned definitions, requirements, and unknown evidence', () => {
    const initial = createBlankProject({
      id: 'project-unified',
      name: 'Unified project',
      createdAt: '2026-09-01T00:00:00Z'
    });
    let snapshot = accept(initial, {
      type: 'add-part-definition',
      causationId: 'cause-definition',
      definition: {
        id: 'definition-connector',
        label: 'Two-pin connector',
        revision: 1,
        provenance: 'project-authored'
      }
    });
    snapshot = accept(snapshot, {
      type: 'add-part-requirement',
      causationId: 'cause-requirement',
      requirement: {
        id: 'requirement-seal',
        subjectId: 'definition-connector',
        label: 'Cavity seal',
        quantity: '2'
      }
    });
    snapshot = accept(snapshot, {
      type: 'record-evidence',
      causationId: 'cause-unknown',
      evidence: {
        id: 'evidence-pressure',
        subjectId: 'project-unified',
        label: 'Coolant pressure',
        state: 'unknown',
        value: null,
        unit: null,
        provenance: null,
        conflictValues: []
      }
    });
    snapshot = accept(snapshot, {
      type: 'record-evidence',
      causationId: 'cause-conflict',
      evidence: {
        id: 'evidence-voltage',
        subjectId: 'project-unified',
        label: 'System voltage',
        state: 'conflicting',
        value: null,
        unit: 'V',
        provenance: 'two measurements',
        conflictValues: ['12.4', '12.8']
      }
    });

    expect(initial).toEqual(
      expect.objectContaining({
        revision: 0,
        partDefinitions: [],
        partRequirements: [],
        evidence: []
      })
    );
    expect(snapshot).toMatchObject({
      revision: 4,
      partDefinitions: [{ id: 'definition-connector', revision: 1 }],
      partRequirements: [{ id: 'requirement-seal', subjectId: 'definition-connector' }],
      evidence: [
        { id: 'evidence-pressure', state: 'unknown', value: null },
        { id: 'evidence-voltage', state: 'conflicting', conflictValues: ['12.4', '12.8'] }
      ]
    });
  });

  it('rejects cross-aggregate identity collisions and absent Part Definitions', () => {
    const snapshot = accept(
      createBlankProject({
        id: 'project-identity',
        name: 'Identity fixture',
        createdAt: '2026-09-01T00:00:00Z'
      }),
      {
        type: 'add-part-definition',
        causationId: 'cause-definition',
        definition: {
          id: 'definition-shared',
          label: 'Shared identity',
          revision: 1,
          provenance: 'project-authored'
        }
      }
    );
    const component = {
      id: 'definition-shared',
      label: 'Colliding Component',
      kind: 'part' as const,
      definitionId: null,
      predecessorId: null,
      successorId: null,
      position: { x: '0', y: '0' },
      ports: []
    };

    expect(
      applyProjectAction(snapshot, {
        type: 'add-component',
        causationId: 'cause-collision',
        component
      })
    ).toMatchObject({ accepted: false, rejection: { code: 'duplicate-identity' } });
    expect(
      applyProjectAction(snapshot, {
        type: 'add-component',
        causationId: 'cause-missing-definition',
        component: {
          ...component,
          id: 'component-missing-definition',
          definitionId: 'definition-absent'
        }
      })
    ).toMatchObject({ accepted: false, rejection: { code: 'missing-subject' } });
  });
});

describe('MVP-MODEL-005 MVP-MODEL-009 replacement and impact', () => {
  it('requires material confirmation, preserves predecessor history, and remaps topology explicitly', () => {
    let snapshot = createBlankProject({
      id: 'project-replacement',
      name: 'Replacement fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    snapshot = accept(snapshot, {
      type: 'add-system',
      causationId: 'cause-system',
      system: {
        id: 'system-power',
        label: 'Power',
        domain: 'electrical',
        mediumId: null
      }
    });
    for (const item of [
      {
        id: 'component-old',
        label: 'Fan',
        kind: 'part' as const,
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '0', y: '0' },
        ports: [
          {
            id: 'old-positive',
            componentId: 'component-old',
            label: 'Positive',
            domain: 'electrical' as const,
            mediumId: null,
            interfaceKey: null
          }
        ]
      },
      {
        id: 'component-source',
        label: 'Source',
        kind: 'part' as const,
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '0', y: '0' },
        ports: [
          {
            id: 'source-positive',
            componentId: 'component-source',
            label: 'Positive',
            domain: 'electrical' as const,
            mediumId: null,
            interfaceKey: null
          },
          {
            id: 'source-other',
            componentId: 'component-source',
            label: 'Other',
            domain: 'electrical' as const,
            mediumId: null,
            interfaceKey: null
          }
        ]
      },
      {
        id: 'component-peer',
        label: 'Unrelated load',
        kind: 'part' as const,
        definitionId: null,
        predecessorId: null,
        successorId: null,
        position: { x: '0', y: '0' },
        ports: [
          {
            id: 'peer-positive',
            componentId: 'component-peer',
            label: 'Positive',
            domain: 'electrical' as const,
            mediumId: null,
            interfaceKey: null
          }
        ]
      }
    ]) {
      snapshot = accept(snapshot, {
        type: 'add-component',
        causationId: `cause-${item.id}`,
        component: item
      });
    }
    snapshot = accept(snapshot, {
      type: 'add-connection',
      causationId: 'cause-wire',
      connection: {
        id: 'connection-fan',
        label: 'Fan feed',
        systemId: 'system-power',
        sourcePortId: 'source-positive',
        targetPortId: 'old-positive',
        domain: 'electrical',
        mediumId: null,
        kind: 'electrical-wire',
        interfaceAssessment: 'compatible',
        routeId: null
      }
    });
    snapshot = accept(snapshot, {
      type: 'add-connection',
      causationId: 'cause-unrelated-wire',
      connection: {
        id: 'connection-unrelated',
        label: 'Unrelated feed',
        systemId: 'system-power',
        sourcePortId: 'source-other',
        targetPortId: 'peer-positive',
        domain: 'electrical',
        mediumId: null,
        kind: 'electrical-wire',
        interfaceAssessment: 'compatible',
        routeId: null
      }
    });
    snapshot = accept(snapshot, {
      type: 'record-evidence',
      causationId: 'cause-evidence',
      evidence: {
        id: 'evidence-installed-photo',
        subjectId: 'component-old',
        label: 'Installed evidence',
        state: 'known',
        value: 'asset-photo',
        unit: null,
        provenance: 'user-recorded',
        conflictValues: []
      }
    });

    const replacement = {
      type: 'replace-component' as const,
      causationId: 'cause-replace',
      componentId: 'component-old',
      replacement: {
        id: 'component-new',
        label: 'Fan',
        kind: 'part' as const,
        definitionId: null,
        predecessorId: 'component-old',
        successorId: null,
        position: { x: '0', y: '0' },
        ports: [
          {
            id: 'new-positive',
            componentId: 'component-new',
            label: 'Positive',
            domain: 'electrical' as const,
            mediumId: null,
            interfaceKey: null
          }
        ]
      },
      portSuccessors: [{ predecessorPortId: 'old-positive', successorPortId: 'new-positive' }],
      confirmedImpactSubjectIds: []
    };
    expect(applyProjectAction(snapshot, replacement)).toMatchObject({
      accepted: false,
      rejection: {
        code: 'confirmation-required',
        impact: {
          subjectIds: ['component-old', 'connection-fan', 'evidence-installed-photo']
        }
      }
    });

    const acceptedReplacement = applyProjectAction(snapshot, {
      ...replacement,
      confirmedImpactSubjectIds: ['component-old', 'connection-fan', 'evidence-installed-photo']
    });
    expect(acceptedReplacement).toMatchObject({
      accepted: true,
      changedSubjects: ['component-old', 'component-new', 'connection-fan']
    });
    if (!acceptedReplacement.accepted) throw new Error(acceptedReplacement.rejection.message);
    snapshot = acceptedReplacement.snapshot;
    expect(snapshot.topology.components).toEqual([
      expect.objectContaining({ id: 'component-source' }),
      expect.objectContaining({ id: 'component-peer' }),
      expect.objectContaining({ id: 'component-new', predecessorId: 'component-old' })
    ]);
    expect(snapshot.topology.connections[0]).toMatchObject({
      id: 'connection-fan',
      targetPortId: 'new-positive'
    });
    expect(snapshot.evidence[0]).toMatchObject({
      id: 'evidence-installed-photo',
      subjectId: 'component-old'
    });
    expect(snapshot.tombstones).toEqual([
      expect.objectContaining({
        subjectId: 'component-old',
        subjectKind: 'component',
        successorId: 'component-new'
      })
    ]);
  });
});

describe('MVP-PROD-003 derived result revision behavior', () => {
  it('publishes only a matching evaluation and makes prior results stale on the next edit', () => {
    const initial = createBlankProject({
      id: 'project-result',
      name: 'Result fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    const stalePublication = applyProjectAction(initial, {
      type: 'publish-evaluation',
      causationId: 'cause-evaluation',
      sourceRevision: 1,
      results: [
        {
          id: 'result-summary',
          sourceRevision: 1,
          status: 'current',
          kind: 'evaluation-summary',
          detail: null
        }
      ]
    });
    expect(stalePublication).toMatchObject({
      accepted: false,
      rejection: { code: 'stale-system-action' }
    });

    let snapshot = accept(initial, {
      type: 'publish-evaluation',
      causationId: 'cause-evaluation',
      sourceRevision: 0,
      results: [
        {
          id: 'result-summary',
          sourceRevision: 0,
          status: 'current',
          kind: 'evaluation-summary',
          detail: null
        }
      ]
    });
    expect(snapshot.revision).toBe(1);
    expect(snapshot.results).toEqual([
      {
        id: 'result-summary',
        sourceRevision: 0,
        status: 'current',
        kind: 'evaluation-summary',
        detail: null
      }
    ]);

    snapshot = accept(snapshot, {
      type: 'rename-project',
      causationId: 'cause-rename',
      name: 'Renamed result fixture'
    });
    expect(snapshot.revision).toBe(2);
    expect(snapshot.results[0]).toMatchObject({ id: 'result-summary', status: 'stale' });
  });

  it('retains the prior atomic result as stale when replacement evaluation fails', () => {
    const initial = createBlankProject({
      id: 'project-result-failure',
      name: 'Result failure fixture',
      createdAt: '2026-09-01T00:00:00Z'
    });
    const current = accept(initial, {
      type: 'publish-evaluation',
      causationId: 'cause-current',
      sourceRevision: 0,
      results: [
        {
          id: 'result-overlay-state-hot',
          sourceRevision: 0,
          status: 'current',
          kind: 'overlay',
          detail: null
        }
      ]
    });
    const failed = accept(current, {
      type: 'publish-evaluation',
      causationId: 'cause-failed',
      sourceRevision: 1,
      results: [
        {
          id: 'result-evaluation-summary',
          sourceRevision: 1,
          status: 'failed',
          kind: 'evaluation-summary',
          detail: null
        }
      ]
    });

    expect(failed.results).toEqual([
      expect.objectContaining({ id: 'result-overlay-state-hot', status: 'stale' }),
      expect.objectContaining({ id: 'result-evaluation-summary', status: 'failed' })
    ]);
  });
});
