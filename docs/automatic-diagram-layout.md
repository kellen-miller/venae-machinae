# Automatic diagram layout

The editor uses ELK Layered 0.12.0 for the coordinated layout recommended in
[the research](research/automatic-schematic-layout.md). **Tidy diagram** arranges
the visible circuit. One Undo restores its previous positions and routes. The
stock FD example ships with generated geometry; opening an existing project
does not silently rearrange it.

```text
Visible projection → card/port/badge envelopes → ELK worker
  → expand coordinate gaps onto an 8-unit grid → clearance checks
  → revision/scope check → one session action → save/export/undo
```

The graph uses fixed left/right typed ports, orthogonal routing, separate
parallel lanes, deterministic ordering and a fixed seed. Card widths use
conservative text estimates; badge reservations have fixed dimensions. Unknown
sizes reserve badge space too, without inventing an installed size. Graph
source/target orientation is for layout; it does not establish fluid flow.

Grid alignment expands sorted coordinate gaps; it never rounds each card and
bend independently. Node dimensions and relative port locations expand with
the same mapping. The independent acceptance checks cover card separation,
line/card clearance, badge/card and badge/badge separation, badge/other-line
clearance and parallel line separation. Perpendicular crossings remain possible
and use the existing dark line outline; a crossing is not a topology junction.
Shared physical ports may share a junction stub. These are bounded checks, not
a proof of globally optimal routing or zero crossings.

A filtered circuit is packed below hidden card, route and badge extents so its
new geometry does not land on them. Hidden positions remain unchanged. Routes attached to rearranged shared
parts are invalidated. Manual movement/topology edits clear generated paths and
use the existing live router; **run Tidy diagram again** to reapply coordinated
placement and clearance validation. There is no pinned-node solver or libavoid
integration in this change. Authored topology routes remain stored separately;
Tidy temporarily supersedes their display without changing physical lengths.

Generated geometry lives in project document schema 9, separate from physical
hose/wire measurements. The shared boundary validates identities, typed port
references, endpoint attachment and orthogonality. Schema 8 migrates to schema 9
with no generated layout, including local projects, checkpoints, named snapshots
and library backups. Exchange integrity checks use the original payload before
migration/defaults. Schema-9 exports require this application or a newer version;
reverting the application does not downgrade them.

The client loads ELK only for an explicit Tidy request. Its dedicated worker is
terminated on completion, error, timeout or workspace teardown. A stale revision
or changed filter discards the result. Requests are bounded to 500 visible parts,
1,000 lines and 20 seconds of worker execution. Failed checks leave the previous
diagram intact. Large overview projections can still be viewed without loading
ELK; choose an individual circuit when layout is too large.

ELK is pinned in the package manifest and lockfile. Its source is available at
[kieler/elkjs](https://github.com/kieler/elkjs); the package license is shipped at
`/vendor/elkjs-LICENSE.txt` (EPL-2.0 OR GPL-3.0-or-later).

The production build contains two 1,595,334-byte worker assets (client/server
output), although the browser requests one. Bundle checks retain the 2 MiB app
JavaScript cap, add a 3.25 MiB cap for those worker copies and raise the complete
build cap from 8 to 10 MiB. Tidied physical strokes and reserved badges scale in
world coordinates so zoom does not enlarge their collision envelopes; the hit
area retains a screen-sized target. Overview labels still require zoom for detail.

Validation covers all six stock FD circuits and the combined graph, grid and port
attachment, cycles, long labels, mixed known sizes, deterministic results,
physical-data preservation, save/reload, undo/redo, lazy worker loading and legacy
project/backup migration. Browser checks exercise Chromium, Firefox and WebKit.
