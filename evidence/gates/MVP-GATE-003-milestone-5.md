# MVP-GATE-003 milestone 5 — Whole-snapshot persistence

- Record: `MVP-GATE-003-milestone-5`
- Machine record: `evidence/gates/MVP-GATE-003-milestone-5.json`
- Raw measurements: `evidence/gates/raw/MVP-GATE-003-milestone-5-browser-measurements.json`
- Supersedes: `MVP-GATE-003-baseline`
- Fixture: `tests/fixtures/capacity-project.ts`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:persistence -- --record milestone-5`
- Result: Pass

Strict production schema-8 documents at 1×, 2×, and 5× were serialized, JITless-Zod validated under the production CSP, structured-cloned, atomically saved, closed, reopened, and compared exactly in Chromium, Firefox, and WebKit. The 5× document was 2,843,146 encoded bytes. The largest observed save was 57 ms and reopen-plus-load was 46 ms, below the fixed 2,000 ms ceiling.

Ten boundary cases exercised all fixture sizes, revision conflict, immutable checkpoint recovery, hash-addressed asset deduplication, and quota rollback that retained the prior durable revision. The fixture is generated through the promoted persisted-document schema rather than a parallel reduced shape.

Bounded decision: retain whole-document IndexedDB transactions, separate hash-addressed assets, immutable checkpoints, and strict schema-8 recovery at the measured 1×/2×/5× sizes.
