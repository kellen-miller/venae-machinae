# MVP-GATE-002 unculled raw-SVG failure

- Scope: non-authoritative local failure on a modern development host
- Fixture: schema-v1 renderer-capacity Project Documents at exact 1x, 2x, and 5x counts
- Selected adapter: app-owned raw SVG
- Command: `PLAYWRIGHT_PORT=4174 pnpm exec playwright test tests/gates/graph-capacity-browser.spec.ts --project=chromium --reporter=list`
- Machine record: `evidence/gates/raw/MVP-GATE-002-unculled-svg-failure.json`
- Verdict: Fail

The renderer preserved every Component, Port, Connection, endpoint, physical kind, route,
Overlay, and structural fingerprint. Snapshot-to-interactive paint stayed below two seconds
at 1x and 2x. Rendering the complete SVG and complete semantic map created 34,373 DOM
elements at 1x, 68,693 at 2x, and 171,653 at 5x. Pointer feedback exceeded 100 ms at 2x
and 5x; pan/zoom fell below the locked frame targets at every scale.

The failure is bounded to presentation volume. Keep the selected adapter and app-owned
projection/intent seams. Cull SVG geometry to the live viewport and paginate the accessible
semantic lens, then rerun the unchanged fixture counts and thresholds. This record is
immutable and cannot become the canonical Pass record.
