# MVP-GATE-002 per-path shadow-filter failure

- Scope: non-authoritative local failure on a modern development host
- Supersedes: `MVP-GATE-002-unculled-svg-failure`
- Fixture: schema-v1 renderer-capacity Project Documents at exact 1x, 2x, and 5x counts
- Selected adapter: app-owned raw SVG with viewport culling and semantic pagination
- Command: `PLAYWRIGHT_PORT=4174 pnpm exec playwright test tests/gates/graph-capacity-browser.spec.ts --project=chromium --reporter=list`
- Machine record: `evidence/gates/raw/MVP-GATE-002-shadow-filter-failure.json`
- Verdict: Fail

Viewport culling and accessible semantic pagination reduced the DOM from as many as 171,653
elements to 2,851 without changing the Project Document or full renderer projection. Pointer,
drag, route-edit, and snapshot timings met their bounds. Pan and zoom remained only 34–39 fps
at 1x/2x while the physical inner and fluid outer paths retained per-path SVG drop-shadow
filters.

Remove those per-path filters, which force costly paint during every transformed frame. Keep
the physical double strokes, node shadow geometry, exact Port-center paths, and Overlay
channels. This record is immutable and cannot become the canonical Pass record.
