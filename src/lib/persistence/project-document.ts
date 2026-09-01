import { z } from 'zod';

z.config({ jitless: true });

const decimalString = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const identity = z.string().min(1).max(160);

const portSchema = z.strictObject({
  id: identity,
  label: z.string().min(1).max(160),
  domain: z.enum(['electrical', 'fluid'])
});

const componentSchema = z.strictObject({
  id: identity,
  label: z.string().min(1).max(160),
  kind: z.enum(['electrical', 'fluid']),
  x: decimalString,
  y: decimalString,
  ports: z.array(portSchema)
});

const connectionSchema = z.strictObject({
  id: identity,
  sourcePortId: identity,
  targetPortId: identity,
  kind: z.enum(['electrical-wire', 'fluid-hose', 'fluid-tube', 'fluid-pipe']),
  routePoints: z.array(z.strictObject({ x: decimalString, y: decimalString }))
});

export const projectDocumentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  project: z.strictObject({
    id: identity,
    name: z.string().min(1).max(240),
    revision: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime({ offset: true })
  }),
  topology: z.strictObject({
    components: z.array(componentSchema),
    connections: z.array(connectionSchema)
  }),
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
  results: z.array(
    z.strictObject({
      id: identity,
      sourceRevision: z.number().int().nonnegative(),
      status: z.enum(['current', 'stale', 'unknown', 'unsupported', 'failed'])
    })
  ),
  settings: z.strictObject({ unitSystem: z.enum(['metric', 'imperial']) }),
  assetHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/))
});

export type ProjectDocument = z.infer<typeof projectDocumentSchema>;
