# MVP-GATE-005 milestone 6 — RX-7 worker boundary

- Record: `MVP-GATE-005-milestone-6`
- Machine record: `evidence/gates/MVP-GATE-005-milestone-6.json`
- Raw measurements: `evidence/gates/raw/MVP-GATE-005-milestone-6-rx7-browser-measurements.json`
- Supersedes: `MVP-GATE-005-milestone-5`
- Fixture: `src/lib/reference/rx7-example.v1.venae.json` through `tests/fixtures/rx7-capacity-project.ts`
- Command: `pnpm gate:worker -- --fixture rx7 --record milestone-6`
- Result: Pass

Complete RX-7 1×/2×/5× evaluation DTOs retained calculations, screenings, operating states, evidence, and validation history and passed through real native module Workers in Chromium, Firefox, and WebKit. A raw production-worker preflight and the client publication path both decoded complete derived results under the production CSP. The final-shape run exposed three nested schemas initialized before JITless mode; configuring JITless at each schema-owning module fixed the production boundary without relaxing CSP.

The 5× initialization was 293,336 bytes. The largest initialization dispatch was 4 ms against 2,000 ms. Revisioned changes retained validation history at 8,426–9,187 bytes, no more than 14.2% of full initialization and below the fixed 20% representative-envelope bound; largest dispatch was 2 ms against 100 ms.

The same scheduler, protocol, and worker proved cooperative supersession, stale rejection, forced termination, one automatic crash restart, explicit recovery, and no restart during server loss.

Bounded decision: retain one native Worker, complete bounded initialization, revisioned changes, production-CSP-safe result validation, identity-gated publication, cancellation/restart, and server-loss guards for the complete RX-7 envelope.
