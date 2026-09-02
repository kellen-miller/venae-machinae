# MVP-GATE-006 baseline — Browser storage lifecycle

- Record: `MVP-GATE-006-baseline`
- Machine record: `evidence/gates/MVP-GATE-006-baseline.json`
- Automated results: `evidence/gates/raw/MVP-GATE-006-automated-results.json`
- Manual record: `evidence/gates/MVP-GATE-006-real-device-safari.md`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:storage-lifecycle`
- Result: Unavailable

Automated result: Pass. Chromium 151.0.7922.34, Firefox 153.0, and WebKit 26.5 exercised granted/denied/unsupported/failed status copy, quota-pressure messaging, one exclusive project writer, shared-library-before-exclusive-project lock ordering, explicit takeover request followed by release and reacquisition, blocked IndexedDB upgrade followed by completion, and whole-snapshot recovery after closing the owning page. Firefox's uncancellable persistence request did not settle in headless mode; the product now reports a bounded failed state after 2,000 ms rather than hanging. Headless pages reported visibility `visible`, so this is not represented as real background-device evidence.

The Web Locks and BroadcastChannel behavior follows the current MDN/W3C contracts: `ifAvailable` produces a null lock instead of waiting, exclusive locks exclude other holders, shared locks permit readers, and BroadcastChannel stays same-origin. The application does not use the dangerous `steal` option; takeover requires explicit release before successful acquisition.

Overall result: Unavailable. `evidence/gates/MVP-GATE-006-real-device-safari.md` and `evidence/gates/manual-evidence.json` contain the exact unblock. Playwright WebKit and localhost do not satisfy real Safari/iPadOS over trusted HTTPS.
