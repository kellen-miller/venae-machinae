import type { SubjectId, Topology } from '../topology/topology';

export type ElectricalComponentRole =
  | 'source'
  | 'ground'
  | 'fuse'
  | 'relay'
  | 'switch'
  | 'load'
  | 'controller'
  | 'connector'
  | 'splice'
  | 'bus';

export type ElectricalConductorRole = 'power' | 'return' | 'analog' | 'discrete' | 'pwm' | 'data';

export type ElectricalLength = Readonly<{
  decimal: string;
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  source: 'estimated' | 'measured' | 'entered' | 'sourced';
  provenance: string;
}>;

export type ElectricalComponentRecord = Readonly<{
  componentId: SubjectId;
  role: ElectricalComponentRole;
}>;

export type ElectricalWire = Readonly<{
  connectionId: SubjectId;
  partDefinitionId: SubjectId | null;
  role: ElectricalConductorRole;
  protocol: string | null;
  routeLength: ElectricalLength | null;
  cutLength: ElectricalLength | null;
  serviceAllowance: ElectricalLength | null;
  environment: string;
}>;

export type ElectricalCircuit = Readonly<{
  id: SubjectId;
  label: string;
  systemId: SubjectId;
  connectionIds: readonly SubjectId[];
  componentIds: readonly SubjectId[];
  protectionComponentIds: readonly SubjectId[];
}>;

export type ElectricalConnectorCavity = Readonly<{
  portId: SubjectId;
  cavityName: string;
  pinMapping: string | null;
  mateConnectionId: SubjectId | null;
  wireConnectionId: SubjectId | null;
  terminalPartDefinitionId: SubjectId | null;
  sealPartDefinitionId: SubjectId | null;
  plugPartDefinitionId: SubjectId | null;
  unusedRequirement: 'occupied' | 'cavity-plug-required' | 'seal-required' | 'open-allowed';
}>;

export type ElectricalConnector = Readonly<{
  componentId: SubjectId;
  cavities: readonly ElectricalConnectorCavity[];
}>;

export type ElectricalHarness = Readonly<{
  id: SubjectId;
  label: string;
  componentIds: readonly SubjectId[];
  wireConnectionIds: readonly SubjectId[];
}>;

export type ElectricalCovering = Readonly<{
  segmentId: SubjectId;
  description: string;
  partDefinitionId: SubjectId | null;
}>;

export type ElectricalBundleTransition = Readonly<{
  segmentId: SubjectId;
  kind: 'split' | 'join';
}>;

export type ElectricalTwistedPair = Readonly<{
  id: SubjectId;
  wireConnectionIds: readonly [SubjectId, SubjectId];
  shield: string | null;
  drainWireConnectionId: SubjectId | null;
  cutLengthAllowance: ElectricalLength | null;
  notes: string;
}>;

export type ElectricalConcentricLayer = Readonly<{
  order: number;
  wireConnectionIds: readonly SubjectId[];
}>;

export type ElectricalConcentricConstruction = Readonly<{
  layers: readonly ElectricalConcentricLayer[];
  pitch: ElectricalLength | null;
  layDirection: 'left' | 'right';
  cutLengthAllowance: ElectricalLength | null;
  notes: string;
}>;

export type ElectricalBundle = Readonly<{
  id: SubjectId;
  harnessId: SubjectId;
  label: string;
  wireConnectionIds: readonly SubjectId[];
  segmentIds: readonly SubjectId[];
  transitions: readonly ElectricalBundleTransition[];
  coverings: readonly ElectricalCovering[];
  twistedPairs: readonly ElectricalTwistedPair[];
  concentric: ElectricalConcentricConstruction | null;
  notes: string;
}>;

export type ElectricalProperty = Readonly<{
  state: 'known' | 'unknown' | 'conflicting';
  value: string | null;
  unit: string | null;
  provenance: string | null;
  conflictValues: readonly string[];
}>;

export type ElectricalCableSpecification = Readonly<{
  partDefinitionId: SubjectId;
  conductorAreaOrGauge: ElectricalProperty;
  material: ElectricalProperty;
  strandConstruction: ElectricalProperty;
  insulation: ElectricalProperty;
  color: ElectricalProperty;
  stripe: ElectricalProperty;
  minimumTemperature: ElectricalProperty;
  maximumTemperature: ElectricalProperty;
  resistancePerLength: ElectricalProperty;
  applicableCurrentData: ElectricalProperty;
}>;

export type ElectricalModel = Readonly<{
  components: readonly ElectricalComponentRecord[];
  wires: readonly ElectricalWire[];
  circuits: readonly ElectricalCircuit[];
  connectors: readonly ElectricalConnector[];
  harnesses: readonly ElectricalHarness[];
  bundles: readonly ElectricalBundle[];
  cableSpecifications: readonly ElectricalCableSpecification[];
}>;

export type ElectricalNet = Readonly<{
  id: string;
  systemId: SubjectId | null;
  portIds: readonly SubjectId[];
  connectionIds: readonly SubjectId[];
}>;

export type ElectricalModelRejection = Readonly<{
  code: 'invalid-electrical-reference' | 'invalid-electrical-record';
  message: string;
}>;

export function createEmptyElectricalModel(): ElectricalModel {
  return {
    components: [],
    wires: [],
    circuits: [],
    connectors: [],
    harnesses: [],
    bundles: [],
    cableSpecifications: []
  };
}

export function deriveElectricalNets(topology: Topology): readonly ElectricalNet[] {
  const electricalPorts = topology.components.flatMap((component) =>
    component.ports.filter((port) => port.domain === 'electrical')
  );
  const parents = new Map(electricalPorts.map((port) => [port.id, port.id]));

  function root(portId: SubjectId): SubjectId {
    let current = portId;
    while (parents.get(current) !== current) current = parents.get(current)!;
    let next = portId;
    while (parents.get(next) !== current) {
      const parent = parents.get(next)!;
      parents.set(next, current);
      next = parent;
    }
    return current;
  }

  function join(left: SubjectId, right: SubjectId): void {
    const leftRoot = root(left);
    const rightRoot = root(right);
    if (leftRoot === rightRoot) return;
    const [first, second] = [leftRoot, rightRoot].sort();
    parents.set(second!, first!);
  }

  const electricalConnections = topology.connections.filter(
    (connection) => connection.domain === 'electrical'
  );
  for (const connection of electricalConnections) {
    join(connection.sourcePortId, connection.targetPortId);
  }
  for (const component of topology.components.filter(
    (candidate) => candidate.kind === 'junction'
  )) {
    const ports = component.ports.filter((port) => port.domain === 'electrical');
    for (let index = 1; index < ports.length; index += 1) {
      join(ports[0]!.id, ports[index]!.id);
    }
  }

  const groups = new Map<SubjectId, SubjectId[]>();
  for (const port of electricalPorts) {
    const group = groups.get(root(port.id)) ?? [];
    group.push(port.id);
    groups.set(root(port.id), group);
  }

  return [...groups.values()]
    .map((portIds) => {
      const sortedPortIds = [...portIds].sort();
      const portSet = new Set(sortedPortIds);
      const connections = electricalConnections.filter(
        (connection) => portSet.has(connection.sourcePortId) && portSet.has(connection.targetPortId)
      );
      const systemIds = [...new Set(connections.map((connection) => connection.systemId))];
      if (systemIds.length > 1) {
        throw new Error(`Electrical Junction crosses Systems ${systemIds.join(', ')}`);
      }
      const systemId = systemIds[0] ?? null;
      return {
        id: `electrical-net:${systemId ?? 'unassigned'}:${sortedPortIds[0]}`,
        systemId,
        portIds: sortedPortIds,
        connectionIds: connections.map((connection) => connection.id).sort()
      };
    })
    .sort((left, right) => left.portIds[0]!.localeCompare(right.portIds[0]!));
}

export function deriveCircuitNetIds(
  circuit: ElectricalCircuit,
  nets: readonly ElectricalNet[]
): readonly string[] {
  const connectionIds = new Set(circuit.connectionIds);
  return nets
    .filter((net) => net.connectionIds.some((connectionId) => connectionIds.has(connectionId)))
    .map((net) => net.id);
}

export function validateElectricalModel(
  topology: Topology,
  partDefinitions: readonly Readonly<{ id: SubjectId }>[],
  model: ElectricalModel
): ElectricalModelRejection | null {
  const components = new Map(topology.components.map((component) => [component.id, component]));
  const connections = new Map(
    topology.connections.map((connection) => [connection.id, connection])
  );
  const systems = new Map(topology.systems.map((system) => [system.id, system]));
  const segments = new Map(topology.segments.map((segment) => [segment.id, segment]));
  const definitionIds = new Set(partDefinitions.map((definition) => definition.id));

  const classified = new Set<SubjectId>();
  for (const record of model.components) {
    const component = components.get(record.componentId);
    if (!component || !component.ports.some((port) => port.domain === 'electrical')) {
      return invalidReference(`Electrical role references absent Component ${record.componentId}`);
    }
    if (classified.has(record.componentId)) {
      return invalidRecord(`Component ${record.componentId} has more than one electrical role`);
    }
    if ((record.role === 'splice' || record.role === 'bus') && component.kind !== 'junction') {
      return invalidRecord(`${record.role} Component ${record.componentId} must be a Junction`);
    }
    classified.add(record.componentId);
  }

  const configuredWires = new Set<SubjectId>();
  for (const wire of model.wires) {
    const connection = connections.get(wire.connectionId);
    if (!connection || connection.kind !== 'electrical-wire') {
      return invalidReference(`Wire record references absent Wire ${wire.connectionId}`);
    }
    if (wire.partDefinitionId !== null && !definitionIds.has(wire.partDefinitionId)) {
      return invalidReference(
        `Wire ${wire.connectionId} references absent Part Definition ${wire.partDefinitionId}`
      );
    }
    if (configuredWires.has(wire.connectionId)) {
      return invalidRecord(`Wire ${wire.connectionId} is configured more than once`);
    }
    for (const [label, length] of [
      ['Route Length', wire.routeLength],
      ['Cut Length', wire.cutLength],
      ['service allowance', wire.serviceAllowance]
    ] as const) {
      if (length && !(Number(length.decimal) >= 0)) {
        return invalidRecord(`${label} for ${wire.connectionId} must be nonnegative`);
      }
    }
    if (
      (wire.cutLength && !['entered', 'sourced'].includes(wire.cutLength.source)) ||
      (wire.serviceAllowance && !['entered', 'sourced'].includes(wire.serviceAllowance.source))
    ) {
      return invalidRecord(
        `Cut Length and service allowance for ${wire.connectionId} must be entered or sourced`
      );
    }
    configuredWires.add(wire.connectionId);
  }

  const identities = new Set<SubjectId>();
  for (const circuit of model.circuits) {
    if (identities.has(circuit.id))
      return invalidRecord(`Duplicate electrical identity ${circuit.id}`);
    identities.add(circuit.id);
    const system = systems.get(circuit.systemId);
    if (!system || system.domain !== 'electrical') {
      return invalidReference(`Circuit ${circuit.id} references absent Electrical System`);
    }
    if (
      circuit.connectionIds.some((connectionId) => {
        const connection = connections.get(connectionId);
        return (
          !connection ||
          connection.systemId !== circuit.systemId ||
          connection.domain !== 'electrical'
        );
      }) ||
      circuit.componentIds.some((componentId) => !components.has(componentId))
    ) {
      return invalidReference(
        `Circuit ${circuit.id} references topology outside its Electrical System`
      );
    }
    if (
      circuit.protectionComponentIds.some(
        (componentId) =>
          !circuit.componentIds.includes(componentId) ||
          !model.components.some(
            (record) => record.componentId === componentId && record.role === 'fuse'
          )
      )
    ) {
      return invalidReference(`Circuit ${circuit.id} references a non-fuse protection Component`);
    }
  }

  for (const connector of model.connectors) {
    const component = components.get(connector.componentId);
    if (
      !component ||
      !model.components.some(
        (record) => record.componentId === connector.componentId && record.role === 'connector'
      )
    ) {
      return invalidReference(
        `Connector record references absent Connector ${connector.componentId}`
      );
    }
    if (
      new Set(connector.cavities.map((cavity) => cavity.portId)).size !== connector.cavities.length
    ) {
      return invalidRecord(`Connector ${connector.componentId} repeats a cavity Port`);
    }
    for (const cavity of connector.cavities) {
      if (
        !component.ports.some((port) => port.id === cavity.portId && port.domain === 'electrical')
      ) {
        return invalidReference(`Connector cavity references absent Port ${cavity.portId}`);
      }
      const wire = cavity.wireConnectionId ? connections.get(cavity.wireConnectionId) : undefined;
      const mate = cavity.mateConnectionId ? connections.get(cavity.mateConnectionId) : undefined;
      if (
        (cavity.wireConnectionId &&
          (!wire ||
            wire.kind !== 'electrical-wire' ||
            ![wire.sourcePortId, wire.targetPortId].includes(cavity.portId))) ||
        (cavity.mateConnectionId &&
          (!mate ||
            mate.kind !== 'electrical-mate' ||
            ![mate.sourcePortId, mate.targetPortId].includes(cavity.portId)))
      ) {
        return invalidReference(
          `Connector cavity ${cavity.portId} has an invalid Wire or Mate assignment`
        );
      }
      if (
        [
          cavity.terminalPartDefinitionId,
          cavity.sealPartDefinitionId,
          cavity.plugPartDefinitionId
        ].some((definitionId) => definitionId !== null && !definitionIds.has(definitionId))
      ) {
        return invalidReference(
          `Connector cavity ${cavity.portId} references an absent Part Definition`
        );
      }
      const occupied = Boolean(wire || mate);
      if ((cavity.unusedRequirement === 'occupied') !== occupied) {
        return invalidRecord(
          `Connector cavity ${cavity.portId} has inconsistent unused-cavity requirements`
        );
      }
      if (
        (cavity.unusedRequirement === 'cavity-plug-required') !==
        (cavity.plugPartDefinitionId !== null)
      ) {
        return invalidRecord(
          `Connector cavity ${cavity.portId} must name a plug exactly when one is required`
        );
      }
    }
  }

  for (const connection of topology.connections.filter(
    (candidate) => candidate.kind === 'electrical-mate'
  )) {
    const source = topology.components.find((component) =>
      component.ports.some((port) => port.id === connection.sourcePortId)
    );
    const target = topology.components.find((component) =>
      component.ports.some((port) => port.id === connection.targetPortId)
    );
    if (
      !source ||
      !target ||
      !model.components.some(
        (record) => record.componentId === source.id && record.role === 'connector'
      ) ||
      !model.components.some(
        (record) => record.componentId === target.id && record.role === 'connector'
      )
    ) {
      return invalidRecord(`Electrical Mate ${connection.id} must join two Connectors`);
    }
  }

  const harnesses = new Map<SubjectId, ElectricalHarness>();
  for (const harness of model.harnesses) {
    if (identities.has(harness.id))
      return invalidRecord(`Duplicate electrical identity ${harness.id}`);
    identities.add(harness.id);
    if (
      harness.componentIds.some((componentId) => !components.has(componentId)) ||
      harness.wireConnectionIds.some(
        (connectionId) => connections.get(connectionId)?.kind !== 'electrical-wire'
      )
    ) {
      return invalidReference(`Harness ${harness.id} references absent electrical construction`);
    }
    harnesses.set(harness.id, harness);
  }

  for (const bundle of model.bundles) {
    if (identities.has(bundle.id))
      return invalidRecord(`Duplicate electrical identity ${bundle.id}`);
    identities.add(bundle.id);
    const harness = harnesses.get(bundle.harnessId);
    if (
      !harness ||
      bundle.wireConnectionIds.some(
        (connectionId) => !harness.wireConnectionIds.includes(connectionId)
      ) ||
      bundle.segmentIds.some((segmentId) => !segments.has(segmentId))
    ) {
      return invalidReference(`Bundle ${bundle.id} references construction outside its Harness`);
    }
    if (
      bundle.transitions.some((transition) => !bundle.segmentIds.includes(transition.segmentId)) ||
      bundle.coverings.some(
        (covering) =>
          !bundle.segmentIds.includes(covering.segmentId) ||
          (covering.partDefinitionId !== null && !definitionIds.has(covering.partDefinitionId))
      )
    ) {
      return invalidReference(`Bundle ${bundle.id} has an invalid transition or covering`);
    }
    for (const pair of bundle.twistedPairs) {
      if (
        pair.wireConnectionIds[0] === pair.wireConnectionIds[1] ||
        pair.wireConnectionIds.some(
          (connectionId) => !bundle.wireConnectionIds.includes(connectionId)
        ) ||
        (pair.drainWireConnectionId !== null &&
          !bundle.wireConnectionIds.includes(pair.drainWireConnectionId)) ||
        (pair.cutLengthAllowance &&
          !['entered', 'sourced'].includes(pair.cutLengthAllowance.source))
      ) {
        return invalidRecord(`Twisted pair ${pair.id} has invalid construction`);
      }
    }
    if (bundle.concentric) {
      const layerOrders = bundle.concentric.layers.map((layer) => layer.order);
      const layerWires = bundle.concentric.layers.flatMap((layer) => layer.wireConnectionIds);
      if (
        new Set(layerOrders).size !== layerOrders.length ||
        new Set(layerWires).size !== layerWires.length ||
        layerWires.some((connectionId) => !bundle.wireConnectionIds.includes(connectionId)) ||
        (bundle.concentric.cutLengthAllowance &&
          !['entered', 'sourced'].includes(bundle.concentric.cutLengthAllowance.source))
      ) {
        return invalidRecord(`Concentric Bundle ${bundle.id} has invalid Layers or allowance`);
      }
    }
  }

  const cableDefinitions = new Set<SubjectId>();
  for (const specification of model.cableSpecifications) {
    if (
      !definitionIds.has(specification.partDefinitionId) ||
      cableDefinitions.has(specification.partDefinitionId)
    ) {
      return invalidReference(
        `Cable specification references absent or repeated Part Definition ${specification.partDefinitionId}`
      );
    }
    for (const property of Object.values(specification).filter(
      (value): value is ElectricalProperty => typeof value === 'object'
    )) {
      if (
        (property.state === 'known' &&
          (property.value === null ||
            property.provenance === null ||
            property.conflictValues.length > 0)) ||
        (property.state === 'unknown' &&
          (property.value !== null || property.conflictValues.length > 0)) ||
        (property.state === 'conflicting' && property.conflictValues.length < 2)
      ) {
        return invalidRecord(
          `Cable specification ${specification.partDefinitionId} has inconsistent evidence state`
        );
      }
    }
    cableDefinitions.add(specification.partDefinitionId);
  }

  try {
    deriveElectricalNets(topology);
  } catch (error) {
    return invalidRecord(
      error instanceof Error ? error.message : 'Electrical Net derivation failed'
    );
  }

  return null;
}

function invalidReference(message: string): ElectricalModelRejection {
  return { code: 'invalid-electrical-reference', message };
}

function invalidRecord(message: string): ElectricalModelRejection {
  return { code: 'invalid-electrical-record', message };
}
