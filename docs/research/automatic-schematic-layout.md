# Automatic schematic placement and routing

Research snapshot: **2026-10-16**. Research only; no application dependencies or
behavior changed. Recommendations below are engineering judgments, distinct
from the linked, verified library capabilities. No candidate was benchmarked. This note proposes a comparison, not a claim
that an engine has already solved Venae’s overlaps.

## Recommendation

Evaluate **ELK Layered through elkjs first** for automatic arrangement. It
combines part placement, explicit connection ports, orthogonal routing, and
label space in one layout. Evaluate **libavoid separately** for rerouting lines
around parts that the user has already positioned. These solve different jobs;
installing a router alone will not untangle poor part placement.

For hobbyists, expose **Tidy diagram**, **Tidy this system**, and **Keep here**.
Preview the result, animate a short transition, and provide one Undo. Keep the
algorithm options internal. Prefer a readable main circuit with separated
return lines, visible branches, and generous space over the smallest drawing.
This is a proposed UX, not an implemented feature.

“Optimal” needs a defined objective. There is no verified universal guarantee
here of simultaneously optimal part positions, minimum crossings, minimum
bends, shortest lines, exact grid alignment, and preserved manual positions.
Some graphs require crossings in a two-dimensional drawing. A crossing must
look different from an actual junction; coincident routes must never imply an
electrical splice or shared fluid passage that the project does not contain.

## Why the present drawing remains hard to follow

The local renderer audit found persisted node positions rather than a placement
algorithm. Ports choose sides from peer x-coordinates. Default routes begin
with a midpoint dogleg and try above/below detours for three passes using a
spatial index. They do not jointly optimize routes or check line-label and
line-line collisions. Source and destination parts are excluded wholesale from
obstacle tests. Label placement chooses the longest segment's midpoint;
rounded bends are added afterward. A spatial index accelerates collision
queries; it does not find a good layout.

Relevant owning files are [`projection.ts`](../../src/lib/renderer/projection.ts),
[`adapter.ts`](../../src/lib/renderer/svg/adapter.ts), and
[`SVGRenderer.svelte`](../../src/lib/renderer/svg/SVGRenderer.svelte). Manual
dragging snaps to 8 units while port slots advance by 22 units, so the existing
geometry is not consistently grid aligned. Fixing that mismatch alone would
not fix routing congestion.

## What “no overlap” should mean

Treat the following as **hard acceptance constraints**, checked independently
after layout and rendering adjustments:

- Part bounds, including visible port/name labels, do not overlap other parts.
- Lines avoid unrelated parts and labels, including their visible stroke,
  casing, and rounded bends. A line can enter its endpoint part only through
  the intended port's short entry corridor.
- Unrelated parallel lines have a visible gap and do not share a segment.
  Deliberate common-port fanout is explicitly represented and localized.
- Endpoints remain attached to the correct project ports; connection identity,
  topology, actual junctions, and user locks are preserved.
- Grid requirements are explicit: part origins, port anchors, and route lanes
  are separate requirements. A faint background grid is not a geometry guarantee.
- Infeasible locks or corridors produce a visible unresolved result, never an
  apparently successful route through an obstacle.

Optimize **soft objectives only after feasibility**: fewer crossings, obvious
main paths, clear loop returns, fewer bends, shorter routes, aligned parts,
balanced whitespace, compact system groups, and minimal movement after edits.
Use ordered priorities rather than allowing a shorter route to compensate for
an overlap. User comprehension is the final measure; a mathematically shorter
diagram may be harder to trace.

For a line of outer width `w` and desired visible gap `c`, inflate node
obstacles by at least `w / 2 + c`. Parallel centerlines require at least
`(w1 + w2) / 2 + c` separation. Include casing in `w`. Current strokes range up
to 26 screen pixels plus 4 outer pixels, so fixed 10-unit obstacle padding cannot cover
every line even at 1:1 scale. These are proposed geometric boundary rules,
not claims that every library implements them automatically.

The current SVG uses non-scaling strokes and screen-sized badges. At total
diagram-to-screen scale `s` (SVG viewBox scale times viewport zoom), a
screen-space width consumes `width / s` world units; node clearance becomes
`(w / 2 + c) / s`. Choose a
supported clearance zoom range, or simplify/hide labels and cap widths at
overview zoom. Do not rerun the whole layout on every wheel event or promise
clearance at arbitrarily small zoom with fixed screen-sized details.

## Algorithms behind the candidates

**Layered/Sugiyama layout** separates cycle handling, layer assignment,
crossing reduction, coordinate placement, and routing. It gives a schematic
an intentional reading order instead of merely repelling overlapping boxes.
This is the practical baseline for Venae; a loop's backward drawing edge does
not establish reverse physical flow.
([ELK's five phases](https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html))

**Orthogonal visibility-graph search** solves routes around already positioned
obstacles. A* searches a sparse graph of useful horizontal/vertical corridors;
turn-aware costs discourage unnecessary bends. A uniform **grid/maze A***
router is an alternative when an exact routing lattice matters more than
reducing search space. Neither method places parts or jointly optimizes every
line. See the libavoid optimality scope and strict-grid requirements below.
([Routing algorithm paper](https://people.eng.unimelb.edu.au/pstuckey/papers/gd09.pdf))

**Constraint/stress layout** combines attractive placement objectives with
explicit separation and alignment constraints. It is useful for retaining a
recognizable arrangement after edits; unconstrained force simulation alone
cannot provide the required rectangle and lane guarantees.
([WebCoLa](https://ialab.it.monash.edu/webcola/))

**HOLA** combines a graph's cyclic core, separately arranged trees, stress
minimization, greedy orthogonal alignment, and routing. Its human-centered
criteria make it a useful quality reference for Venae's loop-and-branch
circuits. **Integer/constraint optimization** can instead encode a bounded
layout problem exactly, but proving that model's optimum is a different goal
from making the most understandable diagram. Both are discussed below.
([HOLA algorithm](https://ialab.it.monash.edu/~dwyer/papers/hola2015.pdf),
[CP-SAT solution statuses](https://developers.google.com/optimization/cp/cp_solver))

## Candidate comparison

| Candidate | Best use | Important limits for Venae |
| --- | --- | --- |
| ELK Layered / elkjs | Arrange a whole schematic, including parts, ports, lines, labels | Heuristic layout; exact pins and a uniform grid need separate handling and verification |
| libavoid / libavoid-js | Obstacle-avoiding lines between existing positioned parts | No node placement; label placement and stroke-aware validation remain app work; WASM integration |
| Dagre | Simple directed diagrams; useful lightweight placement baseline | Documented API lacks ELK-style port constraints and integrated orthogonal obstacle routing |
| Graphviz dot + ortho | Offline/reference comparison or export | Official ortho documentation excludes port handling and dot edge labels |
| WebCoLa / constraint layout | Preserve arrangement, align/group parts, remove node overlap | Additional port-aware routing and grid constraints needed |
| HOLA / libdialect | Research comparison for balanced, human-readable orthogonal networks | C++ integration; application-specific ports, labels, locks, and browser packaging need investigation |

### ELK Layered: strongest initial candidate

Verified: Layered supports ports, edge labels, multiedges, self-loops, and
compound graphs. Orthogonal routing respects port constraints. Its staged
method handles cycles while attempting to orient most edges consistently;
cycle breaking for layout must not change the domain's flow semantics.
Crossing minimization is an optimization stage, not a crossing-free promise.
([Algorithm reference](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html),
[phase structure](https://eclipse.dev/elk/documentation/algorithmdevelopers/algorithmimplementation/algorithmstructure.html))

Port constraints include `FREE`, `FIXED_SIDE`, `FIXED_ORDER`, `FIXED_RATIO`, and
`FIXED_POS`. For editable generic parts, start with fixed side/order and let
layout distribute ports. For symbols with meaningful physical anchors, supply
fixed positions relative to the part. Do not allow visual port reordering to
change which fitting or terminal a connection refers to.
([Port constraints](https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html))

ELK JSON represents measured node, port, and label rectangles, plus output edge
sections with start/end points and bends. Supply actual text dimensions before
layout; do not add an unmeasured size badge afterward. Hierarchical coordinates
must be transformed correctly into the renderer's space.
([JSON format](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html))

Candidate configuration to test, with application-specific spacing derived
from the largest visible line and label envelopes:

```json
{
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.spacing.nodeNode": "48",
  "elk.layered.spacing.nodeNodeBetweenLayers": "80",
  "elk.spacing.edgeNode": "24",
  "elk.layered.spacing.edgeNodeBetweenLayers": "24",
  "elk.spacing.edgeEdge": "24",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "24",
  "elk.randomSeed": "1",
  "elk.layered.mergeEdges": "false"
}
```

These numbers are starting hypotheses, not established safe defaults. ELK's
spacing documentation explicitly measures edge clearance to the **centerline**;
its `elk.edge.thickness` property is documented as a **hint**, not a hard
stroke-clearance guarantee. Validate the output even when supplying thickness.
([Spacing](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/spacingdocumentation.html),
[edge thickness](https://eclipse.dev/elk/reference/options/org-eclipse-elk-edge-thickness.html))

Stability is partial: semi-interactive crossing minimization preserves an
existing within-layer order based on supplied positions. That is useful for
mental-map stability but is not absolute-coordinate pinning. `elk.position`
documents predefined positions for Fixed Layout; Fixed Layout keeps existing
geometry rather than arranging neighbors around arbitrary locked nodes.
`elk.noLayout` can exclude elements, so it is not evidence of an obstacle-aware
pinning mechanism. A general interactive flag is likewise insufficient proof.
([Semi-interactive order](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-semiInteractive.html),
[position](https://eclipse.dev/elk/reference/options/org-eclipse-elk-position.html),
[Fixed](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-fixed.html),
[No Layout](https://eclipse.dev/elk/reference/options/org-eclipse-elk-noLayout.html),
[interactive flag](https://eclipse.dev/elk/reference/options/org-eclipse-elk-interactiveLayout.html))

elkjs computes geometry, not UI. It provides promise-based layout and Web Worker
support; use a worker and discard results for superseded project revisions.
Its documented default algorithms do not include libavoid: ELK's separate
libavoid reference does not mean the stock elkjs bundle contains that C++
router. At research time the repository manifest identifies version `0.13.0`
and license expression `EPL-2.0 OR GPL-3.0-or-later`; this is a repository
snapshot, not verification of the latest published npm package.
([elkjs API](https://github.com/kieler/elkjs),
[manifest](https://github.com/kieler/elkjs/blob/master/package.json),
[license](https://github.com/kieler/elkjs/blob/master/LICENSE.md))

### libavoid: better match for fixed parts and interactive rerouting

Verified: libavoid is a C++ obstacle-avoiding orthogonal/polyline router.
`moveShape` marks affected connectors for rerouting, and `processTransaction`
batches changes. It does not place ordinary component nodes. ELK classifies
its adapter as edge routing only.
([Overview](https://www.adaptagrams.org/documentation/libavoid.html),
[Router API](https://www.adaptagrams.org/documentation/classAvoid_1_1Router.html),
[ELK adapter](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-alg-libavoid.html))

The underlying paper describes an orthogonal visibility graph, A* routing,
then ordering/centering/nudging shared segments. Its optimality claim concerns
an individual connector's monotonic cost of length and bend count for fixed
obstacles and endpoints. It does **not** establish globally optimal node
placement or jointly minimum crossings across all connectors. A uniform grid
search is an alternative, but its state size grows with grid area/resolution;
the visibility graph adapts to obstacle geometry instead.
([Wybrow, Marriott, Stuckey, Orthogonal Connector Routing](https://people.eng.unimelb.edu.au/pstuckey/papers/gd09.pdf))

Practical options include `shapeBufferDistance`, `idealNudgingDistance`, and
nudging shared paths. Ideal nudging distance is not an unconditional minimum
gap when a corridor cannot accommodate its lanes. The official documentation
marks `crossingPenalty` experimental and not recommended for normal use;
benchmark any use instead of treating a large penalty as a no-crossing rule.
Disable any topology-changing hyperedge improvement unless its output is
strictly presentational and cannot alter project junction semantics.
([Routing parameters and options](https://www.adaptagrams.org/documentation/namespaceAvoid.html))

Browser packaging is additional work. `libavoid-js` uses Emscripten/WebIDL and a
WASM asset; its repository manifest is `0.4.5`, `LGPL-2.1-or-later`. The build
script pins an **Aksem/adaptagrams fork**, version `1.0.4`, rather than current
upstream. Upstream headers also state LGPL-2.1-or-later. Verify the exact shipped
sources, notices, fork fixes, exposed API, resource disposal, and browser asset
loading before selecting a build. This report records license metadata; it
does not interpret redistribution obligations.
([Wrapper](https://github.com/Aksem/libavoid-js),
[manifest](https://github.com/Aksem/libavoid-js/blob/master/package.json),
[build script](https://github.com/Aksem/libavoid-js/blob/master/tools/generate.py),
[upstream header](https://github.com/mjwybrow/adaptagrams/blob/master/cola/libavoid/router.h))

### Other options

**Dagre** is client-side directed layout under MIT. Its documented API accepts
node dimensions, rank direction/separation, edge weights, and label dimensions,
and returns center coordinates and edge points. The examples include diagonal
segments; this is not a substitute for an orthogonal port-aware router. Keep it
as a placement-only baseline, not the preferred integrated solution.
([Repository/license](https://github.com/dagrejs/dagre),
[configuration and output](https://github.com/dagrejs/dagre/wiki))

**Graphviz dot** is a useful layered reference. However,
`splines=ortho` explicitly does not handle ports or dot edge labels. `pin` is
documented for neato/fdp, not dot; `quantum` rounds label dimensions, not all
coordinates onto a layout grid. These are material mismatches here. Graphviz's
current license page identifies EPL 2.0.
([Orthogonal limitations](https://graphviz.org/docs/attrs/splines/),
[attributes](https://graphviz.org/doc/info/attrs.html),
[license](https://graphviz.org/license/))

**Force/constraint alternatives:** D3's collision force uses circles and soft,
iterative collision resolution; it does not establish hard rectangular part,
port, label, or routing clearance. WebCoLa offers rectangle overlap constraints,
alignment/grouping, and optional obstacle-avoiding routing. Its documented
optimization reaches a local optimum. It is MIT-licensed and worth considering
for gentle rearrangement around existing positions, but this does not establish
ELK-equivalent fixed-port/grid routing capability.
([D3 collision](https://d3js.org/d3-force/collide),
[WebCoLa capabilities](https://ialab.it.monash.edu/webcola/),
[WebCoLa license](https://github.com/tgdwyer/WebCola/blob/master/LICENSE))

**HOLA** is particularly relevant to the user's aesthetic goal. Its human
studies inform orthogonal alignment, balance, and route design; its evaluated
layouts improved preference and path-finding performance in the studied tasks.
That evidence is not a benchmark against today's elkjs or on RX-7 schematics.
Implementation lives in Adaptagrams' C++ libdialect. Consider its principles
and a later comparison for cyclic circuits rather than assuming a ready-made
browser integration or verified fixed-port support.
([HOLA paper](https://ialab.it.monash.edu/~dwyer/papers/hola2015.pdf),
[libdialect interface](https://www.adaptagrams.org/documentation/hola_8h_source.html))

**Exact optimization** is useful as a small offline reference, not the proposed
interactive default. An integer/constraint model could encode grid coordinates,
non-overlap, locks, candidate route lanes, and a stated objective. OR-Tools
CP-SAT distinguishes `OPTIMAL`, `FEASIBLE`, and `UNKNOWN`: finding a feasible
layout before a time limit does not prove optimality. Any proof applies to the
encoded, bounded model, not aesthetic quality in general. Building that model
would itself be substantial work.
([CP-SAT statuses and integer constraints](https://developers.google.com/optimization/cp/cp_solver))

## Grid handling and integration boundary

Recommendation: define one geometry policy before evaluating engines. Use an
8-unit base grid, grid-compatible node dimensions/port slots, and explicit
connection channels. Begin with aligned nodes and orthogonal lines; require
every bend on the uniform grid only if it materially improves the experience.
No inspected ELK Layered documentation guarantees that arbitrary inputs emerge
on a chosen uniform grid.

Do **not** independently round every node and bend after layout. That can move
ports off their line endpoints, collapse lanes, destroy orthogonality, and push
lines into labels. For a strict grid: quantize node placement, resolve overlaps
with grid-based separation constraints, recompute anchors, then reroute against
the final geometry. Validate again after lane nudging, label placement, and
bend rounding. A custom A* fallback would need direction in its search state
to price bends, inflated occupied cells, explicit endpoint corridors, and a
failure result; sequential routing alone would remain order-dependent.
With an admissible heuristic, A* can optimize a single fixed discrete search
problem; that does not jointly optimize all routes and part placement.

Pack disconnected systems into separate readable groups, preserving shared
part identity across views. Layout direction is a visual convention. Arbitrary
stored source/target ordering must not become an invented fluid-flow arrow;
unknown flow stays unknown. Use a bridge/gap for a transverse crossing and a
dot only for an actual project junction.

Keep automatic diagram geometry separate from authored physical hose/cable
routes. Diagram length is not physical length. Preserve manual routes unless
the user explicitly chooses to replace them. Add an atomic layout action,
revision checks, persisted locks, and one undo record; the existing move and
physical-route actions do not by themselves supply that lifecycle. These are
integration requirements, not changes made by this research.

The audit measured 1,858,578 bytes of JavaScript against the existing 2 MiB cap,
leaving 238,574 bytes. Measure actual production bundle and worker/WASM costs.
Lazy loading can reduce initial load, but does not automatically satisfy a
total-output cap. Engine selection may require a deliberate budget decision.

## Proposed bakeoff and acceptance

Compare current renderer, ELK integrated layout, and ELK placement plus libavoid
rerouting. Add Dagre placement plus the same router as a baseline only if
needed. First evaluate the stock FD fixture (35 parts, 41 lines), each of its
six systems, and edited copies with a dragged/pinned part, long labels, known
-6AN/-8AN widths, and mixed unknown widths. Also test cycles, same-side ports,
parallel edges, dense fanout, narrow blocked corridors, self-loops, disconnected
groups, and larger sparse projects. Never change stock specifications merely
to create a visual test.

Use identical measured bounds and presentation in every candidate. Record
cold/steady layout duration, p50/p95 across repeated runs, worker startup,
output size, crossings, parallel-route overlap length, bends, canvas area, and
node displacement after one edit. Fixed seed and input ordering aid repeatable
comparison; store version/options with the evidence.

Reject outputs with any unexpected part-part, line-part, label-part,
label-label, or line-label collision; wrong/detached ports; invalid grid
coordinates under the selected policy; or overlapping unrelated parallel
segments. Check swept outer strokes, endpoint corridors, and rounded curves,
not just raw segment centerlines. Permit intentional transverse crossings only
with clear crossing semantics. Run checks at representative overview/edit zoom
levels with screen-sized badges, selection strokes, and hover labels visible.

Finally, compare screenshots and timed hobbyist tasks: trace pump to radiator,
find a return line, distinguish -6AN/-8AN, and identify all branches at a part.
No benchmark or usability result is claimed here. Select the simplest candidate
that passes geometry checks and clearly improves those tasks; retain the old
layout if a proposed arrangement fails.

## Source ledger

All external evidence above is primary: official project docs/source or
author-hosted papers. Direct URLs are linked at the claims they support.
Key entry points for follow-up:

- [ELK Layered options](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)
- [elkjs API, source, and worker support](https://github.com/kieler/elkjs)
- [ELK spacing model](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/spacingdocumentation.html)
- [libavoid API](https://www.adaptagrams.org/documentation/libavoid.html)
- [Orthogonal routing paper](https://people.eng.unimelb.edu.au/pstuckey/papers/gd09.pdf)
- [libavoid-js WASM wrapper](https://github.com/Aksem/libavoid-js)
- [Dagre configuration](https://github.com/dagrejs/dagre/wiki)
- [Graphviz orthogonal routing](https://graphviz.org/docs/attrs/splines/)
- [WebCoLa](https://ialab.it.monash.edu/webcola/)
- [HOLA human-centered layout study](https://ialab.it.monash.edu/~dwyer/papers/hola2015.pdf)
