import { projectDocumentSchema } from '../persistence/project-document';

import type { BrowserProjectLibrary } from '../persistence/project-library';
import type { ProjectDocument } from '../persistence/project-document';
import type { StagedExchange } from './stage-exchange';

export type ExchangeCommitDecision = 'replace' | 'import-copy' | 'cancel';
export const DEFAULT_EXCHANGE_COMMIT_DECISION: ExchangeCommitDecision = 'cancel';

export type ExchangeCommitOutcome =
  | Readonly<{
      committed: true;
      decision: 'replace' | 'import-copy';
      projectId: string;
      revision: number;
    }>
  | Readonly<{
      committed: false;
      reason: 'canceled' | 'revision-conflict' | 'quota-exceeded' | 'storage-error';
    }>;

function rekeyProjectCopy(project: ProjectDocument): ProjectDocument {
  const projectId = crypto.randomUUID();
  const systemIds = new Map(
    project.topology.systems.map((system) => [system.id, crypto.randomUUID()])
  );
  const mediumIds = new Map(
    [
      ...project.topology.systems.map((system) => system.mediumId),
      ...project.topology.components.flatMap((component) =>
        component.ports.map((port) => port.mediumId)
      ),
      ...project.topology.connections.map((connection) => connection.mediumId)
    ]
      .filter((mediumId): mediumId is string => mediumId !== null)
      .map((mediumId) => [mediumId, crypto.randomUUID()])
  );
  const componentIds = new Map(
    project.topology.components.map((component) => [component.id, crypto.randomUUID()])
  );
  const portIds = new Map(
    project.topology.components.flatMap((component) =>
      component.ports.map((port) => [port.id, crypto.randomUUID()] as const)
    )
  );
  const connectionIds = new Map(
    project.topology.connections.map((connection) => [connection.id, crypto.randomUUID()])
  );
  const routeIds = new Map(project.topology.routes.map((route) => [route.id, crypto.randomUUID()]));
  const segmentIds = new Map(
    project.topology.segments.map((segment) => [segment.id, crypto.randomUUID()])
  );
  const definitionIds = new Map(
    project.partDefinitions.map((definition) => [definition.id, crypto.randomUUID()])
  );
  const requirementIds = new Map(
    project.partRequirements.map((requirement) => [requirement.id, crypto.randomUUID()])
  );
  const evidenceIds = new Map(
    project.evidence.map((evidence) => [evidence.id, crypto.randomUUID()])
  );
  const tombstoneIds = new Map(
    project.tombstones.flatMap((tombstone) => [
      [tombstone.subjectId, crypto.randomUUID()] as const,
      [tombstone.successorId, crypto.randomUUID()] as const
    ])
  );
  const subjectId = (id: string): string =>
    (id === project.project.id ? projectId : undefined) ??
    systemIds.get(id) ??
    componentIds.get(id) ??
    portIds.get(id) ??
    connectionIds.get(id) ??
    routeIds.get(id) ??
    segmentIds.get(id) ??
    definitionIds.get(id) ??
    requirementIds.get(id) ??
    evidenceIds.get(id) ??
    tombstoneIds.get(id) ??
    id;

  return projectDocumentSchema.parse({
    ...project,
    project: {
      ...project.project,
      id: projectId,
      name: `${project.project.name} copy`,
      revision: 1,
      createdAt: new Date().toISOString()
    },
    topology: {
      systems: project.topology.systems.map((system) => ({
        ...system,
        id: systemIds.get(system.id),
        mediumId: system.mediumId === null ? null : mediumIds.get(system.mediumId)
      })),
      components: project.topology.components.map((component) => ({
        ...component,
        id: componentIds.get(component.id),
        definitionId: component.definitionId === null ? null : subjectId(component.definitionId),
        predecessorId: component.predecessorId === null ? null : subjectId(component.predecessorId),
        successorId: component.successorId === null ? null : subjectId(component.successorId),
        ports: component.ports.map((port) => ({
          ...port,
          id: portIds.get(port.id),
          componentId: componentIds.get(component.id),
          mediumId: port.mediumId === null ? null : mediumIds.get(port.mediumId)
        }))
      })),
      connections: project.topology.connections.map((connection) => {
        const sourcePortId = portIds.get(connection.sourcePortId);
        const targetPortId = portIds.get(connection.targetPortId);
        if (!sourcePortId || !targetPortId) {
          throw new Error('Imported connection references a Port outside the project payload');
        }

        return {
          ...connection,
          id: connectionIds.get(connection.id),
          systemId: systemIds.get(connection.systemId),
          sourcePortId,
          targetPortId,
          mediumId: connection.mediumId === null ? null : mediumIds.get(connection.mediumId),
          routeId: connection.routeId === null ? null : routeIds.get(connection.routeId)
        };
      }),
      routes: project.topology.routes.map((route) => ({
        ...route,
        id: routeIds.get(route.id),
        segmentIds: route.segmentIds.map((segmentId) => segmentIds.get(segmentId))
      })),
      segments: project.topology.segments.map((segment) => ({
        ...segment,
        id: segmentIds.get(segment.id)
      }))
    },
    partDefinitions: project.partDefinitions.map((definition) => ({
      ...definition,
      id: definitionIds.get(definition.id),
      provenance: `Imported as copy from ${project.project.id}; ${definition.provenance}`
    })),
    partRequirements: project.partRequirements.map((requirement) => ({
      ...requirement,
      id: requirementIds.get(requirement.id),
      subjectId: subjectId(requirement.subjectId)
    })),
    evidence: project.evidence.map((evidence) => ({
      ...evidence,
      id: evidenceIds.get(evidence.id),
      subjectId: subjectId(evidence.subjectId),
      provenance:
        evidence.provenance === null
          ? `Imported as copy from ${project.project.id}`
          : `Imported as copy from ${project.project.id}; ${evidence.provenance}`
    })),
    engineeringValues: project.engineeringValues.map((value) => ({
      ...value,
      id: crypto.randomUUID(),
      provenance: `Imported as copy from ${project.project.id}; ${value.provenance}`
    })),
    operatingStates: project.operatingStates.map((state) => ({
      ...state,
      id: crypto.randomUUID()
    })),
    results: project.results.map((result) => ({
      ...result,
      id: crypto.randomUUID(),
      sourceRevision: 1,
      status: 'stale'
    })),
    tombstones: project.tombstones.map((tombstone) => ({
      ...tombstone,
      subjectId: subjectId(tombstone.subjectId),
      successorId: subjectId(tombstone.successorId)
    }))
  });
}

export async function commitStagedExchange(
  staged: StagedExchange,
  decision: ExchangeCommitDecision = DEFAULT_EXCHANGE_COMMIT_DECISION,
  library: BrowserProjectLibrary
): Promise<ExchangeCommitOutcome> {
  if (decision === 'cancel') return Object.freeze({ committed: false, reason: 'canceled' });

  const snapshot =
    decision === 'import-copy'
      ? rekeyProjectCopy(staged.envelope.payload)
      : staged.envelope.payload;
  const current = await library.loadProject(snapshot.project.id);
  if (decision === 'replace' && current) {
    await library.createCheckpoint({
      projectId: snapshot.project.id,
      reason: 'before-import-replacement'
    });
  }

  const saved = await library.saveProject({
    projectId: snapshot.project.id,
    expectedRevision: current?.project.revision ?? null,
    snapshot,
    newAssets: staged.assets
  });
  if (!saved.saved) {
    return Object.freeze({
      committed: false,
      reason: saved.reason
    });
  }

  return Object.freeze({
    committed: true,
    decision,
    projectId: snapshot.project.id,
    revision: snapshot.project.revision
  });
}
