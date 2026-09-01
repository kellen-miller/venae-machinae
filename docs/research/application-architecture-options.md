# Application architecture and delivery options

Research snapshot: 2026-09-01.

## Scope and decision constraints

[Issue #11](https://github.com/kellen-miller/venae-machinae/issues/11) fixes
Svelte and SvelteKit as the production framework, excludes React, and asks for
one coherent architecture rather than a technology menu. The parent
[product map](https://github.com/kellen-miller/venae-machinae/issues/1) and the
resolved persistence, operating-state, validation, and dense-view decisions
add stronger constraints:

- the browser-local working copy is authoritative;
- the application must work offline after it has become available;
- autosave, snapshots, migration, quarantine, and project exchange are product
  behavior, not incidental storage details;
- calculations and overlays are deterministic, versioned, read-only derived
  results which preserve unknowns, conflicts, provenance, and stale state;
- desktop and tablet edit; mobile reviews only; and
- the topology canvas, dense views, and accessible nonvisual representations
  share one authoritative selection and project state.

This note separates facts supported by primary sources from recommendations.

## Decision outcome after grilling

The accepted architecture differs from the smallest research recommendation in
one deliberate way: local use requires a running SvelteKit server so the
application can use SvelteKit's server runtime and retain a direct path to
future server-owned capabilities. The server remains stateless for Vehicle
Projects. Browser IndexedDB remains authoritative, and engineering evaluation
remains local.

The accepted delivery choices are `adapter-node`, default hybrid SSR/CSR, one
stable loopback origin, and no service worker for the MVP. The static-host and
service-worker material below remains evidence for an evaluated alternative;
it is not the final decision. The complete accepted shape is recorded in
[`docs/adr/0001-local-first-sveltekit-architecture.md`](../adr/0001-local-first-sveltekit-architecture.md).

## Pre-grilling research recommendation

Use a statically deployed, browser-only SvelteKit application:

| Concern | Choice |
| --- | --- |
| Language and framework | Strict TypeScript, Svelte 5, SvelteKit 2 |
| Rendering and interaction | `@xyflow/svelte` through a project-owned projection adapter; custom Svelte nodes and SVG edges |
| Application state | One per-project `ProjectSession` created at the app boundary; Svelte 5 runes for UI reactivity; all mutations enter one explicit action executor |
| Domain and calculations | Framework-free TypeScript modules; branded dimensions; decimal strings at boundaries; `decimal.js` in formula execution |
| Runtime validation | Zod 4 strict schemas at persistence, import, worker, and asset boundaries |
| Persistence | IndexedDB through `idb` 8; current whole-project snapshots plus separately deduplicated assets, checkpoints, named snapshots, templates, trash, and migration rollback records |
| Multi-tab ownership | One exclusive Web Lock per project; BroadcastChannel only for status and takeover coordination |
| Background work | One module Web Worker for overlay, calculation, and full-validation runs; immediate mutation checks remain synchronous |
| Offline delivery | `adapter-static`; a prerendered shell; SvelteKit's native service worker; a standards-based web app manifest |
| Tests | Vitest, Svelte Testing Library, Playwright in Chromium/Firefox/WebKit, and axe-core plus manual accessibility testing |
| Hosting | Cloudflare Pages at a stable custom origin, serving only the static build |

Do not add a backend, server database, account layer, sync engine, event store,
generic formula interpreter, canvas scene graph, or plugin framework for the
MVP.

## Evidence

### The static SvelteKit alternative preserves routes

SvelteKit's official `adapter-static` prerenders a site into static files. Its
fallback option can also create a client-only SPA, but SvelteKit explicitly
warns that blanket SPA mode harms startup performance, SEO, and resilience and
recommends prerendering as much as possible
([static adapter](https://svelte.dev/docs/kit/adapter-static),
[SPA guidance](https://svelte.dev/docs/kit/single-page-apps)). A
`src/service-worker.ts` is bundled and automatically registered; the
`$service-worker` module exposes build files, static files, prerendered pages,
the app version, and the deployment base path for versioned caching
([SvelteKit service workers](https://svelte.dev/docs/kit/service-workers)).

A web app manifest supplies install metadata, app identity, start URL, display
mode, icons, and navigation scope. Its specification recommends declaring
scope explicitly; manifest identity and start URL are same-origin concepts
([Web Application Manifest](https://www.w3.org/TR/appmanifest/)). Service
workers require HTTPS outside localhost
([MDN service-worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)).

Service-worker updates are not instantaneous. SvelteKit notes that client-side
navigation does not itself check for an update, and a newly installed worker
normally waits until tabs controlled by the old worker close. Forcing
`skipWaiting()` can instead activate it immediately
([SvelteKit update behavior](https://svelte.dev/docs/kit/service-workers#Updating-the-service-worker),
[platform lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers#basic_architecture)).

### Svelte 5 supports an explicit application-state boundary

Svelte 5's `$state` creates reactive state and deeply proxies ordinary objects
and arrays; `$state.raw` instead requires replacement rather than deep
mutation. Runes may live in `.svelte.ts` modules
([Svelte `$state`](https://svelte.dev/docs/svelte/$state)). Svelte context
provides a parent-owned value to descendants without a process-global
singleton, and `createContext` provides a typed API
([Svelte context](https://svelte.dev/docs/svelte/context)).

These are UI reactivity mechanisms, not persistence or domain architecture.
Nothing in Svelte requires persisted records, worker messages, or calculation
code to depend on Svelte.

### IndexedDB supplies the required transaction and storage primitives, not a durability guarantee

IndexedDB stores significant structured data and blobs, is asynchronous,
same-origin, and transactional
([IndexedDB overview](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)).
The specification describes a transaction as an atomic and durable set of
operations and requires rollback on abort
([IndexedDB 3.0](https://www.w3.org/TR/IndexedDB/)). In practice, browser
durability has limits: MDN documents that Firefox may report transaction
completion after asking the OS to write, before a physical flush, so a power
loss can still lose the transaction
([Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB#adding_data_to_the_database)).
The product may therefore say "Saved" after the browser transaction completes,
but must not imply filesystem-level or device-loss protection.

`idb` closely mirrors native IndexedDB while adding promises, typed schemas,
transaction completion, and explicit upgrade/blocked/blocking/terminated
hooks ([`idb` repository](https://github.com/jakearchibald/idb)). Dexie is a
richer wrapper with typed tables, declarative versions, transactions, queries,
and live-query support
([Dexie API](https://dexie.org/docs/API-Reference)); Dexie 4 also documents
Safari-specific workarounds and ongoing Safari testing
([Dexie on Safari](https://dexie.org/docs/IndexedDB-on-Safari)). Those richer
query/reactivity features are not currently required because the authoritative
project is held and queried in memory.

Browser storage is best-effort by default. `navigator.storage.persist()` can
request protection from storage-pressure eviction, `estimate()` reports
approximate usage and quota, and writes can fail with `QuotaExceededError`
([storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).

The Web Locks API offers origin-scoped exclusive locks across tabs and workers
and supports nonblocking `ifAvailable` acquisition. MDN reports it as widely
available since March 2022
([Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)).
BroadcastChannel provides same-origin communication among tabs and workers,
but defines no ownership or negotiation protocol
([BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)).

### The Svelte-native topology options have different costs

`@xyflow/svelte` is not a React adapter. Its package is implemented in Svelte,
declares Svelte 5 as its peer, and has no React runtime dependency
([package manifest](https://github.com/xyflow/xyflow/blob/main/packages/svelte/package.json)).
Its model provides an infinite pan/zoom viewport, custom Svelte nodes, multiple
handle IDs, selectable and focusable SVG edges, custom edge rendering,
connection validation, keyboard accessibility, and optional visible-element
culling
([concepts](https://svelteflow.dev/learn/concepts/terms-and-definitions),
[handles](https://svelteflow.dev/api-reference/components/handle),
[component API](https://svelteflow.dev/api-reference/svelte-flow),
[edge API](https://svelteflow.dev/api-reference/types/edge)). The project is
MIT licensed and its security policy lists `@xyflow/svelte` 1.x as supported
([repository](https://github.com/xyflow/xyflow),
[supported versions](https://github.com/xyflow/xyflow/security)).

Plain Svelte plus SVG would minimize dependencies and maximize rendering
control, but the project would own pan/zoom, selection, drag, snapping,
connection gestures, hit areas, culling, keyboard interaction, and focus
management.

Konva and its official `svelte-konva` binding are genuinely Svelte-capable and
offer a retained Canvas scene graph, hit detection, layers, drag, transform,
and high shape counts
([Konva overview](https://konvajs.org/docs),
[Svelte binding](https://konvajs.org/docs/svelte/index.html)). However, Konva
states that Canvas shapes do not create accessible DOM elements and that
essential controls and content need an HTML equivalent
([Canvas versus SVG](https://konvajs.org/docs/posts/canvas-vs-svg.html)). Its
Svelte binding also documents a conditional-rendering/z-order caveat
([Svelte z-order behavior](https://konvajs.org/docs/svelte/zIndex.html)).

### Deterministic calculations need a narrower contract than a general math engine

`decimal.js` provides arbitrary-precision decimal arithmetic, TypeScript
declarations, no runtime dependencies, independent cloned constructors, and
explicit precision and rounding configuration. It recommends constructing
from strings when values carry more than a few digits, to avoid first losing
precision through JavaScript `number`
([decimal.js repository](https://github.com/MikeMcl/decimal.js)). It is MIT
licensed.

Math.js can combine units with BigNumber or Fraction values and supports
dimensional comparison and conversion
([math.js units](https://mathjs.org/docs/datatypes/units.html)). That capability
is real, but its broad unit catalog, expression evaluator, matrices, dynamic
types, and user-defined units exceed this product's application-owned,
versioned formula catalog. No user-authored formulas or executable rules are
in scope.

Structured cloning is used by both IndexedDB and worker `postMessage`.
Functions and DOM nodes cannot be cloned, property descriptors and accessors
are not preserved, and prototype chains are not copied
([structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)).
Persisted and worker-facing values should therefore be plain, versioned DTOs,
not `Decimal`, Svelte proxy, or domain class instances.

### Runtime schemas complement TypeScript

TypeScript types do not validate untrusted JSON at runtime. Zod 4 is stable,
has no external dependencies, runs in modern browsers, infers TypeScript types,
and converts schemas to JSON Schema
([Zod overview](https://zod.dev/),
[JSON Schema conversion](https://zod.dev/json-schema)). Zod also documents
which types and transforms cannot be represented in JSON Schema, so generated
JSON Schema must be treated as documentation/tooling output, not an exact
replacement for the runtime parser.

Valibot is a maintained, MIT-licensed, modular alternative with much smaller
tree-shaken bundles and runtime/static inference
([Valibot repository](https://github.com/open-circle/valibot)). Bundle size is
not the dominant cost in this graphics-heavy offline app, while Zod's stable
JSON Schema export and larger established surface are directly useful for a
versioned exchange format.

### Workers isolate CPU work but introduce a serialization boundary

Web Workers run off the main document thread and exchange messages using
structured cloning. Transferable buffers can avoid copies for large binary
data, but ownership moves to the receiver
([Using Web Workers](https://developer.mozilla.org/docs/Web/API/Web_Workers_API/Using_web_workers),
[transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)).
That supports responsive calculation and overlay evaluation, but sending an
entire project still has a cloning cost and results can race newer edits.

### Accessibility cannot be delegated to the graph library

WCAG 2.2 AA adds requirements for an alternative to dragging, focus not being
obscured, and minimum pointer-target size/spacing
([WCAG 2.2 additions](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/),
[dragging alternative technique](https://www.w3.org/WAI/WCAG22/Techniques/general/G219)).
The topology renderer's built-in keyboard behavior is useful, but it cannot by
itself supply the required textual trace, dense tables, error summaries, or
non-drag workflows.

Svelte recommends Vitest for Vite/SvelteKit unit tests, demonstrates Svelte
Testing Library for behavior-oriented component tests, and documents
Playwright for end-to-end testing
([Svelte testing](https://svelte.dev/docs/svelte/testing)). Playwright can
emulate offline contexts, though direct service-worker inspection is
Chromium-only
([Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext)).
axe-core covers WCAG rules in automated browser tests but its own project says
automation finds only a portion of accessibility issues, leaving manual review
necessary
([axe-core](https://github.com/dequelabs/axe-core)).

### The static-host alternative makes origin part of the data architecture

Cloudflare Pages supports `adapter-static`, serves the resulting `build`
directory, rebuilds from Git pushes, and supplies preview deployments
([Cloudflare SvelteKit guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/)).
Pages serves matching static routes and, when no top-level `404.html` exists,
falls back to the root for SPA routes
([Pages serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/)).

Because IndexedDB, Cache Storage, Web Locks, and BroadcastChannel are scoped by
origin, a host or domain change produces a different empty library. A stable
custom domain is therefore not branding alone: it is the namespace of the
user's authoritative local data. Preview deployments are separate libraries
and must be treated as disposable evaluation environments.

## Recommended application boundaries

### One explicit mutation path

Create one `ProjectSession` per open project in a Svelte context. It owns:

- `current`: a `$state.raw<ProjectSnapshot>` value replaced after each accepted
  action;
- transient selection, viewport, open lens, preview, and save/evaluation status
  as separate UI state;
- `execute(action)`, the only domain-mutation gate;
- the debounced autosave queue; and
- the calculation-worker client.

`execute` validates the requested mutation, calls a pure TypeScript domain
function, advances the project revision, replaces `current`, and makes the
pending save visible. Components emit domain intent; they do not write the
snapshot, IndexedDB, or worker directly. Use `$derived` for view projections and
`$effect` only at external boundaries such as persistence scheduling and
worker/service-worker notifications.

Keep the domain model, action executor, validation rules, formulas, migrations,
and exchange codecs free of Svelte and browser APIs. Keep side effects in
plainly named adapters: IndexedDB repository, project write lease, calculation
worker, file import/export, and service-worker update coordinator.

### Project-owned graph projection

Treat Svelte Flow as an interaction and rendering engine, never the domain
model. A single mapper projects Components and Ports to Svelte Flow nodes and
handles, and Connections/Routes/overlay marks to custom SVG edges. Svelte Flow
callbacks become project actions such as `MoveComponent`, `ConnectPorts`, or
`MoveRoutePoint`; no `Node` or `Edge` type crosses into persistence or formula
code.

Custom node/edge components own the visual language for Ports, wires, mates,
fluid lines, findings, selection, provenance markers, temperature fill, and
direction cues. Use its invisible interaction widths and handle radius for
pointer usability, while exact topology compatibility remains a domain rule.
Keep the synchronized table/lens representations as semantic HTML over the
same session and selection.

Choose SVG/Svelte Flow for MVP. Reserve Konva as a later rendering replacement
only if measured project-size tests fail after visible-element culling and
render simplification. The projection boundary makes that replacement possible
without changing the stored model.

### Persistence records and migrations

Use `idb` only inside one repository. Prefer coarse, readable records over a
database mirror of every domain type:

- current project snapshots;
- recovery checkpoints and named snapshots;
- templates and immutable template revisions;
- content-addressed asset blobs plus reference metadata;
- trash;
- library settings and backup health; and
- raw pre-migration rollback/quarantine records.

Autosave overwrites the current whole-project snapshot and related metadata in
one transaction. Checkpoints and named snapshots copy the canonical payload;
assets remain immutable and deduplicated by hash so snapshots do not duplicate
bytes. This is intentionally not event sourcing. Revisit chunking only after
capacity measurements show whole-snapshot writes are too slow or large.

Keep two version mechanisms distinct:

1. IndexedDB database versions change object stores and indexes.
2. `schemaVersion` inside every project/template/exchange payload changes the
   domain document.

For a domain migration: load as `unknown`, select the exact old Zod schema,
parse, migrate one released version at a time with pure functions, validate the
new result, then atomically write both the raw rollback image and new current
record. A newer version stays quarantined and raw-exportable. Imports use the
same parse/migrate/validate path before any library mutation.

Acquire `navigator.locks.request("project:<id>", { ifAvailable: true }, ...)`
for the lifetime of an editable session. Failure opens read-only. Use
BroadcastChannel to announce ownership and a requested takeover; only an
explicit release followed by successful lock acquisition grants editing. Never
use heartbeats or BroadcastChannel messages as proof of ownership.

Request persistent storage, report the returned state and estimated usage, and
handle quota failure. Register `beforeunload` only while unsaved work exists;
MDN documents that the event is unreliable and recommends it sparingly
([beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)).

### Unit-safe deterministic evaluation

Persist every quantity as a plain record containing the original decimal
string, unit ID, dimension ID, applicability, uncertainty/bounds, origin, and
provenance. Do not persist binary floats or normalized values alone.

At a formula boundary:

1. validate dimension and supported unit through exhaustive project-owned
   registries;
2. construct Decimal values from strings;
3. convert through versioned exact factors into a formula's canonical units;
4. run one named, versioned pure formula with a fixed Decimal constructor,
   precision, and rounding policy;
5. return a plain result containing formula revision, referenced input IDs,
   input fingerprint, completeness/status, canonical value, display value,
   assumptions, omissions, and provenance.

Use TypeScript branded dimension types to prevent passing pressure where
current is required, but repeat dimension checks at every untrusted boundary.
Choose 34 significant digits and round-half-even internally, with presentation
rounding recorded separately; approve this numeric policy alongside formula
acceptance fixtures. Do not expose a general expression evaluator.

### One calculation worker, stale-safe publication

Run expensive overlay propagation, calculations, candidate screens, and full
validation in one module worker. Keep cheap mutation validity and immediate
connection compatibility synchronous. The worker request contains a request
ID, project revision, input fingerprint, formula/rule catalog versions, and a
plain project DTO. It returns plain results with the same identities. Publish
only when the revision and fingerprint still match; otherwise retain the last
result visibly stale and schedule replacement. Cancellation and failure are
explicit worker messages/statuses.

Do not let the worker own IndexedDB. Keeping persistence on the application
side makes writes and failure status visible. If structured-clone cost becomes
material, first send narrower evaluation inputs or transferable typed arrays;
do not add shared memory or a second database owner before measurement.

### Superseded static caching and update recommendation

Prerender the public landing/help pages. Make `/app` one known client-rendered
workspace route, with project identity in browser state or a query string, so
static hosting does not require a catch-all route. Use `adapter-static` without
a general SPA fallback unless later routes truly require it.

The native service worker precaches only versioned build assets, the app shell,
manifest/icons, and small built-in reference data. It must never cache project
snapshots or exported files; those belong to IndexedDB and user downloads.
Serve immutable hashed assets cache-first and navigations network-first with a
cached shell fallback. Keep caches versioned and delete old app caches only
after activation.

Check for service-worker updates on full load, return from background, and an
explicit command. When a worker waits, show "Update ready". Before activation,
flush autosave, create the required migration checkpoint when versions demand
it, release the write lease, then activate and reload. Do not call
`skipWaiting()` silently while an editor is open.

Ship a manifest with a stable root-scoped `id`, `scope`, and `start_url`,
standalone display, and maskable/regular icons. Installation is an enhancement;
the ordinary HTTPS site remains fully usable.

### Accessibility and verification

Target WCAG 2.2 AA. Every drag action needs a non-drag path: select then nudge
by keyboard, connect by choosing source and target Ports, route through ordered
point controls, and expose commands in the inspector. Maintain focus and exact
selection across lenses, state switches, and recomputation. Provide at least
24-by-24 CSS-pixel targets or conforming spacing, visible focus, reduced motion,
symbols/text in addition to color, and a semantic HTML topology/list/table and
trace for screen readers.

Use:

- Vitest for pure actions, formulas, unit conversions, schema versions,
  migrations, fingerprints, and validation rules, with
  [`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB) for fast
  repository tests but never as a substitute for browser lifecycle tests;
- Svelte Testing Library for components and keyboard semantics;
- Playwright against the production build in Chromium, Firefox, and WebKit for
  edit flows, multi-tab lease/takeover, IndexedDB reopen/migration/quota
  handling, offline cold/repeat launches, service-worker updates, import/export,
  desktop/tablet/mobile boundaries, reduced motion, and focus retention; and
- axe-core in Playwright plus manual keyboard, zoom/reflow, contrast, and
  screen-reader passes. Automation is not an accessibility sign-off.

## Material uncertainties and required spikes

These facts cannot be settled from documentation alone:

1. **Graph capacity.** Svelte Flow advertises culling and stress examples, but
   no source establishes performance for Venae Machinae's custom multi-stroke
   edges, overlays, labels, and synchronized views. Build one production-style
   benchmark fixture at expected RX-7 size and at 2x/5x size; measure initial
   render, pan/zoom frame time, selection, component drag, route editing, and
   overlay replacement on minimum supported hardware.
2. **Whole-snapshot persistence.** Measure snapshot serialization/clone time,
   IndexedDB transaction time, checkpoint storage growth, asset deduplication, and
   failure recovery at the same sizes in current Chromium, Firefox, and Safari.
   Chunk the model only if this evidence fails an approved interaction/save
   budget.
3. **Worker break-even.** Measure clone time versus main-thread evaluation.
   Small incremental rules may be faster synchronously; the worker boundary is
   for preventing observable jank, not architectural purity.
4. **Browser lifecycle.** Test update waiting, two-tab upgrades, lock takeover,
   background/restore behavior, persistent-storage grant/denial, eviction
   messaging, and Safari IndexedDB recovery on real devices. Browser APIs
   cannot provide device-loss protection.
5. **Numeric policy.** The proposed 34-digit half-even internal policy is a
   deterministic default, not an accuracy claim. Formula-specific significant
   figures, uncertainty propagation, conversion factors, and presentation
   rounding require golden fixtures from the calculation-boundary decision.
6. **Svelte Flow fit.** Confirm custom routed Connection geometry, Ports,
   selectable route points, two-up synchronized viewports, accessible edge
   traces, and mobile read-only behavior in a narrow spike before accepting the
   dependency. Keep its data types outside the domain regardless of outcome.

Architecture acceptance should include explicit capacity budgets rather than
"large project" language. Until expected entity/asset counts and minimum device
are chosen, no renderer or persistence capacity claim is evidence-backed.

## Current dependency and license snapshot

The versions below are registry results observed on 2026-09-01, not a request
to float dependencies. Lock exact resolved versions and review upgrades.

| Package | Observed version | License | Maintenance signal |
| --- | ---: | --- | --- |
| [`svelte`](https://registry.npmjs.org/svelte/latest) | 5.57.0 | MIT | current official release; active first-party repository |
| [`@sveltejs/kit`](https://registry.npmjs.org/%40sveltejs%2Fkit/latest) | 2.70.3 | MIT | current official release; active first-party repository |
| [`@sveltejs/adapter-node`](https://registry.npmjs.org/%40sveltejs%2Fadapter-node/latest) | 5.5.7 | MIT | selected official SvelteKit adapter |
| [`@sveltejs/adapter-static`](https://registry.npmjs.org/%40sveltejs%2Fadapter-static/latest) | 3.0.10 | MIT | evaluated official adapter; not selected |
| [`@xyflow/svelte`](https://registry.npmjs.org/%40xyflow%2Fsvelte/latest) | 1.6.6 | MIT | 1.x listed as supported; active monorepo |
| [`idb`](https://registry.npmjs.org/idb/latest) | 8.0.3 | ISC | stable thin wrapper; repository not archived; last release May 2025 |
| [`decimal.js`](https://registry.npmjs.org/decimal.js/latest) | 10.6.0 | MIT | active repository; documented tests and TypeScript declarations |
| [`zod`](https://registry.npmjs.org/zod/latest) | 4.5.4 | MIT | Zod 4 documented stable; active repository |
| [`vitest`](https://registry.npmjs.org/vitest/latest) | 4.1.11 | MIT | current Svelte-recommended runner; active repository |
| [`fast-check`](https://registry.npmjs.org/fast-check/latest) | 4.9.0 | MIT | selected property-testing library |
| [`@testing-library/svelte`](https://registry.npmjs.org/%40testing-library%2Fsvelte/latest) | 5.4.2 | MIT | Svelte docs integration; active repository |
| [`@playwright/test`](https://registry.npmjs.org/%40playwright%2Ftest/latest) | 1.62.1 | Apache-2.0 | active first-party browser automation project |
| [`axe-core`](https://registry.npmjs.org/axe-core/latest) | 4.13.0 | MPL-2.0 | active Deque repository; WCAG 2.2 rules |
| [`fake-indexeddb`](https://registry.npmjs.org/fake-indexeddb/latest) | 6.2.5 | Apache-2.0 | active IndexedDB test double; not a real-browser substitute |

`idb`, Svelte Flow, decimal.js, and Zod are the production dependencies added
by this recommendation. The rest are build/test dependencies. Recheck registry
versions, licenses, engine requirements, and security support when the
implementation lockfile is created.
