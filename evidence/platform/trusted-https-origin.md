# Historical trusted-HTTPS evidence requirement

Status: Historical — superseded

Before the explicit 2026-09-01 evidence-scope amendment, Milestone 1 required an external
trusted HTTPS origin for real-device Gate 6 evidence. That condition is no longer an active
procedure or acceptance blocker. Cross-device access is outside MVP support and acceptance.

The canonical and supported MVP origin remains `http://localhost:4173` with loopback binding.
Plain-HTTP LAN editing and implicit synchronization remain unsupported. Any future
non-loopback secure origin would own an independent origin-local Project Library and require a
separate support decision.
