# MVP-GATE-006 — Browser storage lifecycle

- Current record: `evidence/gates/MVP-GATE-006-production-browsers.md`
- Machine record: `evidence/gates/MVP-GATE-006-production-browsers.json`
- Verdict: Pass
- Supersedes: `MVP-GATE-006-baseline`

Automated production-build Chromium, Firefox, and WebKit storage-status, eviction-guidance,
lock-ordering, takeover, blocked-upgrade recovery, and close/reopen snapshot recovery evidence
passes. The user-approved evidence amendment removes real-device and external-origin acceptance
from this gate while preserving the local-only, loopback-default, no-plain-HTTP-LAN boundary.
