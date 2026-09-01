import { validateTopology } from '../topology/topology';
import { validateElectricalModel } from '../electrical/electrical';
import { validateFluidModel } from '../fluid/fluid';

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
  | 'invalid-background'
  | 'invalid-electrical-record'
  | 'invalid-electrical-reference'
  | 'invalid-fluid-record'
  | 'invalid-fluid-reference'
  | 'missing-asset'
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
  if (action.type === 'insert-electrical-branch') {
    const connection = snapshot.topology.connections.find(
      (candidate) => candidate.id === action.connectionId
    );
    const evidenceIds = snapshot.evidence
      .filter((evidence) => evidence.subjectId === action.connectionId)
      .map((evidence) => evidence.id);
    const constructionIds = [
      ...snapshot.electrical.circuits
        .filter((circuit) => circuit.connectionIds.includes(action.connectionId))
        .map((circuit) => circuit.id),
      ...snapshot.electrical.harnesses
        .filter((harness) => harness.wireConnectionIds.includes(action.connectionId))
        .map((harness) => harness.id),
      ...snapshot.electrical.bundles
        .filter((bundle) => bundle.wireConnectionIds.includes(action.connectionId))
        .map((bundle) => bundle.id)
    ];
    return {
      subjectIds: [
        action.connectionId,
        ...constructionIds,
        ...(connection?.routeId ? [connection.routeId] : []),
        ...evidenceIds
      ],
      replacementConnections: action.replacementConnections.map(({ id, label }) => ({
        id,
        label
      })),
      evidenceIds,
      ...(connection?.routeId && action.routeTransferConnectionId
        ? {
            routeTransfer: {
              routeId: connection.routeId,
              connectionId: action.routeTransferConnectionId
            }
          }
        : {})
    };
  }

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

    case 'add-fluid-system':
      if (
        projectIdentityExists(snapshot, action.system.id) ||
        projectIdentityExists(snapshot, action.medium.id) ||
        action.system.id === action.medium.id
      ) {
        return reject('duplicate-identity', 'Fluid System or Medium identity is already in use');
      }
      next = {
        ...snapshot,
        topology: {
          ...snapshot.topology,
          systems: [...snapshot.topology.systems, action.system]
        },
        fluid: {
          ...snapshot.fluid,
          media: [...snapshot.fluid.media, action.medium],
          systems: [
            ...snapshot.fluid.systems,
            {
              systemId: action.system.id,
              mediumId: action.medium.id,
              purpose: action.purpose
            }
          ]
        },
        results: staleResults
      };
      changedSubjects = [action.system.id, action.medium.id];
      undoLabel = `Add ${action.system.label}`;
      break;

    case 'add-component':
    case 'add-electrical-component':
    case 'add-fluid-component': {
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
        electrical:
          action.type === 'add-electrical-component'
            ? {
                ...snapshot.electrical,
                components: [
                  ...snapshot.electrical.components,
                  { componentId: action.component.id, role: action.role }
                ]
              }
            : snapshot.electrical,
        fluid:
          action.type === 'add-fluid-component'
            ? {
                ...snapshot.fluid,
                components: [
                  ...snapshot.fluid.components,
                  { componentId: action.component.id, role: action.role }
                ]
              }
            : snapshot.fluid,
        results: staleResults
      };
      changedSubjects = [action.component.id];
      undoLabel = `Add ${action.component.label}`;
      break;
    }

    case 'move-component': {
      const component = snapshot.topology.components.find(
        (candidate) => candidate.id === action.componentId
      );
      if (!component) {
        return reject('missing-subject', `Component ${action.componentId} does not exist`);
      }
      next = {
        ...snapshot,
        topology: {
          ...snapshot.topology,
          components: snapshot.topology.components.map((candidate) =>
            candidate.id === action.componentId
              ? { ...candidate, position: action.position }
              : candidate
          )
        },
        results: staleResults
      };
      changedSubjects = [action.componentId];
      undoLabel = `Move ${component.label}`;
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

    case 'configure-electrical-wire':
      next = {
        ...snapshot,
        electrical: {
          ...snapshot.electrical,
          wires: [
            ...snapshot.electrical.wires.filter(
              (wire) => wire.connectionId !== action.wire.connectionId
            ),
            action.wire
          ]
        },
        results: staleResults
      };
      changedSubjects = [action.wire.connectionId];
      undoLabel = `Configure ${action.wire.connectionId}`;
      break;

    case 'add-electrical-circuit':
      if (projectIdentityExists(snapshot, action.circuit.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.circuit.id} is already in use`
        );
      }
      next = {
        ...snapshot,
        electrical: {
          ...snapshot.electrical,
          circuits: [...snapshot.electrical.circuits, action.circuit]
        },
        results: staleResults
      };
      changedSubjects = [action.circuit.id];
      undoLabel = `Add ${action.circuit.label}`;
      break;

    case 'insert-electrical-branch': {
      const existing = snapshot.topology.connections.find(
        (connection) => connection.id === action.connectionId
      );
      if (!existing || existing.kind !== 'electrical-wire') {
        return reject('missing-subject', `Electrical Wire ${action.connectionId} does not exist`);
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
            message: 'Electrical branch insertion requires confirmation of every affected subject',
            impact
          }
        };
      }

      const newIdentities = [
        action.junction.id,
        ...action.junction.ports.map((port) => port.id),
        ...action.replacementConnections.map((connection) => connection.id)
      ];
      const junctionPortIds = new Set(action.junction.ports.map((port) => port.id));
      const replacementConnectionIds = action.replacementConnections.map(
        (connection) => connection.id
      );
      const replacementWireIds = action.replacementWires.map((wire) => wire.connectionId);
      if (
        action.junction.kind !== 'junction' ||
        action.junction.ports.length < 3 ||
        action.junction.ports.some(
          (port) => port.componentId !== action.junction.id || port.domain !== 'electrical'
        ) ||
        new Set(newIdentities).size !== newIdentities.length ||
        newIdentities.some((subjectId) => projectIdentityExists(snapshot, subjectId))
      ) {
        return reject(
          'invalid-electrical-record',
          'Electrical branch requires one new three-or-more-Port Junction and unique replacement identities'
        );
      }
      if (
        action.replacementConnections.length !== 3 ||
        action.replacementWires.length !== 3 ||
        new Set(replacementWireIds).size !== 3 ||
        replacementConnectionIds.some(
          (connectionId) => !replacementWireIds.includes(connectionId)
        ) ||
        action.replacementConnections.some(
          (connection) =>
            connection.kind !== 'electrical-wire' ||
            connection.domain !== 'electrical' ||
            connection.systemId !== existing.systemId ||
            connection.mediumId !== null ||
            connection.routeId !== null ||
            Number(junctionPortIds.has(connection.sourcePortId)) +
              Number(junctionPortIds.has(connection.targetPortId)) !==
              1
        )
      ) {
        return reject(
          'invalid-electrical-record',
          'Electrical branch requires three matching two-ended replacement Wires'
        );
      }
      const replacementPortIds = action.replacementConnections.flatMap((connection) => [
        connection.sourcePortId,
        connection.targetPortId
      ]);
      const usedJunctionPortIds = replacementPortIds.filter((portId) =>
        junctionPortIds.has(portId)
      );
      const externalPortIds = replacementPortIds.filter((portId) => !junctionPortIds.has(portId));
      const branchPortId = externalPortIds.find(
        (portId) => portId !== existing.sourcePortId && portId !== existing.targetPortId
      );
      const branchComponent = snapshot.topology.components.find((component) =>
        component.ports.some((port) => port.id === branchPortId)
      );
      if (
        new Set(usedJunctionPortIds).size !== 3 ||
        new Set(externalPortIds).size !== 3 ||
        !externalPortIds.includes(existing.sourcePortId) ||
        !externalPortIds.includes(existing.targetPortId) ||
        !branchPortId ||
        !branchComponent ||
        (existing.routeId === null && action.routeTransferConnectionId !== null) ||
        (existing.routeId !== null &&
          !replacementConnectionIds.includes(action.routeTransferConnectionId ?? ''))
      ) {
        return reject(
          'invalid-electrical-reference',
          'Electrical branch replacements must preserve both endpoints, add one branch endpoint, and name the Route successor'
        );
      }
      if (
        snapshot.electrical.bundles.some((bundle) =>
          [
            ...bundle.twistedPairs.flatMap((pair) => [
              ...pair.wireConnectionIds,
              ...(pair.drainWireConnectionId ? [pair.drainWireConnectionId] : [])
            ]),
            ...(bundle.concentric?.layers.flatMap((layer) => layer.wireConnectionIds) ?? [])
          ].includes(existing.id)
        )
      ) {
        return reject(
          'invalid-electrical-record',
          `Wire ${existing.id} has pair or concentric construction that must be revised before branching`
        );
      }

      const replacementConnections = action.replacementConnections.map((connection) => ({
        ...connection,
        routeId: connection.id === action.routeTransferConnectionId ? existing.routeId : null
      }));
      const replaceWireId = (wireConnectionIds: readonly SubjectId[]): SubjectId[] =>
        wireConnectionIds.flatMap((connectionId) =>
          connectionId === existing.id ? replacementConnectionIds : [connectionId]
        );
      const replacementForPort = (portId: SubjectId): SubjectId | null =>
        replacementConnections.find(
          (connection) => connection.sourcePortId === portId || connection.targetPortId === portId
        )?.id ?? null;
      next = {
        ...snapshot,
        topology: {
          ...snapshot.topology,
          components: [...snapshot.topology.components, action.junction],
          connections: [
            ...snapshot.topology.connections.filter((connection) => connection.id !== existing.id),
            ...replacementConnections
          ]
        },
        electrical: {
          ...snapshot.electrical,
          components: [
            ...snapshot.electrical.components,
            { componentId: action.junction.id, role: action.role }
          ],
          wires: [
            ...snapshot.electrical.wires.filter((wire) => wire.connectionId !== existing.id),
            ...action.replacementWires
          ],
          circuits: snapshot.electrical.circuits.map((circuit) =>
            circuit.connectionIds.includes(existing.id)
              ? {
                  ...circuit,
                  connectionIds: replaceWireId(circuit.connectionIds),
                  componentIds: [
                    ...circuit.componentIds,
                    ...[action.junction.id, branchComponent.id].filter(
                      (componentId) => !circuit.componentIds.includes(componentId)
                    )
                  ]
                }
              : circuit
          ),
          connectors: snapshot.electrical.connectors.map((connector) => ({
            ...connector,
            cavities: connector.cavities.map((cavity) =>
              cavity.wireConnectionId === existing.id
                ? { ...cavity, wireConnectionId: replacementForPort(cavity.portId) }
                : cavity
            )
          })),
          harnesses: snapshot.electrical.harnesses.map((harness) => ({
            ...harness,
            wireConnectionIds: replaceWireId(harness.wireConnectionIds)
          })),
          bundles: snapshot.electrical.bundles.map((bundle) => ({
            ...bundle,
            wireConnectionIds: replaceWireId(bundle.wireConnectionIds)
          }))
        },
        results: staleResults,
        tombstones: [
          ...snapshot.tombstones,
          {
            subjectId: existing.id,
            subjectKind: 'connection',
            successorId: action.routeTransferConnectionId ?? replacementConnections[0]!.id
          }
        ]
      };
      changedSubjects = [
        existing.id,
        action.junction.id,
        ...replacementConnectionIds,
        ...impact.subjectIds.filter((subjectId) => subjectId !== existing.id)
      ];
      undoLabel = `Branch ${existing.label}`;
      break;
    }

    case 'configure-electrical-connector':
      next = {
        ...snapshot,
        electrical: {
          ...snapshot.electrical,
          connectors: [
            ...snapshot.electrical.connectors.filter(
              (connector) => connector.componentId !== action.connector.componentId
            ),
            action.connector
          ]
        },
        results: staleResults
      };
      changedSubjects = [
        action.connector.componentId,
        ...action.connector.cavities.map((cavity) => cavity.portId)
      ];
      undoLabel = `Configure ${action.connector.componentId}`;
      break;

    case 'configure-electrical-harness': {
      const existing = snapshot.electrical.harnesses.find(
        (harness) => harness.id === action.harness.id
      );
      if (!existing && projectIdentityExists(snapshot, action.harness.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.harness.id} is already in use`
        );
      }
      next = {
        ...snapshot,
        electrical: {
          ...snapshot.electrical,
          harnesses: [
            ...snapshot.electrical.harnesses.filter((harness) => harness.id !== action.harness.id),
            action.harness
          ]
        },
        results: staleResults
      };
      changedSubjects = [action.harness.id, ...action.harness.wireConnectionIds];
      undoLabel = `${existing ? 'Update' : 'Add'} ${action.harness.label}`;
      break;
    }

    case 'configure-electrical-bundle': {
      const existing = snapshot.electrical.bundles.find((bundle) => bundle.id === action.bundle.id);
      const replaceableIds = new Set([
        action.bundle.id,
        ...(existing?.twistedPairs.map((pair) => pair.id) ?? [])
      ]);
      const incomingIds = [action.bundle.id, ...action.bundle.twistedPairs.map((pair) => pair.id)];
      if (
        new Set(incomingIds).size !== incomingIds.length ||
        incomingIds.some(
          (subjectId) =>
            projectIdentityExists(snapshot, subjectId) && !replaceableIds.has(subjectId)
        )
      ) {
        return reject('duplicate-identity', 'Bundle or twisted-pair identity is already in use');
      }
      next = {
        ...snapshot,
        electrical: {
          ...snapshot.electrical,
          bundles: [
            ...snapshot.electrical.bundles.filter((bundle) => bundle.id !== action.bundle.id),
            action.bundle
          ]
        },
        results: staleResults
      };
      changedSubjects = incomingIds;
      undoLabel = `${existing ? 'Update' : 'Add'} ${action.bundle.label}`;
      break;
    }

    case 'record-electrical-cable-specification':
      next = {
        ...snapshot,
        electrical: {
          ...snapshot.electrical,
          cableSpecifications: [
            ...snapshot.electrical.cableSpecifications.filter(
              (specification) =>
                specification.partDefinitionId !== action.specification.partDefinitionId
            ),
            action.specification
          ]
        },
        results: staleResults
      };
      changedSubjects = [action.specification.partDefinitionId];
      undoLabel = `Record cable evidence for ${action.specification.partDefinitionId}`;
      break;

    case 'configure-fluid-line':
      next = {
        ...snapshot,
        fluid: {
          ...snapshot.fluid,
          lines: [
            ...snapshot.fluid.lines.filter(
              (line) => line.connectionId !== action.line.connectionId
            ),
            action.line
          ]
        },
        results: staleResults
      };
      changedSubjects = [action.line.connectionId];
      undoLabel = `Configure ${action.line.connectionId}`;
      break;

    case 'configure-fluid-behavior': {
      const existing = snapshot.fluid.behaviors.find(
        (behavior) => behavior.id === action.behavior.id
      );
      if (!existing && projectIdentityExists(snapshot, action.behavior.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.behavior.id} is already in use`
        );
      }
      next = {
        ...snapshot,
        fluid: {
          ...snapshot.fluid,
          behaviors: [
            ...snapshot.fluid.behaviors.filter((behavior) => behavior.id !== action.behavior.id),
            action.behavior
          ]
        },
        results: staleResults
      };
      changedSubjects = [action.behavior.id, action.behavior.componentId];
      undoLabel = `${existing ? 'Update' : 'Add'} ${action.behavior.role} behavior`;
      break;
    }

    case 'record-fluid-boundary-condition':
      if (projectIdentityExists(snapshot, action.boundary.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.boundary.id} is already in use`
        );
      }
      next = {
        ...snapshot,
        fluid: {
          ...snapshot.fluid,
          boundaryConditions: [...snapshot.fluid.boundaryConditions, action.boundary]
        },
        results: staleResults
      };
      changedSubjects = [action.boundary.id, action.boundary.subjectId];
      undoLabel = `Record ${action.boundary.quantity} boundary`;
      break;

    case 'add-operating-state':
      if (projectIdentityExists(snapshot, action.state.id)) {
        return reject(
          'duplicate-identity',
          `Subject identity ${action.state.id} is already in use`
        );
      }
      next = {
        ...snapshot,
        operatingStates: [...snapshot.operatingStates, action.state],
        results: staleResults
      };
      changedSubjects = [action.state.id];
      undoLabel = `Add ${action.state.name}`;
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

    case 'set-vehicle-background': {
      const background = action.background;
      if (background) {
        const opacity = Number(background.opacity);
        const sameCalibrationPoint =
          background.calibration.first.x === background.calibration.second.x &&
          background.calibration.first.y === background.calibration.second.y;
        if (
          !/^[a-f0-9]{64}$/.test(background.assetHash) ||
          !Number.isFinite(opacity) ||
          opacity < 0 ||
          opacity > 1 ||
          sameCalibrationPoint ||
          !(Number(background.calibration.distance.decimal) > 0)
        ) {
          return reject(
            'invalid-background',
            'Vehicle background requires a hash, two calibration points, positive distance, and opacity from zero through one'
          );
        }
      }
      next = {
        ...snapshot,
        vehicleBackground: background,
        assetHashes:
          background && !snapshot.assetHashes.includes(background.assetHash)
            ? [...snapshot.assetHashes, background.assetHash]
            : snapshot.assetHashes,
        results: staleResults
      };
      changedSubjects = [snapshot.id];
      undoLabel = background ? 'Set vehicle background' : 'Remove vehicle background';
      break;
    }

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
  const electricalRejection = validateElectricalModel(
    next.topology,
    next.partDefinitions,
    next.electrical
  );
  if (electricalRejection) return { accepted: false, rejection: electricalRejection };
  const fluidRejection = validateFluidModel(
    next.topology,
    next.partDefinitions,
    next.operatingStates,
    next.fluid
  );
  if (fluidRejection) return { accepted: false, rejection: fluidRejection };

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
    snapshot.electrical.circuits.some((subject) => subject.id === subjectId) ||
    snapshot.electrical.harnesses.some((subject) => subject.id === subjectId) ||
    snapshot.electrical.bundles.some(
      (subject) =>
        subject.id === subjectId || subject.twistedPairs.some((pair) => pair.id === subjectId)
    ) ||
    snapshot.fluid.media.some((subject) => subject.id === subjectId) ||
    snapshot.fluid.behaviors.some((subject) => subject.id === subjectId) ||
    snapshot.fluid.boundaryConditions.some((subject) => subject.id === subjectId) ||
    snapshot.partDefinitions.some((subject) => subject.id === subjectId) ||
    snapshot.partRequirements.some((subject) => subject.id === subjectId) ||
    snapshot.evidence.some((subject) => subject.id === subjectId) ||
    snapshot.engineeringValues.some((subject) => subject.id === subjectId) ||
    snapshot.operatingStates.some((subject) => subject.id === subjectId) ||
    snapshot.results.some((subject) => subject.id === subjectId) ||
    snapshot.tombstones.some(
      (subject) => subject.subjectId === subjectId || subject.successorId === subjectId
    )
  );
}

function reject(code: ActionRejectionCode, message: string): ActionOutcome {
  return { accepted: false, rejection: { code, message } };
}
