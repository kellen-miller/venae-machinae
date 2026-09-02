import { z } from 'zod';

import {
  libraryBackupPayloadSchema,
  librarySettingsSchema,
  namedSnapshotSchema,
  storedProjectSchema,
  templateRevisionSchema
} from '../persistence/database-schema';
import { projectDocumentSchema } from '../persistence/project-document';
import { APPLICATION_VERSIONS } from '../version/version-registry';
import { canonicalJson, sha256Hex } from './canonical-json';

import type { LibraryBackupPayload, TemplateRevision } from '../persistence/database-schema';
import type { ProjectDocument } from '../persistence/project-document';

z.config({ jitless: true });

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const base64 = z.string().refine((value) => {
  if (value.length % 4 !== 0) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  for (let index = 0; index < value.length - padding; index += 1) {
    const code = value.charCodeAt(index);
    const allowed =
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      code === 43 ||
      code === 47;
    if (!allowed) return false;
  }

  for (let index = value.length - padding; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) return false;
  }

  return true;
});
const rasterMimeType = z.enum(['image/png', 'image/jpeg', 'image/webp']);

export const exchangeAssetSchema = z.strictObject({
  sha256,
  mimeType: rasterMimeType,
  byteLength: z.number().int().nonnegative(),
  base64
});

export const exchangeExportMetadataSchema = z.strictObject({
  exportedAt: z.iso.datetime({ offset: true }),
  generator: z.literal('venae-machinae'),
  revisionState: z.enum(['Durable revision', 'Unsaved working state'])
});

export const projectExchangeEnvelopeSchema = z.strictObject({
  format: z.literal('venae-project'),
  exchangeVersion: z.literal(1),
  applicationVersion: z.string().min(1),
  identity: z.strictObject({
    projectId: z.string().min(1).max(160),
    projectRevision: z.number().int().nonnegative()
  }),
  payload: projectDocumentSchema,
  assets: z.array(exchangeAssetSchema),
  integrity: z.strictObject({
    algorithm: z.literal('SHA-256'),
    payloadSha256: sha256,
    exportMetadataSha256: sha256,
    assets: z.array(
      z.strictObject({
        sha256,
        byteLength: z.number().int().nonnegative()
      })
    )
  }),
  exportMetadata: exchangeExportMetadataSchema
});

export const templateExchangePayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  templateRevisions: z.array(templateRevisionSchema),
  assetHashes: z.array(sha256)
});

export const templateExchangeEnvelopeSchema = z.strictObject({
  format: z.literal('venae-templates'),
  exchangeVersion: z.literal(1),
  applicationVersion: z.string().min(1),
  identity: z.strictObject({
    templateIds: z.array(z.string().min(1).max(160)),
    latestRevision: z.number().int().nonnegative()
  }),
  payload: templateExchangePayloadSchema,
  assets: z.array(exchangeAssetSchema),
  integrity: z.strictObject({
    algorithm: z.literal('SHA-256'),
    payloadSha256: sha256,
    exportMetadataSha256: sha256,
    assets: z.array(
      z.strictObject({
        sha256,
        byteLength: z.number().int().nonnegative()
      })
    )
  }),
  exportMetadata: exchangeExportMetadataSchema
});

export const libraryBackupExchangePayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  createdAt: z.iso.datetime({ offset: true }),
  projects: z.array(storedProjectSchema),
  namedSnapshots: z.array(namedSnapshotSchema),
  templates: z.array(templateRevisionSchema),
  settings: librarySettingsSchema,
  assetHashes: z.array(sha256)
});

export const libraryBackupExchangeEnvelopeSchema = z.strictObject({
  format: z.literal('venae-backup'),
  exchangeVersion: z.literal(1),
  applicationVersion: z.string().min(1),
  identity: z.strictObject({
    generationId: z.string().min(1).max(160),
    libraryRevision: z.number().int().positive()
  }),
  payload: libraryBackupExchangePayloadSchema,
  assets: z.array(exchangeAssetSchema),
  integrity: z.strictObject({
    algorithm: z.literal('SHA-256'),
    payloadSha256: sha256,
    exportMetadataSha256: sha256,
    assets: z.array(
      z.strictObject({
        sha256,
        byteLength: z.number().int().nonnegative()
      })
    )
  }),
  exportMetadata: exchangeExportMetadataSchema
});

export const exchangeEnvelopeSchema = z.discriminatedUnion('format', [
  projectExchangeEnvelopeSchema,
  templateExchangeEnvelopeSchema,
  libraryBackupExchangeEnvelopeSchema
]);

export type ProjectExchangeEnvelope = z.infer<typeof projectExchangeEnvelopeSchema>;
export type TemplateExchangeEnvelope = z.infer<typeof templateExchangeEnvelopeSchema>;
export type LibraryBackupExchangeEnvelope = z.infer<typeof libraryBackupExchangeEnvelopeSchema>;
export type ExchangeEnvelope = z.infer<typeof exchangeEnvelopeSchema>;
export type ExchangeAssetInput = {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  bytes: Uint8Array;
};

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }

  return btoa(binary);
}

export function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function encodeExchangeAssets(assets: readonly ExchangeAssetInput[]) {
  const encoded = await Promise.all(
    assets.map(async (asset) => {
      const hash = await sha256Hex(asset.bytes);
      return {
        sha256: hash,
        mimeType: asset.mimeType,
        byteLength: asset.bytes.byteLength,
        base64: bytesToBase64(asset.bytes)
      };
    })
  );

  return encoded.sort((left, right) => left.sha256.localeCompare(right.sha256));
}

export async function createProjectExchange(input: {
  project: ProjectDocument;
  assets: readonly ExchangeAssetInput[];
  exportedAt: string;
  revisionState?: 'Durable revision' | 'Unsaved working state';
}): Promise<ProjectExchangeEnvelope> {
  const assets = await encodeExchangeAssets(input.assets);
  const project = projectDocumentSchema.parse({
    ...input.project,
    assetHashes: assets.map((asset) => asset.sha256).sort()
  });
  const exportMetadata = exchangeExportMetadataSchema.parse({
    exportedAt: input.exportedAt,
    generator: 'venae-machinae',
    revisionState: input.revisionState ?? 'Durable revision'
  });

  return projectExchangeEnvelopeSchema.parse({
    format: 'venae-project',
    exchangeVersion: APPLICATION_VERSIONS.exchangeFormat,
    applicationVersion: APPLICATION_VERSIONS.application,
    identity: {
      projectId: project.project.id,
      projectRevision: project.project.revision
    },
    payload: project,
    assets,
    integrity: {
      algorithm: 'SHA-256',
      payloadSha256: await sha256Hex(canonicalJson(project)),
      exportMetadataSha256: await sha256Hex(canonicalJson(exportMetadata)),
      assets: assets.map((asset) => ({
        sha256: asset.sha256,
        byteLength: asset.byteLength
      }))
    },
    exportMetadata
  });
}

export async function createTemplateExchange(input: {
  templateRevisions: readonly TemplateRevision[];
  assets: readonly ExchangeAssetInput[];
  exportedAt: string;
}): Promise<TemplateExchangeEnvelope> {
  const assets = await encodeExchangeAssets(input.assets);
  const templateRevisions = [...input.templateRevisions].sort(
    (left, right) =>
      left.templateId.localeCompare(right.templateId) || left.revision - right.revision
  );
  const payload = templateExchangePayloadSchema.parse({
    schemaVersion: 1,
    templateRevisions,
    assetHashes: assets.map((asset) => asset.sha256)
  });
  const templateIds = [...new Set(templateRevisions.map((revision) => revision.templateId))].sort();
  const exportMetadata = exchangeExportMetadataSchema.parse({
    exportedAt: input.exportedAt,
    generator: 'venae-machinae',
    revisionState: 'Durable revision'
  });

  return templateExchangeEnvelopeSchema.parse({
    format: 'venae-templates',
    exchangeVersion: APPLICATION_VERSIONS.exchangeFormat,
    applicationVersion: APPLICATION_VERSIONS.application,
    identity: {
      templateIds,
      latestRevision: Math.max(0, ...templateRevisions.map((revision) => revision.revision))
    },
    payload,
    assets,
    integrity: {
      algorithm: 'SHA-256',
      payloadSha256: await sha256Hex(canonicalJson(payload)),
      exportMetadataSha256: await sha256Hex(canonicalJson(exportMetadata)),
      assets: assets.map((asset) => ({
        sha256: asset.sha256,
        byteLength: asset.byteLength
      }))
    },
    exportMetadata
  });
}

export async function createLibraryBackupExchange(input: {
  backup: LibraryBackupPayload;
  exportedAt: string;
}): Promise<LibraryBackupExchangeEnvelope> {
  const backup = libraryBackupPayloadSchema.parse(input.backup);
  const assets = await encodeExchangeAssets(
    backup.assets.map((asset) => ({ mimeType: asset.mimeType, bytes: asset.bytes }))
  );
  const payload = libraryBackupExchangePayloadSchema.parse({
    schemaVersion: backup.schemaVersion,
    createdAt: backup.createdAt,
    projects: [...backup.projects].sort((left, right) =>
      left.projectId.localeCompare(right.projectId)
    ),
    namedSnapshots: [...backup.namedSnapshots].sort(
      (left, right) =>
        left.projectId.localeCompare(right.projectId) || left.id.localeCompare(right.id)
    ),
    templates: [...backup.templates].sort(
      (left, right) =>
        left.templateId.localeCompare(right.templateId) || left.revision - right.revision
    ),
    settings: {
      ...backup.settings,
      lastProjectExports: [...backup.settings.lastProjectExports].sort((left, right) =>
        left.projectId.localeCompare(right.projectId)
      )
    },
    assetHashes: assets.map((asset) => asset.sha256)
  });
  const exportMetadata = exchangeExportMetadataSchema.parse({
    exportedAt: input.exportedAt,
    generator: 'venae-machinae',
    revisionState: 'Durable revision'
  });

  return libraryBackupExchangeEnvelopeSchema.parse({
    format: 'venae-backup',
    exchangeVersion: APPLICATION_VERSIONS.exchangeFormat,
    applicationVersion: APPLICATION_VERSIONS.application,
    identity: {
      generationId: backup.settings.activeGenerationId,
      libraryRevision: backup.schemaVersion
    },
    payload,
    assets,
    integrity: {
      algorithm: 'SHA-256',
      payloadSha256: await sha256Hex(canonicalJson(payload)),
      exportMetadataSha256: await sha256Hex(canonicalJson(exportMetadata)),
      assets: assets.map((asset) => ({
        sha256: asset.sha256,
        byteLength: asset.byteLength
      }))
    },
    exportMetadata
  });
}
