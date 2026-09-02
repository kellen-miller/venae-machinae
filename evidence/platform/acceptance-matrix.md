# MVP-ACC-017 supported-matrix acceptance

Recorded 2026-09-02 on MacBook Pro Mac16,7, Apple M4 Pro 14-core, 48 GB,
macOS 26.6.2 (25G83), arm64, Node 26.8.1 against pinned Node 24.20.0, and pnpm
11.25.0. The production-browser matrix is Playwright 1.62.1 Chromium
151.0.7922.34, Firefox 153.0, and WebKit 26.5.

| Obligation                                  | Command                                                                                                                    | Result                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Browser lifecycle and responsive acceptance | `PLAYWRIGHT_PORT=4311 pnpm test:e2e`                                                                                       | Pass, 147/147 across three engines                                                                                 |
| Accessibility                               | `PLAYWRIGHT_PORT=4313 pnpm test:accessibility`                                                                             | Pass, 6/6; zero axe-core violations in the tested WCAG tag set                                                     |
| Security and content boundaries             | `pnpm test:security`; production delivery cases in `pnpm test:e2e`                                                         | Pass, 12/12 unit/security cases plus all-engine strict-CSP, redaction, origin, route, network, and reload coverage |
| Numeric gate                                | `PLAYWRIGHT_PORT=4312 pnpm gate:all`                                                                                       | Pass, 7/7 unit and 3/3 browser cases                                                                               |
| Persistence and storage lifecycle gates     | same                                                                                                                       | Pass, 10/10 plus 5/5 unit; 3/3 plus 3/3 browser cases                                                              |
| Worker gate                                 | same                                                                                                                       | Pass, 10/10 unit and 3/3 browser cases                                                                             |
| Exchange gate                               | same                                                                                                                       | Pass, 10/10 unit and 3/3 browser cases                                                                             |
| Renderer gate                               | same                                                                                                                       | Pass, 3/3 unit and 3/3 browser cases                                                                               |
| Final-stack capacity gate                   | same                                                                                                                       | Pass, 4/4 unit and 2/2 Chromium cases in the recorded current local environment                                    |
| Visual regression evidence                  | `PLAYWRIGHT_PORT=4310 pnpm test:visual`                                                                                    | Pass, 10/10; final M7 captures inspected                                                                           |
| Core/static/build/bundle                    | `pnpm format:check`; `pnpm lint`; `pnpm check`; `pnpm test:unit`; `pnpm test:component`; `pnpm build`; `pnpm bundle:check` | Pass; 177/177 unit, 4/4 component, zero Svelte diagnostics, 4,023,521-byte built bundle                            |

Final capacity measurements are recorded in
`evidence/gates/MVP-GATE-002-final-stack.md`: pointer feedback at or below
44.1 ms, pan/zoom at 60 fps, 1x/2x final production snapshot-to-interactive at
66.4/78.9 ms, and 5x evaluation dispatch at 5.0 ms with editing accepted while
evaluation remained queued.

Verdict: Pass. Authority is limited to the named automated matrix and recorded
current local environment. It establishes no Safari-brand, operating-system,
physical-device, cross-device, external-origin, minimum-hardware, or
hardware-age support claim.
