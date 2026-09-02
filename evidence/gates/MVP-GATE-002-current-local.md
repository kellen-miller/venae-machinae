# MVP-GATE-002 current-local authority — Graph capacity

- Record: `MVP-GATE-002-current-local`
- Machine record: `evidence/gates/MVP-GATE-002-current-local.json`
- Supersedes: `MVP-GATE-002-baseline`
- Raw measurements: `evidence/gates/raw/MVP-GATE-002-current-local.json`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:capacity`
- Result: Pass

The exact 1x/2x/5x schema-v1 fixtures contain 300/600/1,500 Components,
1,500/3,000/7,500 Ports, and 1,200/2,400/6,000 mixed physical Connections. The
selected app-owned raw-SVG renderer preserves all identities and endpoints while viewport
culling and accessible semantic pagination bound rendered DOM to 2,851 elements.

On the recorded MacBook Pro Mac16,7 environment, pointer feedback remained at or below
51.4 ms, pan and zoom measured 60 fps at every scale, 1x/2x snapshot-to-interactive remained
below 213 ms, and the 5x retained JS heap measured 54,245,144 bytes. All structural-integrity
checks passed. Fixture, test, raw-output, and lockfile SHA-256 values are in the machine record.

The user-approved 2026-09-01 evidence amendment makes this reproducible current-local run
authoritative for its named environment and supersedes the historical Unavailable baseline.
It makes no minimum-hardware, hardware-age, or cross-environment capacity claim. The two
failed renderer candidates remain immutable evidence of the bounded renderer decision.
