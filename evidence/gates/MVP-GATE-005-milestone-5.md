# MVP-GATE-005 milestone 5 — Worker boundary

- Record: `MVP-GATE-005-milestone-5`
- Machine record: `evidence/gates/MVP-GATE-005-milestone-5.json`
- Raw measurements: `evidence/gates/raw/MVP-GATE-005-milestone-5-browser-measurements.json`
- Supersedes: `MVP-GATE-005-baseline`
- Fixture: `tests/fixtures/capacity-project.ts`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:worker -- --record milestone-5`
- Result: Pass

Production schema-8 1×/2×/5× documents were mapped into evaluation DTOs and sent through real native module Workers in Chromium, Firefox, and WebKit. The 5× initialization was 1,955,399 encoded bytes. The largest synchronous initialization dispatch was 23 ms below the 2,000 ms ceiling. The revisioned incremental message remained 960 bytes and its largest dispatch was 15 ms below the 100 ms ceiling and under one percent of every full initialization.

The same scheduler, protocol, and worker proved cooperative supersession, forced termination of non-cooperative work, stale rejection, one automatic crash restart, explicit recovery, and no restart during server loss. IndexedDB never crossed the worker boundary.

Bounded decision: retain one long-lived native Worker, bounded full initialization, small revisioned changes, identity-gated atomic publication, cancellation/restart, and server-loss guards for the production schema.
