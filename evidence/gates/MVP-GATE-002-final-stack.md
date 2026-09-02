# MVP-GATE-002 final production stack — Graph capacity

- Record: `MVP-GATE-002-final-stack`
- Machine record: `evidence/gates/MVP-GATE-002-final-stack.json`
- Supersedes: `MVP-GATE-002-current-local`
- Raw measurements: `evidence/gates/raw/MVP-GATE-002-final-stack.json`
- Command: `PLAYWRIGHT_PORT=4312 pnpm gate:all` (capacity subcommand)
- Result: Pass

The schema-v8 1x/2x/5x fixtures contain 300/600/1,500 Components,
1,500/3,000/7,500 Ports, and 1,200/2,400/6,000 schema-valid mixed physical
Connections. The selected app-owned raw-SVG renderer preserves every identity and endpoint while
viewport culling and accessible semantic pagination keep the rendered DOM at or below 3,152
elements.

On the recorded MacBook Pro Mac16,7 environment, pointer feedback remained at or below 44.1 ms
and pan/zoom measured 60 fps at every scale. Renderer-harness 1x/2x
snapshot-to-interactive remained below 61 ms. Through the final IndexedDB structure-v2
repository, schema-v8 Project Snapshot, Project Session, production evaluation preparation and
evaluation workers, and production renderer, 1x/2x snapshot-to-interactive measured 66.4/78.9
ms. At 5x, evaluation dispatch returned in 5.0 ms and an edit advanced the Project revision while
evaluation was still queued. The 5x retained JS heap measured 54,629,012 bytes. All structural
integrity checks passed.

Fixture, production-boundary, test, raw-output, and lockfile SHA-256 values are in the machine
record. This record supersedes the initial current-local measurement now that the final RX-7
visual, evaluation, persistence, exchange, reporting, and browser-delivery stack exists.

Authority remains limited to the named current local environment. This record establishes no
minimum-hardware, hardware-age, or cross-environment capacity claim.
