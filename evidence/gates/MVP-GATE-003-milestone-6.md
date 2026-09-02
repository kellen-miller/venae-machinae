# MVP-GATE-003 milestone 6 — RX-7 whole-snapshot persistence

- Record: `MVP-GATE-003-milestone-6`
- Machine record: `evidence/gates/MVP-GATE-003-milestone-6.json`
- Raw measurements: `evidence/gates/raw/MVP-GATE-003-milestone-6-rx7-browser-measurements.json`
- Supersedes: `MVP-GATE-003-milestone-5`
- Fixture: `src/lib/reference/rx7-example.v1.venae.json` through `tests/fixtures/rx7-capacity-project.ts`
- Command: `pnpm gate:persistence -- --fixture rx7 --record milestone-6`
- Result: Pass

The complete schema-8 RX-7 envelope was deterministically expanded to 1×, 2×, and 5× without dropping evidence, results, validation history, operating states, provenance, geometry, the vehicle background, or build records. Each variant was serialized, JITless-Zod validated under the production CSP, structured-cloned, atomically saved, closed, reopened, and compared exactly in Chromium, Firefox, and WebKit.

The 5× document contained 130 components, 325 ports, and 160 connections at 788,207 encoded bytes. Largest observed save and reopen-plus-load times were 17 ms and 14 ms against the fixed 2,000 ms ceiling. The shared RX-7 raster wrote once and deduplicated at 2× and 5×; checkpoint recovery was exact.

Bounded decision: retain whole-document IndexedDB transactions, separate hash-addressed assets, immutable checkpoints, and strict schema-8 recovery for the measured complete RX-7 1×/2×/5× envelope.
