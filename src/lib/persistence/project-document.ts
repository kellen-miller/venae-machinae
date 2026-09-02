import { z } from 'zod';

import { validateElectricalModel } from '../electrical/electrical';
import { validateFluidModel } from '../fluid/fluid';
import { validateTopology } from '../topology/topology';
import { APPLICATION_VERSIONS } from '../version/version-registry';
import { validateCalculationModel } from '../project/project';
import {
  calculationOutcomeSchema,
  calculationRequestSchema,
  candidateScreenRequestSchema,
  screeningResultSchema
} from '../calculation/calculation-schema';
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
  kind: z.enum(['electrical-wire', 'electrical-mate', 'fluid-hose', 'fluid-tube', 'fluid-pipe']),
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
  kind: z.string().min(1),
  detail: z
    .discriminatedUnion('type', [
      z.strictObject({ type: z.literal('calculation'), outcome: calculationOutcomeSchema }),
      z.strictObject({ type: z.literal('screening'), result: screeningResultSchema })
    ])
    .nullable()
});

const tombstoneSchema = z.strictObject({
  subjectId: identity,
  subjectKind: z.enum(['component', 'connection']),
  successorId: identity
});

const electricalLengthSchema = z.strictObject({
  decimal: decimalString,
  unit: z.enum(['mm', 'cm', 'm', 'in', 'ft']),
  source: z.enum(['estimated', 'measured', 'entered', 'sourced']),
  provenance: z.string().min(1)
});

const electricalPropertySchema = z.strictObject({
  state: z.enum(['known', 'unknown', 'conflicting']),
  value: z.string().nullable(),
  unit: z.string().nullable(),
  provenance: z.string().nullable(),
  conflictValues: z.array(z.string())
});

const electricalModelSchema = z.strictObject({
  components: z.array(
    z.strictObject({
      componentId: identity,
      role: z.enum([
        'source',
        'ground',
        'fuse',
        'relay',
        'switch',
        'load',
        'controller',
        'connector',
        'splice',
        'bus'
      ])
    })
  ),
  wires: z.array(
    z.strictObject({
      connectionId: identity,
      partDefinitionId: identity.nullable(),
      role: z.enum(['power', 'return', 'analog', 'discrete', 'pwm', 'data']),
      protocol: z.string().min(1).nullable(),
      routeLength: electricalLengthSchema.nullable(),
      cutLength: electricalLengthSchema.nullable(),
      serviceAllowance: electricalLengthSchema.nullable(),
      environment: z.string()
    })
  ),
  circuits: z.array(
    z.strictObject({
      id: identity,
      label: z.string().min(1).max(160),
      systemId: identity,
      connectionIds: z.array(identity),
      componentIds: z.array(identity),
      protectionComponentIds: z.array(identity)
    })
  ),
  connectors: z.array(
    z.strictObject({
      componentId: identity,
      cavities: z.array(
        z.strictObject({
          portId: identity,
          cavityName: z.string().min(1).max(160),
          pinMapping: z.string().nullable(),
          mateConnectionId: identity.nullable(),
          wireConnectionId: identity.nullable(),
          terminalPartDefinitionId: identity.nullable(),
          sealPartDefinitionId: identity.nullable(),
          plugPartDefinitionId: identity.nullable(),
          unusedRequirement: z.enum([
            'occupied',
            'cavity-plug-required',
            'seal-required',
            'open-allowed'
          ])
        })
      )
    })
  ),
  harnesses: z.array(
    z.strictObject({
      id: identity,
      label: z.string().min(1).max(160),
      componentIds: z.array(identity),
      wireConnectionIds: z.array(identity)
    })
  ),
  bundles: z.array(
    z.strictObject({
      id: identity,
      harnessId: identity,
      label: z.string().min(1).max(160),
      wireConnectionIds: z.array(identity),
      segmentIds: z.array(identity),
      transitions: z.array(
        z.strictObject({ segmentId: identity, kind: z.enum(['split', 'join']) })
      ),
      coverings: z.array(
        z.strictObject({
          segmentId: identity,
          description: z.string().min(1),
          partDefinitionId: identity.nullable()
        })
      ),
      twistedPairs: z.array(
        z.strictObject({
          id: identity,
          wireConnectionIds: z.tuple([identity, identity]),
          shield: z.string().nullable(),
          drainWireConnectionId: identity.nullable(),
          cutLengthAllowance: electricalLengthSchema.nullable(),
          notes: z.string()
        })
      ),
      concentric: z
        .strictObject({
          layers: z.array(
            z.strictObject({
              order: z.number().int().positive(),
              wireConnectionIds: z.array(identity)
            })
          ),
          pitch: electricalLengthSchema.nullable(),
          layDirection: z.enum(['left', 'right']),
          cutLengthAllowance: electricalLengthSchema.nullable(),
          notes: z.string()
        })
        .nullable(),
      notes: z.string()
    })
  ),
  cableSpecifications: z.array(
    z.strictObject({
      partDefinitionId: identity,
      conductorAreaOrGauge: electricalPropertySchema,
      material: electricalPropertySchema,
      strandConstruction: electricalPropertySchema,
      insulation: electricalPropertySchema,
      color: electricalPropertySchema,
      stripe: electricalPropertySchema,
      minimumTemperature: electricalPropertySchema,
      maximumTemperature: electricalPropertySchema,
      resistancePerLength: electricalPropertySchema,
      applicableCurrentData: electricalPropertySchema
    })
  )
});

const fluidLengthSchema = z.strictObject({
  decimal: decimalString,
  unit: z.enum(['mm', 'cm', 'm', 'in', 'ft']),
  source: z.enum(['estimated', 'measured', 'entered', 'sourced']),
  provenance: z.string().min(1)
});

const fluidModelSchema = z.strictObject({
  media: z.array(
    z.strictObject({
      id: identity,
      label: z.string().min(1).max(160),
      composition: z.string().min(1),
      provenance: z.string().min(1)
    })
  ),
  systems: z.array(
    z.strictObject({
      systemId: identity,
      mediumId: identity,
      purpose: z.string().min(1)
    })
  ),
  components: z.array(
    z.strictObject({
      componentId: identity,
      role: z.enum([
        'endpoint',
        'fitting',
        'union',
        'tee',
        'manifold',
        'pump',
        'restriction',
        'valve',
        'heat-source',
        'heat-sink',
        'volume',
        'heat-exchanger'
      ])
    })
  ),
  lines: z.array(
    z.strictObject({
      connectionId: identity,
      partDefinitionId: identity.nullable(),
      construction: z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('hose'),
          reinforcement: z.string(),
          minimumBendRadius: fluidLengthSchema.nullable()
        }),
        z.strictObject({
          kind: z.literal('tube'),
          material: z.string(),
          wallThickness: fluidLengthSchema.nullable()
        }),
        z.strictObject({
          kind: z.literal('pipe'),
          material: z.string(),
          schedule: z.string()
        })
      ]),
      routeLength: fluidLengthSchema.nullable(),
      hydraulicLength: fluidLengthSchema.nullable(),
      cutLength: fluidLengthSchema.nullable(),
      elevation: z
        .strictObject({
          start: decimalString,
          end: decimalString,
          unit: z.enum(['mm', 'cm', 'm', 'in', 'ft']),
          source: z.enum(['estimated', 'measured', 'entered', 'sourced']),
          provenance: z.string().min(1)
        })
        .nullable(),
      environment: z.string().min(1),
      provenance: z.string().min(1)
    })
  ),
  behaviors: z.array(
    z.strictObject({
      id: identity,
      componentId: identity,
      role: z.enum([
        'passage',
        'pump',
        'restriction',
        'valve',
        'heat-source',
        'heat-sink',
        'volume',
        'heat-exchanger'
      ]),
      portIds: z.array(identity),
      mediumIds: z.array(identity),
      description: z.string().min(1),
      provenance: z.string().min(1)
    })
  ),
  boundaryConditions: z.array(
    z.strictObject({
      id: identity,
      behaviorId: identity,
      subjectId: identity,
      operatingStateId: identity,
      quantity: z.enum(['pressure', 'flow', 'temperature', 'level', 'command', 'operating-point']),
      value: z.string().min(1),
      unit: z.string().min(1).nullable(),
      source: z.enum(['measured', 'entered', 'sourced', 'assumed']),
      provenance: z.string().min(1)
    })
  )
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
  electrical: electricalModelSchema,
  fluid: fluidModelSchema,
  calculations: z.array(calculationRequestSchema),
  screenings: z.array(candidateScreenRequestSchema),
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
  assetHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
  vehicleBackground: z
    .strictObject({
      assetHash: z.string().regex(/^[a-f0-9]{64}$/),
      mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
      calibration: z.strictObject({
        first: pointSchema,
        second: pointSchema,
        distance: z.strictObject({
          decimal: decimalString,
          unit: z.enum(['mm', 'cm', 'm', 'in', 'ft'])
        })
      }),
      position: pointSchema,
      opacity: decimalString,
      visible: z.boolean(),
      locked: z.boolean()
    })
    .nullable()
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
    electrical: snapshot.electrical,
    fluid: snapshot.fluid,
    calculations: snapshot.calculations,
    screenings: snapshot.screenings,
    partDefinitions: snapshot.partDefinitions,
    partRequirements: snapshot.partRequirements,
    evidence: snapshot.evidence,
    results: snapshot.results,
    tombstones: snapshot.tombstones,
    engineeringValues: snapshot.engineeringValues,
    operatingStates: snapshot.operatingStates,
    settings: snapshot.settings,
    assetHashes: snapshot.assetHashes,
    vehicleBackground: snapshot.vehicleBackground
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
    electrical: parsed.electrical,
    fluid: parsed.fluid,
    calculations: parsed.calculations,
    screenings: parsed.screenings,
    partDefinitions: parsed.partDefinitions,
    partRequirements: parsed.partRequirements,
    evidence: parsed.evidence,
    results: parsed.results,
    tombstones: parsed.tombstones,
    engineeringValues: parsed.engineeringValues,
    operatingStates: parsed.operatingStates,
    settings: parsed.settings,
    assetHashes: parsed.assetHashes,
    vehicleBackground: parsed.vehicleBackground
  };
  const rejection = validateTopology(snapshot.topology);
  if (rejection) throw new Error(`Persisted Project topology is invalid: ${rejection.message}`);
  const electricalRejection = validateElectricalModel(
    snapshot.topology,
    snapshot.partDefinitions,
    snapshot.electrical
  );
  if (electricalRejection) {
    throw new Error(
      `Persisted Project electrical model is invalid: ${electricalRejection.message}`
    );
  }
  const fluidRejection = validateFluidModel(
    snapshot.topology,
    snapshot.partDefinitions,
    snapshot.operatingStates,
    snapshot.fluid
  );
  if (fluidRejection) {
    throw new Error(`Persisted Project fluid model is invalid: ${fluidRejection.message}`);
  }
  const calculationRejection = validateCalculationModel(snapshot);
  if (calculationRejection) {
    throw new Error(
      `Persisted Project calculation model is invalid: ${calculationRejection.message}`
    );
  }
  return snapshot;
}
