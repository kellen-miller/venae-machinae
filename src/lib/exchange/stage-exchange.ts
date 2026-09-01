import { canonicalJson, sha256Hex } from './canonical-json';
import { base64ToBytes, projectExchangeEnvelopeSchema } from './project-exchange';

import type { MeasuredExchangeLimits } from './measured-limits';
import type { ProjectExchangeEnvelope } from './project-exchange';

type StageBlockReason =
  | 'envelope-size'
  | 'parse'
  | 'nesting-depth'
  | 'collection-count'
  | 'structure'
  | 'identity'
  | 'asset-count'
  | 'individual-asset-size'
  | 'combined-asset-size'
  | 'asset-integrity'
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

export type StageExchangeOutcome =
  | StagedExchange
  | Readonly<{
      staged: false;
      reason: StageBlockReason;
      message: string;
    }>;

function blocked(reason: StageBlockReason, message: string): StageExchangeOutcome {
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

export async function stageExchange(
  blob: Blob,
  limits: MeasuredExchangeLimits
): Promise<StageExchangeOutcome> {
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

  const validationStartedAt = performance.now();
  const parsed = projectExchangeEnvelopeSchema.safeParse(unknownEnvelope);
  const validationMs = performance.now() - validationStartedAt;
  if (!parsed.success)
    return blocked('structure', 'The exchange envelope has an invalid structure');
  const envelope = parsed.data;

  if (
    envelope.identity.projectId !== envelope.payload.project.id ||
    envelope.identity.projectRevision !== envelope.payload.project.revision
  ) {
    return blocked('identity', 'Envelope identity does not match its project payload');
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
  const decodedAssets = [];
  for (const asset of envelope.assets) {
    const bytes = base64ToBytes(asset.base64);
    if (bytes.byteLength !== asset.byteLength || (await sha256Hex(bytes)) !== asset.sha256) {
      return blocked('asset-integrity', 'An embedded asset failed corruption detection');
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

  const canonicalPayload = canonicalJson(envelope.payload);
  if ((await sha256Hex(canonicalPayload)) !== envelope.integrity.payloadSha256) {
    return blocked('payload-integrity', 'The project payload failed corruption detection');
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
  const summary = Object.freeze({
    format: 'venae-project' as const,
    projectId: envelope.payload.project.id,
    projectRevision: envelope.payload.project.revision,
    assetCount: envelope.assets.length,
    originalAssetBytes: declaredAssetBytes,
    componentCount: envelope.payload.topology.components.length,
    connectionCount: envelope.payload.topology.connections.length,
    warnings: Object.freeze([] as string[])
  });

  return Object.freeze({
    staged: true as const,
    envelope: stagedEnvelope,
    assets: stagedAssets,
    summary,
    measurements
  });
}
