Review complete. The agreed direction is faithfully implemented at the happy path — C is the baseline with a retained canvas under lenses, A's labels are in C's launcher (icons at tablet), B survives only as a labeled "Optional power view," preview/Follow and Reveal/Return semantics are correct in code, mobile is read-only, and there is zero production-architecture commitment (no framework, no deps, python http.server only). But two High findings contradict the "0 findings, fully validated" status report.

## Findings

### 1. HIGH — Context Matrix validation lens fabricates per-row data; disposition "sync" is a hardcoded hack

**Location:** `prototypes/dense-project-views/app.js:656` (indexes `validation: [2, 9, 9, 0, 7]`) and `app.js:663` (`index === 0 ? h(state.findingDispositions["finding-wire"] ?? "unreviewed") : …`).

**Evidence:** The validation lens columns are `["Subject", "Finding", "Severity", "Disposition", "Coverage"]`, but index 9 is used for both Finding and Severity (identical cell content twice), and the Disposition column ignores the row entirely and prints F-001's disposition for all eight matrix rows.

**Impact:** After task 8's acknowledgement, every row — including the pump ("0 active") and the radiator (whose F-003 is unreviewed) — reads "acknowledged." The task-8 acceptance criterion "disposition synchronizes across the matrix" appears to pass only because one finding's state is stamped onto unrelated subjects. This is incorrect state semantics in exactly the synchronization behavior the prototype exists to validate, and it falsifies the status report's zero-findings claim.

**Fix:** Derive severity/disposition per row (map row id → its finding id, e.g. `wire-fan → finding-wire`, `radiator → finding-temp`, `route-rf → finding-route`, else "—") and give Severity its own data index.

### 2. HIGH — Task 8 (acknowledge F-001) is impossible in Variant C at tablet width

**Location:** `styles.css:1822` (`.c-stage:has(.lens-backdrop) > .inspector.floating { display: none; }`), `app.js:792-801` (`setView` clears `selectedFinding`), `app.js:619` (ack control lives only in the inspector).

**Evidence:** At ≤1120px, opening any lens or the Context Matrix hides C's floating inspector — the only place the rationale input and "Acknowledge Finding" button render. Previewing F-001 in the Findings lens sets `selectedFinding` but the inspector is hidden; closing the lens (`data-view="canvas"`) clears `selectedFinding`, so the ack UI never becomes reachable.

**Impact:** PROTOTYPE.md requires "Tasks 1–8 run on desktop and tablet." The baseline variant cannot complete task 8 on tablet, and the browser evidence (which validated tablet icon collapse and matrix return, but evidently not task 8 at 1024×768 in C) doesn't cover this gap.

**Fix:** At tablet, keep the inspector reachable while a lens is open (bottom sheet or toggle), or render the finding-detail/ack section inside the Findings lens itself.

### 3. MEDIUM — Filter pills are a no-op in the Context Matrix, and the matrix has no empty state

**Location:** `app.js:658-661` (`renderMatrixTable` filters by `state.query` only), `app.js:677` (Variant B renders `renderDenseHeader()`, which includes the filter bar).

**Evidence:** Variant B's matrix workspace shows the same filter pills as A/C and the context strip reports the active filter, but `state.filter` is never applied to `matrixRows`. A query matching nothing yields headers over an empty tbody — the `empty-state` branch exists only in `renderTable`.

**Impact:** Task 6 ("filter to unresolved Findings") silently does nothing in B, and in C's matrix a filter set earlier in a lens is advertised in the context strip while ignored — the shared-filter-state direction item is visibly broken in one projection. The acceptance check "no result for a filter" state is not inspectable in the matrix.

**Fix:** Run `filterRows(matrixRows)` and reuse the empty-state branch in `renderMatrixTable`.

### 4. MEDIUM — Reveal violates its own rule for most subjects: no framing, no highlight, but it still consumes the return slot

**Location:** `app.js:831-837` (frames dict covers only `pump`, `line-102`, `radiator`, `wire-fan`; fallback `{zoom: 100, panX: 0, panY: 0}`).

**Evidence:** Every dense row exposes a Reveal button (`app.js:582`), including `route-rf`, `N-FAN`, `H-ENGINE`, `EV-014`, `CALC-102`, etc. For those, Reveal jumps the viewport to a generic default (not the subject), and since no canvas element carries a matching `data-select`, the `.selected` highlight never applies — yet the return viewport/view are saved and the Return button appears as if a reveal occurred.

**Impact:** The shared Reveal rule ("frames and highlights the requested subject") — a core direction item — only holds for four fixture ids. The collected evidence tested exactly the framed pair (L-102 → thermostat/radiator) so the gap is invisible in the validation record.

**Fix:** Either restrict Reveal buttons to canvas-representable subjects (hide/disable elsewhere) or extend frames + canvas highlight targets to every revealable id.

### 5. MEDIUM — B's mandated matrix capabilities are missing: no nested Route Segments, no state-difference columns

**Location:** `app.js:310-319` (`matrixRows`), vs `PROTOTYPE.md:83-85` ("B must remain one pivotable matrix, including nested Route Segments and state difference columns").

**Evidence:** `route-rf` is a flat row ("3 Segments" as text, no expansion); Key Off/Run Hot difference data exists only in `rowsByView.compare`, which B's matrix never uses — selecting "State Compare" in B's capability bar just shows the engineering lens of the same 8 rows.

**Impact:** B under-delivers its spec'd structure, weakening the comparison that produced the validated direction; matters less now that B is demoted to a power view, but implementation-status claims full compliance at zero findings.

**Fix:** Note the scope cut explicitly in PROTOTYPE.md/status, or add a Segment-expansion row and a compare lens with Key Off / Run Hot columns.

### 6. LOW — Key Off leaves Run Hot artifacts on the canvas

**Location:** `app.js:519` (hose class `hot` is static), `app.js:538` (label "94 °C · →" static); only `.flow-streak` is hidden (`styles.css:525`).

**Evidence:** Compare data says Key Off = "No direction" for L-102, yet in Key Off the hose stays hot-colored with a temperature-plus-direction label.

**Impact:** The visually-primary surface contradicts the "operating state determines derived activity in every projection" precondition; the state note admits "no active direction" while the label shows one.

**Fix:** Gate the `hot` class and the direction/temperature label on `state.operatingState`.

### 7. LOW — Selectable canvas fixtures without subject data

**Location:** `app.js:524` (`data-select="line-101"`), `app.js:535` (`fuse`), fallback at `app.js:385-397`.

**Evidence:** Clicking the cool hose or Main fuse selects a placeholder; context strip and inspector show "line-101 · line-101" / "fuse · fuse," "Fixture subject."

**Fix:** Add minimal subject entries for `line-101` and `fuse`.

### 8. LOW — Findings count inconsistent with Findings view

**Location:** `app.js:403-405` (`activeFindings()` counts `findingDispositions` keys = always 3), `app.js:283-288` (four rows, all lifecycle "Active" including F-008).

**Impact:** Context strip says "3 active" while the Findings projection shows four Active rows — a small authority mismatch between projections.

**Fix:** Count from the findings fixture (or exclude informational explicitly and label the count).

### 9. LOW — Context Matrix is enumerated inside the "Project views" nav; global arrow-key hijack

**Location:** `app.js:456-463` (matrix button inside `nav aria-label="Project views"`), `app.js:975-981` (document-level ArrowLeft/Right switch variants).

**Evidence:** Visually the matrix button is separated and captioned "Optional power view," and state keeps it as an overlay boolean (canonical view anchor preserved — faithful to the decision), but assistive tech enumerates it as a twelfth item of the views nav. Separately, arrow keys anywhere outside text controls switch variants, stealing arrows from focused canvas role-buttons and scrollable tables.

**Fix:** Move the matrix button after the nav (own labeled group); scope variant-switch keys (e.g. require modifier or `[`/`]`).

## Verdict

Direction fidelity is good: all eight agreed points are structurally present and the happy-path browser evidence is consistent with what the code does. What fails is robustness and the zero-findings validation claim: the matrix validation lens shows wrong data by construction (the very sync being validated), task 8 is unreachable in the baseline variant on tablet, and Reveal/filter guarantees only hold for the specific fixtures the evidence exercised.

---ADVERSARIAL_REVIEW_STATUS---
AUTHOR_PROVIDER: OpenAI
REVIEWER_PROVIDER: Anthropic
REVIEWER_MODEL: claude-fable-5
INDEPENDENCE: cross_provider
ISSUES_FOUND: 9
CRITICAL_COUNT: 0
HIGH_COUNT: 2
MEDIUM_COUNT: 3
LOW_COUNT: 4
CONFIDENCE: HIGH
BLOCKING: true
SUMMARY: Direction faithfully implemented at happy path, but matrix validation-lens data is fabricated per-row and task 8 is impossible in Variant C tablet, contradicting the zero-findings validation claim.
---END_ADVERSARIAL_REVIEW_STATUS---
