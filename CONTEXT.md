# Venae Machinae

Venae Machinae describes the physical systems of one project vehicle while
preserving the distinct rules of electrical and fluid design.

## Project

**Vehicle Project**:
The design context for one concrete vehicle build across its planned and
as-built evolution.
_Avoid_: Vehicle family, fleet, product variant

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

**Overlay**:
A derived, read-only visual projection of project topology, one Operating
State, Component Behaviors, and bounded calculations.
_Avoid_: Design data, editable simulation result

## Engineering evidence

**Engineering Value**:
A semantic quantity retaining its original unit, applicability,
uncertainty or bounds, origin, and provenance, attached to its most specific
subject and context. Conflicting values coexist.
_Avoid_: Unqualified number, overwritten value

**Calculation Result**:
An Engineering Value produced by an identified formula from referenced inputs
within an explicit applicability envelope.
_Avoid_: Source value, hidden formula

**Screening Result**:
An assessment comparing an explicit candidate against sourced limits without
claiming final suitability.
_Avoid_: Selection, certification

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
