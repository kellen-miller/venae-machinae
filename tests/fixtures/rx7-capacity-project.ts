import rx7EnvelopeSource from '../../src/lib/reference/rx7-example.v1.venae.json';
import { projectExchangeEnvelopeSchema } from '../../src/lib/exchange/project-exchange';
import { projectDocumentSchema } from '../../src/lib/persistence/project-document';
import { RX7_CAPACITY_COUNTS, type Rx7CapacityScale } from './rx7-capacity-counts';

import type { ProjectDocument } from '../../src/lib/persistence/project-document';

export { RX7_CAPACITY_COUNTS } from './rx7-capacity-counts';
export type { Rx7CapacityScale } from './rx7-capacity-counts';

const rx7Envelope = projectExchangeEnvelopeSchema.parse(rx7EnvelopeSource);
const rx7Project = projectDocumentSchema.parse(rx7Envelope.payload);
const rx7Counts = {
  components: rx7Project.topology.components.length,
  ports: rx7Project.topology.components.flatMap((component) => component.ports).length,
  connections: rx7Project.topology.connections.length
};

export const RX7_CAPACITY_ASSETS = Object.freeze(
  rx7Envelope.assets.map((asset) => ({
    sha256: asset.sha256,
    mimeType: asset.mimeType,
    bytes: Uint8Array.from(atob(asset.base64), (character) => character.charCodeAt(0))
  }))
);

if (JSON.stringify(rx7Counts) !== JSON.stringify(RX7_CAPACITY_COUNTS[1])) {
  throw new Error('Bundled RX-7 base counts do not match the gate envelope');
}

function collectOwnedIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const child of value) collectOwnedIds(child, ids);
    return ids;
  }
  if (!value || typeof value !== 'object') return ids;

  for (const [key, child] of Object.entries(value)) {
    if (key === 'id' && typeof child === 'string') ids.add(child);
    collectOwnedIds(child, ids);
  }
  return ids;
}

function rekeyReplica<T>(
  value: T,
  ids: ReadonlySet<string>,
  prefix: string,
  combinedProjectId: string,
  identityField = false
): T {
  if (typeof value === 'string') {
    if (value === rx7Project.project.id) return combinedProjectId as T;
    return (identityField && ids.has(value) ? `${prefix}${value}` : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((child) =>
      rekeyReplica(child, ids, prefix, combinedProjectId, identityField)
    ) as T;
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      rekeyReplica(
        child,
        ids,
        prefix,
        combinedProjectId,
        key === 'id' || key.endsWith('Id') || key.endsWith('Ids')
      )
    ])
  ) as T;
}

export function generateRx7CapacityProject(scale: Rx7CapacityScale): ProjectDocument {
  if (scale === 1) return structuredClone(rx7Project);

  const projectId = `rx7-capacity-${scale}x`;
  const ownedIds = collectOwnedIds(rx7Project);
  const replicas = Array.from({ length: scale }, (_, index) =>
    rekeyReplica(rx7Project, ownedIds, `replica-${index + 1}-`, projectId)
  );
  const combined = structuredClone(replicas[0]!);
  combined.project = {
    ...combined.project,
    id: projectId,
    name: `Illustrative RX-7 capacity envelope ${scale}x`
  };
  combined.topology = {
    systems: replicas.flatMap((replica) => replica.topology.systems),
    components: replicas.flatMap((replica) => replica.topology.components),
    connections: replicas.flatMap((replica) => replica.topology.connections),
    routes: replicas.flatMap((replica) => replica.topology.routes),
    segments: replicas.flatMap((replica) => replica.topology.segments)
  };
  combined.electrical = {
    components: replicas.flatMap((replica) => replica.electrical.components),
    wires: replicas.flatMap((replica) => replica.electrical.wires),
    circuits: replicas.flatMap((replica) => replica.electrical.circuits),
    connectors: replicas.flatMap((replica) => replica.electrical.connectors),
    harnesses: replicas.flatMap((replica) => replica.electrical.harnesses),
    bundles: replicas.flatMap((replica) => replica.electrical.bundles),
    cableSpecifications: replicas.flatMap((replica) => replica.electrical.cableSpecifications)
  };
  combined.fluid = {
    media: replicas.flatMap((replica) => replica.fluid.media),
    systems: replicas.flatMap((replica) => replica.fluid.systems),
    components: replicas.flatMap((replica) => replica.fluid.components),
    lines: replicas.flatMap((replica) => replica.fluid.lines),
    behaviors: replicas.flatMap((replica) => replica.fluid.behaviors),
    boundaryConditions: replicas.flatMap((replica) => replica.fluid.boundaryConditions)
  };
  combined.calculations = replicas.flatMap((replica) => replica.calculations);
  combined.screenings = replicas.flatMap((replica) => replica.screenings);
  combined.partDefinitions = replicas.flatMap((replica) => replica.partDefinitions);
  combined.partRequirements = replicas.flatMap((replica) => replica.partRequirements);
  combined.build = {
    procurementChoices: replicas.flatMap((replica) => replica.build.procurementChoices),
    installations: replicas.flatMap((replica) => replica.build.installations)
  };
  combined.evidence = replicas.flatMap((replica) => replica.evidence);
  combined.engineeringValues = replicas.flatMap((replica) => replica.engineeringValues);
  combined.operatingStates = replicas.flatMap((replica) => replica.operatingStates);
  combined.results = replicas.flatMap((replica) => replica.results);
  combined.validationApplicabilityDecisions = replicas.flatMap(
    (replica) => replica.validationApplicabilityDecisions
  );
  combined.tombstones = replicas.flatMap((replica) => replica.tombstones);

  return projectDocumentSchema.parse(combined);
}
