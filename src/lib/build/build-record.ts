import Decimal from 'decimal.js';

import type { EngineeringDomain, SubjectId } from '../topology/topology';
import type { ProjectSnapshot } from '../project/project';

export type ProcurementMethod =
  | 'exact'
  | 'package'
  | 'spool'
  | 'spares'
  | 'waste'
  | 'consumable';

export type ProcurementChoice = Readonly<{
  id: SubjectId;
  partDefinitionId: SubjectId;
  variant: string;
  unit: string;
  purchasedQuantity: string;
  method: ProcurementMethod;
  packageSize: string | null;
  sparePercent: string | null;
  wasteQuantity: string | null;
  consumableQuantity: string | null;
  note: string;
  provenance: string;
}>;

export type InstallationRecord = Readonly<{
  id: SubjectId;
  subjectId: SubjectId;
  status: 'planned' | 'installed' | 'removed';
  installedPartDefinitionId: SubjectId | null;
  installedVariant: string | null;
  quantity: string;
  unit: string;
  measuredEvidenceIds: readonly SubjectId[];
  observationEvidenceIds: readonly SubjectId[];
  substitution: Readonly<{
    intendedPartDefinitionId: SubjectId;
    installedPartDefinitionId: SubjectId;
    reason: string;
  }> | null;
  photoAssetHashes: readonly string[];
  notes: string;
  recordedAt: string;
  provenance: string;
}>;

export type BuildRecord = Readonly<{
  procurementChoices: readonly ProcurementChoice[];
  installations: readonly InstallationRecord[];
}>;

export type BomFilters = Readonly<{
  domains?: readonly EngineeringDomain[];
  systemIds?: readonly SubjectId[];
}>;

export type BomLine = Readonly<{
  id: string;
  partDefinitionId: SubjectId;
  partDefinitionRevision: number;
  label: string;
  variant: string;
  exactDemand: string;
  unit: string;
  requirementIds: readonly SubjectId[];
  consumingSubjectIds: readonly SubjectId[];
  domains: readonly EngineeringDomain[];
  systemIds: readonly SubjectId[];
  procurementChoices: readonly ProcurementChoice[];
}>;

export function createEmptyBuildRecord(): BuildRecord {
  return { procurementChoices: [], installations: [] };
}

export function aggregateProjectBom(
  snapshot: ProjectSnapshot,
  filters: BomFilters = {}
): readonly BomLine[] {
  const groups = new Map<
    string,
    {
      partDefinitionId: SubjectId;
      partDefinitionRevision: number;
      label: string;
      variant: string;
      exactDemand: Decimal;
      unit: string;
      requirementIds: SubjectId[];
      consumingSubjectIds: Set<SubjectId>;
      domains: Set<EngineeringDomain>;
      systemIds: Set<SubjectId>;
    }
  >();

  for (const requirement of snapshot.partRequirements) {
    if (filters.domains?.length && !requirement.domain) continue;
    if (filters.domains?.length && !filters.domains.includes(requirement.domain!)) continue;
    if (filters.systemIds?.length && !requirement.systemId) continue;
    if (filters.systemIds?.length && !filters.systemIds.includes(requirement.systemId!)) continue;

    const partDefinitionId =
      requirement.partDefinitionId ??
      snapshot.partDefinitions.find((definition) => definition.id === requirement.subjectId)?.id;
    const definition = snapshot.partDefinitions.find(
      (candidate) => candidate.id === partDefinitionId
    );
    if (!definition) continue;

    const variant = requirement.variant ?? '';
    const unit = requirement.unit ?? 'ea';
    const key = JSON.stringify([definition.id, definition.revision, variant, unit]);
    const group = groups.get(key) ?? {
      partDefinitionId: definition.id,
      partDefinitionRevision: definition.revision,
      label: definition.label,
      variant,
      exactDemand: new Decimal(0),
      unit,
      requirementIds: [],
      consumingSubjectIds: new Set<SubjectId>(),
      domains: new Set<EngineeringDomain>(),
      systemIds: new Set<SubjectId>()
    };
    group.exactDemand = group.exactDemand.plus(requirement.quantity);
    group.requirementIds.push(requirement.id);
    group.consumingSubjectIds.add(requirement.subjectId);
    if (requirement.domain) group.domains.add(requirement.domain);
    if (requirement.systemId) group.systemIds.add(requirement.systemId);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      id: `${group.partDefinitionId}@${group.partDefinitionRevision}:${encodeURIComponent(group.variant)}:${encodeURIComponent(group.unit)}`,
      partDefinitionId: group.partDefinitionId,
      partDefinitionRevision: group.partDefinitionRevision,
      label: group.label,
      variant: group.variant,
      exactDemand: group.exactDemand.toString(),
      unit: group.unit,
      requirementIds: group.requirementIds.toSorted(),
      consumingSubjectIds: [...group.consumingSubjectIds].toSorted(),
      domains: [...group.domains].toSorted(),
      systemIds: [...group.systemIds].toSorted(),
      procurementChoices: snapshot.build.procurementChoices
        .filter(
          (choice) =>
            choice.partDefinitionId === group.partDefinitionId &&
            choice.variant === group.variant &&
            choice.unit === group.unit
        )
        .toSorted((left, right) => left.id.localeCompare(right.id))
    }))
    .toSorted((left, right) => left.id.localeCompare(right.id));
}

export type BuildRecordRejection = Readonly<{
  code: 'invalid-build-record';
  message: string;
}>;

export function validateBuildRecord(snapshot: ProjectSnapshot): BuildRecordRejection | null {
  const ids = new Set<string>();
  for (const choice of snapshot.build.procurementChoices) {
    if (
      ids.has(choice.id) ||
      !choice.id.trim() ||
      !snapshot.partDefinitions.some((definition) => definition.id === choice.partDefinitionId) ||
      !choice.variant.trim() ||
      !choice.unit.trim() ||
      !isPositiveDecimal(choice.purchasedQuantity) ||
      !optionalPositiveDecimal(choice.packageSize) ||
      !optionalNonnegativeDecimal(choice.sparePercent) ||
      !optionalNonnegativeDecimal(choice.wasteQuantity) ||
      !optionalNonnegativeDecimal(choice.consumableQuantity) ||
      !choice.note.trim() ||
      !choice.provenance.trim()
    ) {
      return {
        code: 'invalid-build-record',
        message: `Procurement Choice ${choice.id} is incomplete or invalid`
      };
    }
    ids.add(choice.id);
  }

  for (const installation of snapshot.build.installations) {
    const evidenceIds = [
      ...installation.measuredEvidenceIds,
      ...installation.observationEvidenceIds
    ];
    if (
      ids.has(installation.id) ||
      !installation.id.trim() ||
      !projectOrHistoricalSubjectExists(snapshot, installation.subjectId) ||
      (installation.installedPartDefinitionId !== null &&
        !snapshot.partDefinitions.some(
          (definition) => definition.id === installation.installedPartDefinitionId
        )) ||
      (installation.status === 'installed' &&
        (installation.installedPartDefinitionId === null ||
          !installation.installedVariant?.trim())) ||
      !isPositiveDecimal(installation.quantity) ||
      !installation.unit.trim() ||
      new Set(evidenceIds).size !== evidenceIds.length ||
      evidenceIds.some(
        (evidenceId) => !snapshot.evidence.some((evidence) => evidence.id === evidenceId)
      ) ||
      installation.photoAssetHashes.some(
        (assetHash) => !snapshot.assetHashes.includes(assetHash)
      ) ||
      !Number.isFinite(Date.parse(installation.recordedAt)) ||
      !installation.provenance.trim() ||
      (installation.substitution !== null &&
        (!snapshot.partDefinitions.some(
          (definition) => definition.id === installation.substitution?.intendedPartDefinitionId
        ) ||
          !snapshot.partDefinitions.some(
            (definition) => definition.id === installation.substitution?.installedPartDefinitionId
          ) ||
          !installation.substitution.reason.trim()))
    ) {
      return {
        code: 'invalid-build-record',
        message: `Installation Record ${installation.id} is incomplete or invalid`
      };
    }
    ids.add(installation.id);
  }

  return null;
}

function isPositiveDecimal(value: string): boolean {
  try {
    return new Decimal(value).isFinite() && new Decimal(value).greaterThan(0);
  } catch {
    return false;
  }
}

function optionalPositiveDecimal(value: string | null): boolean {
  return value === null || isPositiveDecimal(value);
}

function optionalNonnegativeDecimal(value: string | null): boolean {
  if (value === null) return true;
  try {
    return new Decimal(value).isFinite() && !new Decimal(value).isNegative();
  } catch {
    return false;
  }
}

function projectOrHistoricalSubjectExists(snapshot: ProjectSnapshot, subjectId: SubjectId): boolean {
  return (
    snapshot.id === subjectId ||
    snapshot.topology.components.some((component) => component.id === subjectId) ||
    snapshot.topology.connections.some((connection) => connection.id === subjectId) ||
    snapshot.topology.systems.some((system) => system.id === subjectId) ||
    snapshot.topology.routes.some((route) => route.id === subjectId) ||
    snapshot.topology.segments.some((segment) => segment.id === subjectId) ||
    snapshot.tombstones.some((tombstone) => tombstone.subjectId === subjectId)
  );
}
