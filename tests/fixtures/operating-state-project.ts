import type { Page } from '@playwright/test';

import { seedWorkspaceProject, WORKSPACE_PROJECT_ID } from './workspace-project';

import type { ProjectDocument } from '../../src/lib/persistence/project-document';

export const OPERATING_STATE_PROJECT_ID = WORKSPACE_PROJECT_ID;

type PersistedOperatingState = ProjectDocument['operatingStates'][number];
type PersistedStateBinding = PersistedOperatingState['bindings'][number];

function stateBinding(
  input: Pick<PersistedStateBinding, 'id' | 'subjectId' | 'systemId' | 'channel'> &
    Partial<Omit<PersistedStateBinding, 'id' | 'subjectId' | 'systemId' | 'channel'>>
): PersistedStateBinding {
  const { id, subjectId, systemId, channel, ...overrides } = input;
  return {
    id,
    subjectId,
    systemId,
    channel,
    evidenceState: 'known',
    value: null,
    unit: null,
    direction: null,
    referenceSubjectId: null,
    pathConnectionIds: [input.subjectId],
    behavior: null,
    calculationResultId: null,
    evidenceIds: [],
    assumptions: [],
    omissions: [],
    applicability: 'independent operating-state fixture',
    uncertainty: null,
    conflictValues: [],
    provenance: ['independent operating-state fixture'],
    ...overrides
  };
}

function operatingState(
  id: string,
  name: string,
  description: string,
  bindings: PersistedStateBinding[] = []
): PersistedOperatingState {
  return {
    id,
    name,
    description,
    commands: [],
    conditions: [],
    measurements: [],
    assumptions: [],
    applicableEvidenceIds: [],
    bindings
  };
}

const operatingStates: ProjectDocument['operatingStates'] = [
  operatingState('state-key-off-cold', 'Key Off / Cold', 'Explicit cold key-off evidence.', [
    stateBinding({
      id: 'binding-key-off-potential',
      subjectId: 'wire-fan',
      systemId: 'system-electrical',
      channel: 'potential',
      value: '0',
      unit: 'V',
      referenceSubjectId: WORKSPACE_PROJECT_ID,
      evidenceIds: ['evidence-wire-source']
    }),
    stateBinding({
      id: 'binding-key-off-zero-flow',
      subjectId: 'hose-upper',
      systemId: 'system-coolant',
      channel: 'fluid-direction',
      direction: 'zero'
    }),
    stateBinding({
      id: 'binding-key-off-excluded-flow',
      subjectId: 'pipe-oil',
      systemId: 'system-oil',
      channel: 'fluid-direction',
      evidenceState: 'excluded',
      direction: 'excluded',
      provenance: []
    })
  ]),
  operatingState('state-fuel-prime', 'Fuel Prime', 'Static key-on prime evidence.', [
    stateBinding({
      id: 'binding-prime-current',
      subjectId: 'wire-fan',
      systemId: 'system-electrical',
      channel: 'current',
      value: '3.2',
      unit: 'ampere',
      direction: 'source-to-load',
      pathConnectionIds: ['wire-fan', 'wire-fan-return'],
      evidenceIds: ['evidence-wire-source']
    })
  ]),
  operatingState('state-run-cold', 'Run Cold', 'Explicit cold-running evidence.', [
    stateBinding({
      id: 'binding-run-cold-current-unknown',
      subjectId: 'wire-fan',
      systemId: 'system-electrical',
      channel: 'current',
      evidenceState: 'unknown',
      direction: 'source-to-load',
      provenance: []
    }),
    stateBinding({
      id: 'binding-run-cold-signal-unsupported',
      subjectId: 'wire-fan',
      systemId: 'system-electrical',
      channel: 'signal',
      evidenceState: 'unsupported',
      provenance: []
    }),
    stateBinding({
      id: 'binding-run-cold-temperature-partial',
      subjectId: 'hose-upper',
      systemId: 'system-coolant',
      channel: 'temperature',
      value: '48',
      unit: 'degC',
      evidenceIds: ['evidence-hose-temperature'],
      omissions: ['radiator outlet temperature']
    })
  ]),
  {
    ...operatingState('state-run-hot', 'Run Hot / Fan On', 'Static hot-running evidence.', [
      stateBinding({
        id: 'binding-hot-potential',
        subjectId: 'wire-fan',
        systemId: 'system-electrical',
        channel: 'potential',
        value: '12.4',
        unit: 'V',
        referenceSubjectId: WORKSPACE_PROJECT_ID,
        evidenceIds: ['evidence-wire-source'],
        assumptions: ['steady battery source'],
        omissions: ['ground-side voltage drop'],
        uncertainty: '±0.1 V'
      }),
      stateBinding({
        id: 'binding-hot-current',
        subjectId: 'wire-fan',
        systemId: 'system-electrical',
        channel: 'current',
        value: '12.5',
        unit: 'ampere',
        direction: 'source-to-load',
        pathConnectionIds: ['wire-fan', 'wire-fan-return'],
        evidenceIds: ['evidence-wire-source']
      }),
      stateBinding({
        id: 'binding-hot-current-return',
        subjectId: 'wire-fan-return',
        systemId: 'system-electrical',
        channel: 'current',
        value: '12.5',
        unit: 'ampere',
        direction: 'load-to-return',
        pathConnectionIds: ['wire-fan', 'wire-fan-return'],
        evidenceIds: ['evidence-wire-source']
      }),
      stateBinding({
        id: 'binding-hot-signal',
        subjectId: 'wire-fan',
        systemId: 'system-electrical',
        channel: 'signal',
        direction: 'driver-to-receiver',
        behavior: {
          id: 'behavior-hot-signal',
          componentId: 'battery',
          description: 'Battery-side driver commands the cooling fan receiver.',
          provenance: 'independent operating-state fixture'
        }
      }),
      stateBinding({
        id: 'binding-hot-signal-bidirectional',
        subjectId: 'wire-fan-return',
        systemId: 'system-electrical',
        channel: 'signal',
        direction: 'bidirectional',
        behavior: {
          id: 'behavior-hot-signal-bidirectional',
          componentId: 'fan',
          description: 'Configured neutral bidirectional service bus.',
          provenance: 'independent operating-state fixture'
        }
      }),
      stateBinding({
        id: 'binding-hot-flow-forward',
        subjectId: 'hose-upper',
        systemId: 'system-coolant',
        channel: 'fluid-direction',
        direction: 'forward',
        behavior: {
          id: 'behavior-hot-forward',
          componentId: 'pump',
          description: 'Water pump drives coolant toward the radiator.',
          provenance: 'independent operating-state fixture'
        }
      }),
      stateBinding({
        id: 'binding-hot-flow-reverse',
        subjectId: 'tube-return',
        systemId: 'system-coolant',
        channel: 'fluid-direction',
        direction: 'reverse',
        behavior: {
          id: 'behavior-hot-reverse',
          componentId: 'radiator',
          description: 'Recorded return path is opposite its authored connection direction.',
          provenance: 'independent operating-state fixture'
        }
      }),
      stateBinding({
        id: 'binding-hot-flow-zero',
        subjectId: 'pipe-oil',
        systemId: 'system-oil',
        channel: 'fluid-direction',
        direction: 'zero'
      }),
      stateBinding({
        id: 'binding-hot-flow-unknown',
        subjectId: 'hose-upper',
        systemId: 'system-coolant',
        channel: 'fluid-direction',
        evidenceState: 'unknown',
        direction: 'unknown',
        provenance: []
      }),
      stateBinding({
        id: 'binding-hot-flow-conflicting',
        subjectId: 'tube-return',
        systemId: 'system-coolant',
        channel: 'fluid-direction',
        evidenceState: 'conflicting',
        direction: 'conflicting',
        conflictValues: ['forward observation', 'reverse observation']
      }),
      stateBinding({
        id: 'binding-hot-flow-excluded',
        subjectId: 'pipe-oil',
        systemId: 'system-oil',
        channel: 'fluid-direction',
        evidenceState: 'excluded',
        direction: 'excluded',
        provenance: []
      }),
      stateBinding({
        id: 'binding-hot-temperature',
        subjectId: 'hose-upper',
        systemId: 'system-coolant',
        channel: 'temperature',
        value: '88',
        unit: 'degC',
        evidenceIds: ['evidence-hose-temperature']
      })
    ]),
    commands: [
      {
        id: 'statement-hot-command',
        subjectId: 'fan',
        label: 'Fan command',
        value: 'on',
        unit: null,
        provenance: 'independent operating-state fixture'
      }
    ],
    conditions: [
      {
        id: 'statement-hot-condition',
        subjectId: 'system-coolant',
        label: 'Thermal condition',
        value: 'hot',
        unit: null,
        provenance: 'independent operating-state fixture'
      }
    ],
    applicableEvidenceIds: ['evidence-wire-source', 'evidence-hose-temperature']
  },
  operatingState('state-heat-soak', 'Heat Soak / Key Off', 'Explicit heat-soak evidence.', [
    stateBinding({
      id: 'binding-heat-soak-temperature-conflict',
      subjectId: 'hose-upper',
      systemId: 'system-coolant',
      channel: 'temperature',
      evidenceState: 'conflicting',
      unit: 'degC',
      evidenceIds: ['evidence-hose-temperature'],
      conflictValues: ['96', '103']
    })
  ])
];

const calculations: ProjectDocument['calculations'] = [
  {
    id: 'calculation-hot-voltage-drop',
    subjectId: 'wire-fan',
    operatingStateId: 'state-run-hot',
    formulaId: 'electrical.voltage-drop.v1',
    pathId: 'route-wire',
    inputs: [
      {
        name: 'current',
        quantity: {
          id: 'quantity-hot-current',
          semantic: 'electric-current',
          decimal: '12.5',
          unit: 'ampere',
          applicability: 'Run Hot / Fan On',
          uncertainty: null,
          bounds: { lower: '10', upper: '15' },
          origin: 'entered',
          provenance: 'independent operating-state fixture'
        }
      },
      {
        name: 'resistance',
        quantity: {
          id: 'quantity-hot-resistance',
          semantic: 'electrical-resistance',
          decimal: '0.032',
          unit: 'ohm',
          applicability: 'Run Hot / Fan On',
          uncertainty: null,
          bounds: { lower: '0.02', upper: '0.04' },
          origin: 'entered',
          provenance: 'independent operating-state fixture'
        }
      }
    ],
    assumptions: ['steady DC'],
    conditions: { voltageSystem: '12 V DC' },
    omissions: [],
    desiredOutputUnit: 'volt'
  },
  {
    id: 'calculation-hot-current',
    subjectId: 'wire-fan',
    operatingStateId: 'state-run-hot',
    formulaId: 'electrical.current.voltage-resistance.v1',
    pathId: 'route-wire',
    inputs: [
      {
        name: 'voltage',
        quantity: {
          id: 'quantity-hot-voltage',
          semantic: 'electric-potential',
          decimal: '12',
          unit: 'volt',
          applicability: 'Run Hot / Fan On',
          uncertainty: null,
          bounds: null,
          origin: 'entered',
          provenance: 'independent operating-state fixture'
        }
      },
      {
        name: 'resistance',
        quantity: {
          id: 'quantity-hot-current-resistance',
          semantic: 'electrical-resistance',
          decimal: '1',
          unit: 'ohm',
          applicability: 'Run Hot / Fan On',
          uncertainty: null,
          bounds: null,
          origin: 'entered',
          provenance: 'independent operating-state fixture'
        }
      }
    ],
    assumptions: ['steady DC'],
    conditions: { voltageSystem: '12 V DC' },
    omissions: [],
    desiredOutputUnit: 'ampere'
  }
];

export async function seedOperatingStateProject(page: Page): Promise<void> {
  await seedWorkspaceProject(page);
  await page.evaluate(
    async ({ projectId, states, calculationRequests }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('venae-machinae', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      const record = await new Promise<{
        projectId: string;
        revision: number;
        snapshot: ProjectDocument;
      }>((resolve, reject) => {
        const request = store.get(projectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      record.snapshot.operatingStates = states;
      record.snapshot.calculations = calculationRequests;
      const battery = record.snapshot.topology.components.find(
        (component) => component.id === 'battery'
      );
      const fan = record.snapshot.topology.components.find((component) => component.id === 'fan');
      if (!battery || !fan) throw new Error('Operating-state fixture components are absent');
      battery.ports.push({
        id: 'battery-return',
        componentId: 'battery',
        label: 'Negative',
        domain: 'electrical',
        mediumId: null,
        interfaceKey: 'ring-m6'
      });
      fan.ports.push({
        id: 'fan-return',
        componentId: 'fan',
        label: 'Return',
        domain: 'electrical',
        mediumId: null,
        interfaceKey: 'ring-m6'
      });
      record.snapshot.topology.connections.push({
        id: 'wire-fan-return',
        label: 'Fan return',
        systemId: 'system-electrical',
        sourcePortId: 'fan-return',
        targetPortId: 'battery-return',
        domain: 'electrical',
        mediumId: null,
        kind: 'electrical-wire',
        interfaceAssessment: 'compatible',
        routeId: null
      });
      record.snapshot.electrical.circuits.push({
        id: 'circuit-fan-supply-return',
        label: 'Fan supply and return',
        systemId: 'system-electrical',
        connectionIds: ['wire-fan', 'wire-fan-return'],
        componentIds: ['battery', 'fan'],
        protectionComponentIds: []
      });
      store.put(record);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
    },
    {
      projectId: OPERATING_STATE_PROJECT_ID,
      states: operatingStates,
      calculationRequests: calculations
    }
  );
}
