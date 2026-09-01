import type { EngineeringEvidence } from '../evidence/evidence';
import type { PartDefinition, PartRequirement, ProjectResult, VehicleBackground } from './project';
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
  | (Causation & Readonly<{ type: 'add-component'; component: Component }>)
  | (Causation &
      Readonly<{
        type: 'move-component';
        componentId: SubjectId;
        position: Readonly<{ x: string; y: string }>;
      }>)
  | (Causation & Readonly<{ type: 'add-connection'; connection: Connection }>)
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

export type DestructiveProjectAction = Extract<ProjectAction, { type: 'replace-component' }>;

export type ImpactPreview = Readonly<{
  subjectIds: readonly SubjectId[];
}>;
