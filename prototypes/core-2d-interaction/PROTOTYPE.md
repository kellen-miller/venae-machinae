# Core 2D Interaction Prototype

> THROWAWAY PROTOTYPE: this artifact answers an interaction-design question. It
> is not production architecture or implementation.

## Question

Which topology-first 2D workflow makes components, ports, connections, routes,
lengths, properties, warnings, and operating-state overlays feel faster and
clearer than CAD or spreadsheets?

Three structurally different variants share one seeded RX-7 project and are
switchable with `?variant=A`, `?variant=B`, or `?variant=C`. Switching uses
`history.replaceState` over one shared state object, so edits survive.

Run from the repository root with `pnpm prototype`, then open
`http://localhost:4173/?variant=A`.

## Shape

This is a new top-level product surface with no existing application host, so
the prototype uses the UI skill's sub-shape B: one dependency-free static route.

### A — Systems Workbench

- Direct-manipulation canvas is primary.
- Project/system tree and part shelf remain visible on the left.
- Selection inspector and validation stay visible on the right.
- Hypothesis: persistent context and inspector density make repeated expert
  editing faster than progressive disclosure.

### B — Guided Build

- A visible Add → Connect → Route → Verify sequence is primary.
- One contextual task panel replaces the permanent inspector.
- The canvas remains visible but progressively discloses engineering detail.
- Hypothesis: a guided sequence reduces domain and tool-mode confusion enough
  to outweigh the extra steps.

### C — Trace Lens

- Full-bleed vehicle canvas and search/command bar are primary.
- System, operating-state, and warning lenses replace permanent sidebars.
- A vertical floating inspector carries selection properties, Ports, provenance,
  and findings without shrinking the canvas.
- The grid, floating controls, and zoom affordance establish an infinite-canvas
  model; the scaled vehicle background is content within that space.
- Hypothesis: a canvas-first command-and-lens workflow makes authoring and
  tracing feel like one continuous task without permanent chrome.

## Validated direction

- Use C's canvas-first, floating-panel composition as the product baseline.
- Preserve A's information depth inside the vertical contextual inspector.
- Preserve B's explicit wire, coolant-hose, temperature, direction, and unknown
  legend as a floating canvas key.
- Keep the canvas focused on spatial design. Dense tables, BOMs, audit views,
  and other information-heavy representations belong in separate synchronized
  project views.
- Treat the editor as an infinite pan-and-zoom canvas in the manner of drawing
  tools such as Excalidraw, rather than as a fixed vehicle diagram.
- The revised physical connection language was accepted: solid insulated
  wires, tubular temperature-aware hoses, inline direction, and Port snapping.

## Common review task

Perform the same sequence in every variant:

1. Add an auxiliary fan relay from the seeded Part shelf.
2. Connect relay output to the fan's positive Port.
3. Route the new Wire through the shared right-front bay Segment.
4. Inspect the Segment breakdown and resulting Route Length.
5. Find the illustrative unknown terminal Compatibility Assessment.
6. Switch from Key Off to Run Hot and trace fan power plus coolant direction.
7. Inspect the conflicting radiator-outlet temperature evidence.

Favor A if repeated editing and comparison are clearly fastest, B if the user
rarely loses context despite less persistent detail, or C if command/lens
interactions remain discoverable while preserving the strongest tracing view.
The final answer may deliberately combine named parts of the variants.

## Shared prototype state

- Seeded electrical and coolant topology: battery, fuse, relay, ECU, fan,
  electric water pump, thermostat, radiator, reservoir, Junctions, Ports,
  Wires, Fluid Lines, Routes, and a cross-System shared Segment.
- Seeded Operating States are Key Off and Run Hot. Per-state direction and
  temperature annotations are fixture data, not computed simulation.
- Seeded evidence includes an unknown terminal Compatibility Assessment, an
  unknown fitting loss, conflicting radiator-outlet temperatures, and an
  illustrative route-clearance warning with a visible subject.
- Selected System, Operating State, tool mode, selected Component, visible
  Overlay, warning count, and selection are always visible in a compact status
  strip. Full state is inspectable within one interaction.
- Components and Ports are focusable/selectable; tool buttons change mode;
  state and System controls change the visible topology and Overlay.
- Run-hot shows direction and temperature evidence without implying simulated
  values between known points.
- Connect targets Ports. Route inspection lists constituent Segments and their
  lengths rather than presenting a fabricated scalar.
- Add/Connect/Route actions change shared in-memory prototype state only.

## Visual direction

- Technical notebook meets motorsport instrument panel, not enterprise CAD.
- Warm paper, ink, oxidized copper, coolant teal, and temperature amber/red.
- Strong hierarchy, restrained borders, readable dense data, and no generic
  card-grid dashboard.
- Wires use a narrow insulated conductor treatment. Fluid Lines use a wider
  hose wall, liquid core, and endpoint couplings. Neither uses a dotted-line
  substitute for its physical character.
- Direction uses restrained inline motion and explicit labels, not oversized
  arrowheads. Coolant cores use segment-level cool, warm, hot, or conflicting
  evidence colors without implying interpolation.
- Every Connection endpoint is derived from its rendered Port center after
  layout, making port snapping explicit across variants and viewport sizes.
- Every viewport carries a persistent “Prototype — illustrative data, not
  engineering guidance” marker; seeded warnings say they are illustrative.

## Live feedback constraints

- Production implementation uses Svelte and SvelteKit. React is excluded.
- Wires and pipes must be visually distinct before reading their labels.
- Connection geometry terminates at explicit component Ports.

## Product boundaries represented

- Desktop-first editing. On tablet, A collapses the library, B keeps its step
  rail and drawers the task panel, and C narrows its vertical floating inspector.
- Mobile presents a read-only review state with Add, Connect, and Route removed;
  C reduces the inspector to a non-overlapping bottom selection summary.
- Canvas nodes support keyboard focus and selection. Pointer Connect and Route
  mechanics are explicitly out of scope for keyboard parity in this prototype.
- Unknown and conflicting evidence stay visually distinct from warnings and
  structural errors.
- Overlay is read-only; editing always targets source topology or values.
- No persistence, collaboration, auth, catalog, 3D, or simulation behavior.

## Acceptance checks

- Three genuinely different layouts on one URL with a floating variant switcher.
- URL-stable and keyboard-accessible switching preserves in-memory edits.
- Required state is inspectable within one interaction in every variant; the
  compact System/state/tool/selection/warning strip remains visible.
- Component selection, tool modes, System filter, and Operating State work.
- Every Connection exposes two Ports and its domain. Route inspection exposes
  its Segment breakdown and Route Length.
- Warning rows expose their subject. The seeded unknown compatibility, unknown
  loss, and conflicting temperature values remain distinct and inspectable.
- Electrical and fluid direction and temperature evidence are legible without
  relying on color or suggesting interpolation.
- Desktop, tablet, and mobile read-only layouts render without overlap.
- Mobile hides editing affordances; representative touch controls are at least
  44×44 pixels.
- The prototype disclaimer remains visible and warnings remain illustrative.
- No console errors and no network dependencies.

## Validation plan

- Render A, B, and C at 1440×900 and 1024×768.
- Render the read-only state at 390×844.
- Run the common review task in each variant and confirm shared edits survive
  switching.
- Exercise mouse and keyboard variant switching, node selection, tool modes,
  System, and Operating State; document pointer-only Connect/Route.
- Verify each named tablet compression, mobile editing suppression, and
  representative 44-pixel touch targets.
- Inspect DOM semantics, focus visibility, console output, and horizontal
  overflow.
