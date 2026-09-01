import type { SubjectId } from '../topology/topology';

export type EvidenceState = 'known' | 'unknown' | 'conflicting';

export type EngineeringEvidence = Readonly<{
  id: SubjectId;
  subjectId: SubjectId;
  label: string;
  state: EvidenceState;
  value: string | null;
  unit: string | null;
  provenance: string | null;
  conflictValues: readonly string[];
}>;
