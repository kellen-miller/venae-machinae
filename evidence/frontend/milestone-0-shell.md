# Milestone 0 Project Library shell

- Route: `/`
- Origin: `http://localhost:4173`
- Viewport: 1440 by 1000 CSS pixels
- Fixture: server-rendered empty baseline
- Action: open the Project Library
- Expected: browser-local authority is explicit, no mutation is enabled, and no project endpoint is requested
- Browser records:
  - `evidence/frontend/milestone-0-chromium.png`
  - `evidence/frontend/milestone-0-firefox.png`
  - `evidence/frontend/milestone-0-webkit.png`
- Automated browser result: Pass on Playwright Chromium, Firefox, and WebKit with the production adapter build on isolated test port 4174
- Network result: Pass; `tests/e2e/shell.spec.ts` observed no project endpoint while `/health` returned `{"status":"ok"}` and `/version` returned `{"application":"0.1.0"}`
- Visual inspection: Pass; the three captures preserve the same hierarchy, legible authority boundary, disabled creation state, and empty-library state without clipping at the recorded viewport
- Strict-port result: Pass; a second guarded production launcher exited nonzero for the occupied port, and the canonical 4173 launcher rejected the pre-existing wildcard listener without changing that user-owned process
- Observed: 2026-09-01T17:37:14Z
