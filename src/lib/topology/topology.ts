export type SubjectId = string;
export type EngineeringDomain = 'electrical' | 'fluid';
export type ConnectionKind = 'electrical-wire' | 'fluid-hose' | 'fluid-tube' | 'fluid-pipe';
export type InterfaceAssessment = 'compatible' | 'incompatible' | 'unknown';

export type Point = Readonly<{
  x: string;
  y: string;
}>;

export type Port = Readonly<{
  id: SubjectId;
  componentId: SubjectId;
  label: string;
  domain: EngineeringDomain;
  mediumId: SubjectId | null;
  interfaceKey: string | null;
}>;

export type Component = Readonly<{
  id: SubjectId;
  label: string;
  kind: 'part' | 'junction';
  definitionId: SubjectId | null;
  predecessorId: SubjectId | null;
  successorId: SubjectId | null;
  position: Point;
  ports: readonly Port[];
}>;

export type System = Readonly<{
  id: SubjectId;
  label: string;
  domain: EngineeringDomain;
  mediumId: SubjectId | null;
}>;

export type Connection = Readonly<{
  id: SubjectId;
  label: string;
  systemId: SubjectId;
  sourcePortId: SubjectId;
  targetPortId: SubjectId;
  domain: EngineeringDomain;
  mediumId: SubjectId | null;
  kind: ConnectionKind;
  interfaceAssessment: InterfaceAssessment;
  routeId: SubjectId | null;
}>;

export type RouteSegment = Readonly<{
  id: SubjectId;
  label: string;
  start: Point;
  end: Point;
}>;

export type Route = Readonly<{
  id: SubjectId;
  segmentIds: readonly SubjectId[];
}>;

export type Topology = Readonly<{
  systems: readonly System[];
  components: readonly Component[];
  connections: readonly Connection[];
  routes: readonly Route[];
  segments: readonly RouteSegment[];
}>;

export type TopologyRejectionCode =
  | 'duplicate-identity'
  | 'missing-subject'
  | 'invalid-reference'
  | 'domain-mismatch'
  | 'medium-mismatch'
  | 'invalid-connection-kind'
  | 'same-component-connection'
  | 'port-already-connected';

export type TopologyRejection = Readonly<{
  code: TopologyRejectionCode;
  message: string;
}>;

export type LocatedPort = Readonly<{
  component: Component;
  port: Port;
}>;

export function createEmptyTopology(): Topology {
  return {
    systems: [],
    components: [],
    connections: [],
    routes: [],
    segments: []
  };
}

export function findPort(topology: Topology, portId: SubjectId): LocatedPort | undefined {
  for (const component of topology.components) {
    const port = component.ports.find((candidate) => candidate.id === portId);
    if (port) return { component, port };
  }

  return undefined;
}

export function validateTopology(topology: Topology): TopologyRejection | null {
  const identities = new Set<SubjectId>();
  for (const subject of [
    ...topology.systems,
    ...topology.components,
    ...topology.connections,
    ...topology.routes,
    ...topology.segments
  ]) {
    if (identities.has(subject.id)) {
      return {
        code: 'duplicate-identity',
        message: `Subject identity ${subject.id} is already in use`
      };
    }

    identities.add(subject.id);
  }

  for (const system of topology.systems) {
    if (
      (system.domain === 'electrical' && system.mediumId !== null) ||
      (system.domain === 'fluid' && system.mediumId === null)
    ) {
      return {
        code: 'medium-mismatch',
        message: `System ${system.id} has a medium inconsistent with ${system.domain}`
      };
    }
  }

  const portIds = new Set<SubjectId>();
  for (const component of topology.components) {
    for (const port of component.ports) {
      if (portIds.has(port.id) || identities.has(port.id)) {
        return {
          code: 'duplicate-identity',
          message: `Port identity ${port.id} is already in use`
        };
      }
      if (port.componentId !== component.id) {
        return {
          code: 'invalid-reference',
          message: `Port ${port.id} does not belong to Component ${component.id}`
        };
      }
      if (
        (port.domain === 'electrical' && port.mediumId !== null) ||
        (port.domain === 'fluid' && port.mediumId === null)
      ) {
        return {
          code: 'medium-mismatch',
          message: `Port ${port.id} has a medium inconsistent with ${port.domain}`
        };
      }

      portIds.add(port.id);
    }
  }

  const occupiedPorts = new Set<SubjectId>();
  for (const connection of topology.connections) {
    const system = topology.systems.find((candidate) => candidate.id === connection.systemId);
    const source = findPort(topology, connection.sourcePortId);
    const target = findPort(topology, connection.targetPortId);
    if (!system || !source || !target) {
      return {
        code: 'missing-subject',
        message: `Connection ${connection.id} references an absent System or Port`
      };
    }
    if (source.component.id === target.component.id) {
      return {
        code: 'same-component-connection',
        message: `Connection ${connection.id} must join Ports on different Components`
      };
    }
    if (
      source.port.domain !== target.port.domain ||
      connection.domain !== source.port.domain ||
      connection.domain !== system.domain
    ) {
      return {
        code: 'domain-mismatch',
        message: `Connection ${connection.id} crosses engineering domains`
      };
    }
    if (
      connection.domain === 'fluid' &&
      (connection.mediumId === null ||
        connection.mediumId !== source.port.mediumId ||
        connection.mediumId !== target.port.mediumId ||
        connection.mediumId !== system.mediumId)
    ) {
      return {
        code: 'medium-mismatch',
        message: `Connection ${connection.id} crosses Fluid Media`
      };
    }
    if (
      connection.domain === 'electrical' &&
      (connection.mediumId !== null ||
        source.port.mediumId !== null ||
        target.port.mediumId !== null ||
        system.mediumId !== null)
    ) {
      return {
        code: 'medium-mismatch',
        message: `Electrical Connection ${connection.id} cannot name a Fluid Medium`
      };
    }
    if (
      (connection.domain === 'electrical' && connection.kind !== 'electrical-wire') ||
      (connection.domain === 'fluid' && connection.kind === 'electrical-wire')
    ) {
      return {
        code: 'invalid-connection-kind',
        message: `Connection ${connection.id} has a kind inconsistent with its domain`
      };
    }
    if (occupiedPorts.has(connection.sourcePortId) || occupiedPorts.has(connection.targetPortId)) {
      return {
        code: 'port-already-connected',
        message: `Connection ${connection.id} reuses an occupied Port; add an explicit Junction`
      };
    }
    if (
      connection.routeId !== null &&
      !topology.routes.some((route) => route.id === connection.routeId)
    ) {
      return {
        code: 'missing-subject',
        message: `Connection ${connection.id} references absent Route ${connection.routeId}`
      };
    }

    occupiedPorts.add(connection.sourcePortId);
    occupiedPorts.add(connection.targetPortId);
  }

  for (const route of topology.routes) {
    if (new Set(route.segmentIds).size !== route.segmentIds.length) {
      return {
        code: 'duplicate-identity',
        message: `Route ${route.id} repeats a Segment`
      };
    }
    if (route.segmentIds.some((segmentId) => !topology.segments.some((s) => s.id === segmentId))) {
      return {
        code: 'missing-subject',
        message: `Route ${route.id} references an absent Segment`
      };
    }
  }

  return null;
}
