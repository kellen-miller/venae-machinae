# MVP-GATE-006 production-browser authority — Browser storage lifecycle

- Record: `MVP-GATE-006-production-browsers`
- Machine record: `evidence/gates/MVP-GATE-006-production-browsers.json`
- Supersedes: `MVP-GATE-006-baseline`
- Automated results: `evidence/gates/raw/MVP-GATE-006-automated-results.json`
- Command: `PLAYWRIGHT_PORT=4174 pnpm gate:storage-lifecycle`
- Result: Pass

The production SvelteKit application passed Chromium 151.0.7922.34, Firefox 153.0, and WebKit
26.5 coverage for browser persistence outcomes, quota-pressure guidance, exclusive project
leases after shared library access, takeover after explicit release, blocked IndexedDB upgrade
then recovery, and whole-snapshot recovery after closing and reopening the owning page. Unit
fixtures independently cover granted, denied, unsupported, near-quota, and never-settling
persistence requests.

The user-approved 2026-09-01 evidence amendment makes this automated three-engine lifecycle
record authoritative and supersedes the historical Unavailable baseline. It makes no claim
about Safari, iPadOS, Android, physical devices, cross-device access, or external origins.
Loopback remains the supported MVP delivery path; plain-HTTP LAN editing remains unsupported.
