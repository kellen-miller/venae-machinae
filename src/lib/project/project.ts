import { createEmptyTopology } from '../topology/topology';

import type { EngineeringEvidence } from '../evidence/evidence';
import type { SubjectId, Topology } from '../topology/topology';

export type ResultId = string;

export type PartDefinition = Readonly<{
  id: SubjectId;
  label: string;
  revision: number;
  provenance: string;
}>;

export type PartRequirement = Readonly<{
  id: SubjectId;
  subjectId: SubjectId;
  label: string;
  quantity: string;
}>;

export type ProjectResult = Readonly<{
  id: ResultId;
  sourceRevision: number;
  status: 'current' | 'stale' | 'unknown' | 'unsupported' | 'failed';
  kind: string;
}>;

export type SubjectTombstone = Readonly<{
  subjectId: SubjectId;
  subjectKind: 'component' | 'connection';
  successorId: SubjectId;
}>;

export type ProjectSnapshot = Readonly<{
  id: SubjectId;
  name: string;
  createdAt: string;
  revision: number;
  topology: Topology;
  partDefinitions: readonly PartDefinition[];
  partRequirements: readonly PartRequirement[];
  evidence: readonly EngineeringEvidence[];
  results: readonly ProjectResult[];
  tombstones: readonly SubjectTombstone[];
}>;

export function createBlankProject(input: {
  id: SubjectId;
  name: string;
  createdAt: string;
}): ProjectSnapshot {
  return {
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    revision: 0,
    topology: createEmptyTopology(),
    partDefinitions: [],
    partRequirements: [],
    evidence: [],
    results: [],
    tombstones: []
  };
}
