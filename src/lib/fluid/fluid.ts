import type { SubjectId, Topology } from '../topology/topology';

export type FluidComponentRole =
  | 'endpoint'
  | 'fitting'
  | 'union'
  | 'tee'
  | 'manifold'
  | 'pump'
  | 'restriction'
  | 'valve'
  | 'heat-source'
  | 'heat-sink'
  | 'volume'
  | 'heat-exchanger';

export type FluidBehaviorRole =
  | 'passage'
  | 'pump'
  | 'restriction'
  | 'valve'
  | 'heat-source'
  | 'heat-sink'
  | 'volume'
  | 'heat-exchanger';

export type FluidLength = Readonly<{
  decimal: string;
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  source: 'estimated' | 'measured' | 'entered' | 'sourced';
  provenance: string;
}>;

export type FluidElevation = Readonly<{
  start: string;
  end: string;
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  source: 'estimated' | 'measured' | 'entered' | 'sourced';
  provenance: string;
}>;

export type FluidLineConstruction =
  | Readonly<{
      kind: 'hose';
      reinforcement: string;
      minimumBendRadius: FluidLength | null;
    }>
  | Readonly<{
      kind: 'tube';
      material: string;
      wallThickness: FluidLength | null;
    }>
  | Readonly<{
      kind: 'pipe';
      material: string;
      schedule: string;
    }>;

export type FluidMedium = Readonly<{
  id: SubjectId;
  label: string;
  composition: string;
  provenance: string;
}>;

export type FluidSystemRecord = Readonly<{
  systemId: SubjectId;
  mediumId: SubjectId;
  purpose: string;
}>;

export type FluidComponentRecord = Readonly<{
  componentId: SubjectId;
  role: FluidComponentRole;
}>;

export type FluidLine = Readonly<{
  connectionId: SubjectId;
  partDefinitionId: SubjectId | null;
  construction: FluidLineConstruction;
  routeLength: FluidLength | null;
  hydraulicLength: FluidLength | null;
  cutLength: FluidLength | null;
  elevation: FluidElevation | null;
  environment: string;
  provenance: string;
}>;

export type FluidComponentBehavior = Readonly<{
  id: SubjectId;
  componentId: SubjectId;
  role: FluidBehaviorRole;
  portIds: readonly SubjectId[];
  mediumIds: readonly SubjectId[];
  description: string;
  provenance: string;
}>;

export type FluidBoundaryCondition = Readonly<{
  id: SubjectId;
  behaviorId: SubjectId;
  subjectId: SubjectId;
  operatingStateId: SubjectId;
  quantity: 'pressure' | 'flow' | 'temperature' | 'level' | 'command' | 'operating-point';
  value: string;
  unit: string | null;
  source: 'measured' | 'entered' | 'sourced' | 'assumed';
  provenance: string;
}>;

export type FluidModel = Readonly<{
  media: readonly FluidMedium[];
  systems: readonly FluidSystemRecord[];
  components: readonly FluidComponentRecord[];
  lines: readonly FluidLine[];
  behaviors: readonly FluidComponentBehavior[];
  boundaryConditions: readonly FluidBoundaryCondition[];
}>;

export type FluidModelRejection = Readonly<{
  code: 'invalid-fluid-reference' | 'invalid-fluid-record';
  message: string;
}>;

export function createEmptyFluidModel(): FluidModel {
  return {
    media: [],
    systems: [],
    components: [],
    lines: [],
    behaviors: [],
    boundaryConditions: []
  };
}

export function validateFluidModel(
  topology: Topology,
  partDefinitions: readonly Readonly<{ id: SubjectId }>[],
  operatingStates: readonly Readonly<{ id: SubjectId }>[],
  model: FluidModel
): FluidModelRejection | null {
  const topologySystems = new Map(topology.systems.map((system) => [system.id, system]));
  const topologyComponents = new Map(
    topology.components.map((component) => [component.id, component])
  );
  const topologyConnections = new Map(
    topology.connections.map((connection) => [connection.id, connection])
  );
  const definitionIds = new Set(partDefinitions.map((definition) => definition.id));
  const operatingStateIds = new Set(operatingStates.map((state) => state.id));

  const media = new Map<SubjectId, FluidMedium>();
  for (const medium of model.media) {
    if (
      media.has(medium.id) ||
      medium.label.trim() === '' ||
      medium.composition.trim() === '' ||
      medium.provenance.trim() === ''
    ) {
      return invalidRecord(`Fluid Medium ${medium.id} is repeated or incomplete`);
    }

    media.set(medium.id, medium);
  }

  const configuredSystems = new Set<SubjectId>();
  for (const fluidSystem of model.systems) {
    const system = topologySystems.get(fluidSystem.systemId);
    if (
      !system ||
      system.domain !== 'fluid' ||
      system.mediumId !== fluidSystem.mediumId ||
      !media.has(fluidSystem.mediumId)
    ) {
      return invalidReference(
        `Fluid System ${fluidSystem.systemId} needs one identified Medium and purpose`
      );
    }
    if (configuredSystems.has(fluidSystem.systemId) || fluidSystem.purpose.trim() === '') {
      return invalidRecord(`Fluid System ${fluidSystem.systemId} is repeated or has no purpose`);
    }

    configuredSystems.add(fluidSystem.systemId);
  }
  for (const system of topology.systems.filter((candidate) => candidate.domain === 'fluid')) {
    if (!configuredSystems.has(system.id)) {
      return invalidReference(`Fluid System ${system.id} needs one identified Medium and purpose`);
    }
  }

  const configuredComponents = new Set<SubjectId>();
  for (const fluidComponent of model.components) {
    const topologyComponent = topologyComponents.get(fluidComponent.componentId);
    if (
      !topologyComponent ||
      !topologyComponent.ports.some((port) => port.domain === 'fluid') ||
      configuredComponents.has(fluidComponent.componentId)
    ) {
      return invalidReference(
        `Fluid role references absent or repeated Component ${fluidComponent.componentId}`
      );
    }
    if (
      (fluidComponent.role === 'tee' || fluidComponent.role === 'manifold') &&
      topologyComponent.kind !== 'junction'
    ) {
      return invalidRecord(
        `${fluidComponent.role} Component ${fluidComponent.componentId} must be a Junction`
      );
    }

    configuredComponents.add(fluidComponent.componentId);
  }

  const configuredLines = new Set<SubjectId>();
  for (const line of model.lines) {
    const connection = topologyConnections.get(line.connectionId);
    if (!connection || connection.domain !== 'fluid' || configuredLines.has(line.connectionId)) {
      return invalidReference(
        `Fluid Line record references absent or repeated Connection ${line.connectionId}`
      );
    }
    if (line.partDefinitionId !== null && !definitionIds.has(line.partDefinitionId)) {
      return invalidReference(
        `Fluid Line ${line.connectionId} references absent Part Definition ${line.partDefinitionId}`
      );
    }
    if (connection.kind !== `fluid-${line.construction.kind}`) {
      return invalidRecord(
        `Fluid Line ${line.connectionId} construction ${line.construction.kind} does not match ${connection.kind}`
      );
    }
    if (line.routeLength !== null && connection.routeId === null) {
      return invalidReference(
        `Fluid Line ${line.connectionId} has Route Length without an assigned Route`
      );
    }
    for (const [label, length] of [
      ['Route Length', line.routeLength],
      ['Hydraulic Length', line.hydraulicLength],
      ['Cut Length', line.cutLength]
    ] as const) {
      if (length !== null && !validLength(length)) {
        return invalidRecord(`${label} for Fluid Line ${line.connectionId} is invalid`);
      }
    }
    if (
      line.construction.kind === 'hose' &&
      line.construction.minimumBendRadius !== null &&
      !validLength(line.construction.minimumBendRadius)
    ) {
      return invalidRecord(`Hose ${line.connectionId} has an invalid minimum bend radius`);
    }
    if (
      line.construction.kind === 'tube' &&
      line.construction.wallThickness !== null &&
      !validLength(line.construction.wallThickness)
    ) {
      return invalidRecord(`Tube ${line.connectionId} has an invalid wall thickness`);
    }
    if (
      line.elevation !== null &&
      (!Number.isFinite(Number(line.elevation.start)) ||
        !Number.isFinite(Number(line.elevation.end)) ||
        line.elevation.start.trim() === '' ||
        line.elevation.end.trim() === '' ||
        line.elevation.provenance.trim() === '')
    ) {
      return invalidRecord(`Fluid Line ${line.connectionId} has invalid elevation evidence`);
    }
    if (line.environment.trim() === '' || line.provenance.trim() === '') {
      return invalidRecord(`Fluid Line ${line.connectionId} needs environment and provenance`);
    }

    configuredLines.add(line.connectionId);
  }

  const identities = new Set<SubjectId>();
  const behaviors = new Map<SubjectId, FluidComponentBehavior>();
  for (const behavior of model.behaviors) {
    const component = topologyComponents.get(behavior.componentId);
    const fluidPorts = new Map(
      component?.ports.filter((port) => port.domain === 'fluid').map((port) => [port.id, port]) ??
        []
    );
    const selectedMediumIds = new Set(
      behavior.portIds
        .map((portId) => fluidPorts.get(portId)?.mediumId)
        .filter((mediumId): mediumId is SubjectId => mediumId !== null && mediumId !== undefined)
    );
    if (
      !component ||
      identities.has(behavior.id) ||
      behavior.portIds.length === 0 ||
      new Set(behavior.portIds).size !== behavior.portIds.length ||
      behavior.portIds.some((portId) => !fluidPorts.has(portId)) ||
      behavior.mediumIds.length === 0 ||
      new Set(behavior.mediumIds).size !== behavior.mediumIds.length ||
      behavior.mediumIds.length !== selectedMediumIds.size ||
      behavior.mediumIds.some((mediumId) => !selectedMediumIds.has(mediumId)) ||
      behavior.description.trim() === '' ||
      behavior.provenance.trim() === ''
    ) {
      return invalidReference(`Component Behavior ${behavior.id} has invalid fluid references`);
    }

    identities.add(behavior.id);
    behaviors.set(behavior.id, behavior);
  }

  for (const boundary of model.boundaryConditions) {
    const behavior = behaviors.get(boundary.behaviorId);
    if (
      !behavior ||
      identities.has(boundary.id) ||
      (boundary.subjectId !== behavior.id && !behavior.portIds.includes(boundary.subjectId)) ||
      !operatingStateIds.has(boundary.operatingStateId)
    ) {
      return invalidReference(`Boundary Condition ${boundary.id} has invalid fluid references`);
    }
    if (
      boundary.value.trim() === '' ||
      boundary.provenance.trim() === '' ||
      (boundary.quantity !== 'command' && boundary.unit === null)
    ) {
      return invalidRecord(`Boundary Condition ${boundary.id} is incomplete`);
    }

    identities.add(boundary.id);
  }

  return null;
}

function validLength(length: FluidLength): boolean {
  return (
    length.decimal.trim() !== '' &&
    Number.isFinite(Number(length.decimal)) &&
    Number(length.decimal) >= 0 &&
    length.provenance.trim() !== ''
  );
}

function invalidReference(message: string): FluidModelRejection {
  return { code: 'invalid-fluid-reference', message };
}

function invalidRecord(message: string): FluidModelRejection {
  return { code: 'invalid-fluid-record', message };
}
