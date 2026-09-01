Review of `prototypes/dense-project-views/PROTOTYPE.md` against the domain model in `CONTEXT.md`. Eight plan-changing findings; two are high severity and self-contradictory enough that the build would stall or produce an unanswerable comparison.

## Findings

### H1 — Reveal on Canvas contradicts the single stored viewport (HIGH)
**Location:** `PROTOTYPE.md:71` (shared state: "Canvas zoom and pan coordinates"), `PROTOTYPE.md:99` (task 4), `PROTOTYPE.md:129` (acceptance).
**Evidence:** Task 4 says "Reveal coolant line L-102 on the canvas and verify the prior viewport returns." The acceptance check says "Reveal on Canvas restores the exact stored zoom/pan and highlights the subject." Shared state holds exactly one zoom/pan value.
**Impact:** These are mutually exclusive. If Reveal pans/zooms to L-102 (its normal purpose — L-102 may be off-screen at the stored viewport), the single stored viewport is overwritten and "the prior viewport returns" is impossible. If Reveal instead restores the stored viewport, it may not show L-102 at all, failing "highlights the subject." Each variant author will resolve this differently, confounding the A/B/C comparison, and task 4 cannot pass as written.
**Fix:** Define Reveal semantics explicitly: Reveal saves the current viewport to a separate return slot, animates to frame the subject, and a Back/return action restores the saved viewport. Update shared state to include the return slot and rewrite acceptance to match ("Reveal frames the subject; return restores the pre-reveal viewport").

### H2 — No decision criteria: the review tasks verify function, not which variant wins (HIGH)
**Location:** `PROTOTYPE.md:91-104` (review tasks), `PROTOTYPE.md:124-138` (acceptance), `PROTOTYPE.md:140-148` (validation plan).
**Evidence:** All seven tasks and all acceptance checks are pass/fail and identical for A, B, and C. Nothing records comparative measures — action counts, context-loss events, reorientation cost, or a judgment rubric. The stated question is "which synchronized dense-view workflow…"
**Impact:** The validation plan can conclude "all three variants pass everything" and still leave the prototype's only question unanswered. This is the exact failure mode the artifact exists to avoid.
**Fix:** Add a per-task comparison rubric to the validation plan: count discrete actions per task, log every moment context (selection/state/viewport/filter) is lost or must be mentally reconstructed, and require a written per-variant verdict per task plus an overall recommendation with rationale. Add an acceptance check that the validation output includes a variant recommendation.

### M1 — "Without losing selection" is undefined when following relationships (MEDIUM)
**Location:** `PROTOTYPE.md:68` (single "Selected subject"), `PROTOTYPE.md:97-98` (task 3), `PROTOTYPE.md:101-102` (task 6), `PROTOTYPE.md:72` ("selected Finding").
**Evidence:** Task 3 follows pump → connector → Route → calculations → BOM → evidence → Findings "without losing selection," yet shared state holds one selected subject plus a separately selected Finding. Nothing says whether clicking a related row changes the selected subject, opens a preview, or pushes a breadcrumb stack; task 6's "trace back to the radiator" has the same ambiguity in reverse.
**Impact:** Selection-follow semantics is the core synchronization behavior being tested. Left undefined, each variant will implement a different model (replace vs. peek vs. stack), making "did selection survive?" unjudgeable and the variants incomparable.
**Fix:** Specify one shared rule, e.g.: activating a related item previews it without changing the selected subject; an explicit second action promotes it to the selection and records a breadcrumb; define how subject selection and Finding selection interact (selecting a Finding also focuses its subject or not). All variants must implement the same rule; only presentation differs.

### M2 — Seeded project omits entities the tasks and domain model require (MEDIUM)
**Location:** `PROTOTYPE.md:77-90` (seed), `PROTOTYPE.md:99` (task 4), `PROTOTYPE.md:100` (task 5); `CONTEXT.md:80-93, 110-119`.
**Evidence:** The domain model defines Electrical Circuit as a grouping of Electrical Nets, and Flow Path as a directed traversal *derived* from Component Behaviors per Operating State. The seed lists "Wires, Circuit, Route, Harness, Bundle" but no Electrical Net, no Junction, and no Component Behaviors or Behavior Roles for the pump/thermostat/relay/fan. Task 4 references "coolant line L-102," an identifier defined nowhere.
**Impact:** Task 5 (Run Hot temperature/direction, Key Off compare) cannot be data-driven without seeded Component Behaviors — direction would be hardcoded per drawing, which stops testing the "dense views are projections of canonical data" precondition. The Circuits & Lines view can't demonstrate the Circuit→Net→Wire structure. Task 4 references an entity the seed doesn't contain.
**Fix:** Extend the seed to enumerate: named Electrical Nets under the Circuit, at least one Junction, Behavior Roles per Component (pump, valve/thermostat, heat exchanger, switch/relay, source, load) with per-Operating-State behavior, and stable IDs for every subject the tasks reference (including L-102).

### M3 — Variants B and C don't map the ten required views to concrete presentations (MEDIUM)
**Location:** `PROTOTYPE.md:40-49` (B), `PROTOTYPE.md:51-61` (C), vs. `PROTOTYPE.md:30-33` (A's explicit view list).
**Evidence:** A enumerates all eleven destinations. B claims "domain, lifecycle, and engineering lenses pivot the same rows and columns," and C has an unspecified "vertical view launcher." Neither states how Routes (ordered Segment traversals), Harnesses (assemblies), Calculations (formula + inputs + envelope), or State Compare (two-state diff) appear as matrix pivots or lenses.
**Impact:** Routes and State Compare are structurally not row/column pivots of an entity matrix. If B silently escapes its metaphor into bespoke sub-views for tasks 4–6, it converges toward A and the "three structurally different variants" constraint is only nominally met — the comparison becomes noise.
**Fix:** Before build, add a coverage table mapping each of the ten dense capabilities to its concrete presentation in A, B, and C, and add an acceptance check that no variant borrows another variant's structure for any of the seven tasks.

### M4 — URL-driven variant switching conflicts with in-memory-only state (MEDIUM)
**Location:** `PROTOTYPE.md:13-14` ("switch through `?variant=A`"), `PROTOTYPE.md:74-75` ("Variant switching preserves it and updates the URL"), `PROTOTYPE.md:127` (acceptance), `PROTOTYPE.md:152-153` (no persistence).
**Evidence:** On a dependency-free static page, navigating to a new `?variant=` URL reloads the document and destroys the in-memory state object. Preserving state across a real URL navigation requires serializing it (URL or storage), which the no-persistence constraint forbids.
**Impact:** The acceptance check "URL and keyboard variant switching preserve shared in-memory state" is unimplementable under one reading and trivially different under the other; validators can't tell pass from fail, and a builder may reach for localStorage, violating the constraint.
**Fix:** Specify the mechanism: in-page switching uses `history.replaceState` (no reload, memory preserved); a cold load of any `?variant=` URL reseeds defaults, and that is explicitly acceptable. Reword the acceptance check accordingly.

### M5 — Desktop "editing" scope is undefined and contradicts the non-goals (MEDIUM)
**Location:** `PROTOTYPE.md:107` ("Desktop: complete editing-oriented prototype workflow"), `PROTOTYPE.md:112-113` (mobile excludes "Add, Connect, Route, acknowledgement, suppression, applicability, or validation-run"), `PROTOTYPE.md:155` (non-goal: no "real project mutation").
**Evidence:** The only place editing actions are named is the mobile exclusion list. No variant description, review task, required state, or acceptance check defines any desktop editing interaction, while non-goals prohibit project mutation.
**Impact:** Builders must guess whether to implement Add/Connect/Route/Finding-acknowledgement flows (large scope) or nothing (making "editing-oriented" and the mobile exclusion list meaningless). Either guess changes implementation and validation substantially.
**Fix:** Enumerate the exact mutation affordances desktop presents (even if they only mutate the in-memory seed), state that they exist to test dense-view synchronization of edits, and add one review task exercising an edit (e.g., acknowledge a Finding and watch it synchronize across projections). Or explicitly declare all editing chrome non-functional/stubbed and delete the implication of a "complete editing-oriented workflow."

### M6 — Mobile has no executable validation and canvas presence is unstated (MEDIUM)
**Location:** `PROTOTYPE.md:111-113` (mobile = subject stream + detail sheet), `PROTOTYPE.md:143-144` (validation: render at 390×844; "Execute the seven review tasks in every variant").
**Evidence:** Tasks 1 and 4 require the canvas; the mobile spec replaces navigation chrome with a stream and sheet and never says whether a read-only canvas exists on mobile. The validation plan only "renders" mobile — no mobile task list.
**Impact:** Mobile read-only is a stated product constraint, but the plan cannot demonstrate whether a hobbyist can actually review the project (see topology, Findings, Operating State) on a phone; "renders without overflow" will pass vacuously. Also ambiguous whether "execute the seven tasks in every variant" includes the mobile viewport, where it's impossible.
**Fix:** State whether mobile includes a read-only canvas/topology view. Define a mobile task subset (e.g., find the water pump via search, read its evidence and Findings, view Run Hot values) and scope the seven full tasks to desktop/tablet explicitly.

## Summary

The plan is strong on data-authority framing (projections, not copies), required states, and A's information architecture. What blocks the build is that its two central promises — viewport-preserving reveal and a decision among three variants — are respectively self-contradictory (H1) and unmeasured (H2), and the shared semantics that make variants comparable (selection-follow, seed completeness, view coverage, URL behavior, editing scope) are underspecified enough that three builders would produce three incomparable artifacts.

---ADVERSARIAL_REVIEW_STATUS---
AUTHOR_PROVIDER: OpenAI
REVIEWER_PROVIDER: Anthropic
REVIEWER_MODEL: claude-fable-5
INDEPENDENCE: cross_provider
ISSUES_FOUND: 8
CRITICAL_COUNT: 0
HIGH_COUNT: 2
MEDIUM_COUNT: 6
LOW_COUNT: 0
CONFIDENCE: HIGH
BLOCKING: true
SUMMARY: Reveal-viewport spec self-contradicts and no comparative criteria exist to pick a variant; six semantics gaps would make the three builds incomparable.
---END_ADVERSARIAL_REVIEW_STATUS---
