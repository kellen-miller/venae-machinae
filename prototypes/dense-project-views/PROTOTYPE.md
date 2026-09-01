# Dense Project Views Prototype

> THROWAWAY PROTOTYPE: this artifact answers an interaction-design question. It
> is not production architecture or implementation.

## Question

Which synchronized dense-view workflow lets a hobbyist move between spatial
design and project data without losing the selected subject, project scope,
operating state, filters, or canvas viewport?

Three structurally different variants share one seeded RX-7 project and one
in-memory state object. They live on a dependency-free static route and switch
through `?variant=A`, `?variant=B`, or `?variant=C`.

In-page switching uses `history.replaceState`, so it changes the shareable URL
without reloading or losing memory. A cold load of any variant URL deliberately
reseeds fixture defaults.

## Preconditions

- The earlier core-interaction decision remains authoritative: an effectively
  infinite canvas, floating vertical inspector, explicit Port snapping,
  distinct wire and hose rendering, and temperature-aware directional flow.
- Dense views are synchronized projections of canonical project data, never
  separate editable copies.
- Production remains Svelte/SvelteKit with React excluded. This framework-free
  prototype does not select production architecture.

## Variants

### A — View Rail

- A persistent left rail organizes Canvas, Systems, Circuits & Lines,
  Interfaces, Routes, Harnesses, Calculations, Evidence, BOM, Findings, and
  State Compare.
- Each selection owns the full central workspace; dense views never split or
  resize the canvas.
- A persistent right inspector, context strip, and selection breadcrumb keep
  project state visible across view replacement.
- Hypothesis: explicit information architecture and stable screen regions make
  a large project easiest to learn and revisit.

### B — Context Matrix

- One dense matrix is primary. Domain, lifecycle, and engineering lenses pivot
  the same rows and columns instead of presenting many separate destinations.
- A compact spatial preview and Reveal on Canvas action preserve topology
  orientation while the matrix owns the workspace.
- The selected subject opens a bottom detail tray with related topology,
  evidence, BOM, calculations, and Findings.
- Hypothesis: entity-first pivoting reduces navigation overhead for spreadsheet
  users without duplicating authoritative data.

### C — Lens Stack

- The full-bleed canvas remains primary, with Excalidraw-like floating controls
  and a vertical view launcher.
- Dense views open as focused workspace lenses layered over the retained canvas
  state. They may be full-screen or peek-sized, but never mutate canvas
  geometry or viewport.
- A vertical floating inspector carries the earlier accepted information depth;
  a selection ribbon and Back to Canvas action preserve continuity.
- Hypothesis: canvas-first lenses best combine spatial design with deep project
  review while keeping authoring and inspection distinct.

## Dense capability coverage

| Capability | A — View Rail | B — Context Matrix | C — Lens Stack |
| --- | --- | --- | --- |
| Canvas | Full workspace destination | Spatial preview plus full-canvas reveal | Default full-bleed workspace |
| Systems | Dedicated grouped table | Domain pivot and group rows | System lens |
| Circuits & Lines | Circuit → Net → Connection hierarchy | Connection rows pivoted by topology | Topology lens |
| Interfaces | Dedicated mate/Port compatibility table | Interface columns and compatibility pivot | Interface lens |
| Routes | Route → Segment detail workspace | Route rows with expandable Segment sequence | Route lens |
| Harnesses & Bundles | Assembly tree and build summary | Assembly pivot with construction columns | Build lens |
| Calculations | Formula/input/result table | Engineering pivot | Calculation lens |
| Evidence | Provenance ledger | Evidence pivot | Evidence lens |
| BOM | Dedicated grouped BOM | Build pivot with quantity columns | BOM lens |
| Findings | Review queue | Validation pivot | Findings lens |
| State Compare | Side-by-side state workspace | State-difference columns | Compare lens over retained topology |

B must remain one pivotable matrix, including nested Route Segments and state
difference columns. C must remain one canvas with focused lenses. Neither may
fall back to A's destination-page composition during the review tasks.

## Shared prototype state

- Current variant and view.
- Project scope and domain filter.
- Operating State and comparison state.
- Selected subject and its canonical identity.
- Dense-view filter and sort.
- Canvas zoom and pan coordinates plus a separate pre-reveal return viewport.
- Inspector/lens visibility.
- Active Findings count and selected Finding.
- Finding disposition and per-variant review measurements.

All variants expose this state in a persistent context strip and a one-action
state inspector. Variant switching preserves it and updates the URL.

**Selection rule:** one primary subject persists across projections. Activating
a related row previews it without changing that subject. An explicit **Follow**
action promotes the preview and pushes the prior subject onto a breadcrumb
stack. Selecting a Finding previews its subject; **Follow subject** promotes it.

**Reveal rule:** **Reveal on Canvas** saves the current viewport into the return
slot, frames and highlights the requested subject, and exposes **Return to prior
viewport**. Return restores the exact saved zoom and pan without changing the
primary subject.

## Seeded project

- Electrical: battery, main fuse, fan relay, ECU, radiator fan, electric water
  pump, Wires, Circuit `C-FAN`, Nets `N-BATT` and `N-FAN`, Junction `J-GND`,
  Route `R-RF`, Harness `H-ENGINE`, Bundle `B-RF`, and connector terminals.
- Coolant: water pump, thermostat, radiator, reservoir, Fluid Lines, fittings,
  Flow Paths, and temperature evidence. Stable fixtures include Fluid Line
  `L-102` and Wire `W-003`.
- Cross-domain subjects: radiator fan and water pump.
- Component Behavior fixtures declare source, load, switch, pump, valve, and
  heat-exchanger roles. Key Off and Run Hot bindings explicitly determine the
  derived Electrical Net activity and Flow Paths shown by every projection.
- Operating States: Key Off and Run Hot; Compare adds Key Off as reference.
- Evidence: sourced values, user-entered values, one conflicting radiator
  outlet temperature, one unknown terminal compatibility, and one stale route
  measurement.
- Findings: conductor capacity Warning, missing route evidence Caution,
  conflicting temperature Warning, and one passing informational screen.

## Review tasks

Perform the same tasks in all variants:

1. Select the electric water pump on the canvas.
2. Open Circuits & Lines and locate every connected Wire and Fluid Line.
3. Follow the pump to its connector/fittings, Route, calculations, BOM rows,
   engineering evidence, and Findings without losing selection.
4. Reveal coolant line L-102 on the canvas and verify the prior viewport returns.
5. Switch to Run Hot and inspect temperature/direction, then compare Key Off.
6. Filter to unresolved Findings and trace the conflicting radiator-outlet
   evidence back to the radiator.
7. Clear the selection and judge the empty-selection guidance.
8. Acknowledge the conductor-capacity Warning with a fixture rationale and
   verify its disposition synchronizes across the matrix, inspector, Findings,
   context strip, and mobile review while its severity/lifecycle do not change.

Tasks 1–8 run on desktop and tablet. A built-in comparison recorder counts
discrete actions from task start, lets the reviewer mark context-loss and
reorientation events, and retains a short verdict per variant. Resolution
requires a written per-variant verdict and overall recommendation; raw feature
parity alone cannot select a winner.

## Responsive behavior

- **Desktop:** complete navigation/review workflow plus one explicit in-memory
  mutation: acknowledging the seeded conductor-capacity Warning with a fixture
  rationale. Add, Connect, Route, evidence editing, suppression, applicability,
  and validation runs are outside this prototype.
- **Tablet:** View Rail collapses to icons, Context Matrix moves subject detail
  into a drawer, and Lens Stack uses a full-screen dense lens. Canvas viewport
  state remains unchanged.
- **Mobile:** read-only project review only. A searchable subject stream and
  compact detail sheet accompany a read-only topology view. No Add, Connect,
  Route, acknowledgement, suppression, applicability, or validation-run action.

Mobile validation uses a separate subset: find the water pump through search,
open its read-only topology context, inspect Run Hot values and direction, read
its evidence and Findings, and confirm an acknowledgement made on desktop is
visible without exposing a mutation action.

## Required states

- Populated dense data and high-information selected-subject state.
- No selection, no result for a filter, and an unavailable/unsupported result.
- Stale, Unknown, conflicting, passing, and active-Finding evidence.
- Read-only mobile state and compact tablet navigation.
- Visible focus, keyboard navigation, text/symbol severity, and non-color
  domain distinctions.

## Validated direction

- Use Variant C's canvas-first Lens Stack as the baseline. Dense work opens
  above the retained canvas and never resizes or replaces its geometry.
- Carry Variant A's explicit labels into the floating desktop view launcher;
  collapse them to recognizable icons and titles at tablet width.
- Retain Variant B's Context Matrix as an optional power view inside the Lens
  Stack, not as primary navigation or a twelfth canonical project view.
- Share selection, preview, filters, operating state, and viewport across every
  projection. Preview never changes primary selection without Follow, while
  Reveal and Return preserve the exact prior view, presentation, zoom, and pan.
- Keep mobile read-only for topology, subjects, evidence, and Findings review.
- Implement production in Svelte/SvelteKit with no React. Rewrite this
  dependency-free throwaway prototype around production domain boundaries;
  do not promote its fixture state or direct DOM rendering into the app.

## Acceptance checks

- Three genuinely different layouts share one URL and floating switcher.
- In-page URL and Alt+Arrow keyboard variant switching preserve shared
  in-memory state; a cold URL load deliberately reseeds defaults.
- Selection made in any projection synchronizes everywhere.
- Reveal is enabled only for canvas-representable subjects, frames and
  highlights them, and Return restores the exact pre-reveal presentation, zoom,
  and pan from its separate return slot.
- Dense views do not maintain editable copies or imply conflicting authority.
- Wires and Fluid Lines remain visually distinct and terminate at explicit Ports.
- Each dense row can reach its subject, evidence, calculation, BOM, and Finding
  relationships within two actions.
- All eleven capabilities use the variant-specific presentation in the coverage
  table; B and C do not silently borrow A's destination layout.
- Desktop and tablet avoid horizontal page overflow and panel collisions.
- Mobile exposes no editing or validation mutation and maintains 44 px targets.
- Empty, no-results, unsupported, stale, Unknown, conflict, pass, and active
  Finding states are inspectable.
- No console errors, invalid links, or network dependencies.
- Validation output records action/context-loss/reorientation measures,
  per-variant verdicts, and an overall recommendation.

## Validation plan

- Render A, B, and C at 1440×900 and 1024×768.
- Render the shared mobile read-only state at 390×844.
- Execute the eight desktop/tablet review tasks in every variant and the mobile
  review subset once against the shared mobile presentation.
- Exercise mouse and keyboard variant switching, view navigation, row/canvas
  selection, filtering, state comparison, and Reveal on Canvas.
- Inspect DOM semantics, focus visibility, touch-target size, console output,
  invalid paths, and horizontal overflow.
- Record action count, context-loss events, reorientation events, and a written
  verdict for every variant/task combination; conclude with a recommendation.

## Non-goals

- Production component boundaries or framework selection.
- Persistence, collaboration, authentication, live telemetry, catalogs, or
  simulation.
- Building every production field or permitting real project mutation.
