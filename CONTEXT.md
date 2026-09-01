# Venae Machinae

Venae Machinae describes the physical systems of one project vehicle while
preserving the distinct rules of electrical and fluid design.

## Project

**Vehicle Project**:
The design context for one concrete vehicle build across its planned and
as-built evolution.
_Avoid_: Vehicle family, fleet, product variant

**Project Library**:
The browser-profile-local collection of independent Vehicle Projects and
reusable Part Definition Templates.
_Avoid_: Account, cloud workspace, fleet

**Library Backup**:
A self-contained, versioned capture of active Vehicle Projects, Named
Snapshots, Part Definition Templates, Project Assets, and library settings.
_Avoid_: Project Snapshot, cloud sync, Recovery Checkpoint

**Project Snapshot**:
An immutable, self-contained capture of one Vehicle Project at a specific
point in its evolution, retained locally or exchanged with another browser.
_Avoid_: Live project, linked file, report

**Project Copy**:
An independent Vehicle Project derived from another while retaining origin
provenance and assigning new identities to all project-owned subjects.
_Avoid_: Project Snapshot, shared project, live branch

**Recovery Checkpoint**:
An automatically retained Project Snapshot used to restore recent work after
failed persistence, corruption, or migration.
_Avoid_: Named snapshot, authoritative project

**Named Snapshot**:
A user-created Project Snapshot whose contents remain immutable until the user
explicitly deletes it; its name and note may change.
_Avoid_: Recovery Checkpoint, live project, save command

**Quarantined Project**:
A retained Vehicle Project whose stored representation failed validation or
migration and is unavailable for normal editing while recovery remains possible.
_Avoid_: Deleted project, repaired project

**Import Record**:
The provenance of an accepted project, template, or library import, including
its content identity, source format, migration path, and collision decision.
_Avoid_: Filesystem path, imported payload, audit log

**Project Asset**:
An original binary file owned by a Vehicle Project as design context or
evidence, retained with its media metadata and integrity identity.
_Avoid_: External link, generated preview, render cache

**System**:
A flat, domain-homogeneous functional grouping of topology within a Vehicle
Project. A Component may participate in more than one System.
_Avoid_: Document, drawing, subsystem tree

**Electrical System**:
A System whose topology carries low-voltage power, return, signal, or data.
_Avoid_: Wiring document

**Fluid System**:
A System whose topology carries an identified fluid medium for a stated
purpose, such as fuel, oil, or coolant.
_Avoid_: Plumbing document

**Fluid Medium**:
The identified fluid and composition carried by a Fluid System, together with
the provenance needed to interpret its properties.
_Avoid_: Fluid type

## Physical model

**Part Definition**:
A reusable specification and evidence record for a manufactured, fabricated,
or project-local item.
_Avoid_: Component type, catalog part

**Part Definition Template**:
A reusable local source copied into a Vehicle Project as an independent Part
Definition with origin provenance but no continuing authority over the copy.
_Avoid_: Shared Part Definition, live catalog dependency

**Template Revision**:
An immutable version of a Part Definition Template that identifies the exact
origin of later project-local copies.
_Avoid_: Live template, project Part Definition, update channel

**Template Bundle**:
A self-contained, versioned exchange of selected Part Definition Templates and
their provenance, independent of any Vehicle Project.
_Avoid_: Project Snapshot, live library, catalog sync

**Component**:
One project-specific occurrence of a Part Definition, whether planned or
installed. It keeps that identity through installation but not replacement.
_Avoid_: Part, device

**Port**:
A domain-typed interface belonging to a Component through which electrical or
fluid continuity may be established.
_Avoid_: Generic endpoint

**Connection**:
One direct physical continuity relationship between exactly two Ports in the
same domain and exactly one System, either routed or mated. It keeps its
identity through planning and installation but not physical replacement.
_Avoid_: Circuit, net, whole harness

**Wire**:
A routed Electrical Connection containing one conductive path between two
Electrical Ports.
_Avoid_: Cable, Electrical Net

**Fluid Line**:
A routed Fluid Connection containing one wetted passage between two Fluid
Ports. Its construction kind is hose, tube, or pipe.
_Avoid_: Flow Path, Fluid System

**Mate**:
A non-routed Connection between electrical or fluid Ports intended to form a
complementary interface.
_Avoid_: Route, Wire, Fluid Line

**Electrical Port**:
One independently connectable terminal or pin. It records permitted electrical
roles, while actual direction belongs to an Operating State.
_Avoid_: Connector, device function

**Ground Point**:
A project-specific physical attachment to chassis, body, or engine return
structure, represented as a Component with Electrical Ports and interface
evidence. Its symbol implies neither global continuity nor zero resistance.
_Avoid_: Ground symbol, implicit ground, zero-ohm return

**Connector**:
A Component whose Electrical Ports are organized as mechanically keyed
cavities for bulk mating and termination. An integral device receptacle stays
part of its device Component rather than becoming a separate Connector.
_Avoid_: Electrical Port, terminal, Mate

**Fluid Port**:
One independently connectable fluid opening. It records permitted inlet,
outlet, or bidirectional use, while actual flow belongs to an Operating State.
_Avoid_: Hose, fluid function

**Electrical Net**:
The structurally continuous Electrical Ports and Connections within an
Electrical System, without implying current or direction.
_Avoid_: Electrical Circuit, active path

**Electrical Circuit**:
A named functional grouping of Electrical Nets, Components, and Connections
within an Electrical System.
_Avoid_: Electrical Net

**Flow Path**:
A directed traversal through Fluid Connections and Component Behaviors derived
for one Operating State.
_Avoid_: Fluid System, static Connection

**Assembly**:
An independently meaningful physical build or installation grouping of
Components, Connections, and Part Requirements.
_Avoid_: Component, arbitrary folder

**Harness**:
An Assembly of Wires, connector and Junction Components, coverings, and related
hardware. It may span Electrical Systems and is not itself a System or Circuit.
_Avoid_: Electrical System, Electrical Circuit

**Junction**:
A Component that creates an explicit branch among three or more Ports, such as
an electrical splice or bus, or a fluid tee or manifold.
_Avoid_: Multi-ended Connection

**Component Behavior**:
The state-dependent relationship a Component establishes among its own Ports,
including cross-domain effects. It never creates a cross-domain Connection.
_Avoid_: Hidden external Connection

**Behavior Role**:
A composable electrical or fluid capability used to describe Component
Behavior, such as source, load, switch, pump, valve, or heat exchanger. Part
Definitions provide reusable roles; Components configure them.
_Avoid_: Rigid Component subtype

**Interface Specification**:
The typed mechanical and domain details needed to assess whether two Ports can
connect, such as connector or fitting family, size, terminal, and seal.
_Avoid_: Free-form connector label

**Compatibility Assessment**:
The evidenced compatible, incompatible, conflicting, or unknown relationship
between two Interface Specifications. It does not erase intended topology.
_Avoid_: Connection validity

**Part Requirement**:
A quantity of a Part Definition required by a Component, Connection, or Route
without receiving independent topology identity.
_Avoid_: Component

## Routing

**Route**:
The project-owned ordered physical course for one routed Connection, expressed
as a traversal of Segments. A mated Connection has no Route.
_Avoid_: Connection, branched route

**Segment**:
One measurable physical interval between route points, carrying length and
environmental context. Routes from multiple Systems may share the same Segment.
_Avoid_: Connection, whole route

**Route Length**:
The length of a Route obtained from its traversed Segments.
_Avoid_: Cut Length

**Hydraulic Length**:
The evidenced wetted axial length of a Fluid Line used by an identified flow
or pressure-loss calculation. It remains distinct from Route Length and Cut
Length even when either provides applicable evidence.
_Avoid_: Route Length, Cut Length, nominal length

**Cut Length**:
The material length required for a routed Connection after its termination,
service, bend, twist, or lay allowances are applied.
_Avoid_: Route Length

**Bundle**:
A construction grouping of Wires that share Route Segments without changing
their electrical connectivity.
_Avoid_: Harness, Electrical Net

**Concentric Bundle**:
A Bundle whose Wires occupy ordered Layers around a core.
_Avoid_: Generic Bundle

**Layer**:
One ordered radial group of Wires within a Concentric Bundle.
_Avoid_: Diagram layer

**Lay Specification**:
The direction and pitch governing how a Concentric Bundle or Layer is formed
and how its Wires consume Cut Length.
_Avoid_: Route geometry

## Operating model

**Operating State**:
A named static scenario of explicit commands, conditions, measurements, and
assumptions used to evaluate Component Behaviors and calculations.
_Avoid_: State machine, timeline, simulation

**Boundary Condition**:
An Engineering Value or explicit assumption that constrains a Port or
Component Behavior for one Operating State, such as pressure, flow,
temperature, level, command, or operating point.
_Avoid_: Hidden solver input, simulated state

**State Binding**:
An explicit selection of an Engineering Value, command, condition, or
assumption for one subject in one Operating State. It may deliberately retain
unknown or conflicting applicability.
_Avoid_: Implicit precedence, global default, latest value

**Overlay**:
A derived, read-only visual projection of project topology, one Operating
State, Component Behaviors, and bounded calculations.
_Avoid_: Design data, editable simulation result

**Overlay Channel**:
An independently selectable derived perspective within an Overlay, such as
electrical potential, current, signal, fluid direction, or temperature.
_Avoid_: Diagram layer, editable state, authoritative data

## Engineering evidence

**Engineering Value**:
A semantic quantity retaining its original unit, applicability,
uncertainty or bounds, origin, and provenance, attached to its most specific
subject and context. Conflicting values coexist.
_Avoid_: Unqualified number, overwritten value

**Component Characteristic**:
A sourced curve, table, equation, or bounded relationship describing a
Component Behavior under stated conditions. It is reusable evidence, not an
actual operating point.
_Avoid_: Operating State, Boundary Condition, Calculation Result

**Assumption**:
An explicitly authored Engineering Value or State Binding used for a stated
subject, scope, and applicability without treating it as direct evidence.
_Avoid_: Default, inferred fact, hidden input

**Calculation Result**:
An Engineering Value produced by an identified formula from referenced inputs
within an explicit applicability envelope.
_Avoid_: Source value, hidden formula

**Margin**:
A Calculation Result expressing the directed distance between an explicit
value or bounded result and one sourced or user-entered limit.
_Avoid_: Safety factor, pass verdict, confidence

**Caution Band**:
An explicit sourced or user-entered interval adjacent to a limit within which
a Margin warrants review without implying failure or danger.
_Avoid_: Hidden buffer, universal safety margin, default tolerance

**Screening Result**:
An assessment comparing an explicit candidate against sourced limits without
claiming final suitability.
_Avoid_: Selection, certification

**Screen Outcome**:
The pass, fail, indeterminate, unevaluated, or not-applicable result of one
explicit comparison within a Screening Result.
_Avoid_: Candidate suitability, safety verdict, aggregate status

**Result Completeness**:
The complete-for-stated-model, known-subtotal, unknown, or unsupported scope of
a Calculation Result, independent of evaluator success or failure.
_Avoid_: Accuracy, confidence, safety rating

**Unknown**:
An explicit unresolved conclusion whose recorded reason identifies missing,
conflicting, ambiguous, unsupported, unevaluated, stale, or unobservable input.
_Avoid_: Zero, false, blank, compatible

**Finding**:
A derived, subject-linked assessment of topology, evidence, or results with
independent kind, severity, evaluation state, and lifecycle state.
_Avoid_: Engineering Value, universal verdict, unqualified warning

**Finding Trace**:
The complete relationship from a Finding through its Validation Rule, subject,
inputs, evidence, assumptions, and derived results.
_Avoid_: Warning message, opaque explanation, detached log

**Validation Rule**:
A versioned, explicit assessment applied to identified project subjects and
evidence within a stated scope to produce Findings.
_Avoid_: Hidden heuristic, certification requirement, safety rule

**Finding Severity**:
The scoped actionability of a Finding: blocker, warning, caution, or
information. It is neither failure probability nor a safety rating.
_Avoid_: Risk score, confidence, project health

**Finding Lifecycle**:
The derived active or resolved state of a Finding under current evidence and
the applicable Validation Rule.
_Avoid_: Acknowledgement, dismissal, suppression

**Finding Occurrence**:
One active-to-resolved interval within a persistent Finding identity for the
same Validation Rule, subject, and scope.
_Avoid_: New Finding, audit event, user disposition

**Finding Disposition**:
The user's unreviewed, acknowledged, or suppressed treatment of a Finding,
which does not change its severity, evidence, or lifecycle.
_Avoid_: Resolution, waiver, safety acceptance

**Validation Run**:
An evaluation of identified Validation Rules against one project revision and
scope, retaining both Findings and evaluation coverage.
_Avoid_: Certification, safety audit, completeness claim

**Validation Report**:
A derived record of one Validation Run's scope, coverage, Findings, filters,
and rule revisions for one project revision.
_Avoid_: Project Snapshot, certification, safety report

**Review Profile**:
A versioned selection of Validation Rules and completeness expectations for a
named review purpose without producing a readiness or safety verdict.
_Avoid_: Certification checklist, project phase, health score

**Validation Coverage**:
The accounting of applicable, evaluated, stale, unsupported, failed, and
excluded rules and subjects within one Validation Run.
_Avoid_: Completeness score, safety score, pass percentage

**Applicability Decision**:
An evidenced determination that a rule-declared condition does not apply to an
identified subject and scope.
_Avoid_: Suppression, Unknown, severity override

**Provenance**:
The source identity, revision, location, applicability, and observation context
needed to trace an Engineering Value or assessment.
_Avoid_: Unattributed note

## Build record

**Design Intent**:
The planned identity, placement, properties, and relationships of an item in a
Vehicle Project.
_Avoid_: As-built fact

**As-Built Evidence**:
An observation, measurement, or document establishing what was actually
installed without creating a duplicate project topology.
_Avoid_: Design assumption
