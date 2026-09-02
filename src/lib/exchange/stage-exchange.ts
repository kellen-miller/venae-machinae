import { canonicalJson, sha256Hex } from './canonical-json';
import { base64ToBytes, exchangeEnvelopeSchema } from './project-exchange';
import { migrateProjectDocument } from './project-document-migration';
import { APPLICATION_VERSIONS } from '../version/version-registry';

import type { MeasuredExchangeLimits } from './measured-limits';
import type {
  LibraryBackupExchangeEnvelope,
  ProjectExchangeEnvelope,
  TemplateExchangeEnvelope
} from './project-exchange';

type StageBlockReason =
  | 'envelope-size'
  | 'parse'
  | 'nesting-depth'
  | 'collection-count'
  | 'structure'
  | 'newer-schema'
  | 'unsupported-schema'
  | 'identity'
  | 'asset-count'
  | 'individual-asset-size'
  | 'combined-asset-size'
  | 'asset-integrity'
  | 'asset-content'
  | 'asset-reference'
  | 'payload-integrity'
  | 'export-metadata-integrity'
  | 'estimated-memory';

type StageMeasurements = Readonly<{
  envelopeBytes: number;
  originalAssetBytes: number;
  maxNestingDepth: number;
  collectionEntries: number;
  parseMs: number;
  validationMs: number;
  hashingMs: number;
  cloneMs: number;
  estimatedPeakBytes: number;
  estimatedPhasePeakBytes: Readonly<{
    parse: number;
    validation: number;
    hashing: number;
    clone: number;
    commit: number;
  }>;
}>;

export type StagedExchange = Readonly<{
  staged: true;
  format: 'venae-project';
  envelope: ProjectExchangeEnvelope;
  assets: readonly Readonly<{
    sha256: string;
    mimeType: string;
    bytes: Uint8Array;
  }>[];
  summary: Readonly<{
    format: 'venae-project';
    projectId: string;
    projectRevision: number;
    assetCount: number;
    originalAssetBytes: number;
    componentCount: number;
    connectionCount: number;
    warnings: readonly string[];
  }>;
  measurements: StageMeasurements;
}>;

export type StagedTemplateExchange = Readonly<{
  staged: true;
  format: 'venae-templates';
  envelope: TemplateExchangeEnvelope;
  assets: readonly Readonly<{
    sha256: string;
    mimeType: string;
    bytes: Uint8Array;
  }>[];
  summary: Readonly<{
    format: 'venae-templates';
    templateCount: number;
    revisionCount: number;
    assetCount: number;
    originalAssetBytes: number;
    warnings: readonly string[];
  }>;
  measurements: StageMeasurements;
}>;

export type StagedLibraryBackupExchange = Readonly<{
  staged: true;
  format: 'venae-backup';
  envelope: LibraryBackupExchangeEnvelope;
  assets: readonly Readonly<{
    sha256: string;
    mimeType: string;
    bytes: Uint8Array;
  }>[];
  summary: Readonly<{
    format: 'venae-backup';
    projectCount: number;
    namedSnapshotCount: number;
    templateRevisionCount: number;
    assetCount: number;
    originalAssetBytes: number;
    warnings: readonly string[];
  }>;
  measurements: StageMeasurements;
}>;

type StagedKnownExchange = StagedExchange | StagedTemplateExchange | StagedLibraryBackupExchange;

type StageBlockedOutcome = Readonly<{
  staged: false;
  reason: StageBlockReason;
  message: string;
}>;

export type StageExchangeOutcome = StagedExchange | StageBlockedOutcome;

export type StageTemplateExchangeOutcome = StagedTemplateExchange | StageBlockedOutcome;

export type StageLibraryBackupExchangeOutcome = StagedLibraryBackupExchange | StageBlockedOutcome;

function blocked(reason: StageBlockReason, message: string): StageBlockedOutcome {
  return Object.freeze({ staged: false as const, reason, message });
}

function inspectStructure(value: unknown): { maxNestingDepth: number; collectionEntries: number } {
  let maxNestingDepth = 0;
  let collectionEntries = 0;
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 1 }];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    if (Array.isArray(current.value)) {
      maxNestingDepth = Math.max(maxNestingDepth, current.depth);
      collectionEntries += current.value.length;
      for (const entry of current.value) pending.push({ value: entry, depth: current.depth + 1 });
    } else if (current.value !== null && typeof current.value === 'object') {
      maxNestingDepth = Math.max(maxNestingDepth, current.depth);
      for (const entry of Object.values(current.value)) {
        pending.push({ value: entry, depth: current.depth + 1 });
      }
    }
  }

  return { maxNestingDepth, collectionEntries };
}

function checkSchemaCompatibility(value: unknown): StageBlockedOutcome | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  const exchangeVersion = envelope.exchangeVersion;
  if (typeof exchangeVersion !== 'number' || !Number.isInteger(exchangeVersion)) return null;
  if (exchangeVersion > APPLICATION_VERSIONS.exchangeFormat) {
    return blocked('newer-schema', 'The exchange envelope requires a newer application version');
  }
  if (exchangeVersion < APPLICATION_VERSIONS.exchangeFormat) {
    return blocked('unsupported-schema', 'The exchange envelope is not from a released schema');
  }

  const payload = envelope.payload;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const payloadVersion = (payload as Record<string, unknown>).schemaVersion;
  if (typeof payloadVersion !== 'number' || !Number.isInteger(payloadVersion)) return null;
  const expectedPayloadVersion =
    envelope.format === 'venae-templates' || envelope.format === 'venae-backup' ? 1 : null;
  if (expectedPayloadVersion === null) return null;
  if (payloadVersion > expectedPayloadVersion) {
    return blocked('newer-schema', 'The exchange payload requires a newer application version');
  }
  if (payloadVersion < expectedPayloadVersion) {
    return blocked('unsupported-schema', 'The exchange payload is not from a released schema');
  }

  return null;
}

function hasRasterSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === 'image/png') {
    return (
      bytes.length >= 4 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
    );
  }
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  if (mimeType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes[0] === 82 &&
      bytes[1] === 73 &&
      bytes[2] === 70 &&
      bytes[3] === 70 &&
      bytes[8] === 87 &&
      bytes[9] === 69 &&
      bytes[10] === 66 &&
      bytes[11] === 80
    );
  }

  return false;
}

async function stageKnownExchange(
  blob: Blob,
  limits: MeasuredExchangeLimits
): Promise<StagedKnownExchange | StageBlockedOutcome> {
  if (blob.size > limits.maxEnvelopeBytes) {
    return blocked('envelope-size', 'The encoded exchange envelope exceeds the measured limit');
  }

  const parseStartedAt = performance.now();
  const source = await blob.text();
  let unknownEnvelope: unknown;
  try {
    unknownEnvelope = JSON.parse(source);
  } catch {
    return blocked('parse', 'The exchange envelope is not valid JSON');
  }
  const parseMs = performance.now() - parseStartedAt;
  const structure = inspectStructure(unknownEnvelope);
  if (structure.maxNestingDepth > limits.maxNestingDepth) {
    return blocked('nesting-depth', 'The exchange envelope exceeds the measured nesting limit');
  }

  if (structure.collectionEntries > limits.maxCollectionEntries) {
    return blocked(
      'collection-count',
      'The exchange envelope exceeds the measured collection limit'
    );
  }

  const incompatibleSchema = checkSchemaCompatibility(unknownEnvelope);
  if (incompatibleSchema) return incompatibleSchema;

  let migratedEnvelope = unknownEnvelope;
  let integrityPayload: unknown = null;
  if (
    unknownEnvelope !== null &&
    typeof unknownEnvelope === 'object' &&
    !Array.isArray(unknownEnvelope)
  ) {
    const envelope = unknownEnvelope as Record<string, unknown>;
    if (envelope.format === 'venae-project') {
      integrityPayload = envelope.payload;
      const migration = migrateProjectDocument(envelope.payload);
      if (!migration.migrated) {
        return blocked(migration.reason, 'The project payload cannot be migrated by this version');
      }
      migratedEnvelope = { ...envelope, payload: migration.document };
    }
  }

  const validationStartedAt = performance.now();
  const parsed = exchangeEnvelopeSchema.safeParse(migratedEnvelope);
  const validationMs = performance.now() - validationStartedAt;
  if (!parsed.success)
    return blocked('structure', 'The exchange envelope has an invalid structure');
  const envelope = parsed.data;

  if (envelope.format === 'venae-project') {
    if (
      envelope.identity.projectId !== envelope.payload.project.id ||
      envelope.identity.projectRevision !== envelope.payload.project.revision
    ) {
      return blocked('identity', 'Envelope identity does not match its project payload');
    }
  } else if (envelope.format === 'venae-templates') {
    const templateIds = [
      ...new Set(envelope.payload.templateRevisions.map((revision) => revision.templateId))
    ].sort();
    const latestRevision = Math.max(
      0,
      ...envelope.payload.templateRevisions.map((revision) => revision.revision)
    );
    if (
      JSON.stringify(templateIds) !== JSON.stringify(envelope.identity.templateIds) ||
      latestRevision !== envelope.identity.latestRevision
    ) {
      return blocked('identity', 'Envelope identity does not match its template payload');
    }
  } else if (
    envelope.identity.generationId !== envelope.payload.settings.activeGenerationId ||
    envelope.identity.libraryRevision !== envelope.payload.schemaVersion
  ) {
    return blocked('identity', 'Envelope identity does not match its Library Backup payload');
  }

  if (envelope.assets.length > limits.maxAssets) {
    return blocked('asset-count', 'The exchange envelope contains too many assets');
  }

  if (envelope.assets.some((asset) => asset.byteLength > limits.maxIndividualAssetBytes)) {
    return blocked('individual-asset-size', 'An asset exceeds the measured individual limit');
  }

  const declaredAssetBytes = envelope.assets.reduce((total, asset) => total + asset.byteLength, 0);
  if (declaredAssetBytes > limits.maxCombinedAssetBytes) {
    return blocked('combined-asset-size', 'Combined assets exceed the measured limit');
  }

  const hashingStartedAt = performance.now();
  const decodedAssets: Array<{ sha256: string; mimeType: string; bytes: Uint8Array }> = [];
  for (const asset of envelope.assets) {
    const bytes = base64ToBytes(asset.base64);
    if (bytes.byteLength !== asset.byteLength || (await sha256Hex(bytes)) !== asset.sha256) {
      return blocked('asset-integrity', 'An embedded asset failed corruption detection');
    }
    if (!hasRasterSignature(asset.mimeType, bytes)) {
      return blocked(
        'asset-content',
        'An embedded asset does not match its allowlisted raster type'
      );
    }

    decodedAssets.push({ sha256: asset.sha256, mimeType: asset.mimeType, bytes });
  }

  const integrityAssets = envelope.integrity.assets
    .map((asset) => `${asset.sha256}:${asset.byteLength}`)
    .sort();
  const embeddedAssets = envelope.assets
    .map((asset) => `${asset.sha256}:${asset.byteLength}`)
    .sort();
  const payloadAssetHashes = [...envelope.payload.assetHashes].sort();
  const embeddedAssetHashes = envelope.assets.map((asset) => asset.sha256).sort();
  if (
    new Set(embeddedAssetHashes).size !== embeddedAssetHashes.length ||
    JSON.stringify(integrityAssets) !== JSON.stringify(embeddedAssets) ||
    JSON.stringify(payloadAssetHashes) !== JSON.stringify(embeddedAssetHashes)
  ) {
    return blocked('asset-reference', 'Asset references and integrity metadata do not match');
  }

  const canonicalPayload = canonicalJson(
    envelope.format === 'venae-project' ? integrityPayload : envelope.payload
  );
  if ((await sha256Hex(canonicalPayload)) !== envelope.integrity.payloadSha256) {
    return blocked('payload-integrity', 'The exchange payload failed corruption detection');
  }

  if (
    (await sha256Hex(canonicalJson(envelope.exportMetadata))) !==
    envelope.integrity.exportMetadataSha256
  ) {
    return blocked('export-metadata-integrity', 'Export metadata failed corruption detection');
  }
  const hashingMs = performance.now() - hashingStartedAt;

  const cloneStartedAt = performance.now();
  const stagedEnvelope = structuredClone(envelope);
  const stagedAssets = structuredClone(decodedAssets);
  const cloneMs = performance.now() - cloneStartedAt;
  const payloadBytes = new TextEncoder().encode(JSON.stringify(envelope.payload)).byteLength;
  const sourceStringBytes = source.length * 2;
  const canonicalPayloadBytes = new TextEncoder().encode(canonicalPayload).byteLength;
  const phasePeaks = Object.freeze({
    parse: blob.size + sourceStringBytes + blob.size,
    validation: sourceStringBytes + blob.size + blob.size,
    hashing: blob.size + canonicalPayloadBytes + declaredAssetBytes,
    clone: blob.size * 2 + declaredAssetBytes,
    commit: blob.size + payloadBytes * 2 + declaredAssetBytes * 2
  });
  const estimatedPeakBytes = Math.max(...Object.values(phasePeaks));
  if (estimatedPeakBytes > limits.maxEstimatedPeakBytes) {
    return blocked('estimated-memory', 'The staged exchange exceeds the measured memory limit');
  }

  const measurements = Object.freeze({
    envelopeBytes: blob.size,
    originalAssetBytes: declaredAssetBytes,
    ...structure,
    parseMs,
    validationMs,
    hashingMs,
    cloneMs,
    estimatedPeakBytes,
    estimatedPhasePeakBytes: phasePeaks
  });
  const warnings = Object.freeze([] as string[]);
  if (stagedEnvelope.format === 'venae-project') {
    return Object.freeze({
      staged: true as const,
      format: stagedEnvelope.format,
      envelope: stagedEnvelope,
      assets: stagedAssets,
      summary: Object.freeze({
        format: stagedEnvelope.format,
        projectId: stagedEnvelope.payload.project.id,
        projectRevision: stagedEnvelope.payload.project.revision,
        assetCount: stagedEnvelope.assets.length,
        originalAssetBytes: declaredAssetBytes,
        componentCount: stagedEnvelope.payload.topology.components.length,
        connectionCount: stagedEnvelope.payload.topology.connections.length,
        warnings
      }),
      measurements
    });
  }

  if (stagedEnvelope.format === 'venae-templates') {
    return Object.freeze({
      staged: true as const,
      format: stagedEnvelope.format,
      envelope: stagedEnvelope,
      assets: stagedAssets,
      summary: Object.freeze({
        format: stagedEnvelope.format,
        templateCount: stagedEnvelope.identity.templateIds.length,
        revisionCount: stagedEnvelope.payload.templateRevisions.length,
        assetCount: stagedEnvelope.assets.length,
        originalAssetBytes: declaredAssetBytes,
        warnings
      }),
      measurements
    });
  }

  return Object.freeze({
    staged: true as const,
    format: stagedEnvelope.format,
    envelope: stagedEnvelope,
    assets: stagedAssets,
    summary: Object.freeze({
      format: stagedEnvelope.format,
      projectCount: stagedEnvelope.payload.projects.length,
      namedSnapshotCount: stagedEnvelope.payload.namedSnapshots.length,
      templateRevisionCount: stagedEnvelope.payload.templates.length,
      assetCount: stagedEnvelope.assets.length,
      originalAssetBytes: declaredAssetBytes,
      warnings
    }),
    measurements
  });
}

export async function stageExchange(
  blob: Blob,
  limits: MeasuredExchangeLimits
): Promise<StageExchangeOutcome> {
  const outcome = await stageKnownExchange(blob, limits);
  if (!outcome.staged) return outcome;
  if (outcome.format !== 'venae-project') {
    return blocked('structure', 'Expected a .venae.json project exchange envelope');
  }

  return outcome;
}

export async function stageTemplateExchange(
  blob: Blob,
  limits: MeasuredExchangeLimits
): Promise<StageTemplateExchangeOutcome> {
  const outcome = await stageKnownExchange(blob, limits);
  if (!outcome.staged) return outcome;
  if (outcome.format !== 'venae-templates') {
    return blocked('structure', 'Expected a .venae-templates.json exchange envelope');
  }

  return outcome;
}

export async function stageLibraryBackupExchange(
  blob: Blob,
  limits: MeasuredExchangeLimits
): Promise<StageLibraryBackupExchangeOutcome> {
  const outcome = await stageKnownExchange(blob, limits);
  if (!outcome.staged) return outcome;
  if (outcome.format !== 'venae-backup') {
    return blocked('structure', 'Expected a .venae-backup.json exchange envelope');
  }

  return outcome;
}
