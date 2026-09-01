import { z } from 'zod';

import { projectDocumentSchema } from '../persistence/project-document';
import { APPLICATION_VERSIONS } from '../version/version-registry';
import { canonicalJson, sha256Hex } from './canonical-json';

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

const exchangeAssetSchema = z.strictObject({
  sha256,
  mimeType: rasterMimeType,
  byteLength: z.number().int().nonnegative(),
  base64
});

const exchangeExportMetadataSchema = z.strictObject({
  exportedAt: z.iso.datetime({ offset: true }),
  generator: z.literal('venae-machinae')
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

export type ProjectExchangeEnvelope = z.infer<typeof projectExchangeEnvelopeSchema>;
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

export async function createProjectExchange(input: {
  project: ProjectDocument;
  assets: readonly ExchangeAssetInput[];
  exportedAt: string;
}): Promise<ProjectExchangeEnvelope> {
  const assets = await Promise.all(
    input.assets.map(async (asset) => {
      const hash = await sha256Hex(asset.bytes);
      return {
        sha256: hash,
        mimeType: asset.mimeType,
        byteLength: asset.bytes.byteLength,
        base64: bytesToBase64(asset.bytes)
      };
    })
  );
  const project = projectDocumentSchema.parse({
    ...input.project,
    assetHashes: assets.map((asset) => asset.sha256).sort()
  });
  const exportMetadata = exchangeExportMetadataSchema.parse({
    exportedAt: input.exportedAt,
    generator: 'venae-machinae'
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
