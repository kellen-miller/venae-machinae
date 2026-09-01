# Venae Machinae MVP specification

Status: approved for implementation planning on 2026-09-01. This document
becomes the normative MVP product specification when it and the required
authority records below are merged.

## Authority and language

This specification integrates the accepted product, domain, interaction,
calculation, persistence, validation, and architecture decisions. The detailed
decision records linked under [Traceability](#traceability) retain rationale and
examples. Authority is scoped rather than globally ranked:

1. `CONTEXT.md` owns canonical domain vocabulary;
2. this specification owns integrated product behavior and MVP acceptance;
3. the accepted architecture ADR owns delivery, dependency, module, and runtime
   boundaries; and
4. the linked decision resolutions own domain-specific detail and rationale.

Within overlapping scope, this specification is the reconciled product
contract. It does not weaken an architecture boundary or a canonical domain
definition.

The required merged authority set is:

- [wiring vocabulary](https://github.com/kellen-miller/venae-machinae/pull/14);
- [fluid vocabulary](https://github.com/kellen-miller/venae-machinae/pull/15);
- [Operating State and Overlay vocabulary](https://github.com/kellen-miller/venae-machinae/pull/16);
- [persistence vocabulary](https://github.com/kellen-miller/venae-machinae/pull/18);
- [validation vocabulary](https://github.com/kellen-miller/venae-machinae/pull/19);
  and
- [application architecture ADR](https://github.com/kellen-miller/venae-machinae/pull/20).

Those accepted glossary records define the capitalized domain terms used here.
Interaction names such as Lens Stack and calculation result labels such as
`input-bound envelope` are defined where this specification introduces their
required behavior; they are not additional domain entities.

`MUST` identifies an MVP requirement. `MAY` identifies permitted optional
behavior. `DEFERRED` identifies behavior intentionally outside the MVP. There
are no implicit requirements between these levels.

Every requirement has stable identity and names observable acceptance evidence.
Renumbering an existing requirement is prohibited; superseded requirements
remain traceable.

## Product outcome

Venae Machinae is a personal-first application for designing and documenting
the electrical and fluid systems of one concrete project vehicle. It replaces
disconnected diagrams, spreadsheets, and general CAD with one topology-first
model, an effectively infinite two-dimensional canvas, synchronized dense
views, transparent engineering evidence, bounded calculations, build outputs,
and planned-to-installed continuity.

The RX-7 is the first acceptance project. It proves the product without
introducing RX-7-specific assumptions into the domain model.

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-PROD-001` | The application MUST support one local user without accounts, permissions, cloud services, or network-hosted project data. | A fresh production build completes the reference workflow with internet access disabled and the local server running. |
| `MVP-PROD-002` | A Vehicle Project MUST contain electrical and fluid work in one shared physical model while preserving their different physics and validation rules. | The reference project contains connected electrical, coolant, oil, and fuel Systems without cross-domain Connections. |
| `MVP-PROD-003` | The canvas, dense views, inspectors, calculations, Overlays, reports, and exports MUST project the same authoritative project revision. | A mutation in any editable projection is immediately observable in every other projection and in the next durable snapshot. |
| `MVP-PROD-004` | The product MUST preserve incomplete, conflicting, unsupported, and unknown work without treating it as zero, false, compatible, passing, or corrupt. | The incomplete-reference scenarios save, reopen, report, and round-trip with their evidence and Findings intact. |
| `MVP-PROD-005` | The product MUST describe only scoped evidence and results. It MUST NOT claim that a vehicle, project, design, candidate, or installation is globally safe, ready, suitable, correct, complete, or certified. | Copy review and automated assertions reject prohibited aggregate claims across UI and generated output. |

## Project and physical model

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-MODEL-001` | A Vehicle Project MUST own Components once and organize Connections into flat, domain-homogeneous Systems. A Component MAY participate in several Systems; each Connection MUST belong to exactly one System. | Domain invariant tests and the multi-medium heat-exchanger fixture. |
| `MVP-MODEL-002` | Every Connection MUST join exactly two same-domain Ports. Fluid Connections MUST also remain within one Fluid Medium. Branches MUST use explicit Junction Components. | Mutation tests reject cross-domain, cross-medium, and multi-ended Connections while accepting explicit electrical and fluid Junctions. |
| `MVP-MODEL-003` | Components MUST own immutable internal identities and editable human labels. Labels MAY repeat; affected views MUST disambiguate them by context, and operations requiring unique interpretation MUST expose ambiguity. | Duplicate-label fixtures remain editable and produce unambiguous tables, selection, and operation prompts. |
| `MVP-MODEL-004` | Reusable Part Definitions MUST remain separate from project-specific Components. Part Requirements MUST represent BOM demand without independent topology identity. | Template-copy, Component-replacement, and consumable-BOM tests. |
| `MVP-MODEL-005` | Planned-to-installed items MUST retain identity. Replacing a physical Component or Connection MUST create a successor identity linked to its predecessor while preserving historical evidence. | The reference project records installation and a physical replacement without creating parallel topology. |
| `MVP-MODEL-006` | Routes MUST remain independent of connectivity. Each routed Connection MUST traverse one ordered Route of shareable Segments; Mates MUST have no Route. | Route edits leave topology unchanged, and shared Segment tests preserve independent electrical and fluid connectivity. |
| `MVP-MODEL-007` | Route Length, Hydraulic Length, and Cut Length MUST remain distinct where applicable. Canvas geometry MUST produce only estimated Segment-length evidence; entered and measured alternatives MUST coexist until the user explicitly selects applicable evidence. | Length fixtures show provenance, explicit selection, and separate route/material/hydraulic totals. |
| `MVP-MODEL-008` | Interface compatibility MUST be an evidenced assessment rather than a topology gate. Same-domain incompatible or unknown intent MUST remain representable; impossible domain mutations MUST be rejected. | Unknown and incompatible same-domain Connections persist with Findings; impossible Connections never commit. |
| `MVP-MODEL-009` | Destructive mutations MUST show their dependency impact, require confirmation when material, support session undo/redo, and MUST NOT silently cascade-delete topology, evidence, requirements, or history. | Delete, branch-insertion, replacement, undo, and recovery tests. |

## Library, workspace, and canvas experience

The application has two top-level contexts: the Project Library and the Project
Workspace. Opening a project enters the canvas-first workspace.

The eleven canonical project views are Canvas, Systems, Circuits & Lines,
Interfaces, Routes, Harnesses & Bundles, Calculations, Evidence, BOM, Findings,
and State Compare. Context Matrix is an optional power view, not a twelfth
canonical destination.

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-UX-001` | The Project Workspace MUST use one canonical, effectively infinite pan-and-zoom canvas. System, domain, state, and presentation filters MUST alter projection, never create separate topology copies. | Cross-filter identity and persistence tests on the reference project. |
| `MVP-UX-002` | The canvas MUST remain the default full-bleed workspace. Dense work MUST open through a labeled vertical floating launcher as focused Lens Stack views above retained canvas state without resizing or replacing its geometry. | Desktop and tablet visual, interaction, and viewport-retention tests. |
| `MVP-UX-003` | Primary selection, preview, filters, and Operating State MUST remain synchronized across projections. Each projection MUST retain its own transient viewport and presentation. Follow MUST explicitly promote a preview. Reveal and Return MUST restore the exact prior canvas presentation, zoom, and pan; State Compare alone MUST link its two canvas viewports. | The approved dense-view review sequence passes against production state. |
| `MVP-UX-004` | Select, Pan, Add, Connect, and Route MUST be explicit modes with the active mode visible. Escape MUST return to Select. | Pointer and keyboard interaction tests. |
| `MVP-UX-005` | Every Connection MUST terminate at the rendered center of an explicit typed Port. Candidate targets MUST expose compatibility before commit, and the application MUST NOT insert adapters, Junctions, or repair topology silently. | Renderer geometry assertions and connection-action tests. |
| `MVP-UX-006` | Wires, hoses, tubes, and pipes MUST use distinct physical visual languages. Direction, temperature, selection, provenance, unknowns, conflicts, and Findings MUST be independent additive channels, never one overloaded stroke. | Screenshot, semantic, and non-color-cue tests in every supported viewport. |
| `MVP-UX-007` | The canvas MAY contain one optional locked raster vehicle background with two-point calibration, position, opacity, visibility, and replacement controls. Geometry-derived length MUST remain explicitly estimated. | Background calibration and estimated-length tests. |
| `MVP-UX-008` | Project creation MUST support Blank, Duplicate, Import `.venae.json`, and Copy Example without a mandatory wizard. Empty projects MUST expose a concise checklist and contextual next actions. | First-run and project-creation browser tests. |
| `MVP-UX-009` | The application MUST provide a small immutable manufacturer-neutral primitive library. Using a primitive MUST create project-owned data; built-ins MUST NOT supply hidden ratings or constitute a vendor catalog. | Primitive-copy and no-hidden-evidence tests. |
| `MVP-UX-010` | The verified RX-7 fixture MUST be available as an optional copyable example labeled illustrative, with assumptions, unknowns, and absence of safety endorsement visible. | Example-copy identity, provenance, and copy-review tests. |
| `MVP-UX-011` | Project-wide subject search and a command palette MUST support navigation and actions. Shortcuts MAY accelerate commands but MUST NOT be the only access path. | Search, command, keyboard, and discoverability tests. |
| `MVP-UX-012` | Direct canvas manipulation, inspectors, and dense views MUST invoke the same Project Session actions. Every authoring outcome MUST have a non-spatial inspector or dense-view path; exact pointer gestures need not have keystroke-for-keystroke equivalents. | Action-equivalence and keyboard-only workflow tests. |
| `MVP-UX-013` | Contextual help MUST expose canonical vocabulary, formula boundaries, provenance requirements, and corrective guidance without recommending an engineering choice. | Content review and help-link tests for representative electrical and fluid fields. |

## Wiring slice

The wiring slice is accepted against one RX-7 auxiliary-cooling harness with
explicit power and return, primary protection, ECU-controlled switching, fan
or pump loads, a splice branch, connector pins, a short twisted signal or data
pair, shared Route Segments, coverings, service allowance, and traceable BOM.

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-ELEC-001` | Users MUST be able to create Electrical Components and Ports from manufacturer-neutral source, Ground Point, fuse, relay, switch, load, controller, Connector, splice, and bus primitives or project-local Part Definitions. | Build the auxiliary-cooling harness from an empty project. |
| `MVP-ELEC-002` | Power, return, Ground Points, ground straps, splices, buses, Connector pins, protection, Wires, and per-pin Mates MUST be explicit topology. A ground symbol MUST NOT create continuity or imply a zero-resistance chassis return. | Source-to-load-to-return topology and missing-return tests. |
| `MVP-ELEC-003` | Electrical Nets MUST derive from structural continuity. Users MUST be able to create named functional Electrical Circuits and assign relevant Nets, Components, and Wires. | Net derivation and Circuit assignment tests. |
| `MVP-ELEC-004` | Adding a branch MUST insert a splice or bus Junction and preview replacement Wires, labels, evidence, and Route transfer before commit. Multi-ended Wires are prohibited. | Splice-branch acceptance scenario plus undo. |
| `MVP-ELEC-005` | Every independently connectable pin MUST be an Electrical Port. A Connector-focused view MUST support bulk cavity naming, pin mapping, per-pin mating, Wire assignment, terminal and seal selection, and unused-cavity requirements. | Bulk-map and mate the reference Connector with terminal, seal, and cavity-plug BOM demand. |
| `MVP-ELEC-006` | Wires MUST route independently through ordered shared Segments. Positive and return lengths MUST remain separate. Coverings, service allowance, and environment MUST be explicit. | Route the fixture and produce separate Route and Cut Lengths. |
| `MVP-ELEC-007` | Users MUST be able to group Wires into Harnesses and Bundles, split or join Bundles at route points, assign coverings per Segment, and record twisted pairs, shields, drain Wires, Concentric Bundle Layers, pitch, lay direction, and construction notes. | Create the fixture Bundle, twisted pair, covering, and concentric construction record. |
| `MVP-ELEC-008` | Twist and concentric-lay consumption MUST remain sourced or user-entered Cut Length allowance until a separately validated formula exists. | Construction output contains no inferred lay-consumption value. |
| `MVP-ELEC-009` | Cable Part Definitions MUST preserve sourced conductor area or gauge, material, strand construction, insulation, color or stripe, temperature limits, resistance per length, applicable current data, and provenance. Missing properties MUST remain unknown. | Exact cable evidence and incomplete-candidate fixtures. |
| `MVP-ELEC-010` | Steady-current and voltage-drop calculations MUST use explicit Operating State, source, load, return, path, positive and return lengths, formula, inputs, provenance, applicability, included resistance, and omitted resistance. Multiple paths require explicit selection. | One complete and one conductor-only voltage-drop result. |
| `MVP-ELEC-011` | A fuse MUST be an explicit two-Port protection Component associated with intended Circuits or Wires. Screening MUST evaluate only a user-selected candidate against supplied applicable evidence. | Screen exact conductor and fuse candidates, including pass, fail, and indeterminate comparisons. |
| `MVP-ELEC-012` | The application MUST represent continuous, intermittent, startup, stall, and measured operating-point values distinctly. It MUST NOT derive conductor or fuse suitability from load current or gauge alone. | Classification and prohibited-inference tests. |
| `MVP-ELEC-013` | Power, return, analog, discrete, PWM, and data conductors MAY carry role and protocol metadata. Protocol topology, impedance, termination, waveform, and signal-integrity validation are outside the MVP. | Metadata round-trip and absence-of-authority assertions. |
| `MVP-ELEC-014` | Wiring outputs MUST include topology, Circuit and Connection tables, Connector pinout, Wire list, Harness and Bundle construction, BOM, engineering evidence, Findings, and unknowns. | Revision-consistent print and CSV output comparison. |

## Fluid slice

The fluid slice is accepted against a complete coolant loop, an external
thermostatic oil-cooling loop, and a return-style fuel topology. Coolant is the
complete quantitative fixture; oil proves another medium and valve behavior;
fuel proves topology, interfaces, evidence, routing, BOM, and tighter
calculation boundaries.

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-FLUID-001` | Each Fluid System MUST contain one identified Fluid Medium and purpose. Coolant, oil, and fuel MUST remain separate Systems. Multi-medium Components MUST use distinct Ports and internal Component Behaviors, never cross-medium Connections. | Heat-exchanger and three-System reference fixtures. |
| `MVP-FLUID-002` | Every Fluid Line MUST be one two-Port continuous wetted passage with one construction kind: hose, tube, or pipe. Construction transitions MUST use separate Fluid Lines and explicit fitting or union topology. | Build a hose-to-tube transition through explicit fittings. |
| `MVP-FLUID-003` | Items changing connectivity, interface, location, or hydraulic behavior MUST be Components. Endpoint construction hardware MAY remain Part Requirements unless independent identity or evidence is needed. | Fitting, valve, seal, clamp, and user-promoted-item tests. |
| `MVP-FLUID-004` | Fluid Routes MUST record applicable Route Length, Hydraulic Length, Cut Length, elevation, and environment with provenance. Flexible hose, rigid tube, and rigid pipe MUST retain distinct construction data and rendering. | Route the coolant fixture through shared Segments and produce all three applicable lengths. |
| `MVP-FLUID-005` | Pumps, restrictions, valves, heat sources or sinks, volumes, and multi-medium heat exchangers MUST use composable Component Behaviors. State-specific pressure, flow, temperature, level, command, or assumed operating points MUST be explicit Boundary Conditions. | Pump, thermostat, cooler, and reservoir behavior tests. |
| `MVP-FLUID-006` | Actual direction and Flow Paths MUST derive from an Operating State and explicit Behaviors. The application MUST NOT invent branch splits, interpolate pump/system operating points, or solve network distribution. | Enter independent branch flows and verify mass-conservation reporting without an invented split. |
| `MVP-FLUID-007` | For supported circular passages, the application MUST calculate area, velocity, volumetric flow, mass flow, and a mathematical minimum inside-diameter candidate only from explicit actual ID, medium properties, conditions, and limits. Nominal or dash size MUST NOT substitute for actual ID. | One supported flow/velocity case and one missing-ID Unknown. |
| `MVP-FLUID-008` | Pressure-loss calculations MUST remain within steady, single-phase, incompressible, Newtonian circular-passage limits. They MAY include validated Darcy major loss, sourced fitting coefficients, and manufacturer or measured Component characteristics. | Complete and known-subtotal pressure-loss fixtures, plus unsupported transitional-flow result. |
| `MVP-FLUID-009` | Missing fitting or Component losses MUST NOT become zero. Partial results MUST list inclusions, omissions, assumptions, stopping boundaries, and model uncertainty. | Intentionally incomplete pressure-loss worksheet. |
| `MVP-FLUID-010` | Every temperature MUST identify subject, medium, location, Operating State, time, origin, uncertainty, and provenance. The application MUST NOT interpolate temperature across unmeasured topology. | Point, Port, Component, Segment, Line, gap, and conflict display tests. |
| `MVP-FLUID-011` | For an exact thermostat with sufficient sourced evidence, the application MAY report only the expected thermal region. Actual position, health, hysteresis, and bypass flow remain unknown without direct evidence. | Below-range, transition, above-range, and insufficient-evidence fixtures. |
| `MVP-FLUID-012` | Steady sensible-heat transport MUST require one evidenced single-phase stream, explicit mass flow, composition-specific heat, and inlet/outlet bulk temperatures. It MUST NOT claim radiator capacity or predicted operating temperature. | One supported heat-transport result and prohibited-claim tests. |
| `MVP-FLUID-013` | User-selected hose, tube, pipe, fitting, and coupling candidates MUST be screened only against sourced applicable medium compatibility, actual ID, temperature, pressure, bend/routing, connection, and standards evidence. The lowest applicable constituent rating governs an assembled line; burst pressure cannot substitute for working pressure. | Exact-candidate pass, fail, indeterminate, and incomplete fixtures. |
| `MVP-FLUID-014` | Fuel support MUST include topology, interfaces, routing, evidence, measurements, candidate screening, BOM, and unknowns while excluding fuel-injection sizing, pressure-regulation recommendation, injector supply design, fire protection, and legal compliance. | Build and export the return-style fuel fixture without exposing prohibited calculations. |
| `MVP-FLUID-015` | Fluid outputs MUST include topology, line and interface schedules, Component and Port tables, routes, flow/velocity/pressure worksheets, temperature and thermostat evidence, BOM, Findings, and unknowns. | Revision-consistent print and CSV output comparison. |

## Operating States and Overlays

The five reference states are `Key Off / Cold`, `Fuel Prime`, `Run Cold`,
`Run Hot / Fan On`, and `Heat Soak / Key Off`. They are acceptance fixtures,
not mandatory templates for every project.

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-STATE-001` | An Operating State MUST be an independent named static snapshot of explicit commands, conditions, measurements, assumptions, and applicable evidence. It MUST NOT imply a state machine, transition, timeline, simulation, or telemetry stream. | Create, clone, edit, and delete independent states; later edits do not cascade. |
| `MVP-STATE-002` | Each state MUST own explicit State Bindings. Unknown or conflicting bindings MUST remain representable, with no implicit evidence precedence, averaging, or latest-wins behavior. | Binding conflict and explicit-selection tests. |
| `MVP-STATE-003` | One Operating State MUST be active per canvas. Switching MUST preserve selection and viewport, mark prior Overlay output stale, and replace it atomically after evaluation. | Switch through all five reference states under concurrent-edit and failure conditions. |
| `MVP-STATE-004` | Each affected System and Overlay Channel MUST expose availability and evaluation status, provenance trace, omissions, input fingerprint, and source revision. Failure MUST leave physical topology visible. | Available, partial, unavailable, conflicting, unsupported, stale, and failed fixtures. |
| `MVP-STATE-005` | Overlay Channels MUST be independently selectable. Electrical potential, current, and signal are mutually exclusive primary channels; fluid direction and temperature MAY appear together; Findings and selection are additive. | Channel-combination and legend-generation tests. |
| `MVP-STATE-006` | The electrical potential channel MUST show sourced potential relative to an identified return/reference without implying load current. The current channel MUST require a complete source-load-return path and explicit or approved calculated current evidence. | Potential-only, complete-current, and incomplete-path tests. |
| `MVP-STATE-007` | Electrical current direction MUST use conventional current and identify source-to-load and load-to-return direction. Direction animation and line weight MUST NOT encode magnitude. | Direction, magnitude-label, paused-motion, and legend tests. |
| `MVP-STATE-008` | Signal direction MUST represent configured driver-to-receiver Behavior only. Bidirectional buses MUST use a neutral bidirectional cue; the MVP MUST NOT infer transmitters, decode messages, or simulate waveforms. | Directed-signal and bidirectional-bus fixtures. |
| `MVP-STATE-009` | Fluid paths MUST distinguish forward, reverse, explicitly zero, unknown, conflicting, and excluded states. Pump-off alone MUST NOT establish zero flow. | All six path-state fixtures. |
| `MVP-STATE-010` | Temperature color MUST apply only to topology covered by explicit evidence. Unknown gaps remain neutral; conflicts expose every value. Numeric value and provenance class MUST remain inspectable. | Non-interpolated temperature and conflict fixtures. |
| `MVP-STATE-011` | Every Overlay mark MUST trace physical topology to State Binding, Component Behavior, Calculation Result, and mark, including sources, assumptions, omissions, applicability, uncertainty, and conflicts. Derived marks MUST NOT be directly editable. | End-to-end trace inspection for electrical and fluid marks. |
| `MVP-STATE-012` | State Compare MUST provide synchronized two-up canvases and a tabular difference view with linked pan/zoom and motion paused by default. Differences MUST be classified without claiming causality. | Compare two reference states and restore prior view context. |
| `MVP-STATE-013` | Direction MUST remain understandable through static cues, labels, and accessible summaries. Motion MUST be pausable, honor reduced-motion preferences, and remain a constant direction-only cue. | Reduced-motion, no-motion, non-color, keyboard, and screen-reader tests. |

## Calculations and candidate screening

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-CALC-001` | The executable formula catalog MUST be application-owned, deterministic, local, explicit, and versioned. User-provided curves and tables MAY supply data to a supported catalog formula. User equations MAY remain inert evidence but MUST NOT execute. Scripts, expression evaluators, and plugins are prohibited. | Formula-catalog, schema, unsupported-evidence, and security tests. |
| `MVP-CALC-002` | A user MUST configure a requested calculation by selecting its subject, Operating State, formula, path when relevant, inputs, assumptions, and desired output. The application MUST NOT infer the intended calculation or candidate. | Calculation-creation tests with ambiguous and complete inputs. |
| `MVP-CALC-003` | Configured supported calculations MUST reevaluate after dependency changes. Existing results become stale immediately and remain traceable until one atomic replacement publishes. Failed evaluation MUST NOT erase prior results. | Dependency-change, cancellation, crash, and stale-publication tests. |
| `MVP-CALC-004` | Every numeric input MUST retain semantic quantity, original decimal and unit, applicable condition, uncertainty or bounds, and provenance. Every result MUST retain formula identity and revision, input identities, assumptions, applicability, result unit, completeness, and timestamp. | Golden serialization and trace tests. |
| `MVP-CALC-005` | Conflicting values MUST coexist. Multiple paths, values, or interpretations MUST require explicit selection; the selection MUST remain traceable and MUST NOT erase the conflict. | Ambiguous path and conflicting-evidence tests. |
| `MVP-CALC-006` | Explicit lower and upper bounds MUST propagate through proven monotonic formulas as an `input-bound envelope`. Unsupported propagation MUST return Unknown; the application MUST NOT invent tolerances, distributions, confidence, or statistical uncertainty. | Monotonic, non-monotonic, missing-bound, and exact-conversion golden fixtures. |
| `MVP-CALC-007` | Calculations MUST use deterministic unrounded decimal values. Rounding is presentation-only, MUST disclose applied display precision, and MUST NOT imply more measurement certainty than inputs support. | Cross-browser numeric golden fixtures and export comparisons. |
| `MVP-CALC-008` | Low-voltage electrical calculation authority MUST stop at 60 V DC and the accepted steady-state current, resistance, voltage-drop, loss, and explicit scenario-sum formulas. Unsupported transient, fault, waveform, thermal, or high-voltage work returns Unsupported or Unknown. | Electrical formula envelope and boundary tests. |
| `MVP-CALC-009` | Fluid calculation authority MUST stop at the accepted steady single-phase relationships, sourced characteristics, thermostat-region comparison, and sensible-heat transport envelope. Unsupported regimes return Unsupported or Unknown. | Fluid formula envelope and boundary tests. |
| `MVP-CALC-010` | Screens MUST compare one or more user-selected Part Definitions independently against explicit supplied limits. A neutral table MUST show each comparison and missing evidence without ranking, recommendation, automatic selection, or hidden safety factors. | Multi-candidate pass/fail/indeterminate/unevaluated comparison tests. |

## Validation, uncertainty, and Findings

Validation assesses explicit project evidence. It does not certify the vehicle
or replace engineering judgment.

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-VAL-001` | Validation Rules MUST be application-owned, deterministic, local, explicit, scoped, and versioned. Users MAY author evidence, assumptions, limits, Caution Bands, applicability, and Review Profile scope, but not executable rules, formulas, or severities. | Rule-catalog, configuration, and prohibited-script tests. |
| `MVP-VAL-002` | Engineering Values, Calculation Results, and Screening Results MUST remain evidence. A canonical Finding MUST be derived from one Validation Rule, subject, and evaluation scope with a complete trace. Aggregated views MUST NOT duplicate its identity. | Finding identity and aggregation tests. |
| `MVP-VAL-003` | Finding severity MUST mean scoped actionability only: Blocker prevents only the named mutation, calculation, evaluation, or output; Warning records explicit conflict, failure, or limit violation; Caution records unresolved or bounded uncertainty; Information records a passing screen or fact. A Blocker MUST NOT disable unrelated editing, saving, reporting, or exchange. | Severity golden fixtures and prohibited-safety-language review. |
| `MVP-VAL-004` | Evaluation state, lifecycle, and disposition MUST remain independent. Evaluation is current, stale, unevaluated, unsupported, or failed; lifecycle is active or resolved; disposition is unreviewed, acknowledged, or suppressed. | State-transition and persistence tests. |
| `MVP-VAL-005` | Unknown MUST be explicit and reason-coded as missing, conflicting, ambiguous, unsupported, unevaluated, stale, unobservable, or outside an applicability envelope. | Unknown-reason coverage tests. |
| `MVP-VAL-006` | Optional blank data MUST create no Finding. Missing required profile evidence MAY create a scoped Caution; a missing calculation input MUST block only the requested calculation. Saving, editing, reporting, and exchange remain available. | Draft topology and requested-calculation scenarios. |
| `MVP-VAL-007` | Result Completeness MUST distinguish `complete for stated model`, `known subtotal`, `unknown`, and `unsupported`. Screen comparisons MUST distinguish pass, fail, indeterminate, unevaluated, and not applicable. | Numeric subtotal, interval overlap, missing comparison, and unsupported tests. |
| `MVP-VAL-008` | Structural consistency, direct interface conflicts, stale dependencies, and configured screens MUST evaluate incrementally. Completeness MUST run only through an explicit Review Profile or Validate Project action. | Incremental and explicit-run timing tests. |
| `MVP-VAL-009` | Review Profiles MUST be cumulative: Topology Review, Engineering Review, Build Preparation, and As-Built Review. They MUST report Findings and Validation Coverage, never readiness or project health. | Profile coverage and prohibited-score tests. |
| `MVP-VAL-010` | Validation Coverage MUST account for applicable, evaluated, passed, active-Finding, Unknown, stale, unsupported, failed, excluded, and not-applicable rules and subjects. Ratios MAY be displayed but MUST NOT become a health or safety score. | Coverage denominator and display tests. |
| `MVP-VAL-011` | Users MUST NOT manually downgrade severity or resolve a Finding. Acknowledgement and permitted suppression MUST retain exact rule, subject, scope, revision, rationale, and invalidation behavior; Blockers cannot be suppressed. | Acknowledge, suppress, recur, invalidate, and Blocker tests. |
| `MVP-VAL-012` | Only reevaluation MAY resolve a Finding. Deleting its subject MUST retain a minimal tombstone and resolve the active occurrence as `subject removed`; undo MUST restore the subject and trace. | Subject-deletion, history, recurrence, and undo tests. |
| `MVP-VAL-013` | A Validation Run MUST publish Findings and coverage atomically for its scope. Failed or canceled runs MUST remain non-current and MUST NOT clear prior evidence. | Full, canceled, failed, and concurrent-run tests. |
| `MVP-VAL-014` | Finding presentation MUST lead with the exact scoped claim, then severity rationale, known/unknown evidence, affected operation, inputs, assumptions, rule revision, trace, disposition, recurrence, and corrective actions. Background validation MUST NOT move focus or produce noisy modals/toasts/live-region output. | Content-order, focus, notification, and accessibility tests. |

## BOM, build record, and reports

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-BUILD-001` | One project BOM MUST combine electrical and fluid demand with domain and System filters. It MUST aggregate only identical Part Definitions and variants while retaining every consuming subject. | Cross-domain BOM grouping and trace tests. |
| `MVP-BUILD-002` | Exact design demand MUST remain separate from procurement quantity. Package/spool rounding, spare percentage, waste, and user-entered consumable quantities MUST be explicit choices; no hidden waste factor is allowed. | Wire, line, covering, terminal, seal, fitting, clamp, and consumable quantity fixtures. |
| `MVP-BUILD-003` | Design Intent and As-Built Evidence MUST share topology identity through installation. The project MUST record installation status, exact installed products, measured lengths and observations, substitutions, photos, quantities, and notes. | Reference installation and physical-replacement workflow. |
| `MVP-BUILD-004` | View-scoped print and CSV output MUST derive from one immutable project revision. Export All MUST package stable project tables as a ZIP. Derived reports MUST NOT be accepted as project backups or round-trip formats. | Cross-table revision consistency, CSV safety, ZIP contents, and reimport rejection tests. |
| `MVP-BUILD-005` | Printable output MUST identify project revision, Operating State, filters, Overlay Channels, units, legend, provenance summary, visible Findings, generation time, and pagination. | Print-route assertions and manual PDF review. |
| `MVP-BUILD-006` | CSV MUST use stable domain tables and identities, separate raw-value and unit columns, provenance and status, invariant decimals, ISO timestamps, UTF-8 RFC-4180-style encoding, and neutralized spreadsheet-formula prefixes. | CSV golden files and spreadsheet-injection tests. |
| `MVP-BUILD-007` | Validation reports MUST identify project revision, run scope, Review Profile, Operating States, filters, rule revisions, coverage, and generation time. Active acknowledged and suppressed Findings remain included by default; resolved Findings are optional and separately labeled. | Validation-report content and filter tests. |

## Local persistence, recovery, and exchange

The browser-profile-local Project Library is authoritative. Exported files are
self-contained snapshots, never live-linked sources. Local durability covers
refreshes, browser restarts, operation without internet access, and ordinary
browser updates in the same profile. It does not cover cleared site data,
private browsing, profile deletion, browser eviction, or device loss.

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-DATA-001` | The Project Library MUST hold multiple independent Vehicle Projects and reusable Part Definition Templates in browser IndexedDB. The server MUST NOT own or receive project content. | Network inspection, server-log review, IndexedDB reopen, and multiple-project tests. |
| `MVP-DATA-002` | Every accepted project action MUST enter an atomic debounced autosave queue; continuous gestures MAY coalesce. Status MUST report Saving, Saved at, or Save failed only after the persistence transaction completes. Save and `Cmd/Ctrl+S` MUST flush pending work rather than create a file. | Autosave timing, flush, transaction-failure, and status tests. |
| `MVP-DATA-003` | One tab MUST hold a project's writable lease. Other tabs MUST open read-only and MAY take over only after explicit release and successful lock acquisition. | Multi-tab open, refusal, release, takeover, crash, and upgrade tests. |
| `MVP-DATA-004` | On persistence failure, unsaved changes MUST remain in memory; the UI MUST retain a persistent failure state, retry safely, offer emergency JSON export, and warn before navigation where supported. It MUST NOT claim durability. | Quota, transaction, server-loss, emergency-export, and navigation tests. |
| `MVP-DATA-005` | The application MUST request persistent storage where available and report granted, denied, or unsupported status plus estimated usage/quota without implying a guarantee. A downloaded Library Backup is the device-loss durability boundary. | Real-browser storage lifecycle and copy-review tests. |
| `MVP-DATA-006` | A Project Snapshot MUST include authored project data, evidence, states, As-Built Evidence, canvas geometry, settings, assets, and evidence-bearing results. It MUST exclude selection, open panels, viewport, undo history, render caches, and generated Overlay marks. | Snapshot schema and exact reopen tests. |
| `MVP-DATA-007` | Recovery Checkpoints MUST be created periodically during active editing, at session boundaries, and before migration, import replacement, restore, or destructive operations. Retention MUST keep the newest 25 plus one daily for 30 days. | Clock-controlled creation and pruning tests. |
| `MVP-DATA-008` | Named Snapshots MUST be content-immutable and user-retained. Restore MUST first create a checkpoint, then make restored contents a new current revision under the same project identity without consuming the source snapshot. | Snapshot name/note edit, restore, undo source, and identity tests. |
| `MVP-DATA-009` | Projects and templates MUST remain in Trash for 30 days. Automatic reclamation MUST remove only disposable caches, regenerated previews, expired Trash, and out-of-policy checkpoints; it MUST NOT remove current projects, Named Snapshots, templates, evidence, or assets. | Time-controlled Trash, reclamation, quota, and blocked-save tests. |
| `MVP-DATA-010` | A Library Backup MUST contain active projects, Named Snapshots, templates, assets, and library settings while excluding Trash, rolling checkpoints, transient UI state, and caches. Restore MUST preview and atomically replace or cancel. The prior rollback image MUST remain until the replacement opens, a later Library Backup succeeds, and at least seven days pass. | Backup, replace, cancel, open, later-backup, and retention tests. |
| `MVP-DATA-011` | `.venae.json`, `.venae-templates.json`, and `.venae-backup.json` MUST be strict readable self-contained JSON envelopes with format, integer schema version, application version, identity/revision metadata, canonical payload, embedded assets, integrity metadata, and export metadata. | Schema and golden round-trip tests. |
| `MVP-DATA-012` | Canonical payload ordering MUST preserve meaningful domain order and normalize unordered collections. Entered decimal and display precision MUST remain strings with explicit units. Timestamps MUST use RFC 3339 UTC with separate observation timezone when domain-relevant. | Byte-stable canonicalization and semantic round-trip tests. |
| `MVP-DATA-013` | Exchange integrity MUST hash the canonical payload separately from export metadata and every asset with SHA-256. The UI MUST describe hashes as corruption detection, never authenticity or authorship. | Mutation, asset-corruption, metadata-change, and copy-review tests. |
| `MVP-DATA-014` | Imports MUST parse, validate, migrate, and summarize in staging before confirmation and atomic commit. Older released schemas migrate sequentially; newer or structurally invalid files block. Legitimate incomplete engineering data imports with Findings. | Full migration matrix, rejection, quarantine, and no-partial-mutation tests. |
| `MVP-DATA-015` | Project identity collision MUST offer Replace existing, Import as copy, or Cancel, defaulting to Cancel. Copy MUST rekey the project and all project-owned subjects, retain origin provenance, mark copied validation stale, and reset dispositions. | Replace, copy, cancel, identity, provenance, and validation tests. |
| `MVP-DATA-016` | Invalid stored projects MUST remain quarantined and raw-exportable without silent repair. Imported assets MUST remain inert, pathless, type/size/count-limited, hash-addressed original bytes; only allowlisted sandboxed raster previews execute as display content. | Quarantine, malicious HTML/SVG/macro, path, MIME, size, count, and preview tests. |
| `MVP-DATA-017` | Part Definition Templates MUST use immutable revisions. Adding one to a project copies an independent definition with source provenance; later template edits, replacement, or deletion MUST NOT mutate project copies. | Create, revise, promote, exchange, collide, trash, restore, and delete tests. |
| `MVP-DATA-018` | Output from a persisted Project Session MUST derive from one immutable revision. A writable session MUST first flush autosave; a read-only session MUST use its current durable revision. Output from a transient read-only file MUST derive from that envelope's immutable identity and revision without pretending to persist it. Emergency output from unsaved memory MUST require consent and carry `Unsaved working state`. | Save-success, save-failure, persisted-read-only, transient-review, emergency, and cross-output consistency tests. |
| `MVP-DATA-019` | The library MUST display last successful project export and Library Backup and give non-blocking reminders after seven days, substantial editing, and before application migration. It MUST NOT imply autosave protects against profile or device loss. | Clock/edit-threshold reminder and content-review tests. |

## Application architecture and delivery

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-ARCH-001` | Production MUST be one strict-TypeScript Svelte 5/SvelteKit 2 application using `adapter-node`. React and React adapters are prohibited. | Dependency, import-boundary, build, and source scans. |
| `MVP-ARCH-002` | A local server MUST run and deliver the application while remaining stateless for Vehicle Projects. Browser IndexedDB is authoritative; project mutations, calculations, validation, and exchange MUST remain in the browser. | Production network inspection, endpoint inventory, and server-log tests. |
| `MVP-ARCH-003` | The application MUST use one explicit Project Session and mutation pipeline. Pure domain modules MUST remain free of Svelte, browser, Node, persistence, worker, and renderer dependencies. Side effects MUST remain in plainly owned adapters. | ESLint dependency-boundary tests and architecture review. |
| `MVP-ARCH-004` | Runtime boundaries MUST use typed validation, deterministic decimal arithmetic, versioned formulas/results, browser storage and locking, and cancellable worker evaluation. Renderer-specific types MUST remain behind an application-owned adapter. | Boundary tests, type checks, golden fixtures, and worker lifecycle tests. |
| `MVP-ARCH-005` | SvelteKit MUST own delivery, routing, server-rendered shell, context, error pages, security headers, and application-version handling. Server load data, form actions, and remote functions MUST NOT carry project data or mutations. | Route, hydration, CSP/header, and network tests. |
| `MVP-ARCH-006` | The canonical loopback origin MUST be `http://localhost:4173` with strict-port failure and `localhost`, never `127.0.0.1`. MVP release packaging and installation are not acceptance requirements. | Production-build launch, occupied-port, and origin tests. |
| `MVP-ARCH-007` | No service worker ships in the MVP. Network-independent use means no internet or cloud dependency while the local server runs. An already-open editor MUST retain its loaded edit, undo, IndexedDB, and emergency-export loss-prevention core during server loss; cold launch and full serverless operation are not promised. | Offline-network, server-loss, refresh, worker-crash, and reconnect tests. |
| `MVP-ARCH-008` | Loopback binding is the default. Another device MUST use a stable trusted HTTPS origin and owns an independent origin-local Project Library. Plain HTTP LAN access and implicit synchronization are unsupported. | Origin, secure-context, independent-library, and no-sync tests. |
| `MVP-ARCH-009` | The application MUST use strict CSP and response headers, inert imported assets, explicit diagnostics export, and no telemetry or remote crash reporting. Diagnostic export MUST redact project values by default. | Security-header, injection, network, and redaction tests. |
| `MVP-ARCH-010` | Svelte Flow MAY be adopted only after the renderer evidence gate passes. It MUST remain behind the renderer adapter, with raw SVG or Canvas as bounded fallback without domain or persistence changes. | Spike report and adapter import-boundary tests. |

## Device, browser, accessibility, and performance

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-NFR-001` | Desktop presentation at layout viewports above 1,120 CSS pixels and tablet presentation from 700 through 1,120 CSS pixels MUST support the complete lifecycle. Tablet authoring MUST use trusted HTTPS, touch-sized controls, compressed floating UI, and no hover-only behavior. | Real desktop/tablet production workflows at both breakpoint boundaries. |
| `MVP-NFR-002` | Mobile presentation below 700 CSS pixels MUST remain read-only, independent of user-agent strings. Entering it MUST complete the active action, flush pending persistence when possible, and reject new mutations until a capable authoring presentation resumes with a valid write lease. It MAY structurally validate and transiently open a `.venae.json` for review without importing or persisting it, switch states/channels, inspect traces and comparisons, filter/search, print/download reports, and export snapshots. It MUST NOT mutate the library, project, engineering validation, templates, applicability, acknowledgement, or disposition. | Breakpoint-transition, capability-denial, persistence, and complete mobile-review tests. |
| `MVP-NFR-003` | Missing required browser APIs MUST block editing with a useful explanation while retaining permitted recovery/export behavior. | Capability-matrix tests. |
| `MVP-NFR-004` | The application MUST support the current and previous stable desktop Chrome/Edge, Firefox, and Safari releases, Safari on iPadOS for tablet and mobile presentation, and Chrome on Android for tablet and mobile presentation. Device-support claims require real supported-device lifecycle evidence and required API capability. | Cross-browser production Playwright and real-device reports. |
| `MVP-NFR-005` | Non-spatial workflows MUST target WCAG 2.2 AA. Spatial limitations MUST be documented. All meanings require text/symbol alternatives, keyboard paths, visible focus, screen-reader summaries, WCAG 2.2 AA target sizing or spacing, zoom/reflow support, and reduced-motion behavior. Primary tablet/mobile controls MUST retain the approved 44-CSS-pixel target. | axe-core plus manual keyboard, screen-reader, zoom, contrast, reflow, touch, and motion review. |
| `MVP-NFR-006` | The expected 1x fixture is approximately 300 Components, 1,500 Ports, and 1,200 mixed Connections. Capacity MUST be measured at 1x, 2x, and 5x on a 2020-era laptop. | Reproducible benchmark fixture and recorded environment. |
| `MVP-NFR-007` | At 1x and 2x, pointer feedback MUST remain below 100 ms and pan/zoom near 60 fps. At 5x, the workspace MUST remain usable above 30 fps without data loss. At 1x and 2x, elapsed time from the persistence repository returning a Project Snapshot to the Project Session until the first interactive canvas paint MUST remain below two seconds. Expensive evaluation MUST NOT block editing. | Renderer, persistence, and worker benchmarks with recorded start/end marks. |

## Mandatory evidence gates

These gates are implementation prerequisites, not user-facing features. A gate
failure reopens only the bounded architecture choice it guards; it does not
weaken the product contract silently.

| ID | Gate | Required evidence |
| --- | --- | --- |
| `MVP-GATE-001` | Renderer fit | Production-style custom Ports, exact snapping, routed edges, distinct pipe/wire rendering, synchronized lenses, keyboard paths, responsive review, and renderer isolation. |
| `MVP-GATE-002` | Graph capacity | Render, pan/zoom, selection, drag, route editing, labels, and Overlays at the 1x, 2x, and 5x fixtures against `MVP-NFR-007`. |
| `MVP-GATE-003` | Whole-snapshot persistence | Serialization, IndexedDB transaction time, checkpoints, asset deduplication, quota failure, and recovery at all three fixture sizes. |
| `MVP-GATE-004` | Exchange limits | Peak parse, hashing, validation, clone, commit memory, and evidence-backed envelope/asset limits across Chromium, Firefox, and WebKit, with tested caps and environments recorded. If safe monolithic JSON cannot satisfy the fixture, reopen the exchange-format decision before implementation proceeds. |
| `MVP-GATE-005` | Worker boundary | Clone cost, incremental change sets, cancellation, stale publication, crash/restart, and server-loss behavior. |
| `MVP-GATE-006` | Browser storage lifecycle | Persistence grant/denial, eviction messaging, multi-tab upgrade, takeover, background/restore, and Safari recovery on real devices. |
| `MVP-GATE-007` | Numeric correctness | Formula golden fixtures, units, exact conversions, bounds, significant-figure presentation, and cross-browser deterministic display. |

Safe exchange caps are intentionally evidence-gated values, not an unresolved
product choice. `MVP-GATE-004` evidence records the tested limits and
environments.

## Integrated acceptance project

One vehicle-agnostic RX-7 Vehicle Project exercises the entire contract. Its
data may use sourced or deliberately synthetic values; the requirements below
preserve provenance and applicability and prevent fixture data from becoming
hidden defaults or a claim of recommended vehicle design.

| ID | Acceptance scenario |
| --- | --- |
| `MVP-ACC-001` | From an empty Project Library, create the reference project and its Electrical, coolant, oil, and fuel Systems using primitives and project-local Part Definitions. |
| `MVP-ACC-002` | Build the auxiliary-cooling harness, explicit source/load/return, protection, ECU-controlled switching, splice Junction, Connector pinout, routes, coverings, Bundle, twisted pair, and concentric construction. |
| `MVP-ACC-003` | Build the complete coolant topology including thermostat bypass, heater/turbo branch, bleed topology, hose/tube transition, exact fittings, shared routes, and all applicable length types. |
| `MVP-ACC-004` | Build the thermostatic oil loop with a distinct Fluid Medium and state-dependent path, then build return-style fuel topology and BOM without prohibited fuel calculations. |
| `MVP-ACC-005` | Create and switch among all five reference Operating States; demonstrate electrical potential/current/signal and every fluid direction status with non-interpolated temperature evidence and complete Overlay trace. |
| `MVP-ACC-006` | Produce sourced electrical current/voltage-drop results, conductor-only subtotal, supported flow/velocity, complete and incomplete pressure loss, thermostat region, sensible heat transport, and explicit Unknown/Unsupported results. |
| `MVP-ACC-007` | Screen multiple explicit wire, fuse, hose, fitting, and coupling candidates across pass, fail, indeterminate, unevaluated, missing-evidence, bound-overlap, and constituent-limit cases without ranking or recommendation. |
| `MVP-ACC-008` | Run every Review Profile and Validate Project across valid, incomplete, conflicting, stale, unsupported, failed-evaluator, acknowledged, suppressed, recurring, and resolved Finding scenarios. |
| `MVP-ACC-009` | Navigate all eleven canonical views while preserving selection, filters, Operating State, preview/follow behavior, and exact Reveal/Return viewport. Produce the unified BOM and required build/evidence outputs. |
| `MVP-ACC-010` | Record installation evidence, measured values, substitutions, photos, and a physical Component replacement without duplicating topology or orphaning history. |
| `MVP-ACC-011` | Autosave, explicitly flush, close, reopen, duplicate, checkpoint, create/restore a Named Snapshot, trash/restore, fail storage, perform emergency export, and transfer a multi-tab write lease without data loss. |
| `MVP-ACC-012` | Export and reimport the complete project with exact identities, values, units, precision, provenance, states, results, validation history, geometry, and assets through replace, copy, and cancel paths. Reject/quarantine corruption and newer/invalid schemas without partial mutation. |
| `MVP-ACC-013` | Back up and atomically restore the complete Project Library with rollback; create, revise, promote, exchange, collide, trash, restore, and delete templates without changing project copies. |
| `MVP-ACC-014` | Generate revision-consistent print, validation, CSV, Export All ZIP, and round-trip JSON outputs, including explicitly marked unsaved emergency output. |
| `MVP-ACC-015` | Repeat applicable lifecycle and authoring scenarios on desktop and tablet, then complete the permitted read-only workflow on mobile with every prohibited mutation absent. |
| `MVP-ACC-016` | Stop internet access while the local server runs, then stop the server with an editor already open; verify the exact network-independent and loss-prevention boundaries without claiming cold-launch support. |
| `MVP-ACC-017` | Complete browser, accessibility, security, numeric, persistence, exchange, worker, and capacity gates against the supported matrix and recorded environments. |
| `MVP-ACC-018` | Save, reopen, export, import as copy, and revalidate the unified project end to end without identity, evidence, topology, result, Finding, or asset loss. |

## Explicit deferrals

The following are DEFERRED beyond the MVP:

- accounts, authentication, permissions, collaboration, cloud sync, server
  project APIs, remote configuration, telemetry, and hosted infrastructure;
- release packaging, installers, automatic distribution/update mechanisms,
  service-worker delivery, PWA installation, and publishing to npm;
- mobile mutation, cross-device library sharing, implicit synchronization, and
  plain-HTTP LAN editing;
- comprehensive manufacturer catalogs, vendor ordering, pricing, inventory,
  automatic part selection, and authoritative wire/fuse/hose/component sizing;
- 3D CAD, mechanical interference, fabrication-grade tube bending, CAD/netlist
  export, manufacturing-machine formats, and automatic concentric optimization;
- high-voltage EV, AC, PCB, brake, hydraulic-actuation, pneumatic, HVAC,
  refrigerant, and regulated fuel-injection design;
- fault, short-circuit, transient, PWM, inrush, flyback, waveform, protocol,
  signal-integrity, and conductor-thermal simulation;
- branch/network distribution solving, pump/system operating-point solving,
  CFD, cavitation, water hammer, and compressible, pulsating, non-Newtonian,
  two-phase, phase-change, or transient flow analysis;
- radiator/heat-exchanger sizing, warm-up or whole-system thermal prediction,
  thermostat dynamics/health, boiling/freezing margin, and inferred fill volume;
- real-time telemetry, time-series playback, state machines, automatic state
  sequencing, inferred causality, diagnosis, control output, and AI-generated
  assumptions, Findings, rules, or severities;
- project fragments, graph/library merge, live-file linkage, event sourcing,
  indefinite audit history, arbitrary schema extensions, down-export, hand-edit
  compatibility, encrypted/signed exchange, and persistent filesystem handles;
- full revision comparison, certification, legal compliance claims, universal
  safety claims, project-health scores, and final engineering selection.

## Implementation handoff

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| `MVP-HANDOFF-001` | `grill-plan-build` MUST begin only after this specification and every required authority record are merged into `main`. | The handoff records merged commits for this specification and each linked authority. |
| `MVP-HANDOFF-002` | The implementation plan MUST preserve requirement IDs, make evidence gates explicit early milestones, and trace each work item and test to this specification. It MAY phase work into vertical increments but MUST NOT silently defer an MVP requirement. | A complete bidirectional trace from implementation work items and tests to every MVP requirement and gate. |

## Traceability

- [Research existing hobbyist system-design workflows](https://github.com/kellen-miller/venae-machinae/issues/2)
- [Establish trustworthy automotive calculation boundaries](https://github.com/kellen-miller/venae-machinae/issues/3)
- [Define the shared vehicle-system domain model](https://github.com/kellen-miller/venae-machinae/issues/4)
- [Prototype the core 2D system-building interaction](https://github.com/kellen-miller/venae-machinae/issues/5)
- [Define the wiring MVP behavior and acceptance](https://github.com/kellen-miller/venae-machinae/issues/6)
- [Define the plumbing MVP behavior and acceptance](https://github.com/kellen-miller/venae-machinae/issues/7)
- [Define operating states and flow overlays](https://github.com/kellen-miller/venae-machinae/issues/8)
- [Define local-first projects and versioned exchange](https://github.com/kellen-miller/venae-machinae/issues/9)
- [Define validation, uncertainty, and warning semantics](https://github.com/kellen-miller/venae-machinae/issues/10)
- [Choose the application architecture and delivery stack](https://github.com/kellen-miller/venae-machinae/issues/11)
- [Choose the product and repository name](https://github.com/kellen-miller/venae-machinae/issues/13)
- [Prototype synchronized dense project views](https://github.com/kellen-miller/venae-machinae/issues/17)
