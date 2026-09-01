# MVP-GATE-001 baseline — Renderer fit

- Record: `MVP-GATE-001-baseline`
- Machine record: `evidence/gates/MVP-GATE-001-baseline.json`
- Raw browser results: `evidence/gates/raw/MVP-GATE-001-browser-results.json`
- Rejected-candidate record: `evidence/gates/raw/MVP-GATE-001-xyflow-failure.md`
- Frontend review: `evidence/frontend/MVP-GATE-001-review.md`
- Fixture: `tests/fixtures/renderer-projection.ts`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:renderer`
- Result: Pass

The provisional `@xyflow/svelte` 1.6.6 candidate failed the locked production
CSP because it depends on runtime inline styles and its tested source geometry
terminated at the outside of an 18 px Handle, nine pixels from the Port center.
The gate did not weaken CSP or reinterpret center snapping.

The bounded raw-SVG candidate passed the unchanged app-owned projection and
intent interface. Chromium, Firefox, and WebKit measured at most 0.0042 px from
the exact Port center while preserving three routed points, wire/hose physical
language, four additive Overlay channels, two synchronized lenses, and keyboard
connection and route alternatives. All three desktop/tablet/mobile layouts had
no horizontal overflow; axe-core reported no serious or critical violations.

Bounded decision: promote only `src/lib/renderer/svg/`, remove the provisional
dependency and losing candidate, and keep `TopologyRenderer.svelte` isolated
behind app-owned records and callbacks. This gate does not prove 1x/2x/5x graph
capacity; `MVP-GATE-002` remains responsible for that measurement.
