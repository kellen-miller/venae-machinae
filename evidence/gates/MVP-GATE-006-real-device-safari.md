# Historical MVP-GATE-006 real-device requirement

Status: Historical — superseded

Before the explicit 2026-09-01 evidence-scope amendment, Gate 6 required a real Safari/iPadOS
lifecycle artifact through a trusted HTTPS origin. That unavailable condition is preserved in
`MVP-GATE-006-baseline.*` as decision provenance; it is no longer an active procedure or
acceptance blocker.

`MVP-GATE-006-production-browsers.*` supersedes the baseline with automated production-build
Chromium, Firefox, and WebKit lifecycle authority. It makes no Safari, physical-device,
cross-device, or external-origin claim. Loopback remains the supported MVP delivery path and
plain-HTTP LAN editing remains unsupported.
