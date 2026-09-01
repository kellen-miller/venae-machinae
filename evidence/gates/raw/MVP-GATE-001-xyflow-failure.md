# MVP-GATE-001 Candidate A failure

- Candidate: `@xyflow/svelte` 1.6.6
- Command: `PLAYWRIGHT_PORT=4174 pnpm exec playwright test tests/gates/renderer-browser.spec.ts --project=chromium`
- Environment: Chromium 151.0.7922.34, macOS arm64, production SvelteKit response
- Verdict: Fail

The package requires runtime inline style attributes for node transforms and
viewport layout. Chromium rejected those writes under the locked production
policy `style-src 'self'`. The tested physical source endpoint also terminated
at the outside of its 18 px Handle, producing a measured 9 px error from the
required exact Port center.

The gate does not weaken CSP or reinterpret center snapping. Candidate B is the
bounded app-owned raw-SVG adapter named by the approved ExecPlan. Candidate A
will not remain in production source or package dependencies.
