import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const destination = fileURLToPath(
  new URL('../src/lib/reference/rx7-example.v1.venae.json', import.meta.url)
);
const generatedAt = '2026-09-02T00:00:00.000Z';
const provenance =
  'Illustrative synthetic RX-7 acceptance data; verify applicability against the actual vehicle and selected product evidence';

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const pngBytes = Buffer.from(pngBase64, 'base64');
const assetHash = sha256(pngBytes);

const partDefinitions = [
  ['definition-wire-txl', 'TXL primary wire'],
  ['definition-terminal', 'Sealed connector terminal'],
  ['definition-seal', 'Sealed connector cavity seal'],
  ['definition-covering', 'Abrasion-resistant harness covering'],
  ['definition-fuse', 'Low-voltage blade fuse'],
  ['definition-fan', 'Auxiliary cooling fan'],
  ['definition-hose-coolant', 'Coolant hose'],
  ['definition-tube-coolant', 'Coolant transfer tube'],
  ['definition-pipe-oil', 'Oil hard line'],
  ['definition-hose-fuel', 'Fuel-compatible hose'],
  ['definition-fitting', 'Fluid transition fitting'],
  ['definition-clamp', 'Cushioned line clamp'],
  ['definition-coupling', 'Serviceable fluid coupling'],
  ['definition-wire-alt', 'Alternate TXL primary wire'],
  ['definition-fuse-alt', 'Alternate low-voltage fuse'],
  ['definition-hose-alt', 'Alternate coolant hose'],
  ['definition-fitting-alt', 'Alternate transition fitting'],
  ['definition-coupling-alt', 'Alternate fluid coupling']
].map(([id, label]) => ({ id, label, revision: 1, provenance }));

function port(componentId, suffix, label, domain, mediumId = null, interfaceKey = null) {
  return {
    id: `${componentId}-${suffix}`,
    componentId,
    label,
    domain,
    mediumId,
    interfaceKey
  };
}

function component(id, label, domain, ports, options = {}) {
  return {
    id,
    label,
    kind: options.kind ?? 'part',
    definitionId: options.definitionId ?? null,
    predecessorId: options.predecessorId ?? null,
    successorId: null,
    position: options.position ?? { x: '0', y: '0' },
    ports: ports.map(([suffix, portLabel, mediumId, interfaceKey]) =>
      port(id, suffix, portLabel, domain, mediumId ?? null, interfaceKey ?? null)
    )
  };
}

const components = [
  component(
    'battery',
    '12 V battery',
    'electrical',
    [
      ['positive', 'Positive', null, 'ring-m6'],
      ['negative', 'Negative', null, 'ring-m6']
    ],
    { position: { x: '60', y: '80' } }
  ),
  component(
    'fuse',
    'Auxiliary fan fuse',
    'electrical',
    [
      ['in', 'Supply', null, 'blade'],
      ['out', 'Protected', null, 'blade']
    ],
    { definitionId: 'definition-fuse', position: { x: '200', y: '80' } }
  ),
  component(
    'relay',
    'ECU-commanded relay',
    'electrical',
    [
      ['supply', 'Supply', null, 'terminal'],
      ['load', 'Load', null, 'terminal'],
      ['coil-in', 'Coil command', null, 'terminal'],
      ['coil-return', 'Coil return', null, 'terminal']
    ],
    { position: { x: '340', y: '80' } }
  ),
  component('ecu', 'Engine controller', 'electrical', [['fan-command', 'Fan command']], {
    position: { x: '200', y: '200' }
  }),
  component(
    'splice-control',
    'Fan control splice',
    'electrical',
    [
      ['source', 'Source'],
      ['relay', 'Relay branch'],
      ['monitor', 'Monitor branch']
    ],
    { kind: 'junction', position: { x: '340', y: '200' } }
  ),
  component(
    'connector-fan',
    'Fan harness connector',
    'electrical',
    [
      ['power', 'Cavity A', null, 'sealed-280'],
      ['return', 'Cavity B', null, 'sealed-280'],
      ['control', 'Cavity C', null, 'sealed-150']
    ],
    { position: { x: '480', y: '130' } }
  ),
  component(
    'fan-current',
    'Auxiliary cooling fan replacement',
    'electrical',
    [
      ['power', 'Power', null, 'sealed-280'],
      ['return', 'Return', null, 'sealed-280'],
      ['control', 'Monitor', null, 'sealed-150']
    ],
    {
      definitionId: 'definition-fan',
      predecessorId: 'fan-original',
      position: { x: '660', y: '130' }
    }
  ),
  component('ground', 'Chassis ground', 'electrical', [['stud', 'Ground stud', null, 'ring-m6']], {
    position: { x: '820', y: '200' }
  }),

  component(
    'coolant-pump',
    'Water pump',
    'fluid',
    [
      ['in', 'Main inlet', 'medium-coolant', 'hose-32'],
      ['fill', 'Fill return', 'medium-coolant', 'hose-10'],
      ['out', 'Outlet', 'medium-coolant', 'hose-32']
    ],
    { position: { x: '80', y: '360' } }
  ),
  component(
    'engine-coolant',
    'Engine coolant passages',
    'fluid',
    [
      ['in', 'Block inlet', 'medium-coolant', 'hose-32'],
      ['out', 'Housing outlet', 'medium-coolant', 'hose-32'],
      ['heater', 'Heater feed', 'medium-coolant', 'hose-16'],
      ['turbo', 'Turbo feed', 'medium-coolant', 'hose-10'],
      ['bleed', 'Bleed', 'medium-coolant', 'hose-6']
    ],
    { position: { x: '260', y: '360' } }
  ),
  component(
    'coolant-thermostat',
    'Coolant thermostat',
    'fluid',
    [
      ['in', 'Engine inlet', 'medium-coolant', 'hose-32'],
      ['radiator-out', 'Radiator path', 'medium-coolant', 'hose-32'],
      ['bypass-out', 'Bypass path', 'medium-coolant', 'hose-20']
    ],
    { position: { x: '450', y: '360' } }
  ),
  component(
    'radiator',
    'Radiator',
    'fluid',
    [
      ['in', 'Upper inlet', 'medium-coolant', 'hose-32'],
      ['out', 'Lower outlet', 'medium-coolant', 'tube-32']
    ],
    { position: { x: '650', y: '350' } }
  ),
  component(
    'heater-core',
    'Heater core',
    'fluid',
    [
      ['in', 'Inlet', 'medium-coolant', 'hose-16'],
      ['out', 'Outlet', 'medium-coolant', 'hose-16']
    ],
    { position: { x: '450', y: '470' } }
  ),
  component(
    'turbo-cooler',
    'Turbo coolant passage',
    'fluid',
    [
      ['in', 'Inlet', 'medium-coolant', 'hose-10'],
      ['out', 'Outlet', 'medium-coolant', 'hose-10']
    ],
    { position: { x: '650', y: '470' } }
  ),
  component(
    'coolant-return-manifold',
    'Coolant return manifold',
    'fluid',
    [
      ['radiator', 'Radiator return', 'medium-coolant', 'tube-32'],
      ['heater', 'Heater return', 'medium-coolant', 'hose-16'],
      ['turbo', 'Turbo return', 'medium-coolant', 'hose-10'],
      ['bypass', 'Bypass return', 'medium-coolant', 'hose-20'],
      ['out', 'Pump return', 'medium-coolant', 'hose-32']
    ],
    { kind: 'junction', position: { x: '800', y: '410' } }
  ),
  component(
    'expansion-tank',
    'Expansion tank',
    'fluid',
    [
      ['bleed', 'Bleed inlet', 'medium-coolant', 'hose-6'],
      ['out', 'Fill outlet', 'medium-coolant', 'hose-10']
    ],
    { position: { x: '800', y: '520' } }
  ),

  component(
    'oil-pump',
    'Engine oil pump',
    'fluid',
    [
      ['in', 'Inlet', 'medium-oil', 'pipe-10'],
      ['out', 'Outlet', 'medium-oil', 'pipe-10']
    ],
    { position: { x: '80', y: '650' } }
  ),
  component(
    'oil-thermostat',
    'Oil thermostat',
    'fluid',
    [
      ['in', 'Pump inlet', 'medium-oil', 'pipe-10'],
      ['cooler-out', 'Cooler path', 'medium-oil', 'pipe-10'],
      ['bypass-out', 'Bypass path', 'medium-oil', 'pipe-10']
    ],
    { position: { x: '280', y: '650' } }
  ),
  component(
    'oil-cooler',
    'Oil cooler',
    'fluid',
    [
      ['in', 'Inlet', 'medium-oil', 'pipe-10'],
      ['out', 'Outlet', 'medium-oil', 'pipe-10']
    ],
    { position: { x: '480', y: '620' } }
  ),
  component(
    'oil-return-manifold',
    'Oil return manifold',
    'fluid',
    [
      ['cooler', 'Cooler return', 'medium-oil', 'pipe-10'],
      ['bypass', 'Bypass return', 'medium-oil', 'pipe-10'],
      ['out', 'Engine feed', 'medium-oil', 'pipe-10']
    ],
    { kind: 'junction', position: { x: '650', y: '650' } }
  ),
  component(
    'engine-oil',
    'Engine oil galleries',
    'fluid',
    [
      ['in', 'Gallery inlet', 'medium-oil', 'pipe-10'],
      ['out', 'Sump return', 'medium-oil', 'pipe-10']
    ],
    { position: { x: '820', y: '650' } }
  ),

  component(
    'fuel-tank',
    'Fuel tank',
    'fluid',
    [
      ['supply', 'Supply', 'medium-fuel', 'hose-8'],
      ['return', 'Return', 'medium-fuel', 'hose-8']
    ],
    { position: { x: '80', y: '850' } }
  ),
  component(
    'fuel-pump',
    'Fuel pump',
    'fluid',
    [
      ['in', 'Inlet', 'medium-fuel', 'hose-8'],
      ['out', 'Outlet', 'medium-fuel', 'hose-8']
    ],
    { position: { x: '250', y: '850' } }
  ),
  component(
    'fuel-filter',
    'Fuel filter',
    'fluid',
    [
      ['in', 'Inlet', 'medium-fuel', 'hose-8'],
      ['out', 'Outlet', 'medium-fuel', 'tube-8']
    ],
    { position: { x: '420', y: '850' } }
  ),
  component(
    'fuel-rail',
    'Fuel rail boundary',
    'fluid',
    [
      ['in', 'Inlet', 'medium-fuel', 'tube-8'],
      ['out', 'Return', 'medium-fuel', 'hose-8']
    ],
    { position: { x: '590', y: '850' } }
  ),
  component(
    'fuel-regulator',
    'Recorded regulator boundary',
    'fluid',
    [
      ['in', 'Rail return', 'medium-fuel', 'hose-8'],
      ['out', 'Tank return', 'medium-fuel', 'hose-8']
    ],
    { position: { x: '760', y: '850' } }
  )
];

function connection(id, label, systemId, sourcePortId, targetPortId, domain, mediumId, kind) {
  return {
    id,
    label,
    systemId,
    sourcePortId,
    targetPortId,
    domain,
    mediumId,
    kind,
    interfaceAssessment: 'compatible',
    routeId: `route-${id}`
  };
}

const electricalConnections = [
  ['wire-battery-fuse', 'Battery to fuse', 'battery-positive', 'fuse-in'],
  ['wire-fuse-relay', 'Fuse to relay', 'fuse-out', 'relay-supply'],
  ['wire-relay-connector', 'Relay to fan connector', 'relay-load', 'connector-fan-power'],
  [
    'wire-connector-fan-power',
    'Connector to fan power',
    'connector-fan-return',
    'fan-current-power'
  ],
  ['wire-fan-ground', 'Fan return', 'fan-current-return', 'ground-stud'],
  ['wire-ecu-splice', 'ECU fan command', 'ecu-fan-command', 'splice-control-source'],
  ['wire-splice-relay', 'Splice to relay coil', 'splice-control-relay', 'relay-coil-in'],
  [
    'wire-splice-monitor',
    'Splice to fan monitor',
    'splice-control-monitor',
    'connector-fan-control'
  ],
  ['wire-relay-coil-return', 'Relay coil return', 'relay-coil-return', 'battery-negative']
].map(([id, label, source, target]) =>
  connection(id, label, 'system-electrical', source, target, 'electrical', null, 'electrical-wire')
);

const fluidConnectionInputs = [
  [
    'coolant-pump-engine',
    'Pump to engine',
    'system-coolant',
    'coolant-pump-out',
    'engine-coolant-in',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'coolant-engine-thermostat',
    'Engine to thermostat',
    'system-coolant',
    'engine-coolant-out',
    'coolant-thermostat-in',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'coolant-thermostat-radiator',
    'Thermostat to radiator',
    'system-coolant',
    'coolant-thermostat-radiator-out',
    'radiator-in',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'coolant-radiator-return',
    'Radiator return tube',
    'system-coolant',
    'radiator-out',
    'coolant-return-manifold-radiator',
    'medium-coolant',
    'fluid-tube'
  ],
  [
    'coolant-thermostat-bypass',
    'Thermostat bypass',
    'system-coolant',
    'coolant-thermostat-bypass-out',
    'coolant-return-manifold-bypass',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'coolant-engine-heater',
    'Heater feed',
    'system-coolant',
    'engine-coolant-heater',
    'heater-core-in',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'coolant-heater-return',
    'Heater return',
    'system-coolant',
    'heater-core-out',
    'coolant-return-manifold-heater',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'coolant-engine-turbo',
    'Turbo feed',
    'system-coolant',
    'engine-coolant-turbo',
    'turbo-cooler-in',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'coolant-turbo-return',
    'Turbo return',
    'system-coolant',
    'turbo-cooler-out',
    'coolant-return-manifold-turbo',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'coolant-manifold-pump',
    'Return manifold to pump',
    'system-coolant',
    'coolant-return-manifold-out',
    'coolant-pump-in',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'coolant-engine-bleed',
    'Engine bleed',
    'system-coolant',
    'engine-coolant-bleed',
    'expansion-tank-bleed',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'coolant-tank-fill',
    'Expansion tank fill',
    'system-coolant',
    'expansion-tank-out',
    'coolant-pump-fill',
    'medium-coolant',
    'fluid-hose'
  ],
  [
    'oil-pump-thermostat',
    'Oil pump to thermostat',
    'system-oil',
    'oil-pump-out',
    'oil-thermostat-in',
    'medium-oil',
    'fluid-pipe'
  ],
  [
    'oil-thermostat-cooler',
    'Oil cooler feed',
    'system-oil',
    'oil-thermostat-cooler-out',
    'oil-cooler-in',
    'medium-oil',
    'fluid-pipe'
  ],
  [
    'oil-cooler-return',
    'Oil cooler return',
    'system-oil',
    'oil-cooler-out',
    'oil-return-manifold-cooler',
    'medium-oil',
    'fluid-pipe'
  ],
  [
    'oil-thermostat-bypass',
    'Oil bypass',
    'system-oil',
    'oil-thermostat-bypass-out',
    'oil-return-manifold-bypass',
    'medium-oil',
    'fluid-pipe'
  ],
  [
    'oil-manifold-engine',
    'Oil manifold to engine',
    'system-oil',
    'oil-return-manifold-out',
    'engine-oil-in',
    'medium-oil',
    'fluid-pipe'
  ],
  [
    'oil-engine-pump',
    'Oil engine return',
    'system-oil',
    'engine-oil-out',
    'oil-pump-in',
    'medium-oil',
    'fluid-pipe'
  ],
  [
    'fuel-tank-pump',
    'Fuel tank supply',
    'system-fuel',
    'fuel-tank-supply',
    'fuel-pump-in',
    'medium-fuel',
    'fluid-hose'
  ],
  [
    'fuel-pump-filter',
    'Fuel pump to filter',
    'system-fuel',
    'fuel-pump-out',
    'fuel-filter-in',
    'medium-fuel',
    'fluid-hose'
  ],
  [
    'fuel-filter-rail',
    'Fuel filter to rail',
    'system-fuel',
    'fuel-filter-out',
    'fuel-rail-in',
    'medium-fuel',
    'fluid-tube'
  ],
  [
    'fuel-rail-regulator',
    'Fuel rail return',
    'system-fuel',
    'fuel-rail-out',
    'fuel-regulator-in',
    'medium-fuel',
    'fluid-hose'
  ],
  [
    'fuel-regulator-tank',
    'Fuel return to tank',
    'system-fuel',
    'fuel-regulator-out',
    'fuel-tank-return',
    'medium-fuel',
    'fluid-hose'
  ]
];
const fluidConnections = fluidConnectionInputs.map(
  ([id, label, system, source, target, medium, kind]) =>
    connection(id, label, system, source, target, 'fluid', medium, kind)
);
const connections = [...electricalConnections, ...fluidConnections];

const segments = connections.map((item, index) => ({
  id: `segment-${item.id}`,
  label: `${item.label} route`,
  start: { x: String(40 + (index % 8) * 110), y: String(1040 + Math.floor(index / 8) * 45) },
  end: { x: String(110 + (index % 8) * 110), y: String(1040 + Math.floor(index / 8) * 45) }
}));
segments.push({
  id: 'segment-shared-coolant',
  label: 'Shared coolant bundle corridor',
  start: { x: '380', y: '560' },
  end: { x: '620', y: '560' }
});
const routes = connections.map((item) => ({
  id: `route-${item.id}`,
  segmentIds: [
    `segment-${item.id}`,
    ...(['coolant-engine-heater', 'coolant-engine-turbo'].includes(item.id)
      ? ['segment-shared-coolant']
      : [])
  ]
}));

function length(decimal, source = 'entered') {
  return { decimal, unit: 'mm', source, provenance };
}

const electrical = {
  components: [
    ['battery', 'source'],
    ['fuse', 'fuse'],
    ['relay', 'relay'],
    ['ecu', 'controller'],
    ['splice-control', 'splice'],
    ['connector-fan', 'connector'],
    ['fan-current', 'load'],
    ['ground', 'ground']
  ].map(([componentId, role]) => ({ componentId, role })),
  wires: electricalConnections.map((item, index) => ({
    connectionId: item.id,
    partDefinitionId: 'definition-wire-txl',
    role:
      item.id.includes('return') || item.id.includes('ground')
        ? 'return'
        : item.id.includes('command') || item.id.includes('monitor') || item.id.includes('splice')
          ? 'discrete'
          : 'power',
    protocol: null,
    routeLength: length(String(480 + index * 35), 'measured'),
    cutLength: length(String(560 + index * 35)),
    serviceAllowance: length('80'),
    environment: 'Illustrative engine-bay routing; actual temperature and abrasion exposure unknown'
  })),
  circuits: [
    {
      id: 'circuit-aux-cooling',
      label: 'Auxiliary cooling fan',
      systemId: 'system-electrical',
      connectionIds: electricalConnections.map((item) => item.id),
      componentIds: [
        'battery',
        'fuse',
        'relay',
        'ecu',
        'splice-control',
        'connector-fan',
        'fan-current',
        'ground'
      ],
      protectionComponentIds: ['fuse']
    }
  ],
  connectors: [
    {
      componentId: 'connector-fan',
      cavities: [
        ['connector-fan-power', 'A', 'wire-relay-connector'],
        ['connector-fan-return', 'B', 'wire-connector-fan-power'],
        ['connector-fan-control', 'C', 'wire-splice-monitor']
      ].map(([portId, cavityName, wireConnectionId]) => ({
        portId,
        cavityName,
        pinMapping: cavityName,
        mateConnectionId: null,
        wireConnectionId,
        terminalPartDefinitionId: 'definition-terminal',
        sealPartDefinitionId: 'definition-seal',
        plugPartDefinitionId: null,
        unusedRequirement: 'occupied'
      }))
    }
  ],
  harnesses: [
    {
      id: 'harness-aux-cooling',
      label: 'Auxiliary cooling harness',
      componentIds: [
        'battery',
        'fuse',
        'relay',
        'ecu',
        'splice-control',
        'connector-fan',
        'fan-current',
        'ground'
      ],
      wireConnectionIds: electricalConnections.map((item) => item.id)
    }
  ],
  bundles: [
    {
      id: 'bundle-aux-cooling',
      harnessId: 'harness-aux-cooling',
      label: 'Front harness bundle',
      wireConnectionIds: electricalConnections.map((item) => item.id),
      segmentIds: electricalConnections.map((item) => `segment-${item.id}`),
      transitions: [{ segmentId: 'segment-wire-ecu-splice', kind: 'split' }],
      coverings: electricalConnections.slice(0, 3).map((item) => ({
        segmentId: `segment-${item.id}`,
        description: 'Abrasion covering',
        partDefinitionId: 'definition-covering'
      })),
      twistedPairs: [
        {
          id: 'pair-fan-monitor',
          wireConnectionIds: ['wire-ecu-splice', 'wire-splice-monitor'],
          shield: null,
          drainWireConnectionId: null,
          cutLengthAllowance: length('60'),
          notes: 'Illustrative pair only; verify actual signal construction'
        }
      ],
      concentric: {
        layers: [
          { order: 1, wireConnectionIds: ['wire-battery-fuse', 'wire-fuse-relay'] },
          { order: 2, wireConnectionIds: ['wire-relay-connector', 'wire-fan-ground'] }
        ],
        pitch: length('90', 'sourced'),
        layDirection: 'left',
        cutLengthAllowance: length('120'),
        notes: 'Illustrative construction; not a manufacturing recommendation'
      },
      notes: 'Explicit harness and bundle construction acceptance record'
    }
  ],
  cableSpecifications: [
    {
      partDefinitionId: 'definition-wire-txl',
      conductorAreaOrGauge: property('known', '18 AWG', null),
      material: property('known', 'copper', null),
      strandConstruction: property('known', 'stranded', null),
      insulation: property('known', 'TXL', null),
      color: property('conflicting', null, null, ['red', 'orange']),
      stripe: property('unknown', null, null),
      minimumTemperature: property('known', '-40', 'degC'),
      maximumTemperature: property('known', '125', 'degC'),
      resistancePerLength: property('known', '0.021', 'ohm-per-metre'),
      applicableCurrentData: property('unknown', null, null)
    }
  ]
};

function property(state, value, unit, conflictValues = []) {
  return {
    state,
    value,
    unit,
    provenance: state === 'unknown' ? null : provenance,
    conflictValues
  };
}

const fluidComponents = [
  ['coolant-pump', 'pump'],
  ['engine-coolant', 'heat-source'],
  ['coolant-thermostat', 'valve'],
  ['radiator', 'heat-exchanger'],
  ['heater-core', 'heat-exchanger'],
  ['turbo-cooler', 'heat-source'],
  ['coolant-return-manifold', 'manifold'],
  ['expansion-tank', 'volume'],
  ['oil-pump', 'pump'],
  ['oil-thermostat', 'valve'],
  ['oil-cooler', 'heat-exchanger'],
  ['oil-return-manifold', 'manifold'],
  ['engine-oil', 'endpoint'],
  ['fuel-tank', 'volume'],
  ['fuel-pump', 'pump'],
  ['fuel-filter', 'restriction'],
  ['fuel-rail', 'endpoint'],
  ['fuel-regulator', 'restriction']
].map(([componentId, role]) => ({ componentId, role }));

const definitionForConnection = (item) =>
  item.systemId === 'system-fuel'
    ? 'definition-hose-fuel'
    : item.kind === 'fluid-tube'
      ? 'definition-tube-coolant'
      : item.kind === 'fluid-pipe'
        ? 'definition-pipe-oil'
        : 'definition-hose-coolant';

const fluidLines = fluidConnections.map((item, index) => ({
  connectionId: item.id,
  partDefinitionId: definitionForConnection(item),
  construction:
    item.kind === 'fluid-hose'
      ? {
          kind: 'hose',
          reinforcement: 'illustrative reinforced hose',
          minimumBendRadius: length('75', 'sourced')
        }
      : item.kind === 'fluid-tube'
        ? {
            kind: 'tube',
            material: 'illustrative aluminium tube',
            wallThickness: length('1.5', 'sourced')
          }
        : { kind: 'pipe', material: 'illustrative steel pipe', schedule: 'project-defined' },
  routeLength: length(String(620 + index * 18), 'measured'),
  hydraulicLength: length(String(680 + index * 18), 'entered'),
  cutLength: length(String(750 + index * 18), 'entered'),
  elevation: {
    start: String((index % 5) * 20),
    end: String(((index + 2) % 5) * 20),
    unit: 'mm',
    source: 'estimated',
    provenance
  },
  environment:
    'Illustrative engine-bay route; verify actual heat, vibration, chemical, and abrasion exposure',
  provenance
}));

function behavior(id, componentId, role, mediumId) {
  const selected = components.find((item) => item.id === componentId);
  return {
    id,
    componentId,
    role,
    portIds: selected.ports.map((item) => item.id),
    mediumIds: [mediumId],
    description: `${selected.label} ${role} behavior`,
    provenance
  };
}

const fluid = {
  media: [
    {
      id: 'medium-coolant',
      label: 'Illustrative coolant',
      composition: 'Synthetic acceptance mixture; actual composition unknown',
      provenance
    },
    {
      id: 'medium-oil',
      label: 'Illustrative engine oil',
      composition: 'Synthetic acceptance fluid; actual grade unknown',
      provenance
    },
    {
      id: 'medium-fuel',
      label: 'Illustrative gasoline boundary',
      composition: 'Synthetic acceptance fuel evidence; actual composition unknown',
      provenance
    }
  ],
  systems: [
    {
      systemId: 'system-coolant',
      mediumId: 'medium-coolant',
      purpose: 'Engine, heater, and turbo thermal transport'
    },
    {
      systemId: 'system-oil',
      mediumId: 'medium-oil',
      purpose: 'Thermostatic engine oil cooling loop'
    },
    {
      systemId: 'system-fuel',
      mediumId: 'medium-fuel',
      purpose: 'Return-style fuel topology and evidence only'
    }
  ],
  components: fluidComponents,
  lines: fluidLines,
  behaviors: [
    behavior('behavior-coolant-pump', 'coolant-pump', 'pump', 'medium-coolant'),
    behavior('behavior-coolant-thermostat', 'coolant-thermostat', 'valve', 'medium-coolant'),
    behavior('behavior-radiator', 'radiator', 'heat-exchanger', 'medium-coolant'),
    behavior('behavior-engine-coolant', 'engine-coolant', 'heat-source', 'medium-coolant'),
    behavior('behavior-oil-pump', 'oil-pump', 'pump', 'medium-oil'),
    behavior('behavior-oil-thermostat', 'oil-thermostat', 'valve', 'medium-oil'),
    behavior('behavior-oil-cooler', 'oil-cooler', 'heat-exchanger', 'medium-oil'),
    behavior('behavior-fuel-pump', 'fuel-pump', 'pump', 'medium-fuel'),
    behavior('behavior-fuel-filter', 'fuel-filter', 'restriction', 'medium-fuel'),
    behavior('behavior-fuel-regulator', 'fuel-regulator', 'restriction', 'medium-fuel')
  ],
  boundaryConditions: [
    boundary(
      'boundary-coolant-temperature',
      'behavior-radiator',
      'radiator-in',
      'state-run-hot',
      'temperature',
      '88',
      'degC',
      'measured'
    ),
    boundary(
      'boundary-coolant-flow',
      'behavior-coolant-pump',
      'coolant-pump-out',
      'state-run-hot',
      'flow',
      '42',
      'litre-per-minute',
      'entered'
    ),
    boundary(
      'boundary-oil-temperature',
      'behavior-oil-thermostat',
      'oil-thermostat-in',
      'state-run-hot',
      'temperature',
      '96',
      'degC',
      'measured'
    ),
    boundary(
      'boundary-fuel-prime',
      'behavior-fuel-pump',
      'fuel-pump-out',
      'state-fuel-prime',
      'command',
      'prime',
      null,
      'entered'
    )
  ]
};

function boundary(id, behaviorId, subjectId, operatingStateId, quantity, value, unit, source) {
  return { id, behaviorId, subjectId, operatingStateId, quantity, value, unit, source, provenance };
}

function evidence(id, subjectId, label, state, value = null, unit = null, conflictValues = []) {
  return {
    id,
    subjectId,
    label,
    state,
    value,
    unit,
    provenance: state === 'unknown' ? null : provenance,
    conflictValues
  };
}

const evidenceRecords = [
  evidence('evidence-system-voltage', 'wire-battery-fuse', 'System voltage', 'known', '12.6', 'V'),
  evidence('evidence-fan-current', 'wire-relay-connector', 'Fan current', 'known', '12.5', 'A'),
  evidence(
    'evidence-coolant-flow',
    'coolant-pump-engine',
    'Coolant volume flow',
    'known',
    '42',
    'L/min'
  ),
  evidence(
    'evidence-coolant-hot',
    'coolant-thermostat-radiator',
    'Hot coolant temperature',
    'known',
    '88',
    'degC'
  ),
  evidence(
    'evidence-coolant-cold',
    'coolant-engine-thermostat',
    'Cold coolant temperature',
    'known',
    '48',
    'degC'
  ),
  evidence(
    'evidence-oil-temperature',
    'oil-pump-thermostat',
    'Oil temperature',
    'conflicting',
    null,
    'degC',
    ['94', '101']
  ),
  evidence('evidence-fuel-interface', 'fuel-filter-rail', 'Fuel tube interface', 'unknown'),
  evidence(
    'evidence-fuel-return',
    'fuel-regulator-tank',
    'Fuel return route observation',
    'known',
    'observed',
    null
  ),
  evidence(
    'evidence-fan-original-length',
    'fan-original',
    'Original fan lead length',
    'known',
    '425',
    'mm'
  ),
  evidence(
    'evidence-fan-current-observation',
    'fan-current',
    'Replacement fan installation',
    'known',
    'installed',
    null
  ),
  evidence('evidence-radiator-interface', 'radiator-in', 'Radiator inlet interface', 'unknown'),
  evidence(
    'evidence-pressure-incomplete',
    'coolant-radiator-return',
    'Minor-loss coefficient evidence',
    'unknown'
  )
];

function binding(id, subjectId, systemId, channel, overrides = {}) {
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
    pathConnectionIds: [subjectId],
    behavior: null,
    calculationResultId: null,
    evidenceIds: [],
    assumptions: [],
    omissions: [],
    applicability: 'Illustrative static Operating State; no interpolation or transient simulation',
    uncertainty: null,
    conflictValues: [],
    provenance: [provenance],
    ...overrides
  };
}

function state(id, name, description, bindings, details = {}) {
  return {
    id,
    name,
    description,
    commands: details.commands ?? [],
    conditions: details.conditions ?? [],
    measurements: details.measurements ?? [],
    assumptions: details.assumptions ?? [],
    applicableEvidenceIds: details.applicableEvidenceIds ?? [],
    bindings
  };
}

const currentPath = electricalConnections.map((item) => item.id);
const operatingStates = [
  state('state-key-off-cold', 'Key Off / Cold', 'Cold key-off evidence without interpolation.', [
    binding('binding-key-off-potential', 'wire-battery-fuse', 'system-electrical', 'potential', {
      value: '0',
      unit: 'V',
      referenceSubjectId: 'ground',
      evidenceIds: ['evidence-system-voltage']
    }),
    binding(
      'binding-key-off-coolant-zero',
      'coolant-pump-engine',
      'system-coolant',
      'fluid-direction',
      { direction: 'zero' }
    ),
    binding(
      'binding-key-off-oil-excluded',
      'oil-pump-thermostat',
      'system-oil',
      'fluid-direction',
      { evidenceState: 'excluded', direction: 'excluded', provenance: [] }
    )
  ]),
  state('state-fuel-prime', 'Fuel Prime', 'Key-on prime topology review; no injection sizing.', [
    binding('binding-prime-fuel-forward', 'fuel-tank-pump', 'system-fuel', 'fluid-direction', {
      direction: 'forward',
      pathConnectionIds: fluidConnections
        .filter((item) => item.systemId === 'system-fuel')
        .map((item) => item.id),
      behavior: {
        id: 'state-behavior-fuel-pump',
        componentId: 'fuel-pump',
        description: 'Recorded forward prime direction',
        provenance
      },
      evidenceIds: ['evidence-fuel-return']
    }),
    binding('binding-prime-signal', 'wire-ecu-splice', 'system-electrical', 'signal', {
      direction: 'driver-to-receiver',
      behavior: {
        id: 'state-behavior-prime-signal',
        componentId: 'ecu',
        description: 'ECU output treated as the recorded driver',
        provenance
      }
    })
  ]),
  state('state-run-cold', 'Run Cold', 'Cold-running static evidence.', [
    binding(
      'binding-run-cold-current-unknown',
      'wire-relay-connector',
      'system-electrical',
      'current',
      { evidenceState: 'unknown', direction: 'source-to-load', provenance: [] }
    ),
    binding(
      'binding-run-cold-temperature',
      'coolant-engine-thermostat',
      'system-coolant',
      'temperature',
      {
        value: '48',
        unit: 'degC',
        evidenceIds: ['evidence-coolant-cold'],
        omissions: ['radiator outlet temperature']
      }
    ),
    binding('binding-run-cold-fuel-unknown', 'fuel-filter-rail', 'system-fuel', 'fluid-direction', {
      evidenceState: 'unknown',
      direction: 'unknown',
      provenance: []
    })
  ]),
  state(
    'state-run-hot',
    'Run Hot / Fan On',
    'Hot-running static evidence with every overlay direction status.',
    [
      binding('binding-hot-potential', 'wire-battery-fuse', 'system-electrical', 'potential', {
        value: '12.6',
        unit: 'V',
        referenceSubjectId: 'ground',
        evidenceIds: ['evidence-system-voltage'],
        uncertainty: '±0.1 V'
      }),
      binding('binding-hot-current', 'wire-relay-connector', 'system-electrical', 'current', {
        value: '12.5',
        unit: 'A',
        direction: 'source-to-load',
        pathConnectionIds: currentPath,
        evidenceIds: ['evidence-fan-current'],
        calculationResultId: 'result-calculation-current'
      }),
      binding('binding-hot-signal', 'wire-ecu-splice', 'system-electrical', 'signal', {
        direction: 'driver-to-receiver',
        behavior: {
          id: 'state-behavior-hot-signal',
          componentId: 'ecu',
          description: 'Recorded ECU driver to relay receiver',
          provenance
        }
      }),
      binding(
        'binding-hot-coolant-forward',
        'coolant-pump-engine',
        'system-coolant',
        'fluid-direction',
        {
          direction: 'forward',
          behavior: {
            id: 'state-behavior-coolant-forward',
            componentId: 'coolant-pump',
            description: 'Pump drives stated path',
            provenance
          },
          evidenceIds: ['evidence-coolant-flow']
        }
      ),
      binding(
        'binding-hot-coolant-reverse',
        'coolant-radiator-return',
        'system-coolant',
        'fluid-direction',
        {
          direction: 'reverse',
          behavior: {
            id: 'state-behavior-coolant-reverse',
            componentId: 'radiator',
            description: 'Observed return opposite authored direction',
            provenance
          },
          evidenceIds: ['evidence-coolant-flow']
        }
      ),
      binding('binding-hot-oil-zero', 'oil-thermostat-bypass', 'system-oil', 'fluid-direction', {
        direction: 'zero'
      }),
      binding(
        'binding-hot-coolant-conflicting',
        'coolant-heater-return',
        'system-coolant',
        'fluid-direction',
        {
          evidenceState: 'conflicting',
          direction: 'conflicting',
          conflictValues: ['forward observation', 'zero observation']
        }
      ),
      binding(
        'binding-hot-fuel-excluded',
        'fuel-regulator-tank',
        'system-fuel',
        'fluid-direction',
        { evidenceState: 'excluded', direction: 'excluded', provenance: [] }
      ),
      binding(
        'binding-hot-temperature',
        'coolant-thermostat-radiator',
        'system-coolant',
        'temperature',
        { value: '88', unit: 'degC', evidenceIds: ['evidence-coolant-hot'] }
      )
    ],
    {
      commands: [
        {
          id: 'statement-hot-fan-command',
          subjectId: 'fan-current',
          label: 'Fan command',
          value: 'on',
          unit: null,
          provenance
        }
      ],
      conditions: [
        {
          id: 'statement-hot-condition',
          subjectId: 'system-coolant',
          label: 'Thermal condition',
          value: 'hot',
          unit: null,
          provenance
        }
      ],
      measurements: [
        {
          id: 'statement-hot-temperature',
          subjectId: 'coolant-thermostat-radiator',
          label: 'Bulk coolant',
          value: '88',
          unit: 'degC',
          provenance
        }
      ],
      applicableEvidenceIds: [
        'evidence-system-voltage',
        'evidence-fan-current',
        'evidence-coolant-flow',
        'evidence-coolant-hot'
      ]
    }
  ),
  state('state-heat-soak', 'Heat Soak / Key Off', 'Key-off heat-soak evidence.', [
    binding('binding-heat-soak-temperature', 'oil-pump-thermostat', 'system-oil', 'temperature', {
      evidenceState: 'conflicting',
      unit: 'degC',
      evidenceIds: ['evidence-oil-temperature'],
      conflictValues: ['94', '101']
    })
  ])
];

let quantityIndex = 0;
function quantity(semantic, decimal, unit, applicability, options = {}) {
  quantityIndex += 1;
  return {
    id: `quantity-rx7-${quantityIndex}`,
    semantic,
    decimal,
    unit,
    applicability,
    uncertainty: options.uncertainty ?? null,
    bounds: options.bounds ?? null,
    origin: options.origin ?? 'entered',
    provenance
  };
}

function calculation(id, subjectId, operatingStateId, formulaId, pathId, inputs, options = {}) {
  return {
    id,
    subjectId,
    operatingStateId,
    formulaId,
    pathId,
    inputs: Object.entries(inputs).map(([name, input]) => ({ name, quantity: input })),
    assumptions: options.assumptions ?? [],
    conditions: options.conditions ?? {},
    omissions: options.omissions ?? [],
    desiredOutputUnit: options.desiredOutputUnit ?? null
  };
}

const calculations = [
  calculation(
    'calculation-current',
    'wire-relay-connector',
    'state-run-hot',
    'electrical.current.voltage-resistance.v1',
    'route-wire-relay-connector',
    {
      voltage: quantity('electric-potential', '12.6', 'volt', 'Run Hot / Fan On'),
      resistance: quantity('electrical-resistance', '1.008', 'ohm', 'Run Hot / Fan On')
    },
    { desiredOutputUnit: 'ampere', assumptions: ['steady DC'] }
  ),
  calculation(
    'calculation-conductor-resistance',
    'wire-relay-connector',
    'state-run-hot',
    'electrical.conductor-resistance.v1',
    'route-wire-relay-connector',
    {
      'resistance-per-length': quantity(
        'resistance-per-length',
        '0.021',
        'ohm-per-metre',
        '18 AWG at stated temperature'
      ),
      length: quantity('length', '1.1', 'metre', 'Conductor-only route')
    },
    { desiredOutputUnit: 'ohm', omissions: ['connector and ground-path resistance'] }
  ),
  calculation(
    'calculation-voltage-drop',
    'wire-relay-connector',
    'state-run-hot',
    'electrical.voltage-drop.v1',
    'route-wire-relay-connector',
    {
      current: quantity('electric-current', '12.5', 'ampere', 'Run Hot / Fan On', {
        bounds: { lower: '11.8', upper: '13.2' }
      }),
      resistance: quantity('electrical-resistance', '0.0231', 'ohm', 'Conductor-only subtotal', {
        bounds: { lower: '0.020', upper: '0.027' }
      })
    },
    {
      desiredOutputUnit: 'volt',
      assumptions: ['steady DC'],
      omissions: ['connector and return losses']
    }
  ),
  calculation(
    'calculation-coolant-area',
    'coolant-pump-engine',
    'state-run-hot',
    'fluid.circular-area.v1',
    'route-coolant-pump-engine',
    {
      'inside-diameter': quantity('length', '0.032', 'metre', 'Illustrative 32 mm coolant ID')
    },
    { desiredOutputUnit: 'square-metre' }
  ),
  calculation(
    'calculation-coolant-velocity',
    'coolant-pump-engine',
    'state-run-hot',
    'fluid.mean-velocity.v1',
    'route-coolant-pump-engine',
    {
      'volume-flow': quantity('volumetric-flow', '42', 'litre-per-minute', 'Run Hot / Fan On'),
      area: quantity('area', '0.000804247719318987', 'square-metre', 'Calculated circular area', {
        origin: 'calculated'
      })
    },
    { desiredOutputUnit: 'metre-per-second' }
  ),
  calculation(
    'calculation-pressure-complete',
    'coolant-pump-engine',
    'state-run-hot',
    'fluid.total-pressure-loss.v1',
    'route-coolant-pump-engine',
    {
      'pressure-loss:major': quantity(
        'pressure-difference',
        '2100',
        'pascal',
        'Straight line term'
      ),
      'pressure-loss:minor': quantity(
        'pressure-difference',
        '700',
        'pascal',
        'Explicit fitting terms'
      )
    },
    { desiredOutputUnit: 'kilopascal' }
  ),
  calculation(
    'calculation-pressure-incomplete',
    'coolant-radiator-return',
    'state-run-hot',
    'fluid.total-pressure-loss.v1',
    'route-coolant-radiator-return',
    {
      'pressure-loss:major': quantity(
        'pressure-difference',
        '1800',
        'pascal',
        'Known straight-line term'
      )
    },
    { desiredOutputUnit: 'kilopascal', omissions: ['unknown radiator and fitting losses'] }
  ),
  calculation(
    'calculation-thermostat-region',
    'coolant-thermostat-radiator',
    'state-run-hot',
    'fluid.thermostat-region.v1',
    'route-coolant-thermostat-radiator',
    {
      'measured-temperature': quantity(
        'temperature-absolute',
        '88',
        'celsius-absolute',
        'Run Hot / Fan On'
      ),
      'begin-open-lower': quantity(
        'temperature-absolute',
        '80',
        'celsius-absolute',
        'Illustrative sourced thermostat range'
      ),
      'begin-open-upper': quantity(
        'temperature-absolute',
        '84',
        'celsius-absolute',
        'Illustrative sourced thermostat range'
      ),
      'full-open-lower': quantity(
        'temperature-absolute',
        '92',
        'celsius-absolute',
        'Illustrative sourced thermostat range'
      ),
      'full-open-upper': quantity(
        'temperature-absolute',
        '96',
        'celsius-absolute',
        'Illustrative sourced thermostat range'
      )
    }
  ),
  calculation(
    'calculation-sensible-heat',
    'coolant-thermostat-radiator',
    'state-run-hot',
    'fluid.sensible-heat.v1',
    'route-coolant-thermostat-radiator',
    {
      'mass-flow': quantity(
        'mass-flow',
        '0.72',
        'kilogram-per-second',
        'Illustrative coolant stream'
      ),
      'specific-heat': quantity(
        'specific-heat-capacity',
        '3600',
        'joule-per-kilogram-kelvin',
        'Illustrative composition and temperature'
      ),
      'inlet-temperature': quantity(
        'temperature-absolute',
        '88',
        'celsius-absolute',
        'Bulk inlet measurement'
      ),
      'outlet-temperature': quantity(
        'temperature-absolute',
        '82',
        'celsius-absolute',
        'Bulk outlet measurement'
      )
    },
    { desiredOutputUnit: 'kilowatt', omissions: ['not a radiator-capacity claim'] }
  ),
  calculation(
    'calculation-unknown-flow',
    'coolant-engine-bleed',
    'state-run-hot',
    'fluid.mean-velocity.v1',
    'route-coolant-engine-bleed',
    {
      'volume-flow': quantity('volumetric-flow', '0.3', 'litre-per-minute', 'Bleed observation')
    },
    { desiredOutputUnit: 'metre-per-second', omissions: ['inside area is unknown'] }
  ),
  calculation(
    'calculation-unsupported-voltage',
    'wire-battery-fuse',
    'state-run-hot',
    'electrical.current.voltage-resistance.v1',
    'route-wire-battery-fuse',
    {
      voltage: quantity('electric-potential', '61', 'volt', 'Outside low-voltage support envelope'),
      resistance: quantity('electrical-resistance', '2', 'ohm', 'Illustrative unsupported case')
    },
    { desiredOutputUnit: 'ampere' }
  )
];

function screening(id, subjectId, operatingStateId, candidateIds, criterion) {
  const limit = quantity(criterion.semantic, criterion.limit, criterion.unit, criterion.label);
  return {
    id,
    subjectId,
    operatingStateId,
    criteria: [
      {
        id: `${id}-criterion`,
        label: criterion.label,
        evidenceKey: 'limit',
        applicability: 'applicable',
        comparison: { kind: criterion.kind, limit }
      }
    ],
    selectedCandidates: candidateIds.map((candidateId, index) => ({
      id: candidateId,
      label: partDefinitions.find((definition) => definition.id === candidateId).label,
      evidence: {
        limit:
          index === candidateIds.length - 1 && id === 'screening-coupling'
            ? null
            : {
                kind: 'quantity',
                quantity: quantity(
                  criterion.semantic,
                  index === 0 ? criterion.passValue : criterion.failValue,
                  criterion.unit,
                  criterion.label,
                  index === 0 && id === 'screening-hose'
                    ? { bounds: { lower: criterion.failValue, upper: criterion.passValue } }
                    : {}
                )
              }
      }
    }))
  };
}

const screenings = [
  screening(
    'screening-wire',
    'wire-relay-connector',
    'state-run-hot',
    ['definition-wire-txl', 'definition-wire-alt'],
    {
      label: 'Current evidence',
      semantic: 'electric-current',
      unit: 'ampere',
      kind: 'at-least',
      limit: '15',
      passValue: '20',
      failValue: '10'
    }
  ),
  screening('screening-fuse', 'fuse', 'state-run-hot', ['definition-fuse', 'definition-fuse-alt'], {
    label: 'Voltage evidence',
    semantic: 'electric-potential',
    unit: 'volt',
    kind: 'at-least',
    limit: '12',
    passValue: '32',
    failValue: '6'
  }),
  screening(
    'screening-hose',
    'coolant-pump-engine',
    'state-run-hot',
    ['definition-hose-coolant', 'definition-hose-alt'],
    {
      label: 'Temperature evidence',
      semantic: 'temperature-absolute',
      unit: 'celsius-absolute',
      kind: 'at-least',
      limit: '100',
      passValue: '110',
      failValue: '95'
    }
  ),
  screening(
    'screening-fitting',
    'coolant-radiator-return',
    'state-run-hot',
    ['definition-fitting', 'definition-fitting-alt'],
    {
      label: 'Pressure evidence',
      semantic: 'pressure-difference',
      unit: 'kilopascal',
      kind: 'at-least',
      limit: '250',
      passValue: '500',
      failValue: '150'
    }
  ),
  screening(
    'screening-coupling',
    'fuel-filter-rail',
    'state-fuel-prime',
    ['definition-coupling', 'definition-coupling-alt'],
    {
      label: 'Temperature evidence',
      semantic: 'temperature-absolute',
      unit: 'celsius-absolute',
      kind: 'at-least',
      limit: '80',
      passValue: '100',
      failValue: '60'
    }
  )
];

function calculationResult(request, status, completeness, output, reason = null) {
  return {
    id: `result-${request.id}`,
    sourceRevision: 42,
    status: 'current',
    kind: 'calculation',
    detail: {
      type: 'calculation',
      outcome: {
        status,
        completeness,
        output,
        bounds: null,
        reason,
        omissions: request.omissions,
        trace: {
          calculationId: request.id,
          subjectId: request.subjectId,
          operatingStateId: request.operatingStateId,
          pathId: request.pathId,
          formulaId: request.formulaId,
          formulaRevision: 1,
          inputIds: request.inputs.map((input) => input.quantity.id),
          assumptions: request.assumptions,
          conditions: request.conditions,
          applicability: [provenance],
          calculatedAt: generatedAt
        }
      }
    }
  };
}

const resultByCalculation = new Map(calculations.map((request) => [request.id, request]));
const calculationResults = [
  calculationResult(
    resultByCalculation.get('calculation-current'),
    'calculated',
    'complete-for-stated-model',
    { kind: 'quantity', semantic: 'electric-current', decimal: '12.5', unit: 'ampere' }
  ),
  calculationResult(
    resultByCalculation.get('calculation-conductor-resistance'),
    'calculated',
    'known-subtotal',
    { kind: 'quantity', semantic: 'electrical-resistance', decimal: '0.0231', unit: 'ohm' }
  ),
  calculationResult(
    resultByCalculation.get('calculation-voltage-drop'),
    'calculated',
    'known-subtotal',
    { kind: 'quantity', semantic: 'electric-potential', decimal: '0.28875', unit: 'volt' }
  ),
  calculationResult(
    resultByCalculation.get('calculation-coolant-area'),
    'calculated',
    'complete-for-stated-model',
    { kind: 'quantity', semantic: 'area', decimal: '0.000804247719318987', unit: 'square-metre' }
  ),
  calculationResult(
    resultByCalculation.get('calculation-coolant-velocity'),
    'calculated',
    'complete-for-stated-model',
    { kind: 'quantity', semantic: 'velocity', decimal: '0.870378', unit: 'metre-per-second' }
  ),
  calculationResult(
    resultByCalculation.get('calculation-pressure-complete'),
    'calculated',
    'complete-for-stated-model',
    { kind: 'quantity', semantic: 'pressure-difference', decimal: '2.8', unit: 'kilopascal' }
  ),
  calculationResult(
    resultByCalculation.get('calculation-pressure-incomplete'),
    'calculated',
    'known-subtotal',
    { kind: 'quantity', semantic: 'pressure-difference', decimal: '1.8', unit: 'kilopascal' }
  ),
  calculationResult(
    resultByCalculation.get('calculation-thermostat-region'),
    'calculated',
    'complete-for-stated-model',
    { kind: 'classification', value: 'between begin-open and full-open ranges' }
  ),
  calculationResult(
    resultByCalculation.get('calculation-sensible-heat'),
    'calculated',
    'known-subtotal',
    { kind: 'quantity', semantic: 'power', decimal: '15.552', unit: 'kilowatt' }
  ),
  calculationResult(
    resultByCalculation.get('calculation-unknown-flow'),
    'unknown',
    'unknown',
    null,
    'missing-input: area'
  ),
  calculationResult(
    resultByCalculation.get('calculation-unsupported-voltage'),
    'unsupported',
    'unsupported',
    null,
    'outside-low-voltage-envelope'
  ),
  {
    id: 'result-failed-evaluator',
    sourceRevision: 42,
    status: 'failed',
    kind: 'evaluation-failure',
    detail: null
  }
];

const findings = [
  finding(
    'finding-active-interface',
    'topology.interface-known',
    'radiator-in',
    'active',
    'unreviewed',
    'Radiator inlet compatibility is Unknown.'
  ),
  finding(
    'finding-acknowledged-pressure',
    'fluid.pressure-completeness',
    'coolant-radiator-return',
    'active',
    'acknowledged',
    'Pressure-loss evidence omits radiator and fitting losses.'
  ),
  finding(
    'finding-suppressed-color',
    'electrical.cable-evidence',
    'definition-wire-txl',
    'active',
    'suppressed',
    'Wire color evidence conflicts.'
  ),
  finding(
    'finding-resolved-route',
    'topology.route-present',
    'fuel-filter-rail',
    'resolved',
    'unreviewed',
    'Fuel route was previously absent and is now resolved.'
  )
];

function finding(id, ruleId, subjectId, lifecycle, dispositionKind, claim) {
  const disposition =
    dispositionKind === 'unreviewed'
      ? { kind: 'unreviewed' }
      : {
          kind: dispositionKind,
          ruleId,
          ruleRevision: 1,
          subjectId,
          scopeKey: 'profile:build-preparation',
          occurrenceNumber: 1,
          recordedAtRevision: 41,
          rationale: `${dispositionKind} with explicit illustrative rationale`,
          invalidationKey: '0123456789abcdef'
        };
  return {
    id,
    ruleId,
    ruleRevision: 1,
    subjectId,
    scopeKey: 'profile:build-preparation',
    claim,
    severity: lifecycle === 'resolved' ? 'information' : 'caution',
    severityRationale: 'Bounded to the stated subject and review profile',
    evaluation: 'current',
    lifecycle,
    unknownReason: lifecycle === 'resolved' ? null : 'missing',
    knownEvidence: [],
    unknownEvidence: lifecycle === 'resolved' ? [] : ['explicit missing evidence'],
    affectedOperation: 'Build preparation review',
    inputIds: [],
    assumptions: [],
    trace: {
      ruleId,
      ruleRevision: 1,
      subjectId,
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
        openedAtRevision: 40,
        resolvedAtRevision: lifecycle === 'resolved' ? 42 : null,
        resolutionReason: lifecycle === 'resolved' ? 'reevaluated-passed' : null
      }
    ],
    correctiveActions: ['Record the missing evidence and revalidate the bounded scope.'],
    invalidationKey: '0123456789abcdef'
  };
}

const validationRuns = [
  'topology-review',
  'engineering-review',
  'build-preparation',
  'as-built-review'
].map((profileId, index) => ({
  id: `validation-run-${profileId}`,
  projectRevision: 42,
  scope: { kind: 'review-profile', profileId },
  scopeKey: `profile:${profileId}`,
  profileId,
  status: 'current',
  evaluatedAt: generatedAt,
  ruleIds: [...new Set(findings.map((item) => item.ruleId))],
  findingIds: findings.map((item) => item.id),
  coverage: {
    applicable: 4,
    evaluated: 4,
    passed: index,
    activeFinding: 3,
    unknown: 0,
    stale: 0,
    unsupported: 0,
    failed: 0,
    excluded: 0,
    notApplicable: 0,
    entries: []
  }
}));

const validationResult = {
  id: 'result-validation',
  sourceRevision: 42,
  status: 'current',
  kind: 'validation',
  detail: {
    type: 'validation',
    history: {
      findings,
      runs: validationRuns,
      currentRunIds: validationRuns.map((run) => run.id)
    }
  }
};

const partRequirements = [
  requirement(
    'requirement-wire-power',
    'wire-relay-connector',
    'definition-wire-txl',
    '18 AWG red',
    '2.4',
    'm',
    'electrical',
    'system-electrical'
  ),
  requirement(
    'requirement-wire-control',
    'wire-ecu-splice',
    'definition-wire-txl',
    '18 AWG red',
    '1.8',
    'm',
    'electrical',
    'system-electrical'
  ),
  requirement(
    'requirement-clamp-electrical',
    'bundle-aux-cooling',
    'definition-clamp',
    '12 mm',
    '4',
    'ea',
    'electrical',
    'system-electrical'
  ),
  requirement(
    'requirement-clamp-coolant',
    'coolant-pump-engine',
    'definition-clamp',
    '12 mm',
    '6',
    'ea',
    'fluid',
    'system-coolant'
  ),
  requirement(
    'requirement-coolant-hose',
    'coolant-pump-engine',
    'definition-hose-coolant',
    '32 mm',
    '1.25',
    'm',
    'fluid',
    'system-coolant'
  ),
  requirement(
    'requirement-coolant-tube',
    'coolant-radiator-return',
    'definition-tube-coolant',
    '32 mm',
    '0.8',
    'm',
    'fluid',
    'system-coolant'
  ),
  requirement(
    'requirement-oil-pipe',
    'oil-pump-thermostat',
    'definition-pipe-oil',
    '10 mm',
    '2.1',
    'm',
    'fluid',
    'system-oil'
  ),
  requirement(
    'requirement-fuel-hose',
    'fuel-tank-pump',
    'definition-hose-fuel',
    '8 mm',
    '3.4',
    'm',
    'fluid',
    'system-fuel'
  ),
  requirement(
    'requirement-fuel-fitting',
    'fuel-filter-rail',
    'definition-fitting',
    '8 mm tube-to-hose',
    '2',
    'ea',
    'fluid',
    'system-fuel'
  ),
  requirement(
    'requirement-fuel-coupling',
    'fuel-regulator-tank',
    'definition-coupling',
    '8 mm service coupling',
    '1',
    'ea',
    'fluid',
    'system-fuel'
  )
];

function requirement(id, subjectId, partDefinitionId, variant, quantity, unit, domain, systemId) {
  return {
    id,
    subjectId,
    partDefinitionId,
    variant,
    label: `${variant} requirement`,
    quantity,
    unit,
    domain,
    systemId
  };
}

const build = {
  procurementChoices: [
    {
      id: 'procurement-wire-spool',
      partDefinitionId: 'definition-wire-txl',
      variant: '18 AWG red',
      unit: 'm',
      purchasedQuantity: '10',
      method: 'spool',
      packageSize: '10',
      sparePercent: null,
      wasteQuantity: null,
      consumableQuantity: null,
      note: 'One explicit spool; exact design demand remains separate',
      provenance: 'Illustrative user procurement choice'
    },
    {
      id: 'procurement-hose-package',
      partDefinitionId: 'definition-hose-fuel',
      variant: '8 mm',
      unit: 'm',
      purchasedQuantity: '5',
      method: 'package',
      packageSize: '5',
      sparePercent: '10',
      wasteQuantity: '0.5',
      consumableQuantity: null,
      note: 'Package, spare, and waste choices are explicit evidence',
      provenance: 'Illustrative user procurement choice'
    }
  ],
  installations: [
    {
      id: 'installation-fan-original',
      subjectId: 'fan-original',
      status: 'removed',
      installedPartDefinitionId: 'definition-fan',
      installedVariant: 'Original unknown fan',
      quantity: '1',
      unit: 'ea',
      measuredEvidenceIds: ['evidence-fan-original-length'],
      observationEvidenceIds: [],
      substitution: null,
      photoAssetHashes: [assetHash],
      notes: 'Retained as predecessor evidence after physical replacement',
      recordedAt: '2026-09-01T15:00:00.000Z',
      provenance: 'Illustrative workshop removal record'
    },
    {
      id: 'installation-fan-current',
      subjectId: 'fan-current',
      status: 'installed',
      installedPartDefinitionId: 'definition-fan',
      installedVariant: 'Illustrative 12 V replacement fan',
      quantity: '1',
      unit: 'ea',
      measuredEvidenceIds: [],
      observationEvidenceIds: ['evidence-fan-current-observation'],
      substitution: {
        intendedPartDefinitionId: 'definition-fan',
        installedPartDefinitionId: 'definition-fan',
        reason: 'Exact installed variant recorded after physical inspection'
      },
      photoAssetHashes: [assetHash],
      notes: 'Mounted to illustrative radiator brackets; verify actual fasteners and clearance',
      recordedAt: '2026-09-01T16:00:00.000Z',
      provenance: 'Illustrative workshop installation record'
    }
  ]
};

const payload = {
  schemaVersion: 8,
  project: {
    id: 'reference-rx7-v1',
    name: 'Illustrative RX-7 vehicle systems study',
    revision: 42,
    createdAt: '2026-09-01T00:00:00.000Z'
  },
  topology: {
    systems: [
      {
        id: 'system-electrical',
        label: 'Auxiliary cooling electrical',
        domain: 'electrical',
        mediumId: null
      },
      {
        id: 'system-coolant',
        label: 'Engine coolant',
        domain: 'fluid',
        mediumId: 'medium-coolant'
      },
      {
        id: 'system-oil',
        label: 'Thermostatic engine oil',
        domain: 'fluid',
        mediumId: 'medium-oil'
      },
      { id: 'system-fuel', label: 'Return-style fuel', domain: 'fluid', mediumId: 'medium-fuel' }
    ],
    components,
    connections,
    routes,
    segments
  },
  electrical,
  fluid,
  calculations,
  screenings,
  partDefinitions,
  partRequirements,
  build,
  evidence: evidenceRecords,
  results: [...calculationResults, validationResult],
  validationApplicabilityDecisions: [],
  tombstones: [{ subjectId: 'fan-original', subjectKind: 'component', successorId: 'fan-current' }],
  engineeringValues: [
    { id: 'value-reference-voltage', decimal: '12.6', unit: 'volt', provenance },
    { id: 'value-coolant-flow', decimal: '42', unit: 'litre-per-minute', provenance }
  ],
  operatingStates,
  settings: { unitSystem: 'metric' },
  assetHashes: [assetHash],
  vehicleBackground: {
    assetHash,
    mimeType: 'image/png',
    calibration: {
      first: { x: '0', y: '0' },
      second: { x: '100', y: '0' },
      distance: { decimal: '1000', unit: 'mm' }
    },
    position: { x: '0', y: '0' },
    opacity: '0.18',
    visible: false,
    locked: true
  }
};

const exportMetadata = {
  exportedAt: generatedAt,
  generator: 'venae-machinae',
  revisionState: 'Durable revision'
};
const envelope = {
  format: 'venae-project',
  exchangeVersion: 1,
  applicationVersion: '0.1.0',
  identity: { projectId: payload.project.id, projectRevision: payload.project.revision },
  payload,
  assets: [
    {
      sha256: assetHash,
      mimeType: 'image/png',
      byteLength: pngBytes.length,
      base64: pngBase64
    }
  ],
  integrity: {
    algorithm: 'SHA-256',
    payloadSha256: sha256(canonicalJson(payload)),
    exportMetadataSha256: sha256(canonicalJson(exportMetadata)),
    assets: [{ sha256: assetHash, byteLength: pngBytes.length }]
  },
  exportMetadata
};

await writeFile(destination, `${JSON.stringify(envelope, null, 2)}\n`);
