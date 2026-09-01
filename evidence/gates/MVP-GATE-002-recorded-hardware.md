# MVP-GATE-002 recorded 2020-era laptop evidence

Status: Unavailable.

The authoritative run must be executed on an identified laptop model released in 2020 or
earlier. Before running, record the manufacturer, model, release year, CPU, memory, operating
system/build, power source, thermal mode, browser/version, viewport, display scaling, executor,
time, Git commit, and lockfile hash. Do not reuse CI, this modern development machine, virtual
hardware, Playwright WebKit, or a relabeled proxy result.

Run from a clean checkout at the evidence commit:

```sh
CAPACITY_AUTHORITATIVE=1 \
CAPACITY_HARDWARE_RECORD='<recorded device/browser/OS identity>' \
PLAYWRIGHT_PORT=4174 \
pnpm gate:capacity:local
```

Capture the complete command output without editing it. Record every 1x/2x/5x measurement:
initial paint, snapshot-to-interactive paint, pointer feedback, selection, drag, route editing,
pan and zoom frame rates/max frames, labels, Overlays, retained JS heap, retained DOM nodes,
and structural fingerprint. Hash the raw output artifact.

The test enforces pointer feedback below 100 ms; at least 55 fps at 1x/2x; more than 30 fps
at 5x; and snapshot-to-interactive below two seconds at 1x/2x. A superseding canonical record
may say Pass only when the command exits zero and the device record plus raw-output hash are
complete.
