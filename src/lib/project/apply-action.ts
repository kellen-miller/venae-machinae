import { validateTopology } from '../topology/topology';

import type {
  DestructiveProjectAction,
  ImpactPreview,
  ProjectAction,
  ProjectSystemAction
} from './action';
import type { ProjectSnapshot, ResultId } from './project';
import type { SubjectId, TopologyRejectionCode } from '../topology/topology';

export type ActionRejectionCode =
  | TopologyRejectionCode
  | 'confirmation-required'
  | 'invalid-confirmation'
  | 'invalid-result'
  | 'stale-system-action';

export type ActionRejection = Readonly<{
  code: ActionRejectionCode;
  message: string;
  impact?: ImpactPreview;
}>;

export type ActionOutcome =
  | Readonly<{
      accepted: true;
      snapshot: ProjectSnapshot;
      changedSubjects: readonly SubjectId[];
      invalidatedResults: readonly ResultId[];
      undoLabel: string | null;
    }>
  | Readonly<{ accepted: false; rejection: ActionRejection }>;

export function previewProjectActionImpact(
  snapshot: ProjectSnapshot,
  action: DestructiveProjectAction
): ImpactPreview {
  const component = snapshot.topology.components.find(
    (candidate) => candidate.id === action.componentId
  );
  if (!component) return { subjectIds: [action.componentId] };

  const portIds = new Set(component.ports.map((port) => port.id));
  return {
    subjectIds: [
      action.componentId,
      ...snapshot.topology.connections
        .filter(
          (connection) =>
            portIds.has(connection.sourcePortId) || portIds.has(connection.targetPortId)
        )
        .map((connection) => connection.id),
      ...snapshot.partRequirements
        .filter((requirement) => requirement.subjectId === action.componentId)
        .map((requirement) => requirement.id),
      ...snapshot.evidence
        .filter((evidence) => evidence.subjectId === action.componentId)
        .map((evidence) => evidence.id)
    ]
  };
}

export function applyProjectAction(
  snapshot: ProjectSnapshot,
  action: ProjectAction | ProjectSystemAction
): ActionOutcome {
  if (action.type === 'publish-evaluation') {
    if (action.sourceRevision !== snapshot.revision) {
      return reject(
        'stale-system-action',
        `Evaluation revision ${action.sourceRevision} does not match Project revision ${snapshot.revision}`
      );
    }
    if (action.results.some((result) => result.sourceRevision !== action.sourceRevision)) {
      return reject('invalid-result', 'Every published Result must name the evaluated revision');
    }

    return {
      accepted: true,
      snapshot: { ...snapshot, revision: snapshot.revision + 1, results: [...action.results] },
      changedSubjects: action.results.map((result) => result.id),
      invalidatedResults: snapshot.results
        .filter((result) => result.status === 'current')
        .map((result) => result.id),
      undoLabel: null
    };
  }

  const invalidatedResults = snapshot.results
    .filter((result) => result.status === 'current')
    .map((result) => result.id);
  const staleResults = snapshot.results.map((result) =>
    result.status === 'current' ? { ...result, status: 'stale' as const } : result
  );
  let next: ProjectSnapshot;
  let changedSubjects: readonly SubjectId[];
  let undoLabel: string;

  switch (action.type) {
    case 'rename-project':
      next = { ...snapshot, name: action.name, results: staleResults };
      changedSubjects = [snapshot.id];
      undoLabel = `Rename project to ${action.name}`;
      break;

    case 'add-system':
      if (projectIdentityExists(snapshot, action.system.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.system.id} is already in use`
        );
      }
      next = {
        ...snapshot,
        topology: { ...snapshot.topology, systems: [...snapshot.topology.systems, action.system] },
        results: staleResults
      };
      changedSubjects = [action.system.id];
      undoLabel = `Add ${action.system.label}`;
      break;

    case 'add-component': {
      const componentIdentities = [
        action.component.id,
        ...action.component.ports.map((port) => port.id)
      ];
      if (
        new Set(componentIdentities).size !== componentIdentities.length ||
        componentIdentities.some((subjectId) => projectIdentityExists(snapshot, subjectId))
      ) {
        return reject('duplicate-identity', 'Component or Port identity is already in use');
      }
      if (
        action.component.definitionId !== null &&
        !snapshot.partDefinitions.some(
          (definition) => definition.id === action.component.definitionId
        )
      ) {
        return reject(
          'missing-subject',
          `Component ${action.component.id} references an absent Part Definition`
        );
      }
      next = {
        ...snapshot,
        topology: {
          ...snapshot.topology,
          components: [...snapshot.topology.components, action.component]
        },
        results: staleResults
      };
      changedSubjects = [action.component.id];
      undoLabel = `Add ${action.component.label}`;
      break;
    }

    case 'add-connection':
      if (projectIdentityExists(snapshot, action.connection.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.connection.id} is already in use`
        );
      }
      next = {
        ...snapshot,
        topology: {
          ...snapshot.topology,
          connections: [...snapshot.topology.connections, action.connection]
        },
        results: staleResults
      };
      changedSubjects = [action.connection.id];
      undoLabel = `Add ${action.connection.label}`;
      break;

    case 'set-connection-route': {
      if (
        !snapshot.topology.connections.some((connection) => connection.id === action.connectionId)
      ) {
        return reject('missing-subject', `Connection ${action.connectionId} does not exist`);
      }

      const routes = snapshot.topology.routes.filter((route) => route.id !== action.route.id);
      const segments = snapshot.topology.segments.filter(
        (segment) => !action.newSegments.some((candidate) => candidate.id === segment.id)
      );
      next = {
        ...snapshot,
        topology: {
          ...snapshot.topology,
          connections: snapshot.topology.connections.map((connection) =>
            connection.id === action.connectionId
              ? { ...connection, routeId: action.route.id }
              : connection
          ),
          routes: [...routes, action.route],
          segments: [...segments, ...action.newSegments]
        },
        results: staleResults
      };
      changedSubjects = [
        action.connectionId,
        action.route.id,
        ...action.newSegments.map((s) => s.id)
      ];
      undoLabel = 'Change connection route';
      break;
    }

    case 'add-part-definition':
      if (projectIdentityExists(snapshot, action.definition.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.definition.id} is already in use`
        );
      }
      next = {
        ...snapshot,
        partDefinitions: [...snapshot.partDefinitions, action.definition],
        results: staleResults
      };
      changedSubjects = [action.definition.id];
      undoLabel = `Add ${action.definition.label}`;
      break;

    case 'add-part-requirement':
      if (!projectIdentityExists(snapshot, action.requirement.subjectId)) {
        return reject(
          'missing-subject',
          `Part Requirement ${action.requirement.id} references an absent subject`
        );
      }
      if (projectIdentityExists(snapshot, action.requirement.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.requirement.id} is already in use`
        );
      }
      next = {
        ...snapshot,
        partRequirements: [...snapshot.partRequirements, action.requirement],
        results: staleResults
      };
      changedSubjects = [action.requirement.id];
      undoLabel = `Add ${action.requirement.label}`;
      break;

    case 'record-evidence':
      if (!projectIdentityExists(snapshot, action.evidence.subjectId)) {
        return reject(
          'missing-subject',
          `Evidence ${action.evidence.id} references an absent subject`
        );
      }
      if (projectIdentityExists(snapshot, action.evidence.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.evidence.id} is already in use`
        );
      }
      next = {
        ...snapshot,
        evidence: [...snapshot.evidence, action.evidence],
        results: staleResults
      };
      changedSubjects = [action.evidence.id];
      undoLabel = `Record ${action.evidence.label}`;
      break;

    case 'replace-component': {
      const existing = snapshot.topology.components.find(
        (component) => component.id === action.componentId
      );
      if (!existing)
        return reject('missing-subject', `Component ${action.componentId} does not exist`);
      if (projectIdentityExists(snapshot, action.replacement.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.replacement.id} is already in use`
        );
      }

      const impact = previewProjectActionImpact(snapshot, action);
      const confirmed = new Set(action.confirmedImpactSubjectIds);
      if (
        confirmed.size !== impact.subjectIds.length ||
        impact.subjectIds.some((subjectId) => !confirmed.has(subjectId))
      ) {
        return {
          accepted: false,
          rejection: {
            code: 'confirmation-required',
            message: 'Component replacement requires confirmation of every affected subject',
            impact
          }
        };
      }

      const successors = new Map(
        action.portSuccessors.map((successor) => [
          successor.predecessorPortId,
          successor.successorPortId
        ])
      );
      const connectedPortIds = new Set<SubjectId>();
      for (const connection of snapshot.topology.connections) {
        if (existing.ports.some((port) => port.id === connection.sourcePortId)) {
          connectedPortIds.add(connection.sourcePortId);
        }
        if (existing.ports.some((port) => port.id === connection.targetPortId)) {
          connectedPortIds.add(connection.targetPortId);
        }
      }
      if ([...connectedPortIds].some((portId) => !successors.has(portId))) {
        return reject('invalid-reference', 'Every connected predecessor Port needs a successor');
      }
      if (
        [...successors.entries()].some(
          ([oldPortId, newPortId]) =>
            !existing.ports.some((port) => port.id === oldPortId) ||
            !action.replacement.ports.some((port) => port.id === newPortId)
        )
      ) {
        return reject('invalid-reference', 'Port successor mapping references an absent Port');
      }

      const replacement = { ...action.replacement, predecessorId: existing.id };
      const connections = snapshot.topology.connections.map((connection) => {
        const sourcePortId = successors.get(connection.sourcePortId) ?? connection.sourcePortId;
        const targetPortId = successors.get(connection.targetPortId) ?? connection.targetPortId;
        return sourcePortId === connection.sourcePortId && targetPortId === connection.targetPortId
          ? connection
          : { ...connection, sourcePortId, targetPortId };
      });
      next = {
        ...snapshot,
        topology: {
          ...snapshot.topology,
          components: [
            ...snapshot.topology.components.filter((component) => component.id !== existing.id),
            replacement
          ],
          connections
        },
        results: staleResults,
        tombstones: [
          ...snapshot.tombstones,
          { subjectId: existing.id, subjectKind: 'component', successorId: replacement.id }
        ]
      };
      changedSubjects = [
        existing.id,
        replacement.id,
        ...connections
          .filter((connection, index) => connection !== snapshot.topology.connections[index])
          .map((connection) => connection.id)
      ];
      undoLabel = `Replace ${existing.label}`;
      break;
    }
  }

  const topologyRejection = validateTopology(next.topology);
  if (topologyRejection) return { accepted: false, rejection: topologyRejection };

  return {
    accepted: true,
    snapshot: { ...next, revision: snapshot.revision + 1 },
    changedSubjects,
    invalidatedResults,
    undoLabel
  };
}

function projectIdentityExists(snapshot: ProjectSnapshot, subjectId: SubjectId): boolean {
  return (
    snapshot.id === subjectId ||
    snapshot.topology.systems.some((subject) => subject.id === subjectId) ||
    snapshot.topology.components.some(
      (subject) => subject.id === subjectId || subject.ports.some((port) => port.id === subjectId)
    ) ||
    snapshot.topology.connections.some((subject) => subject.id === subjectId) ||
    snapshot.topology.routes.some((subject) => subject.id === subjectId) ||
    snapshot.topology.segments.some((subject) => subject.id === subjectId) ||
    snapshot.partDefinitions.some((subject) => subject.id === subjectId) ||
    snapshot.partRequirements.some((subject) => subject.id === subjectId) ||
    snapshot.evidence.some((subject) => subject.id === subjectId) ||
    snapshot.results.some((subject) => subject.id === subjectId) ||
    snapshot.tombstones.some(
      (subject) => subject.subjectId === subjectId || subject.successorId === subjectId
    )
  );
}

function reject(code: ActionRejectionCode, message: string): ActionOutcome {
  return { accepted: false, rejection: { code, message } };
}
