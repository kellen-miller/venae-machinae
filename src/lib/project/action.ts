import type { EngineeringEvidence } from '../evidence/evidence';
import type {
  ElectricalBundle,
  ElectricalCableSpecification,
  ElectricalCircuit,
  ElectricalComponentRole,
  ElectricalConnector,
  ElectricalHarness,
  ElectricalWire
} from '../electrical/electrical';
import type {
  FluidBoundaryCondition,
  FluidComponentBehavior,
  FluidComponentRole,
  FluidLine,
  FluidMedium
} from '../fluid/fluid';
import type {
  OperatingState,
  PartDefinition,
  PartRequirement,
  ProjectResult,
  VehicleBackground
} from './project';
import type {
  Component,
  Connection,
  Route,
  RouteSegment,
  SubjectId,
  System
} from '../topology/topology';

type Causation = Readonly<{ causationId: string }>;

export type ProjectAction =
  | (Causation & Readonly<{ type: 'rename-project'; name: string }>)
  | (Causation & Readonly<{ type: 'add-system'; system: System }>)
  | (Causation &
      Readonly<{
        type: 'add-fluid-system';
        system: System;
        medium: FluidMedium;
        purpose: string;
      }>)
  | (Causation & Readonly<{ type: 'add-component'; component: Component }>)
  | (Causation &
      Readonly<{
        type: 'add-electrical-component';
        component: Component;
        role: ElectricalComponentRole;
      }>)
  | (Causation &
      Readonly<{
        type: 'add-fluid-component';
        component: Component;
        role: FluidComponentRole;
      }>)
  | (Causation &
      Readonly<{
        type: 'move-component';
        componentId: SubjectId;
        position: Readonly<{ x: string; y: string }>;
      }>)
  | (Causation & Readonly<{ type: 'add-connection'; connection: Connection }>)
  | (Causation & Readonly<{ type: 'configure-electrical-wire'; wire: ElectricalWire }>)
  | (Causation & Readonly<{ type: 'add-electrical-circuit'; circuit: ElectricalCircuit }>)
  | (Causation &
      Readonly<{
        type: 'insert-electrical-branch';
        connectionId: SubjectId;
        junction: Component;
        role: 'splice' | 'bus';
        replacementConnections: readonly Connection[];
        replacementWires: readonly ElectricalWire[];
        routeTransferConnectionId: SubjectId | null;
        confirmedImpactSubjectIds: readonly SubjectId[];
      }>)
  | (Causation &
      Readonly<{ type: 'configure-electrical-connector'; connector: ElectricalConnector }>)
  | (Causation & Readonly<{ type: 'configure-electrical-harness'; harness: ElectricalHarness }>)
  | (Causation & Readonly<{ type: 'configure-electrical-bundle'; bundle: ElectricalBundle }>)
  | (Causation &
      Readonly<{
        type: 'record-electrical-cable-specification';
        specification: ElectricalCableSpecification;
      }>)
  | (Causation & Readonly<{ type: 'configure-fluid-line'; line: FluidLine }>)
  | (Causation & Readonly<{ type: 'configure-fluid-behavior'; behavior: FluidComponentBehavior }>)
  | (Causation &
      Readonly<{
        type: 'record-fluid-boundary-condition';
        boundary: FluidBoundaryCondition;
      }>)
  | (Causation & Readonly<{ type: 'add-operating-state'; state: OperatingState }>)
  | (Causation &
      Readonly<{
        type: 'set-connection-route';
        connectionId: SubjectId;
        route: Route;
        newSegments: readonly RouteSegment[];
      }>)
  | (Causation & Readonly<{ type: 'add-part-definition'; definition: PartDefinition }>)
  | (Causation & Readonly<{ type: 'add-part-requirement'; requirement: PartRequirement }>)
  | (Causation & Readonly<{ type: 'record-evidence'; evidence: EngineeringEvidence }>)
  | (Causation & Readonly<{ type: 'set-vehicle-background'; background: VehicleBackground | null }>)
  | (Causation &
      Readonly<{
        type: 'replace-component';
        componentId: SubjectId;
        replacement: Component;
        portSuccessors: readonly Readonly<{
          predecessorPortId: SubjectId;
          successorPortId: SubjectId;
        }>[];
        confirmedImpactSubjectIds: readonly SubjectId[];
      }>);

export type ProjectSystemAction = Causation &
  Readonly<{
    type: 'publish-evaluation';
    sourceRevision: number;
    results: readonly ProjectResult[];
  }>;

export type DestructiveProjectAction = Extract<
  ProjectAction,
  { type: 'replace-component' | 'insert-electrical-branch' }
>;

export type ImpactPreview = Readonly<{
  subjectIds: readonly SubjectId[];
  replacementConnections?: readonly Readonly<{ id: SubjectId; label: string }>[];
  evidenceIds?: readonly SubjectId[];
  routeTransfer?: Readonly<{ routeId: SubjectId; connectionId: SubjectId }>;
}>;
