import { z } from 'zod';

import { validateTopology } from '../topology/topology';
import { APPLICATION_VERSIONS } from '../version/version-registry';

import type { ProjectSnapshot } from '../project/project';

z.config({ jitless: true });

const decimalString = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const identity = z.string().min(1).max(160);
const domain = z.enum(['electrical', 'fluid']);

const pointSchema = z.strictObject({ x: decimalString, y: decimalString });

const portSchema = z.strictObject({
  id: identity,
  componentId: identity,
  label: z.string().min(1).max(160),
  domain,
  mediumId: identity.nullable(),
  interfaceKey: z.string().min(1).max(160).nullable()
});

const componentSchema = z.strictObject({
  id: identity,
  label: z.string().min(1).max(160),
  kind: z.enum(['part', 'junction']),
  definitionId: identity.nullable(),
  predecessorId: identity.nullable(),
  successorId: identity.nullable(),
  position: pointSchema,
  ports: z.array(portSchema)
});

const systemSchema = z.strictObject({
  id: identity,
  label: z.string().min(1).max(160),
  domain,
  mediumId: identity.nullable()
});

const connectionSchema = z.strictObject({
  id: identity,
  label: z.string().min(1).max(160),
  systemId: identity,
  sourcePortId: identity,
  targetPortId: identity,
  domain,
  mediumId: identity.nullable(),
  kind: z.enum(['electrical-wire', 'fluid-hose', 'fluid-tube', 'fluid-pipe']),
  interfaceAssessment: z.enum(['compatible', 'incompatible', 'unknown']),
  routeId: identity.nullable()
});

const routeSegmentSchema = z.strictObject({
  id: identity,
  label: z.string().min(1).max(160),
  start: pointSchema,
  end: pointSchema
});

const routeSchema = z.strictObject({ id: identity, segmentIds: z.array(identity) });

const partDefinitionSchema = z.strictObject({
  id: identity,
  label: z.string().min(1).max(160),
  revision: z.number().int().positive(),
  provenance: z.string().min(1)
});

const partRequirementSchema = z.strictObject({
  id: identity,
  subjectId: identity,
  label: z.string().min(1).max(160),
  quantity: decimalString
});

const evidenceSchema = z.strictObject({
  id: identity,
  subjectId: identity,
  label: z.string().min(1).max(160),
  state: z.enum(['known', 'unknown', 'conflicting']),
  value: z.string().nullable(),
  unit: z.string().min(1).nullable(),
  provenance: z.string().min(1).nullable(),
  conflictValues: z.array(z.string())
});

const projectResultSchema = z.strictObject({
  id: identity,
  sourceRevision: z.number().int().nonnegative(),
  status: z.enum(['current', 'stale', 'unknown', 'unsupported', 'failed']),
  kind: z.string().min(1)
});

const tombstoneSchema = z.strictObject({
  subjectId: identity,
  subjectKind: z.enum(['component', 'connection']),
  successorId: identity
});

export const projectDocumentSchema = z.strictObject({
  schemaVersion: z.literal(APPLICATION_VERSIONS.projectDocumentSchema),
  project: z.strictObject({
    id: identity,
    name: z.string().min(1).max(240),
    revision: z.number().int().nonnegative(),
    createdAt: z.iso.datetime({ offset: true })
  }),
  topology: z.strictObject({
    systems: z.array(systemSchema),
    components: z.array(componentSchema),
    connections: z.array(connectionSchema),
    routes: z.array(routeSchema),
    segments: z.array(routeSegmentSchema)
  }),
  partDefinitions: z.array(partDefinitionSchema),
  partRequirements: z.array(partRequirementSchema),
  evidence: z.array(evidenceSchema),
  results: z.array(projectResultSchema),
  tombstones: z.array(tombstoneSchema),
  engineeringValues: z.array(
    z.strictObject({
      id: identity,
      decimal: decimalString,
      unit: z.string().min(1),
      provenance: z.string().min(1)
    })
  ),
  operatingStates: z.array(
    z.strictObject({ id: identity, name: z.string().min(1), description: z.string() })
  ),
  settings: z.strictObject({ unitSystem: z.enum(['metric', 'imperial']) }),
  assetHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/))
});

export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

export function projectSnapshotToDocument(snapshot: ProjectSnapshot): ProjectDocument {
  return projectDocumentSchema.parse({
    schemaVersion: APPLICATION_VERSIONS.projectDocumentSchema,
    project: {
      id: snapshot.id,
      name: snapshot.name,
      revision: snapshot.revision,
      createdAt: snapshot.createdAt
    },
    topology: snapshot.topology,
    partDefinitions: snapshot.partDefinitions,
    partRequirements: snapshot.partRequirements,
    evidence: snapshot.evidence,
    results: snapshot.results,
    tombstones: snapshot.tombstones,
    engineeringValues: [],
    operatingStates: [],
    settings: { unitSystem: 'metric' },
    assetHashes: []
  });
}

export function projectDocumentToSnapshot(document: ProjectDocument): ProjectSnapshot {
  const parsed = projectDocumentSchema.parse(document);
  const snapshot: ProjectSnapshot = {
    id: parsed.project.id,
    name: parsed.project.name,
    revision: parsed.project.revision,
    createdAt: parsed.project.createdAt,
    topology: parsed.topology,
    partDefinitions: parsed.partDefinitions,
    partRequirements: parsed.partRequirements,
    evidence: parsed.evidence,
    results: parsed.results,
    tombstones: parsed.tombstones
  };
  const rejection = validateTopology(snapshot.topology);
  if (rejection) throw new Error(`Persisted Project topology is invalid: ${rejection.message}`);
  return snapshot;
}
