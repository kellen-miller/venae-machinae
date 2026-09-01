import type { Component, EngineeringDomain, Point } from '../topology/topology';

export type PrimitivePort = Readonly<{
  label: string;
  domain: EngineeringDomain;
  interfaceKey: string | null;
}>;

export type PrimitiveDefinition = Readonly<{
  id: string;
  label: string;
  description: string;
  kind: Component['kind'];
  ports: readonly PrimitivePort[];
}>;

function primitive(definition: PrimitiveDefinition): PrimitiveDefinition {
  return Object.freeze({
    ...definition,
    ports: Object.freeze(definition.ports.map((port) => Object.freeze({ ...port })))
  });
}

export const PRIMITIVES: readonly PrimitiveDefinition[] = Object.freeze([
  primitive({
    id: 'electrical-source',
    label: 'Electrical source',
    description: 'Source identity and explicit positive Port; no supplied ratings.',
    kind: 'part',
    ports: [{ label: 'Positive', domain: 'electrical', interfaceKey: null }]
  }),
  primitive({
    id: 'ground-point',
    label: 'Ground point',
    description: 'Explicit return attachment; does not imply chassis continuity.',
    kind: 'part',
    ports: [{ label: 'Attachment', domain: 'electrical', interfaceKey: null }]
  }),
  primitive({
    id: 'fuse',
    label: 'Fuse',
    description: 'Two-Port protection identity; no supplied current rating.',
    kind: 'part',
    ports: [
      { label: 'Line', domain: 'electrical', interfaceKey: null },
      { label: 'Load', domain: 'electrical', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'relay',
    label: 'Relay',
    description: 'Explicit coil and contact Ports; no hidden electrical behavior.',
    kind: 'part',
    ports: [
      { label: 'Coil positive', domain: 'electrical', interfaceKey: null },
      { label: 'Coil return', domain: 'electrical', interfaceKey: null },
      { label: 'Contact line', domain: 'electrical', interfaceKey: null },
      { label: 'Contact load', domain: 'electrical', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'switch',
    label: 'Switch',
    description: 'Two-Port switching identity with no inferred rating.',
    kind: 'part',
    ports: [
      { label: 'Line', domain: 'electrical', interfaceKey: null },
      { label: 'Load', domain: 'electrical', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'electrical-load',
    label: 'Electrical load',
    description: 'Explicit power and return Ports; no supplied demand.',
    kind: 'part',
    ports: [
      { label: 'Power', domain: 'electrical', interfaceKey: null },
      { label: 'Return', domain: 'electrical', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'controller',
    label: 'Controller',
    description: 'Power, return, and signal Ports without protocol assumptions.',
    kind: 'part',
    ports: [
      { label: 'Power', domain: 'electrical', interfaceKey: null },
      { label: 'Return', domain: 'electrical', interfaceKey: null },
      { label: 'Signal', domain: 'electrical', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'connector',
    label: 'Connector',
    description: 'Project-owned connector shell starting with two explicit cavities.',
    kind: 'part',
    ports: [
      { label: 'Cavity 1', domain: 'electrical', interfaceKey: null },
      { label: 'Cavity 2', domain: 'electrical', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'splice',
    label: 'Splice',
    description: 'Three-Port electrical branch Junction.',
    kind: 'junction',
    ports: [
      { label: 'Common', domain: 'electrical', interfaceKey: null },
      { label: 'Branch 1', domain: 'electrical', interfaceKey: null },
      { label: 'Branch 2', domain: 'electrical', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'bus',
    label: 'Bus',
    description: 'Four-Port electrical distribution Junction.',
    kind: 'junction',
    ports: [
      { label: 'Common', domain: 'electrical', interfaceKey: null },
      { label: 'Branch 1', domain: 'electrical', interfaceKey: null },
      { label: 'Branch 2', domain: 'electrical', interfaceKey: null },
      { label: 'Branch 3', domain: 'electrical', interfaceKey: null }
    ]
  })
]);

export function createProjectComponentFromPrimitive(input: {
  primitiveId: string;
  componentId: string;
  portIds: readonly string[];
  position: Point;
}): Component {
  const definition = PRIMITIVES.find((candidate) => candidate.id === input.primitiveId);
  if (!definition) throw new Error(`Unknown primitive ${input.primitiveId}`);
  if (input.portIds.length !== definition.ports.length) {
    throw new Error(`${definition.label} requires ${definition.ports.length} Port identities`);
  }

  return {
    id: input.componentId,
    label: definition.label,
    kind: definition.kind,
    definitionId: null,
    predecessorId: null,
    successorId: null,
    position: input.position,
    ports: definition.ports.map((port, index) => ({
      id: input.portIds[index]!,
      componentId: input.componentId,
      label: port.label,
      domain: port.domain,
      mediumId: null,
      interfaceKey: port.interfaceKey
    }))
  };
}
