# MVP-GATE-003 baseline — Whole-snapshot persistence

- Record: `MVP-GATE-003-baseline`
- Machine record: `evidence/gates/MVP-GATE-003-baseline.json`
- Raw measurements: `evidence/gates/raw/MVP-GATE-003-browser-measurements.json`
- Fixture: `tests/fixtures/capacity-project.ts`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:persistence`
- Result: Pass

Strict version-1 generated documents at 1× (300 Components, 1,500 Ports, 1,200 Connections), 2×, and 5× were serialized, JITless-Zod validated under the production CSP, structured-cloned, saved as whole documents, closed, reopened, and compared byte-for-byte in Chromium 151.0.7922.34, Firefox 153.0, and WebKit 26.5. The largest 5× document was 1,423,796 encoded bytes. The largest observed save was 34 ms and reopen-plus-load was 29 ms, below the predeclared 2,000 ms gate ceiling.

The same concrete `BrowserProjectLibrary` passed ten fake-IndexedDB boundary cases covering all fixture sizes, revision conflict, immutable checkpoint recovery, asset deduplication, and a `QuotaExceededError` rollback that retained the prior durable revision. Zod's official CSP guidance was applied before schema construction with `jitless: true`; the production CSP was not weakened.

Bounded decision: retain whole-document IndexedDB transactions with separately hash-addressed assets and immutable checkpoints for the provisional schema. Milestone 5 must supersede this guarded baseline after the complete production schema, migration path, and asset policy are promoted.
