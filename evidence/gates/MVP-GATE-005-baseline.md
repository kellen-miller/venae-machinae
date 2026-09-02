# MVP-GATE-005 baseline — Worker boundary

- Record: `MVP-GATE-005-baseline`
- Machine record: `evidence/gates/MVP-GATE-005-baseline.json`
- Raw measurements: `evidence/gates/raw/MVP-GATE-005-browser-measurements.json`
- Fixture: `tests/fixtures/capacity-project.ts`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:worker`
- Result: Pass

Strict version-1 1×/2×/5× documents were mapped into evaluation-only DTOs and sent through real native module Workers in Chromium 151.0.7922.34, Firefox 153.0, and WebKit 26.5. The 5× initialization was 1,043,330 encoded bytes. The largest observed synchronous initialization dispatch was 16 ms, below the predeclared 2,000 ms ceiling. The revisioned incremental message remained 573 bytes at every scale and its largest dispatch was 8 ms, below the predeclared 100 ms ceiling and under one percent of every full initialization.

The same `EvaluationClient`, protocol, and worker proved one active evaluation, cooperative supersession, forced termination/recreation of a non-cooperative worker, stale and version-mismatched result rejection before a single system-action publication, one automatic crash restart, explicit retry after a second crash, and no worker recreation during server loss. The complete initialization stayed in memory and resumed only after reconnect; IndexedDB never crossed the worker boundary. Browser fault sources simulated non-cooperation and crash outside production modules.

Bounded decision: retain the long-lived native evaluation Worker, evaluation-only full initialization, small revisioned change sets, identity-gated atomic publication, cooperative cancellation with forced restart, one automatic crash restart, explicit retry, and server-loss restart guard. Milestone 5 must supersede this guarded baseline after the complete production document schema is promoted.
