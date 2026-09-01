# ADR 0001: Use a local-first SvelteKit architecture

- Status: Accepted
- Date: 2026-09-01
- Decision ticket: [Choose the application architecture and delivery stack](https://github.com/kellen-miller/venae-machinae/issues/11)
- Research: [Application architecture and delivery options](../../research/application-architecture-options.md)

## Context

Venae Machinae is a canvas-first automotive wiring and fluid-system design
application. It must make project-car engineering approachable without losing
the topology, evidence, calculation, recovery, and exchange guarantees already
settled by the product map.

The browser-held working copy is authoritative. A user must be able to edit,
calculate, validate, recover, and exchange projects without accounts, cloud
storage, synchronization, telemetry, or internet access. At the same time, the
application must support dense topology editing, deterministic unit-safe
calculations, accessible non-spatial views, and durable evolution of persisted
data.

The production framework is Svelte and SvelteKit. React is excluded. The user
also requires a running SvelteKit server for local use, even though the MVP has
no accounts or non-local infrastructure. Release packaging remains deferred.

These constraints make the hard boundary the ownership of a Vehicle Project,
not whether a server process exists. The server delivers and renders the
application. The browser owns project data and engineering work.

## Decision drivers

- Preserve the local-first persistence, recovery, and exchange contract.
- Use native Svelte 5 and SvelteKit capabilities without leaking framework
  concerns into the domain.
- Keep one readable mutation and evaluation lifecycle.
- Make electrical and fluid topology visually distinct and exactly attached to
  typed Ports.
- Keep calculations deterministic, versioned, unit-safe, and traceable.
- Prevent canvas, persistence, worker, or server libraries from becoming the
  domain model.
- Measure capacity and browser lifecycle behavior before freezing claims that
  documentation cannot prove.
- Avoid enterprise structure without a concrete MVP need.

## Decision

### Runtime and server boundary

Use strict TypeScript, Svelte 5, SvelteKit 2, and `@sveltejs/adapter-node` in
one application package.

Local use requires the SvelteKit server. It owns:

- application, route, and bundled reference-data delivery;
- default SvelteKit hybrid SSR/CSR;
- security headers and sanitized server error handling; and
- health and deterministic build-version endpoints.

It does not own:

- Vehicle Projects or the Project Library;
- project CRUD, persistence, backups, or exchange;
- calculations, validation, or Overlay generation;
- accounts, authentication, synchronization, or collaboration; or
- telemetry, remote configuration, or a server database.

The editor server-renders a deterministic shell. After hydration, the browser
opens IndexedDB and creates the Project Session. Project content is not placed
in server `load` data, sent to an endpoint, or logged by the server.

Use SvelteKit's filesystem routes, nested layouts, generated route types,
request-scoped context, route error pages, server hooks, server-only modules,
and built-in application-version detection. Keep `load` functions pure. Do not
use form actions or remote functions for browser-local project mutations.

Configure a strict Content Security Policy and secure response headers in the
SvelteKit boundary. On a detected application-version change, flush autosave,
create any required pre-migration Recovery Checkpoint, release the write lease,
and offer a controlled reload. Never force a reload while an editor owns
unsaved work.

Use one canonical local origin, `http://localhost:4173`, for development and
production-build validation. Configure strict-port behavior and fail clearly
when the port is occupied. Always open `localhost`, never `127.0.0.1`. Tests use
isolated browser profiles and origins. A future origin change must provide a
Library Backup export/restore migration path.

Bind loopback by default. Plain HTTP LAN access is unsupported because required
browser APIs need a secure context. Another device requires a stable trusted
HTTPS origin, normally through user-configured TLS termination. Each browser,
profile, device, and origin has an independent Project Library; no implicit
synchronization occurs.

Do not ship a service worker in the MVP. No internet connection is required
while the local server is running. A Project Session is not reported ready
until its editor core, evaluation worker, autosave path, and emergency exporter
are loaded. If the server later disappears, the already-open workspace keeps
editing, undo, IndexedDB saving, and emergency JSON export. Navigation,
imports, reports, lazy features, and worker restart wait for reconnection.

Use SvelteKit's default split bundles, hashing, preloading, and client router.
Dynamically load the editor and other heavy capabilities, but load the complete
loss-prevention core before declaring an editor ready. Release archives,
installers, updaters, daemons, and package publication are deferred.

### Module and dependency direction

Organize the single package around owned capabilities such as project,
topology, electrical, fluid, validation, calculation, exchange, and reporting.
Do not create generic `common`, `helper`, `util`, or `utils` modules.

Dependencies point inward:

1. Pure TypeScript domain modules define topology, evidence, quantities,
   actions, invariants, formulas, and outcomes. They import no Svelte, browser,
   Node, persistence, worker, or renderer code.
2. Application modules own Project Sessions, commands, revisions, undo,
   autosave coordination, queries, and evaluation scheduling.
3. Browser adapters own IndexedDB, Web Locks, BroadcastChannel, workers, Web
   Crypto, files, downloads, and browser capability detection.
4. Svelte presentation modules render the application and invoke the Project
   Session. Renderer-specific types remain inside the renderer adapter.
5. Server-only SvelteKit modules own delivery concerns only.

Create dependencies explicitly at one application composition root. Do not add
a dependency-injection container, service locator, mutable process-global
session, microservice, plugin framework, event store, or separate read model.

Enforce the direction with directory-scoped ESLint `no-restricted-imports`
rules. In particular, only the renderer adapter may import
`@xyflow/svelte`.

### Svelte application state

Create one Project Session for each open project and provide it through typed
Svelte `createContext`. The Project Session owns:

- the immutable current Project Snapshot;
- project revision and save/evaluation status;
- the mutation executor and session-local undo/redo history;
- persistence and write-lease coordination; and
- worker scheduling and result publication.

Expose the large immutable Project Snapshot through `$state.raw`. Use ordinary
`$state` for small transient UI state and `$derived` for projections. Use
`$effect` only at actual external synchronization boundaries. Prefer Svelte
attachments for DOM or third-party renderer lifecycles.

Selection, hover, viewport, drag previews, open panels, and Lens state are not
part of the Project Snapshot. Multiple canvas or dense lenses share one Project
Session and project revision while retaining independent transient view state.

Use the route path for the browser-local project ID, search parameters for view
state that should survive reload, and typed shallow-routing state for inspectors
and modals. SvelteKit navigation snapshots may preserve disposable UI state but
never represent a domain Project Snapshot.

### Mutation, revision, undo, and evaluation

Every project mutation enters `ProjectSession.execute(action)`. No component,
renderer callback, persistence adapter, or worker mutates the project directly.
The executor:

1. validates synchronous structural invariants;
2. creates a new immutable Project Snapshot with structural sharing;
3. advances the project revision;
4. identifies changed subjects and invalidated results;
5. records the user-visible undo frame and queues autosave; and
6. schedules affected derived evaluation.

Use opaque `crypto.randomUUID()` identities for user-created subjects. Built-in
catalog records use stable namespaced IDs. IDs do not encode mutable names,
types, hierarchy, or renderer identity.

Undo/redo is a bounded in-memory history of Project Snapshots and command
labels. It does not survive reload and is not an event log. Durable recovery
uses Recovery Checkpoints and Named Snapshots.

Each accepted user action receives a causation ID and changed-subject set.
Coalesce affected evaluation into one worker run. A matching run is committed
through one typed system action containing its findings and evidence-bearing
Calculation and Screening Results. The system action advances the persisted
revision but updates the originating undo frame instead of creating another
user-visible undo step. Undo therefore reverts the authored change and its
derived result together.

After an input change, affected saved results become stale immediately and
remain visible until a replacement run commits. A failed run retains stale
results and records a typed failure. Generated Overlay marks and render caches
are ephemeral.

### Browser persistence and concurrency

Use IndexedDB through the thin `idb` wrapper. Hold the current project in
memory. Debounce accepted actions, coalesce continuous gestures, then atomically
write the complete versioned project document and any new referenced assets.
Structural sharing is an in-memory optimization only. Do not persist an event
log.

Use coarse stores for:

- library metadata and the active generation pointer;
- current projects;
- Recovery Checkpoints and Named Snapshots;
- Part Definition Templates and template revisions;
- content-addressed Project Assets;
- Trash and quarantine;
- settings, backup health, and local diagnostics; and
- rollback library generations.

Keep the IndexedDB structure version independent from the project document
schema. Keep structural upgrades short. Parse a stored version-specific shape,
validate it strictly, run sequential pure document migrations, revalidate, map
it into the current domain, and atomically store the result with rollback data.
Migrate projects lazily when opened. Migrate imports and Library Backups
entirely in staging before commit.

Persisted Zod schemas and live domain types are separate. Zod validates
persisted, imported, worker, migration, asset, and configuration boundaries;
it does not dictate the domain representation. Unknown structural fields fail
validation instead of being silently stripped.

Coordinate writes with Web Locks:

- every writable Project Session acquires a shared library-activity lock and
  then an exclusive project lock;
- another tab opens that project read-only and may explicitly request takeover;
- BroadcastChannel carries status and takeover coordination, never ownership;
  and
- cleanup, library restore, and structural migration require the exclusive
  library lock and cannot overlap any writer.

Acquire locks in library-then-project order. Routine maintenance runs only when
the exclusive library lock is immediately available, so it never queues ahead
of project saves. Quota-pressure cleanup asks the user to close editors.

Before an IndexedDB upgrade, notify tabs to flush, release leases, and close old
connections. If they cannot cooperate, expose a blocked-upgrade state rather
than forcing partial progress.

Autosave reports `Saving`, `Saved at...`, or `Save failed` only after the
IndexedDB transaction completes. Completion is not a claim of physical flush,
protection from browser eviction, profile deletion, or device loss. Request
persistent storage and display granted, denied, or unsupported status. When
protection is denied or unverifiable, keep a visible durability warning. A
downloaded Library Backup is the device-loss durability boundary.

On write failure, retain the unsaved Project Snapshot in memory, show a
persistent failure state, retry safely, and offer an emergency JSON export. Do
not navigate silently or claim the work is durable.

Create a Recovery Checkpoint after five active editing minutes or 50 accepted
actions, whichever occurs first, and at the already-defined session,
migration, import, restore, and destructive-operation boundaries. Apply the
settled retention, Trash, Named Snapshot, rollback, and Library Backup rules.

Restore a Library Backup by writing and validating a new logical library
generation, then atomically flipping the active-generation pointer. Retain the
previous generation as the required rollback image.

Store assets once by SHA-256 and reference them by hash. Cleanup computes
reachability only under the exclusive library lock, when no writer exists, and
deletes in bounded transactions. It never deletes a reachable or
contract-protected asset.

### Project and library exchange

Preserve the settled strict, readable, self-contained JSON formats:
`.venae.json`, `.venae-templates.json`, and `.venae-backup.json`. Embed original
asset bytes as base64. Keep assets inert, retain their hash and metadata, and
allow only sandboxed raster previews in the MVP. Do not execute imported HTML,
JavaScript, SVG, macros, or embedded code.

Use standard browser file input, drag/drop, `Blob`, and download APIs. Defer
persistent File System Access handles.

Perform parse, structural validation, integrity checks, sequential migration,
and import summary in a short-lived worker. Commit only after user confirmation
through the main-thread persistence adapter. Invalid stored projects remain
quarantined and raw-exportable. A failed import or restore leaves the active
library unchanged.

Normalize unordered domain collections, then use RFC 8785-style canonical JSON
for payload hashing. Decimal quantities remain strings. Hash the canonical
payload separately from changing export metadata and verify each embedded
asset by SHA-256. Integrity hashes detect corruption, not authenticity.

Do not freeze speculative file-size limits. Before the first released schema,
measure peak parse, validation, hashing, clone, and commit memory in Chromium,
Firefox, and WebKit. Envelope caps count encoded file bytes; per-asset and
combined-asset caps count original raw bytes. If safe monolithic-JSON limits do
not satisfy the product, reopen the exchange-format decision before release.

Use Svelte print routes and browser print-to-PDF. Generate CSV/ZIP and ordinary
JSON exports in short-lived workers. Keep the emergency JSON exporter in the
loaded editor core so it works from the in-memory unsaved snapshot during
storage or server failure.

### Workers and background work

Use one long-lived native module Web Worker per writable Project Session for
expensive validation, calculation, and Overlay evaluation. Keep immediate
mutation checks synchronous. Use short-lived workers for import, export, and
report jobs.

Initialize the evaluation worker with a plain evaluation-only project DTO.
Send revisioned change sets afterward. If a revision gap, schema mismatch, or
connected-server worker restart occurs, discard the mirror and send a complete
initialization DTO.

Allow one active evaluation per session. New edits supersede queued work.
Formula groups support cooperative cancellation; if they cannot stop promptly,
terminate and recreate the worker while the server is connected. On a crash,
retain the project and prior results, restart once automatically when possible,
then require explicit retry. During server loss, evaluation remains unavailable
after a worker crash until reconnection.

Worker messages contain request ID, project revision, input fingerprint,
formula/rule versions, and plain structured-cloneable DTOs. Use transferable
`ArrayBuffer`s for large binary data. Do not send Svelte proxies, renderer
objects, class instances, IndexedDB handles, SharedArrayBuffer, or mutable
domain authority across the boundary. Publish a result only when its revision,
fingerprint, and versions still match.

### Quantities, formulas, and validation

Use `decimal.js` with a project-wide internal policy of 34 significant decimal
digits and half-even rounding. This is a deterministic computation policy, not
an accuracy claim. Formula-specific presentation controls displayed precision
and significant figures.

Persist each entered quantity as its original decimal text plus explicit unit
ID, applicability, uncertainty or bounds, origin, and provenance. Normalize
only for evaluation; never overwrite the entered value with a converted or
rounded value.

Own a small versioned unit registry with exact decimal conversion factors.
Enforce dimensions in TypeScript and at runtime. Distinguish absolute
temperature from temperature difference and absolute pressure from gauge
pressure. Reject ambiguous conversions.

Each formula has a stable ID and version, typed dimensional inputs/outputs,
assumptions, validity bounds, and source notes. Formulas are pure TypeScript
functions. Do not add an arbitrary expression language, user-executed code, or
general-purpose units framework.

Evaluation outcomes represent unknown, out-of-range, conflicting-input, and
failure states explicitly. `NaN`, infinity, and silent clamping never enter a
result. Persist evidence-bearing Calculation and Screening Results with their
input fingerprints, versions, outputs, traces, and provenance. Historical
snapshots retain the results they originally captured.

### Canvas and presentation

Adopt `@xyflow/svelte` only if a narrow production-style spike passes. Keep it
behind a project-owned renderer adapter so the implementation can move to raw
SVG or Canvas without changing domain, persistence, or application types.
Never use React or a React adapter.

The domain owns Connection identity, exact endpoint Ports, compatibility,
Connection kind, direction, route, and user-authored graph-space waypoints. The
renderer derives curves, screen geometry, handles, and animation.

The visual language is an invariant:

- Wires use conductor-scale strokes, colors, stripes, and bundle treatment.
- Fluid Lines use wider double-stroke paths with fluid and temperature
  treatment.
- Direction uses restrained chevrons or particles rather than permanent large
  arrows.
- Every Connection snaps exactly to a compatible typed Port.

Use scoped Svelte CSS and global design tokens through CSS custom properties.
Use native Svelte transitions with reduced-motion behavior. Build app-owned
floating canvas controls rather than adopting Tailwind or a themed component
framework. Prefer semantic platform controls and add a small Svelte-native
headless primitive only for a demonstrated accessibility gap.

Provide a semantic tree/list/table equivalent, keyboard connection and routing
workflows, named Ports, visible focus, and non-color cues. Target WCAG 2.2 AA
for non-spatial workflows and document unavoidable spatial-editor limitations.

Tablet supports the full lifecycle when served from a stable trusted HTTPS
origin and owns an independent local library. Mobile remains read-only. It may
validate and open an exported `.venae.json` transiently for review without
importing or persisting it into a Project Library.

### Security and diagnostics

Treat files, persisted records, asset metadata, worker messages, route
parameters, and runtime configuration as untrusted boundaries. Enforce strict
schemas, count and nesting limits, available-storage checks, and the measured
size caps before mutation. Imported content cannot cause network requests or
code execution.

Represent domain and application failures with typed outcomes. Use SvelteKit
route errors for request/navigation failures and `<svelte:boundary>` around
recoverable editor regions. Event handlers and asynchronous adapters report
through the Project Session because render boundaries cannot catch those
failures.

Keep a bounded local diagnostic log. Diagnostic export is explicit and redacts
project values by default. Do not send telemetry or crash reports.

### Verification and evidence gates

Use:

- Vitest for domain actions, formulas, units, schemas, migrations, and
  fingerprints;
- `fast-check` for properties and invariants;
- Svelte Testing Library for component and keyboard behavior;
- Playwright across Chromium, Firefox, and WebKit for real IndexedDB, Web
  Locks, workers, multi-tab ownership, migration, import/export, server loss,
  responsive behavior, and production builds;
- `fake-indexeddb` only for fast repository tests, never browser lifecycle
  claims; and
- axe-core plus manual keyboard, zoom/reflow, contrast, reduced-motion, and
  screen-reader passes.

Support the current and previous stable desktop Chrome/Edge, Firefox, and
Safari releases. Test responsive tablet and mobile behavior and real supported
device lifecycle before claiming device support. Detect missing required APIs
and block editing with a useful explanation.

Define the expected benchmark fixture as approximately 300 Components, 1,500
Ports, and 1,200 Connections with mixed Wires, Fluid Lines, branches, bundles,
labels, and Overlays. Benchmark at 1x, 2x, and 5x on a 2020-era laptop.

Acceptance targets are:

- 1x and 2x pointer feedback below 100 ms and pan/zoom near 60 frames per
  second;
- 5x remains usable above 30 frames per second without data loss;
- initial workspace display within two seconds after snapshot load; and
- expensive evaluation never blocks editing.

The following spikes are mandatory before the implementation choices they
guard are treated as proven:

1. Svelte Flow custom Ports, exact snapping, routed edges, distinct pipe/wire
   rendering, synchronized lenses, keyboard operation, and responsive review.
2. Graph performance at the 1x, 2x, and 5x fixtures.
3. Whole-document serialization, IndexedDB transaction time, checkpoint growth,
   asset deduplication, quota failure, and recovery at the same sizes.
4. Exchange parse/hash/validation/clone/commit memory and safe limits across
   Chromium, Firefox, and WebKit.
5. Worker clone cost, incremental change-set behavior, cancellation, stale
   publication, crash, and server-loss behavior.
6. Browser lifecycle: persistent-storage grant/denial, eviction messaging,
   multi-tab upgrade, takeover, background/restore, and Safari recovery on real
   devices.
7. Numeric golden fixtures, significant figures, uncertainty handling, exact
   conversions, and cross-browser displayed determinism.

Every pull request runs frozen pnpm installation, formatting, ESLint including
dependency boundaries, `svelte-check`, unit/property/migration/component tests,
the production build, Playwright, exchange golden fixtures, and a bundle-budget
check. Run capacity benchmarks separately to avoid noisy pull-request gates.

Pin direct dependencies and Node/pnpm versions exactly when implementation
begins, and commit the lockfile. Track application, document schema, IndexedDB
structure, formula catalog, validation rules, reference catalog, and exchange
format versions independently.

## Consequences

### Positive

- The server can use SvelteKit's full delivery and rendering model without
  becoming a hidden source of project authority.
- Domain rules, persistence documents, renderer projections, and Svelte state
  have explicit ownership and replacement boundaries.
- Project loss, stale calculations, migrations, and multi-tab conflicts become
  visible product states rather than incidental failures.
- Svelte-native graph tooling can accelerate implementation without locking the
  domain to its types or to React.
- Measurement gates keep large-project, browser durability, and exchange claims
  honest.

### Costs and limitations

- Local use requires a running Node/SvelteKit process.
- A browser origin is part of the data architecture; changing it exposes a
  different library unless the user exports and restores a backup.
- IndexedDB cannot guarantee protection from browser eviction, profile loss, or
  device loss. Users still need Library Backups.
- Whole-document snapshots and self-contained JSON may impose conservative size
  limits after measurement.
- Persisted result runs and recovery history consume storage and require
  reachability maintenance.
- The graph library remains provisional until the product-specific spike
  passes.
- Other devices have independent libraries; there is no synchronization.
- Release packaging and friendly installation remain unresolved.

## Alternatives considered

### Static SvelteKit application with a service worker

This was the smallest research recommendation and would provide installable
offline delivery. It was rejected because the accepted product direction
requires a running SvelteKit server and wants to retain server-native
capability. A service worker is also unnecessary for no-internet operation when
the local server is running and would add update choreography. The loaded-editor
degraded mode is intentionally narrower than serverless operation.

### Server-owned project storage

Rejected because it would contradict the authoritative browser-local Project
Library and reopen accounts, synchronization, conflict resolution, deployment,
and server durability.

### Client-only SPA mode

Rejected because it discards SvelteKit's default SSR/CSR behavior and adds
startup waterfalls without solving a required boundary.

### Dexie or a server database

Rejected initially because the project is held in memory and persisted in
coarse atomic records. The thinner `idb` wrapper exposes the required native
upgrade, transaction, and blocking semantics without another reactive data
model.

### Event sourcing, collaboration, and plugin architecture

Rejected because no MVP requirement needs a replay log, distributed merge,
generic extension host, or multiple sources of truth. Immutable snapshots,
checkpoints, named snapshots, and explicit versioned exchange satisfy the
settled lifecycle.

### React or a React-backed canvas

Rejected by product constraint. The provisional graph dependency is the
Svelte-native `@xyflow/svelte` package behind an application-owned adapter.

### General units or expression frameworks

Rejected because a small versioned unit registry and named pure formulas make
dimensions, assumptions, sources, versions, and failures easier to audit.

## Deferred

- Accounts, authentication, cloud persistence, synchronization, collaboration,
  and live sharing.
- Server-side project APIs, calculations, validation, and reporting.
- Service-worker/PWA installation and serverless operation.
- Release artifacts, installers, automatic updates, daemons, and package
  publication.
- Partial-project exchange, merge, live file linkage, and mobile mutation.
- Persistent File System Access handles, encrypted or signed exchange, SVG
  import, user-authored formulas, and plugin execution.
- Renderer replacement unless the Svelte Flow spike fails.
