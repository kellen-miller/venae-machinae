# MVP-GATE-006 real-device Safari lifecycle

Status: Unavailable

No user-controlled trusted HTTPS origin or real Safari/iPadOS device lifecycle artifact is available for this implementation run. Playwright WebKit, a headless background tab, localhost, and plain HTTP LAN access do not satisfy this subgate.

Required unblock:

- provision the external stable trusted HTTPS origin described in `evidence/platform/trusted-https-origin.md`;
- record device model, OS, real Safari version, certificate trust, origin, proxy target, executor, and UTC time;
- exercise persistence grant/denial, library independence, write-lease takeover, background/restore, eviction/recovery, and server interruption;
- capture the artifact under `evidence/gates/`, compute its SHA-256, and add a non-proxy Pass record to `evidence/gates/manual-evidence.json`.

Current automated evidence: `evidence/gates/raw/MVP-GATE-006-automated-results.json`.
