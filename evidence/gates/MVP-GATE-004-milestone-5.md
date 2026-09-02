# MVP-GATE-004 milestone 5 — Exchange limits

- Record: `MVP-GATE-004-milestone-5`
- Machine record: `evidence/gates/MVP-GATE-004-milestone-5.json`
- Raw measurements: `evidence/gates/raw/MVP-GATE-004-milestone-5-browser-measurements.json`
- Supersedes: `MVP-GATE-004-baseline`
- Fixture: `tests/fixtures/capacity-project.ts`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:exchange -- --record milestone-5`
- Result: Pass

Strict production schema-8 1×/2×/5× project envelopes were encoded, parsed, JITless-Zod validated, SHA-256 checked, raster-signature checked, structured-cloned, atomically committed, reopened, and compared exactly in Chromium, Firefox, and WebKit. The 5× envelope carried two validly signed 6 MiB raster fixtures: 19,621,465 encoded bytes, 12,582,912 original asset bytes, depth 7, and 15,010 collection entries. Largest observed times were 479 ms encoding, 171 ms total staging, 17 ms parsing, 43 ms validation, 61 ms hashing, 14 ms clone, and 86 ms commit.

The instrumented retained-representation high-water bound was 78,485,860 bytes; it is not a browser heap-profiler reading. Ten unit boundaries covered encoded envelope, individual and combined assets, count, depth, collection, payload and metadata integrity, raster content, migration, collisions, rekeying, and atomic commit behavior. The first promoted-schema browser run correctly rejected the old arbitrary-byte raster fixture; the fixture gained matching PNG/JPEG signatures without weakening the production validator.

Bounded decision: retain strict monolithic JSON with frozen limits of 20 MiB encoded envelope, 6 MiB per original asset, 12 MiB combined original assets, 64 assets, nesting depth 32, 50,000 collection entries, and a 128 MiB instrumented retained-representation bound.
