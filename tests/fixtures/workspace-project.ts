import type { Page } from '@playwright/test';

export const WORKSPACE_PROJECT_ID = 'workspace-project';

export async function seedWorkspaceProject(page: Page): Promise<void> {
  await page.goto('/health');
  await page.evaluate(
    async ({ projectId, snapshot }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('venae-machinae', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('projects', { keyPath: 'projectId' });
          request.result.createObjectStore('assets', { keyPath: 'sha256' });
          const checkpoints = request.result.createObjectStore('checkpoints', { keyPath: 'id' });
          checkpoints.createIndex('by-project', 'projectId');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction('projects', 'readwrite');
      transaction.objectStore('projects').put({ projectId, revision: 7, snapshot });
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
    },
    {
      projectId: WORKSPACE_PROJECT_ID,
      snapshot: {
        schemaVersion: 8,
        project: {
          id: WORKSPACE_PROJECT_ID,
          name: 'RX-7 workshop study',
          revision: 7,
          createdAt: '2026-08-31T12:00:00.000Z'
        },
        topology: {
          systems: [
            {
              id: 'system-electrical',
              label: '12 V electrical',
              domain: 'electrical',
              mediumId: null
            },
            { id: 'system-coolant', label: 'Engine coolant', domain: 'fluid', mediumId: 'coolant' },
            { id: 'system-oil', label: 'Engine oil', domain: 'fluid', mediumId: 'oil' }
          ],
          components: [
            {
              id: 'battery',
              label: 'Battery',
              kind: 'part',
              definitionId: null,
              predecessorId: null,
              successorId: null,
              position: { x: '80', y: '96' },
              ports: [
                {
                  id: 'battery-out',
                  componentId: 'battery',
                  label: 'Positive',
                  domain: 'electrical',
                  mediumId: null,
                  interfaceKey: 'ring-m6'
                }
              ]
            },
            {
              id: 'fan',
              label: 'Cooling fan',
              kind: 'part',
              definitionId: null,
              predecessorId: null,
              successorId: null,
              position: { x: '420', y: '96' },
              ports: [
                {
                  id: 'fan-in',
                  componentId: 'fan',
                  label: 'Power',
                  domain: 'electrical',
                  mediumId: null,
                  interfaceKey: 'ring-m6'
                }
              ]
            },
            {
              id: 'pump',
              label: 'Water pump',
              kind: 'part',
              definitionId: null,
              predecessorId: null,
              successorId: null,
              position: { x: '80', y: '280' },
              ports: [
                {
                  id: 'pump-out',
                  componentId: 'pump',
                  label: 'Outlet',
                  domain: 'fluid',
                  mediumId: 'coolant',
                  interfaceKey: 'hose-32'
                }
              ]
            },
            {
              id: 'radiator',
              label: 'Radiator',
              kind: 'part',
              definitionId: null,
              predecessorId: null,
              successorId: null,
              position: { x: '420', y: '280' },
              ports: [
                {
                  id: 'radiator-in',
                  componentId: 'radiator',
                  label: 'Inlet',
                  domain: 'fluid',
                  mediumId: 'coolant',
                  interfaceKey: 'hose-32'
                },
                {
                  id: 'radiator-out',
                  componentId: 'radiator',
                  label: 'Outlet',
                  domain: 'fluid',
                  mediumId: 'coolant',
                  interfaceKey: 'tube-32'
                }
              ]
            },
            {
              id: 'reservoir',
              label: 'Reservoir',
              kind: 'part',
              definitionId: null,
              predecessorId: null,
              successorId: null,
              position: { x: '720', y: '280' },
              ports: [
                {
                  id: 'reservoir-in',
                  componentId: 'reservoir',
                  label: 'Return',
                  domain: 'fluid',
                  mediumId: 'coolant',
                  interfaceKey: 'tube-32'
                }
              ]
            },
            {
              id: 'oil-pump',
              label: 'Oil pump',
              kind: 'part',
              definitionId: null,
              predecessorId: null,
              successorId: null,
              position: { x: '80', y: '464' },
              ports: [
                {
                  id: 'oil-pump-out',
                  componentId: 'oil-pump',
                  label: 'Outlet',
                  domain: 'fluid',
                  mediumId: 'oil',
                  interfaceKey: 'pipe-10'
                }
              ]
            },
            {
              id: 'oil-cooler',
              label: 'Oil cooler',
              kind: 'part',
              definitionId: null,
              predecessorId: null,
              successorId: null,
              position: { x: '420', y: '464' },
              ports: [
                {
                  id: 'oil-cooler-in',
                  componentId: 'oil-cooler',
                  label: 'Inlet',
                  domain: 'fluid',
                  mediumId: 'oil',
                  interfaceKey: 'pipe-10'
                }
              ]
            }
          ],
          connections: [
            {
              id: 'wire-fan',
              label: 'Fan feed',
              systemId: 'system-electrical',
              sourcePortId: 'battery-out',
              targetPortId: 'fan-in',
              domain: 'electrical',
              mediumId: null,
              kind: 'electrical-wire',
              interfaceAssessment: 'compatible',
              routeId: 'route-wire'
            },
            {
              id: 'hose-upper',
              label: 'Upper hose',
              systemId: 'system-coolant',
              sourcePortId: 'pump-out',
              targetPortId: 'radiator-in',
              domain: 'fluid',
              mediumId: 'coolant',
              kind: 'fluid-hose',
              interfaceAssessment: 'compatible',
              routeId: 'route-hose'
            },
            {
              id: 'tube-return',
              label: 'Return tube',
              systemId: 'system-coolant',
              sourcePortId: 'radiator-out',
              targetPortId: 'reservoir-in',
              domain: 'fluid',
              mediumId: 'coolant',
              kind: 'fluid-tube',
              interfaceAssessment: 'unknown',
              routeId: 'route-tube'
            },
            {
              id: 'pipe-oil',
              label: 'Oil feed pipe',
              systemId: 'system-oil',
              sourcePortId: 'oil-pump-out',
              targetPortId: 'oil-cooler-in',
              domain: 'fluid',
              mediumId: 'oil',
              kind: 'fluid-pipe',
              interfaceAssessment: 'compatible',
              routeId: 'route-pipe'
            }
          ],
          routes: [
            { id: 'route-wire', segmentIds: ['segment-wire'] },
            { id: 'route-hose', segmentIds: ['segment-hose'] },
            { id: 'route-tube', segmentIds: ['segment-tube'] },
            { id: 'route-pipe', segmentIds: ['segment-pipe'] }
          ],
          segments: [
            {
              id: 'segment-wire',
              label: 'Fan harness',
              start: { x: '240', y: '120' },
              end: { x: '360', y: '120' }
            },
            {
              id: 'segment-hose',
              label: 'Upper route',
              start: { x: '240', y: '304' },
              end: { x: '360', y: '304' }
            },
            {
              id: 'segment-tube',
              label: 'Return route',
              start: { x: '580', y: '340' },
              end: { x: '680', y: '340' }
            },
            {
              id: 'segment-pipe',
              label: 'Oil route',
              start: { x: '240', y: '488' },
              end: { x: '360', y: '488' }
            }
          ]
        },
        electrical: {
          components: [],
          wires: [],
          circuits: [],
          connectors: [],
          harnesses: [],
          bundles: [],
          cableSpecifications: []
        },
        fluid: {
          media: [
            {
              id: 'coolant',
              label: 'Engine coolant',
              composition: 'fixture coolant',
              provenance: 'independent workspace fixture'
            },
            {
              id: 'oil',
              label: 'Engine oil',
              composition: 'fixture engine oil',
              provenance: 'independent workspace fixture'
            }
          ],
          systems: [
            {
              systemId: 'system-coolant',
              mediumId: 'coolant',
              purpose: 'engine cooling'
            },
            {
              systemId: 'system-oil',
              mediumId: 'oil',
              purpose: 'engine lubrication'
            }
          ],
          components: [],
          lines: [],
          behaviors: [],
          boundaryConditions: []
        },
        calculations: [],
        screenings: [],
        partDefinitions: [],
        partRequirements: [],
        evidence: [
          {
            id: 'evidence-wire-source',
            subjectId: 'wire-fan',
            label: 'Wire provenance',
            state: 'known',
            value: 'workshop measurement',
            unit: null,
            provenance: 'Measured in vehicle',
            conflictValues: []
          },
          {
            id: 'evidence-hose-temperature',
            subjectId: 'hose-upper',
            label: 'Temperature',
            state: 'known',
            value: '88',
            unit: 'degC',
            provenance: 'Logged bulk coolant',
            conflictValues: []
          },
          {
            id: 'evidence-tube-interface',
            subjectId: 'tube-return',
            label: 'Interface',
            state: 'unknown',
            value: null,
            unit: null,
            provenance: null,
            conflictValues: []
          },
          {
            id: 'evidence-pipe-pressure',
            subjectId: 'pipe-oil',
            label: 'Pressure',
            state: 'conflicting',
            value: null,
            unit: 'kPa',
            provenance: 'Two workshop records',
            conflictValues: ['310', '345']
          }
        ],
        results: [
          {
            id: 'result-validation-history',
            sourceRevision: 7,
            status: 'current',
            kind: 'validation',
            detail: {
              type: 'validation',
              history: {
                findings: [
                  {
                    id: 'finding:topology.interface-known:0123456789abcdef',
                    ruleId: 'topology.interface-known',
                    ruleRevision: 1,
                    subjectId: 'tube-return',
                    scopeKey: 'profile:topology-review',
                    claim: 'Return tube has no explicit interface compatibility conclusion.',
                    severity: 'caution',
                    severityRationale:
                      'Caution records missing profile evidence for this connection only.',
                    evaluation: 'current',
                    lifecycle: 'active',
                    unknownReason: 'ambiguous',
                    knownEvidence: [],
                    unknownEvidence: ['interface compatibility conclusion'],
                    affectedOperation: 'Topology Review',
                    inputIds: ['radiator-out', 'pump-return'],
                    assumptions: [],
                    trace: {
                      ruleId: 'topology.interface-known',
                      ruleRevision: 1,
                      subjectId: 'tube-return',
                      scopeKey: 'profile:topology-review',
                      inputIds: ['radiator-out', 'pump-return'],
                      evidenceIds: ['evidence-tube-interface'],
                      resultIds: [],
                      assumptions: [],
                      tombstone: null
                    },
                    disposition: { kind: 'unreviewed' },
                    occurrences: [
                      {
                        number: 1,
                        openedAtRevision: 7,
                        resolvedAtRevision: null,
                        resolutionReason: null
                      }
                    ],
                    correctiveActions: ['Record compatibility evidence or an explicit transition.'],
                    invalidationKey: 'fedcba9876543210'
                  }
                ],
                runs: [
                  {
                    id: 'run-topology-review-7',
                    projectRevision: 7,
                    scope: { kind: 'review-profile', profileId: 'topology-review' },
                    scopeKey: 'profile:topology-review',
                    profileId: 'topology-review',
                    status: 'current',
                    evaluatedAt: '2026-08-31T12:10:00.000Z',
                    ruleIds: ['topology.interface-known'],
                    findingIds: ['finding:topology.interface-known:0123456789abcdef'],
                    coverage: {
                      applicable: 1,
                      evaluated: 1,
                      passed: 0,
                      activeFinding: 1,
                      unknown: 0,
                      stale: 0,
                      unsupported: 0,
                      failed: 0,
                      excluded: 0,
                      notApplicable: 0,
                      entries: [
                        {
                          ruleId: 'topology.interface-known',
                          ruleRevision: 1,
                          subjectId: 'tube-return',
                          scopeKey: 'profile:topology-review',
                          outcome: 'active-finding',
                          findingId: 'finding:topology.interface-known:0123456789abcdef',
                          unknownReason: 'ambiguous'
                        }
                      ]
                    }
                  }
                ],
                currentRunIds: ['run-topology-review-7']
              }
            }
          }
        ],
        validationApplicabilityDecisions: [],
        tombstones: [],
        engineeringValues: [],
        operatingStates: [
          {
            id: 'state-key-on',
            name: 'Key-on, engine-off',
            description: 'Electrical checks before cranking.',
            commands: [],
            conditions: [],
            measurements: [],
            assumptions: [],
            applicableEvidenceIds: [],
            bindings: []
          },
          {
            id: 'state-hot-idle',
            name: 'Hot idle',
            description: 'Warm steady idle review.',
            commands: [],
            conditions: [],
            measurements: [],
            assumptions: [],
            applicableEvidenceIds: [],
            bindings: []
          }
        ],
        settings: { unitSystem: 'metric' },
        assetHashes: [],
        vehicleBackground: null
      }
    }
  );
}
