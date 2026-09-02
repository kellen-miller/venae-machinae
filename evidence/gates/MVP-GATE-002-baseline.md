# MVP-GATE-002 baseline — Graph capacity

- Record: `MVP-GATE-002-baseline`
- Machine record: `evidence/gates/MVP-GATE-002-baseline.json`
- Local smoke: `evidence/gates/raw/MVP-GATE-002-local-smoke.json`
- Required hardware record: `evidence/gates/MVP-GATE-002-recorded-hardware.md`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:capacity:local`
- Result: Unavailable

The exact 1x/2x/5x schema-v1 Project Documents contain 300/600/1,500 Components,
1,500/3,000/7,500 Ports, and 1,200/2,400/6,000 mixed physical Connections. The selected
raw-SVG adapter preserves every identity and endpoint through the app-owned projection.

The first local candidate preserved data but failed capacity while rendering as many as
171,653 DOM elements. Viewport culling and keyboard-operable semantic pagination bounded the
DOM at 2,851; removing per-path SVG drop-shadow filters then restored 60 fps pan and zoom at
all three scales on the modern local host. Pointer, drag, route-edit, snapshot-return, labels,
Overlays, CSP, retained memory, and structural integrity are recorded in the raw smoke.

Overall result: Unavailable. The local hardware is a 2024 Apple M4 Pro system. The approved
gate requires a recorded 2020-era laptop, so the provisional result cannot create a proxy Pass.
`evidence/gates/MVP-GATE-002-recorded-hardware.md` contains the exact unblock.
