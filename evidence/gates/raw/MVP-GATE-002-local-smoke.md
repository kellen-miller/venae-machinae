# MVP-GATE-002 local capacity smoke

- Scope: non-authoritative modern development host
- Fixture: schema-v1 renderer-capacity Project Documents at exact 1x, 2x, and 5x counts
- Selected adapter: app-owned raw SVG with viewport culling and semantic pagination
- Command: `PLAYWRIGHT_PORT=4174 pnpm exec playwright test tests/gates/graph-capacity-browser.spec.ts --project=chromium --reporter=list`
- Machine record: `evidence/gates/raw/MVP-GATE-002-local-smoke.json`
- Result: Provisional Pass

The local run preserved exact Project and renderer identities, endpoint references, physical
kinds, Routes, labels, and Overlay counts at 1x, 2x, and 5x. The complete projection remains
available to the app-owned interface while the initial SVG viewport renders 20 Nodes and 94
Connections; the semantic lens exposes every record through keyboard-operable pagination.

All three scales measured 60 fps for pan and zoom. Pointer feedback measured 13.5 ms,
21.8 ms, and 50.9 ms. The 1x/2x snapshot-to-interactive measurements were 48.9 ms and
32.2 ms. Retained Chromium JS heap after interaction and forced collection measured 17.4 MB,
26.7 MB, and 54.2 MB.

This result is explicitly provisional. The machine is a 2024 Apple M4 Pro system, not the
mandatory recorded 2020-era laptop. It cannot make the canonical gate Pass.
