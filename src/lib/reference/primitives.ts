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
  }),
  primitive({
    id: 'fluid-endpoint',
    label: 'Fluid endpoint',
    description: 'One explicit wetted interface with no inferred reservoir or environment.',
    kind: 'part',
    ports: [{ label: 'Fluid Port', domain: 'fluid', interfaceKey: null }]
  }),
  primitive({
    id: 'fluid-pump',
    label: 'Fluid pump',
    description: 'Inlet and outlet identity; pressure and flow require explicit Behavior evidence.',
    kind: 'part',
    ports: [
      { label: 'Inlet', domain: 'fluid', interfaceKey: null },
      { label: 'Outlet', domain: 'fluid', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'fluid-valve',
    label: 'Fluid valve',
    description: 'Two-Port valve identity with no inferred position or direction.',
    kind: 'part',
    ports: [
      { label: 'Port A', domain: 'fluid', interfaceKey: null },
      { label: 'Port B', domain: 'fluid', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'fluid-fitting',
    label: 'Fluid fitting',
    description: 'Explicit interface or construction transition Component.',
    kind: 'part',
    ports: [
      { label: 'Side A', domain: 'fluid', interfaceKey: null },
      { label: 'Side B', domain: 'fluid', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'fluid-union',
    label: 'Fluid union',
    description: 'Two-ended serviceable union with independent topology identity.',
    kind: 'part',
    ports: [
      { label: 'Side A', domain: 'fluid', interfaceKey: null },
      { label: 'Side B', domain: 'fluid', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'fluid-tee',
    label: 'Fluid tee',
    description: 'Three-Port Fluid Junction; no branch split or direction is inferred.',
    kind: 'junction',
    ports: [
      { label: 'Common', domain: 'fluid', interfaceKey: null },
      { label: 'Branch 1', domain: 'fluid', interfaceKey: null },
      { label: 'Branch 2', domain: 'fluid', interfaceKey: null }
    ]
  }),
  primitive({
    id: 'fluid-volume',
    label: 'Fluid volume',
    description: 'Two-Port reservoir or volume identity; level remains an explicit boundary.',
    kind: 'part',
    ports: [
      { label: 'Inlet', domain: 'fluid', interfaceKey: null },
      { label: 'Outlet', domain: 'fluid', interfaceKey: null }
    ]
  })
]);

export function createProjectComponentFromPrimitive(input: {
  primitiveId: string;
  componentId: string;
  portIds: readonly string[];
  position: Point;
  mediumId?: string;
}): Component {
  const definition = PRIMITIVES.find((candidate) => candidate.id === input.primitiveId);
  if (!definition) throw new Error(`Unknown primitive ${input.primitiveId}`);
  if (input.portIds.length !== definition.ports.length) {
    throw new Error(`${definition.label} requires ${definition.ports.length} Port identities`);
  }
  if (definition.ports.some((port) => port.domain === 'fluid') && !input.mediumId) {
    throw new Error(`${definition.label} requires one Fluid Medium`);
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
      mediumId: port.domain === 'fluid' ? input.mediumId! : null,
      interfaceKey: port.interfaceKey
    }))
  };
}
