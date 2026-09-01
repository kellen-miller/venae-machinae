# Trusted HTTPS device origin

Status: Unavailable

No user-controlled stable trusted HTTPS test origin has been provided or discovered for this implementation run. The canonical loopback origin remains `http://localhost:4173`.

Required unblock before Milestone 2:

- provision an external TLS termination layer that proxies to the local Node server;
- record the stable origin, certificate trust, proxy target, and device reachability;
- verify that the other device owns an independent origin-local Project Library; and
- execute the lifecycle and recovery procedure in real Safari on iPadOS.

Playwright WebKit, browser emulation, localhost, or plain HTTP LAN access cannot substitute for this evidence.
