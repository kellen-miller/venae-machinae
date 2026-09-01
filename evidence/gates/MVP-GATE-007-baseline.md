# MVP-GATE-007 baseline — Numeric correctness

- Record: `MVP-GATE-007-baseline`
- Machine record: `evidence/gates/MVP-GATE-007-baseline.json`
- Raw browser results: `evidence/gates/raw/MVP-GATE-007-browser-results.json`
- Fixture: `tests/fixtures/numeric-goldens.ts`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:numeric`
- Result: Pass

Three exact conversions, one application-owned formula, monotonic lower/upper propagation, missing and unsupported bound outcomes, and disclosed significant-figure presentation passed without intermediate numeric rounding. The same production exports were bundled and executed in Chromium 151.0.7922.34, Firefox 153.0, and WebKit 26.5; each rendered `12.35` from the independent `12.3456` at four-significant-figure fixture.

Bounded decision: retain `decimal.js` 10.6.0 with string inputs, 40-digit internal precision, application-owned formulas, explicit positive-monotonic bound policy, and presentation-only rounding. This gate does not expand the formula authority envelope or permit executable user formulas.
