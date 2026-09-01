import { createEmptyTopology } from '../topology/topology';
import { createEmptyElectricalModel } from '../electrical/electrical';
import { createEmptyFluidModel } from '../fluid/fluid';

import type { ElectricalModel } from '../electrical/electrical';
import type { EngineeringEvidence } from '../evidence/evidence';
import type { FluidModel } from '../fluid/fluid';
import type { Point, SubjectId, Topology } from '../topology/topology';

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

export type EngineeringValue = Readonly<{
  id: SubjectId;
  decimal: string;
  unit: string;
  provenance: string;
}>;

export type OperatingState = Readonly<{
  id: SubjectId;
  name: string;
  description: string;
}>;

export type VehicleBackground = Readonly<{
  assetHash: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  calibration: Readonly<{
    first: Point;
    second: Point;
    distance: Readonly<{ decimal: string; unit: 'mm' | 'cm' | 'm' | 'in' | 'ft' }>;
  }>;
  position: Point;
  opacity: string;
  visible: boolean;
  locked: boolean;
}>;

export type ProjectSnapshot = Readonly<{
  id: SubjectId;
  name: string;
  createdAt: string;
  revision: number;
  topology: Topology;
  electrical: ElectricalModel;
  fluid: FluidModel;
  partDefinitions: readonly PartDefinition[];
  partRequirements: readonly PartRequirement[];
  evidence: readonly EngineeringEvidence[];
  results: readonly ProjectResult[];
  tombstones: readonly SubjectTombstone[];
  engineeringValues: readonly EngineeringValue[];
  operatingStates: readonly OperatingState[];
  settings: Readonly<{ unitSystem: 'metric' | 'imperial' }>;
  assetHashes: readonly string[];
  vehicleBackground: VehicleBackground | null;
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
    electrical: createEmptyElectricalModel(),
    fluid: createEmptyFluidModel(),
    partDefinitions: [],
    partRequirements: [],
    evidence: [],
    results: [],
    tombstones: [],
    engineeringValues: [],
    operatingStates: [],
    settings: { unitSystem: 'metric' },
    assetHashes: [],
    vehicleBackground: null
  };
}
