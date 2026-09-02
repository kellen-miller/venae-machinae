# MVP-GATE-004 milestone 6 — RX-7 exchange limits

- Record: `MVP-GATE-004-milestone-6`
- Machine record: `evidence/gates/MVP-GATE-004-milestone-6.json`
- Raw measurements: `evidence/gates/raw/MVP-GATE-004-milestone-6-rx7-browser-measurements.json`
- Supersedes: `MVP-GATE-004-milestone-5`
- Fixture: `src/lib/reference/rx7-example.v1.venae.json` through `tests/fixtures/rx7-capacity-project.ts`
- Command: `pnpm gate:exchange -- --fixture rx7 --record milestone-6`
- Result: Pass

Complete schema-8 RX-7 1×/2×/5× envelopes were encoded, parsed, JITless-Zod validated, SHA-256 checked, raster-signature checked, structured-cloned, atomically committed, reopened, and compared exactly in Chromium, Firefox, and WebKit. The original RX-7 vehicle-background raster remained present at every scale; deterministic raster padding reached the frozen 512 KiB and 12 MiB combined-asset boundaries without replacing it.

The 5× envelope was 17,566,751 encoded bytes with 12,582,912 original asset bytes, depth 10, and 3,654 collection entries. Largest observed times were 434 ms encoding, 108 ms total staging, 17 ms parsing, 33 ms validation, 55.6 ms hashing, 6.5 ms clone, and 48 ms commit. The retained-representation high-water bound was 70,266,994 bytes; it is not a browser heap-profiler reading.

Bounded decision: retain strict monolithic JSON with the frozen 20 MiB encoded envelope, 6 MiB per asset, 12 MiB combined assets, 64 assets, depth 32, 50,000 collection entries, and 128 MiB instrumented retained-representation limits for the measured complete RX-7 envelope.
