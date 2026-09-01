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
  const componentIds = new Map(
    project.topology.components.map((component) => [component.id, crypto.randomUUID()])
  );
  const portIds = new Map(
    project.topology.components.flatMap((component) =>
      component.ports.map((port) => [port.id, crypto.randomUUID()] as const)
    )
  );

  return projectDocumentSchema.parse({
    ...project,
    project: {
      ...project.project,
      id: projectId,
      name: `${project.project.name} copy`,
      revision: 1,
      updatedAt: new Date().toISOString()
    },
    topology: {
      components: project.topology.components.map((component) => ({
        ...component,
        id: componentIds.get(component.id),
        ports: component.ports.map((port) => ({ ...port, id: portIds.get(port.id) }))
      })),
      connections: project.topology.connections.map((connection) => {
        const sourcePortId = portIds.get(connection.sourcePortId);
        const targetPortId = portIds.get(connection.targetPortId);
        if (!sourcePortId || !targetPortId) {
          throw new Error('Imported connection references a Port outside the project payload');
        }

        return {
          ...connection,
          id: crypto.randomUUID(),
          sourcePortId,
          targetPortId
        };
      })
    },
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
