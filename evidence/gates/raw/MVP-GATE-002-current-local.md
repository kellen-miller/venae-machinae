# MVP-GATE-002 raw current-local measurement

- Recorded: 2026-09-01T19:55:06Z
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:capacity`
- Environment: MacBook Pro Mac16,7; Apple M4 Pro 14-core; 48 GB; macOS 26.6.2
  (25G83); arm64; Node 26.8.1; pnpm 11.25.0; Chromium 151.0.7922.34;
  1280x900 viewport
- Result: Pass

The authoritative-default runner enforced every locked threshold. Unit coverage passed 4/4.
The Chromium production-browser run passed one test with exact 1x/2x/5x counts and preserved
all structural fingerprints. Pointer feedback measured 13.6/22.8/51.4 ms; pan and zoom
measured 60 fps at every scale; 1x/2x snapshot-to-interactive measured 212.9/33.7 ms; and the
5x retained JS heap measured 54,245,144 bytes. Rendered DOM stayed at 2,851 elements while the
complete projection remained available through semantic pagination.

This is authority only for the named current local environment. It establishes no minimum
hardware, hardware-age, or cross-environment support claim.
