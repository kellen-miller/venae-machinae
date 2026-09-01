/* THROWAWAY PROTOTYPE — illustrative fixture data, no engineering guidance. */

const VARIANTS = {
  A: "View Rail",
  B: "Context Matrix",
  C: "Lens Stack",
};

const VIEWS = [
  ["canvas", "Canvas", "⌁"],
  ["systems", "Systems", "◫"],
  ["connections", "Circuits & Lines", "↝"],
  ["interfaces", "Interfaces", "◇"],
  ["routes", "Routes", "⌇"],
  ["harnesses", "Harnesses & Bundles", "≋"],
  ["calculations", "Calculations", "ƒ"],
  ["evidence", "Evidence", "◉"],
  ["bom", "BOM", "▤"],
  ["findings", "Findings", "△"],
  ["compare", "State Compare", "⇄"],
];

const subjects = {
  pump: {
    id: "pump",
    code: "P1",
    name: "Electric water pump",
    kind: "Component · pump + load",
    domain: "cross",
    system: "Cooling + electrical",
    detail: "Primary selected subject",
    values: ["Flow 92 L/min · manufacturer", "Current 7.8 A · measured"],
    related: ["wire-pump", "line-102", "pump-connector", "pump-fitting"],
  },
  radiator: {
    id: "radiator",
    code: "HX1",
    name: "Radiator",
    kind: "Component · heat exchanger",
    domain: "fluid",
    system: "Cooling",
    detail: "Outlet evidence conflicts",
    values: ["Outlet 79 °C · sensor", "Outlet 84 °C · imported log"],
    related: ["line-102", "finding-temp", "evidence-temp"],
  },
  fan: {
    id: "fan",
    code: "M1",
    name: "Radiator fan",
    kind: "Component · electrical load",
    domain: "cross",
    system: "Fan control + cooling",
    detail: "18 A running current",
    values: ["Running 18 A · measured", "Startup current · Unknown"],
    related: ["wire-fan", "finding-wire"],
  },
  relay: {
    id: "relay",
    code: "K1",
    name: "Fan relay",
    kind: "Component · switch",
    domain: "electrical",
    system: "Fan control",
    detail: "Normally-open switch behavior",
    values: ["Coil 180 mA · sourced", "Normally open · authored"],
    related: ["net-fan", "wire-fan"],
  },
  thermostat: {
    id: "thermostat",
    code: "TH1",
    name: "Thermostat",
    kind: "Component · valve",
    domain: "fluid",
    system: "Cooling",
    detail: "Run Hot binding: open",
    values: ["Begins opening 82 °C · sourced", "Run Hot: open · authored"],
    related: ["line-102", "flow-main"],
  },
  fuse: {
    id: "fuse",
    code: "F1",
    name: "Main fuse",
    kind: "Component · protection",
    domain: "electrical",
    system: "Pump power",
    detail: "Primary pump supply protection",
    values: ["Rating 15 A · authored", "Output Port feeds W-005"],
    related: ["wire-pump", "pump"],
  },
  "wire-pump": {
    id: "wire-pump",
    code: "W-005",
    name: "Pump supply wire",
    kind: "Wire",
    domain: "electrical",
    system: "Pump power",
    detail: "2.0 mm² TXL · 1.31 m",
    values: ["Route R-LOWER · 1.31 m", "Capacity screen · pass"],
    related: ["pump", "route-lower", "calc-pump"],
  },
  "wire-fan": {
    id: "wire-fan",
    code: "W-003",
    name: "Fan supply wire",
    kind: "Wire",
    domain: "electrical",
    system: "Fan control",
    detail: "2.0 mm² TXL · 1.46 m",
    values: ["Required 24 A", "Applicable capacity 20 A"],
    related: ["fan", "relay", "finding-wire", "route-rf"],
  },
  "line-102": {
    id: "line-102",
    code: "L-102",
    name: "Radiator hot-side hose",
    kind: "Fluid Line · hose",
    domain: "fluid",
    system: "Cooling",
    detail: "32 mm EPDM · 1.18 m",
    values: ["Run Hot 94 °C · measured", "Direction engine → radiator"],
    related: ["pump", "thermostat", "radiator", "route-rf"],
  },
  "line-101": {
    id: "line-101",
    code: "L-101",
    name: "Radiator cool-side hose",
    kind: "Fluid Line · hose",
    domain: "fluid",
    system: "Cooling",
    detail: "32 mm EPDM · radiator return",
    values: ["Run Hot 79 °C · sensor", "Direction radiator → pump"],
    related: ["radiator", "pump", "route-rf"],
  },
  "pump-connector": {
    id: "pump-connector",
    code: "X-P1",
    name: "Pump power connector",
    kind: "Mate · electrical",
    domain: "electrical",
    system: "Pump power",
    detail: "DTM 2-way · compatible",
    values: ["Terminal family DTM", "Compatibility compatible · sourced"],
    related: ["pump", "wire-pump"],
  },
  "pump-fitting": {
    id: "pump-fitting",
    code: "F-P1",
    name: "Pump outlet fitting",
    kind: "Mate · fluid",
    domain: "fluid",
    system: "Cooling",
    detail: "AN-20 to 32 mm barb",
    values: ["Seal EPDM · sourced", "Loss coefficient · Unknown"],
    related: ["pump", "line-102"],
  },
  "route-rf": {
    id: "route-rf",
    code: "R-RF",
    name: "Right-front bay route",
    kind: "Route · 3 Segments",
    domain: "cross",
    system: "Shared routing",
    detail: "S-03 → S-04 → S-09",
    values: ["1.46 m design", "As-built length · stale"],
    related: ["wire-fan", "line-102", "finding-route"],
  },
  "route-lower": {
    id: "route-lower",
    code: "R-LOWER",
    name: "Lower engine-bay route",
    kind: "Route · 2 Segments",
    domain: "cross",
    system: "Shared routing",
    detail: "S-06 → S-07",
    values: ["1.31 m design", "Clearance 32 mm · measured"],
    related: ["wire-pump", "pump"],
  },
  "finding-wire": {
    id: "finding-wire",
    code: "F-001",
    name: "Conductor capacity exceeded",
    kind: "Finding · Warning",
    domain: "electrical",
    system: "Fan control",
    detail: "24 A required; 20 A applicable capacity",
    values: ["Severity Warning", "Lifecycle active"],
    subjectId: "wire-fan",
    related: ["wire-fan", "calc-fan"],
  },
  "finding-temp": {
    id: "finding-temp",
    code: "F-003",
    name: "Radiator outlet evidence conflicts",
    kind: "Finding · Warning",
    domain: "fluid",
    system: "Cooling",
    detail: "79 °C sensor; 84 °C imported log",
    values: ["Severity Warning", "Disposition unreviewed"],
    subjectId: "radiator",
    related: ["radiator", "evidence-temp"],
  },
  "finding-route": {
    id: "finding-route",
    code: "F-004",
    name: "As-built route evidence is stale",
    kind: "Finding · Caution",
    domain: "cross",
    system: "Shared routing",
    detail: "Measurement predates latest Route change",
    values: ["Severity Caution", "Evaluation stale"],
    subjectId: "route-rf",
    related: ["route-rf", "evidence-route"],
  },
  "calc-fan": {
    id: "calc-fan",
    code: "CALC-003",
    name: "Fan conductor capacity screen",
    kind: "Screening Result",
    domain: "electrical",
    system: "Fan control",
    detail: "Failed · complete for stated model",
    values: ["Required 24 A", "Limit 20 A"],
    related: ["wire-fan", "finding-wire"],
  },
  "calc-pump": {
    id: "calc-pump",
    code: "CALC-005",
    name: "Pump voltage drop",
    kind: "Calculation Result",
    domain: "electrical",
    system: "Pump power",
    detail: "0.31 V · complete for stated model",
    values: ["7.8 A · measured", "1.31 m Route Length"],
    related: ["pump", "wire-pump"],
  },
  "evidence-temp": {
    id: "evidence-temp",
    code: "EV-009",
    name: "Radiator outlet temperatures",
    kind: "Engineering evidence · conflict",
    domain: "fluid",
    system: "Cooling",
    detail: "Two preserved source values",
    values: ["79 °C · sensor", "84 °C · imported log"],
    related: ["radiator", "finding-temp"],
  },
  "evidence-route": {
    id: "evidence-route",
    code: "EV-014",
    name: "Right-front route measurement",
    kind: "As-Built Evidence · stale",
    domain: "cross",
    system: "Shared routing",
    detail: "Recorded before revision 18",
    values: ["1.51 m · measured", "Current Route 1.46 m"],
    related: ["route-rf", "finding-route"],
  },
  "segment-s03": {
    id: "segment-s03",
    code: "S-03",
    name: "Right-front bay segment",
    kind: "Route Segment · 1 of 3",
    domain: "cross",
    system: "Shared routing",
    detail: "Nested under Route R-RF",
    values: ["0.54 m · measured", "Clearance complete"],
    related: ["route-rf", "wire-fan", "line-102"],
  },
  "segment-s04": {
    id: "segment-s04",
    code: "S-04",
    name: "Radiator support segment",
    kind: "Route Segment · 2 of 3",
    domain: "cross",
    system: "Shared routing",
    detail: "Nested under Route R-RF",
    values: ["0.38 m · design", "Clearance complete"],
    related: ["route-rf", "wire-fan", "line-102"],
  },
  "segment-s09": {
    id: "segment-s09",
    code: "S-09",
    name: "Fan shroud segment",
    kind: "Route Segment · 3 of 3",
    domain: "cross",
    system: "Shared routing",
    detail: "Nested under Route R-RF",
    values: ["0.54 m · stale", "Evidence revision 17"],
    related: ["route-rf", "wire-fan", "finding-route"],
  },
};

const rowsByView = {
  systems: [
    ["SYS-E1", "Fan control", "Electrical System", "6 Components · 2 Nets", "1 Warning"],
    ["SYS-E2", "Pump power", "Electrical System", "3 Components · 1 Net", "Complete"],
    ["SYS-F1", "Cooling", "Fluid System · coolant", "5 Components · 4 Lines", "1 Warning"],
  ],
  connections: [
    ["wire-fan", "W-003", "Wire", "K1:87 → M1:+", "R-RF · 1.46 m", "Warning"],
    ["wire-pump", "W-005", "Wire", "F1:OUT → P1:+12V", "R-LOWER · 1.31 m", "Pass"],
    ["line-102", "L-102", "Fluid Line · hose", "TH1:RAD → HX1:HOT", "R-RF · 1.18 m", "94 °C"],
    ["N-FAN", "N-FAN", "Electrical Net", "K1 · M1 · J-GND", "2 Wires", "Active"],
  ],
  interfaces: [
    ["pump-connector", "X-P1", "Electrical Mate", "DTM 2-way", "Compatible", "Sourced"],
    ["pump-fitting", "F-P1", "Fluid Mate", "AN-20 / 32 mm", "Compatible", "Loss Unknown"],
    ["X-K2", "X-K2", "Electrical Mate", "Terminal family", "Unknown", "Missing evidence"],
  ],
  routes: [
    ["route-rf", "R-RF", "3 Segments", "S-03 → S-04 → S-09", "1.46 m", "Stale evidence"],
    ["route-lower", "R-LOWER", "2 Segments", "S-06 → S-07", "1.31 m", "Measured"],
    ["R-CABIN", "R-CABIN", "2 Segments", "S-05 → S-03", "1.72 m", "Design"],
  ],
  harnesses: [
    ["H-ENGINE", "H-ENGINE", "Harness", "14 Wires · 4 connectors", "B-RF + B-CAB", "Build prep"],
    ["B-RF", "B-RF", "Bundle", "6 Wires", "S-03 · 0.54 m", "Layer data complete"],
    ["B-CAB", "B-CAB", "Concentric Bundle", "8 Wires · 2 Layers", "S-05 · 1.18 m", "Lay 35 mm"],
  ],
  calculations: [
    ["calc-fan", "CALC-003", "Capacity screen", "24 A / 20 A", "Fail", "Complete"],
    ["calc-pump", "CALC-005", "Voltage drop", "7.8 A · 1.31 m", "0.31 V", "Complete"],
    ["CALC-102", "CALC-102", "Pressure drop", "K fitting missing", "Known subtotal", "Incomplete"],
    ["CALC-104", "CALC-104", "Transient warm-up", "Outside envelope", "Unsupported", "Unevaluated"],
  ],
  evidence: [
    ["EV-P1", "EV-P1", "Pump flow", "92 L/min", "Manufacturer sheet", "Current"],
    ["evidence-temp", "EV-009", "Radiator outlet", "79 °C / 84 °C", "Sensor + import", "Conflict"],
    ["evidence-route", "EV-014", "Route length", "1.51 m", "As-built measurement", "Stale"],
    ["EV-XK2", "EV-XK2", "Terminal family", "Unknown", "No source", "Missing"],
  ],
  bom: [
    ["pump", "P1", "Davies Craig EWP", "1", "Installed", "Pump power + Cooling"],
    ["pump-connector", "X-P1", "DTM 2-way kit", "1", "Planned", "Pump power"],
    ["pump-fitting", "F-P1", "AN-20 adapter", "1", "Planned", "Cooling"],
    ["line-102", "L-102", "32 mm EPDM hose", "1.35 m", "Cut allowance", "Cooling"],
  ],
  findings: [
    ["finding-wire", "F-001", "Warning", "Conductor capacity exceeded", "W-003", "Active"],
    ["finding-temp", "F-003", "Warning", "Outlet evidence conflicts", "HX1", "Active"],
    ["finding-route", "F-004", "Caution", "Route evidence is stale", "R-RF", "Active"],
    ["F-008", "F-008", "Information", "Pump voltage-drop screen passes", "P1", "Passing"],
  ],
  compare: [
    ["pump", "P1", "No activity", "92 L/min → radiator", "Changed", "Authored binding"],
    ["thermostat", "TH1", "Closed · bypass", "Open · radiator", "Changed", "Authored binding"],
    ["line-102", "L-102", "No direction", "Engine → radiator · 94 °C", "Changed", "Derived Flow Path"],
    ["fan", "M1", "0 A", "18 A · forward", "Changed", "Derived Electrical Net"],
  ],
};

const columnsByView = {
  systems: ["ID", "System", "Domain", "Topology", "Coverage"],
  connections: ["ID", "Connection", "Kind", "Ports", "Route", "State"],
  interfaces: ["ID", "Interface", "Kind", "Specification", "Assessment", "Evidence"],
  routes: ["ID", "Route", "Composition", "Segments", "Length", "Evidence"],
  harnesses: ["ID", "Assembly", "Kind", "Contents", "Routing", "Status"],
  calculations: ["ID", "Result", "Kind", "Inputs", "Outcome", "Completeness"],
  evidence: ["ID", "Evidence", "Quantity", "Value", "Provenance", "State"],
  bom: ["ID", "Subject", "Requirement", "Qty", "Basis", "Scope"],
  findings: ["ID", "Finding", "Severity", "Claim", "Subject", "Lifecycle"],
  compare: ["ID", "Subject", "Key Off", "Run Hot", "Difference", "Basis"],
};

const matrixRows = [
  ["pump", "P1", "Electric water pump", "Component", "Cross-domain", "W-005 + L-102", "R-LOWER", "2 evidence", "0.31 V", "0 active"],
  ["fan", "M1", "Radiator fan", "Component", "Cross-domain", "N-FAN", "R-RF", "1 measured", "24 A screen", "1 Warning"],
  ["radiator", "HX1", "Radiator", "Component", "Fluid", "L-102", "R-RF", "2 conflicting", "Temperature", "1 Warning"],
  ["wire-fan", "W-003", "Fan supply wire", "Wire", "Electrical", "K1:87 → M1:+", "R-RF", "Ampacity table", "Fail", "1 Warning"],
  ["wire-pump", "W-005", "Pump supply wire", "Wire", "Electrical", "F1 → P1", "R-LOWER", "Measured current", "0.31 V", "Pass"],
  ["line-102", "L-102", "Hot-side hose", "Fluid Line", "Fluid", "TH1 → HX1", "R-RF", "94 °C", "Known subtotal", "0 active"],
  ["route-rf", "R-RF", "Right-front bay", "Route", "Cross-domain", "3 Connections", "3 Segments", "Stale length", "—", "1 Caution"],
  ["pump-connector", "X-P1", "Pump connector", "Mate", "Electrical", "2 Ports", "—", "Compatible", "—", "0 active"],
];

const matrixSegmentRows = [
  ["segment-s03", "S-03", "↳ Right-front bay", "Route Segment", "Cross-domain", "R-RF · 1 of 3", "S-03", "0.54 m measured", "Clear", "Complete"],
  ["segment-s04", "S-04", "↳ Radiator support", "Route Segment", "Cross-domain", "R-RF · 2 of 3", "S-04", "0.38 m design", "Clear", "Complete"],
  ["segment-s09", "S-09", "↳ Fan shroud", "Route Segment", "Cross-domain", "R-RF · 3 of 3", "S-09", "0.54 m stale", "Clear", "1 Caution"],
];

const matrixFindingBySubject = {
  radiator: "finding-temp",
  "route-rf": "finding-route",
  "wire-fan": "finding-wire",
};

const canvasFrames = {
  fan: { zoom: 114, panX: -128, panY: 28 },
  fuse: { zoom: 112, panX: 38, panY: -28 },
  "line-101": { zoom: 105, panX: -122, panY: -28 },
  "line-102": { zoom: 110, panX: -145, panY: -52 },
  pump: { zoom: 112, panX: -92, panY: -46 },
  radiator: { zoom: 112, panX: -170, panY: 12 },
  relay: { zoom: 114, panX: 4, panY: 32 },
  thermostat: { zoom: 112, panX: -118, panY: -44 },
  "wire-fan": { zoom: 114, panX: -88, panY: 24 },
  "wire-pump": { zoom: 112, panX: -26, panY: -42 },
};

const queryVariant = new URLSearchParams(window.location.search)
  .get("variant")
  ?.toUpperCase();

const state = {
  variant: VARIANTS[queryVariant] ? queryVariant : "A",
  view: "canvas",
  previousView: "canvas",
  system: "all",
  operatingState: "run-hot",
  compareState: "key-off",
  selectedId: "pump",
  previewId: null,
  selectedFinding: null,
  breadcrumbs: [],
  query: "",
  filter: "all",
  matrixLens: "topology",
  cMatrix: false,
  inspectorOpen: true,
  stateOpen: false,
  reviewOpen: false,
  mobileTab: "subjects",
  viewport: { zoom: 92, panX: -12, panY: 6 },
  returnViewport: null,
  returnView: null,
  returnCMatrix: null,
  revealId: null,
  findingDispositions: {
    "finding-wire": "unreviewed",
    "finding-temp": "unreviewed",
    "finding-route": "unreviewed",
  },
  findingRationale: {
    "finding-wire": "",
  },
  review: {
    A: { actions: 0, contextLoss: 0, reorientation: 0, verdict: "" },
    B: { actions: 0, contextLoss: 0, reorientation: 0, verdict: "" },
    C: { actions: 0, contextLoss: 0, reorientation: 0, verdict: "" },
  },
};

const app = document.querySelector("#app");

function h(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function viewName(id = state.view) {
  return VIEWS.find(([view]) => view === id)?.[1] ?? "Canvas";
}

function displayedViewName() {
  return state.variant === "C" && state.cMatrix
    ? `Context Matrix · ${viewName()}`
    : viewName();
}

function subject(id = state.selectedId) {
  return subjects[id] ?? {
    id,
    code: id,
    name: id,
    kind: "Project subject",
    domain: "cross",
    system: "Project",
    detail: "Fixture subject",
    values: ["Illustrative fixture"],
    related: [],
  };
}

function recordAction() {
  state.review[state.variant].actions += 1;
}

function activeFindings() {
  return Object.keys(state.findingDispositions).length;
}

function revealTarget(id) {
  return subject(id).subjectId ?? id;
}

function canReveal(id) {
  return Boolean(canvasFrames[revealTarget(id)]);
}

function renderRevealButton(id, label = "Reveal") {
  return canReveal(id)
    ? `<button data-reveal="${h(id)}">${h(label)}</button>`
    : `<button disabled title="Not represented on the topology canvas">${h(label)}</button>`;
}

function severityTone(value) {
  const text = String(value).toLowerCase();
  if (text.includes("warning") || text.includes("fail") || text.includes("conflict")) return "warning";
  if (text.includes("caution") || text.includes("stale") || text.includes("incomplete")) return "caution";
  if (text.includes("unknown") || text.includes("unsupported") || text.includes("missing")) return "unknown";
  if (text.includes("pass") || text.includes("complete") || text.includes("compatible")) return "pass";
  return "neutral";
}

function renderBrand(compact = false) {
  return `<div class="brand ${compact ? "compact" : ""}">
    <span class="brand-mark" aria-hidden="true">VM</span>
    <span><b>Venae Machinae</b><small>RX-7 systems plan</small></span>
  </div>`;
}

function renderHeader() {
  const selected = subject();
  return `<header class="topbar">
    ${renderBrand()}
    <form class="search" data-search-form>
      <span aria-hidden="true">⌕</span>
      <input aria-label="Search project" value="${h(state.query)}" placeholder="Find a subject, Port, Route, value…" />
      <kbd>⌘ K</kbd>
    </form>
    <div class="header-controls">
      <label><span>System</span><select data-system>
        <option value="all" ${state.system === "all" ? "selected" : ""}>All systems</option>
        <option value="electrical" ${state.system === "electrical" ? "selected" : ""}>Electrical</option>
        <option value="fluid" ${state.system === "fluid" ? "selected" : ""}>Cooling</option>
      </select></label>
      <label><span>Operating state</span><select data-operating-state>
        <option value="key-off" ${state.operatingState === "key-off" ? "selected" : ""}>Key Off</option>
        <option value="run-hot" ${state.operatingState === "run-hot" ? "selected" : ""}>Run Hot</option>
      </select></label>
    </div>
  </header>
  <div class="context-strip" aria-label="Current synchronized project context">
    <span><b>View</b>${h(displayedViewName())}</span>
    <span><b>Scope</b>${state.system === "all" ? "All systems" : state.system}</span>
    <span><b>State</b>${state.operatingState === "run-hot" ? "Run Hot" : "Key Off"}</span>
    <span class="selection"><b>Selection</b>${h(selected.code)} · ${h(selected.name)}</span>
    <span><b>Filter</b>${h(state.filter)}</span>
    <span class="finding-count"><b>Findings</b>△ ${activeFindings()} active</span>
  </div>`;
}

function renderNav(mode = "rail") {
  const floating = mode === "floating-launcher";
  const nav = `<nav class="view-nav ${floating ? "" : mode}" aria-label="Project views">
    ${VIEWS.map(([id, label, icon]) => `<button
      class="view-button ${state.view === id && !(floating && state.cMatrix) ? "active" : ""}"
      data-view="${id}"
      aria-current="${state.view === id && !(floating && state.cMatrix) ? "page" : "false"}"
      title="${h(label)}"
    ><span aria-hidden="true">${icon}</span><em>${h(label)}</em></button>`).join("")}
  </nav>`;
  if (!floating) return nav;
  return `<div class="floating-launcher">${nav}<div class="launcher-power-group" role="group" aria-label="Optional power views"><button class="matrix-view-button ${state.cMatrix ? "active" : ""}" data-c-matrix aria-pressed="${state.cMatrix}" title="Context Matrix"><span aria-hidden="true">▦</span><em>Context Matrix</em><small>Optional power view</small></button></div></div>`;
}

function canvasNode({ id, x, y, width, code, name, ports = [] }) {
  const selected = state.selectedId === id || state.revealId === id;
  return `<g class="canvas-node ${selected ? "selected" : ""}" role="button" tabindex="0" data-select="${id}" transform="translate(${x} ${y})">
    <rect width="${width}" height="58" rx="8"></rect>
    <circle class="node-code" cx="22" cy="29" r="14"></circle>
    <text class="node-code-text" x="22" y="33" text-anchor="middle">${h(code)}</text>
    <text class="node-name" x="44" y="25">${h(name)}</text>
    <text class="node-kind" x="44" y="42">${h(subject(id).kind.replace("Component · ", ""))}</text>
    ${ports.map(([px, py, label, domain]) => `<g class="port ${domain}" transform="translate(${px} ${py})">
      <circle r="9"></circle><text y="3" text-anchor="middle">${h(label)}</text>
    </g>`).join("")}
  </g>`;
}

function renderCanvas(compact = false) {
  const inactive = state.operatingState === "key-off";
  const transform = `translate(${state.viewport.panX} ${state.viewport.panY}) scale(${state.viewport.zoom / 100})`;
  return `<section class="canvas-workspace ${compact ? "compact" : ""}" aria-label="Topology canvas">
    <div class="canvas-toolbar">
      <div><span class="eyebrow">Topology canvas</span><b>Engine bay · shared electrical + coolant</b></div>
      <div class="canvas-actions">
        ${state.returnViewport ? `<button class="return-button" data-return-reveal>↩ Return to ${state.returnCMatrix ? "Context Matrix · " : ""}${h(viewName(state.returnView))}</button>` : ""}
        <button data-pan="left" aria-label="Pan canvas left">←</button>
        <button data-zoom="out" aria-label="Zoom out">−</button>
        <output>${state.viewport.zoom}%</output>
        <button data-zoom="in" aria-label="Zoom in">+</button>
        <button data-pan="right" aria-label="Pan canvas right">→</button>
      </div>
    </div>
    <div class="canvas-stage ${inactive ? "inactive" : ""}">
      <svg viewBox="0 0 1000 600" role="img" aria-label="Electrical wires and coolant hoses snapped to component Ports">
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#738078" stroke-opacity=".18" stroke-width="1" /></pattern>
          <pattern id="minor-grid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M 8 0 L 0 0 0 8" fill="none" stroke="#738078" stroke-opacity=".07" stroke-width="1" /></pattern>
        </defs>
        <rect width="1000" height="600" fill="url(#minor-grid)"></rect>
        <rect width="1000" height="600" fill="url(#grid)"></rect>
        <g transform="${transform}">
          <path class="vehicle-outline" d="M150 90 C280 45 720 45 850 90 L930 230 L895 505 C715 565 285 565 105 505 L70 230 Z"></path>
          <path class="route-zone" d="M500 80 H875 V215 H500 Z"></path>
          <text class="zone-label" x="515" y="103">S-03 · RIGHT-FRONT BAY</text>

          <g class="connection wire ${state.revealId === "wire-fan" ? "selected" : ""}" role="button" tabindex="0" data-select="wire-fan">
            <path class="wire-shadow" d="M438 182 H585 Q610 182 610 157 H758"></path>
            <path class="wire-core" d="M438 182 H585 Q610 182 610 157 H758"></path>
            <path class="flow-streak" d="M438 182 H585 Q610 182 610 157 H758"></path>
          </g>
          <g class="connection wire ${state.revealId === "wire-pump" ? "selected" : ""}" role="button" tabindex="0" data-select="wire-pump">
            <path class="wire-shadow" d="M302 324 H350 V435 H430"></path>
            <path class="wire-core" d="M302 324 H350 V435 H430"></path>
            <path class="flow-streak" d="M302 324 H350 V435 H430"></path>
          </g>
          <g class="connection hose ${inactive ? "" : "hot"} ${state.revealId === "line-102" ? "selected" : ""}" role="button" tabindex="0" data-select="line-102">
            <path class="hose-wall" d="M765 436 C790 420 800 340 835 315 S900 250 905 208"></path>
            <path class="hose-core" d="M765 436 C790 420 800 340 835 315 S900 250 905 208"></path>
            <path class="flow-streak" d="M765 436 C790 420 800 340 835 315 S900 250 905 208"></path>
          </g>
          <g class="connection hose cool ${state.revealId === "line-101" ? "selected" : ""}" role="button" tabindex="0" data-select="line-101">
            <path class="hose-wall" d="M530 466 C575 510 735 540 880 486"></path>
            <path class="hose-core" d="M530 466 C575 510 735 540 880 486"></path>
            <path class="flow-streak" d="M530 466 C575 510 735 540 880 486"></path>
          </g>

          ${canvasNode({ id: "relay", x: 330, y: 154, width: 118, code: "K1", name: "Fan relay", ports: [[108, 28, "87", "electrical"], [0, 28, "30", "electrical"]] })}
          ${canvasNode({ id: "fan", x: 758, y: 128, width: 132, code: "M1", name: "Radiator fan", ports: [[0, 29, "+", "electrical"]] })}
          ${canvasNode({ id: "pump", x: 430, y: 406, width: 190, code: "P1", name: "Electric water pump", ports: [[0, 29, "+", "electrical"], [100, 60, "IN", "fluid"], [190, 29, "OUT", "fluid"]] })}
          ${canvasNode({ id: "thermostat", x: 620, y: 407, width: 145, code: "TH1", name: "Thermostat", ports: [[0, 29, "IN", "fluid"], [145, 29, "RAD", "fluid"]] })}
          ${canvasNode({ id: "radiator", x: 805, y: 150, width: 150, code: "HX1", name: "Radiator", ports: [[100, 58, "HOT", "fluid"], [75, 336, "COOL", "fluid"]] })}
          ${canvasNode({ id: "fuse", x: 182, y: 295, width: 120, code: "F1", name: "Main fuse", ports: [[120, 29, "OUT", "electrical"]] })}

          <g class="canvas-label wire-label" transform="translate(500 142)"><rect width="74" height="34" rx="3"></rect><text x="8" y="14">WIRE · W-003</text><text x="8" y="27">1.46 m</text></g>
          <g class="canvas-label hose-label" transform="translate(760 350)"><rect width="84" height="34" rx="3"></rect><text x="8" y="14">HOSE · L-102</text><text x="8" y="27">${inactive ? "KEY OFF · STATIC" : "94 °C · →"}</text></g>
        </g>
      </svg>
      <div class="canvas-legend" aria-label="Canvas legend">
        <span><i class="legend-wire"></i>Wire</span>
        <span><i class="legend-hose"></i>Coolant hose</span>
        <span><i class="legend-hot"></i>Hot coolant</span>
        <span><i class="legend-flow">›</i>Direction</span>
        <span><i class="legend-unknown">?</i>Unknown</span>
      </div>
      <div class="canvas-state-note"><b>${inactive ? "Key Off" : "Run Hot"}</b>${inactive ? "Physical topology retained; no active direction" : "Authored state · overlay evidence, not simulation"}</div>
    </div>
  </section>`;
}

function filterRows(rows) {
  let result = rows;
  const q = state.query.trim().toLowerCase();
  if (q) result = result.filter((row) => row.join(" ").toLowerCase().includes(q));
  if (state.filter !== "all") result = result.filter((row) => row.join(" ").toLowerCase().includes(state.filter));
  return result;
}

function renderFilters() {
  return `<div class="filter-bar" aria-label="Dense view filters">
    ${["all", "warning", "stale", "unknown", "fluid", "electrical"].map((filter) => `<button class="filter-pill ${state.filter === filter ? "active" : ""}" data-filter="${filter}">${h(filter)}</button>`).join("")}
  </div>`;
}

function renderTable(view = state.view, matrix = false) {
  const rows = filterRows(rowsByView[view] ?? rowsByView.connections);
  const columns = columnsByView[view] ?? columnsByView.connections;
  if (!rows.length) {
    return `<div class="empty-state"><span>⌕</span><h2>No matching project data</h2><p>Clear “${h(state.query || state.filter)}” to restore this synchronized projection.</p><button data-clear-filter>Clear filter</button></div>`;
  }
  return `<div class="table-scroll"><table class="data-table ${matrix ? "matrix-table" : ""}">
    <thead><tr>${columns.slice(1).map((column) => `<th>${h(column)}</th>`).join("")}<th><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${rows.map((row) => {
      const id = row[0];
      const preview = state.previewId === id;
      return `<tr class="${preview ? "preview" : ""}">
        ${row.slice(1).map((cell, index) => `<td>${index === 0
          ? `<button class="row-subject" data-preview="${h(id)}"><b>${h(cell)}</b><small>${h(row[0])}</small></button>`
          : `<span class="cell-value ${severityTone(cell)}">${h(cell)}</span>`}</td>`).join("")}
        <td class="row-action"><button data-follow="${h(id)}">Follow</button>${renderRevealButton(id)}</td>
      </tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

function renderBreadcrumbs() {
  if (!state.breadcrumbs.length) return "";
  return `<div class="breadcrumbs"><span>Path</span>${state.breadcrumbs.map((id, index) => `<button data-breadcrumb="${index}">${h(subject(id).code)}</button><i>›</i>`).join("")}<b>${h(subject().code)}</b></div>`;
}

function renderDenseHeader(view = state.view) {
  const selected = subject();
  return `<div class="dense-heading">
    <div><span class="eyebrow">Synchronized project view</span><h1>${h(viewName(view))}</h1><p>Canonical projection · ${h(selected.code)} remains selected</p></div>
    <div class="dense-heading-actions">${renderRevealButton(selected.id, "⌁ Reveal selection")}<button data-view="canvas">Canvas</button></div>
  </div>${renderBreadcrumbs()}${renderFilters()}`;
}

function renderFindingDetail(finding, className = "") {
  const disposition = state.findingDispositions[finding.id];
  return `<section class="finding-detail ${severityTone(finding.kind)} ${className}" data-finding-detail>
    <span class="eyebrow">Finding detail</span><h3>${h(finding.name)}</h3><p>${h(finding.detail)}</p>
    <dl><div><dt>Severity</dt><dd>${finding.kind.includes("Caution") ? "Caution" : "Warning"}</dd></div><div><dt>Lifecycle</dt><dd>Active</dd></div><div><dt>Disposition</dt><dd>${h(disposition)}</dd></div></dl>
    ${finding.id === "finding-wire" && disposition !== "acknowledged" ? `<label class="rationale"><span>Fixture rationale</span><input data-ack-reason value="Reviewed against current fixture evidence" /></label><button class="ack-button" data-ack="finding-wire">Acknowledge Finding</button>` : ""}
    ${disposition === "acknowledged" ? `<p class="acknowledged">✓ Acknowledged · severity and lifecycle unchanged</p>` : ""}
  </section>`;
}

function renderInspector({ floating = false } = {}) {
  const selected = subject();
  const preview = state.previewId ? subject(state.previewId) : null;
  const finding = state.selectedFinding ? subject(state.selectedFinding) : null;
  const relationSource = preview ?? selected;
  return `<aside class="inspector ${floating ? "floating" : ""} ${state.inspectorOpen ? "" : "closed"}" aria-label="Selection inspector">
    <div class="inspector-head">
      <div><span class="eyebrow">Primary selection</span><h2>${h(selected.name)}</h2><p>${h(selected.code)} · ${h(selected.kind)}</p></div>
      <button data-toggle-inspector aria-label="Toggle inspector">${state.inspectorOpen ? "×" : "‹"}</button>
    </div>
    ${state.inspectorOpen ? `<div class="inspector-body">
      ${preview ? `<section class="preview-card"><span class="eyebrow">Previewing · primary unchanged</span><h3>${h(preview.name)}</h3><p>${h(preview.detail)}</p><div><button data-follow="${h(preview.subjectId ?? preview.id)}">${preview.subjectId ? "Follow subject" : "Promote selection"}</button>${renderRevealButton(preview.subjectId ?? preview.id)}</div></section>` : ""}
      <section><span class="eyebrow">Known values</span><ul class="value-list">${selected.values.map((value) => `<li>${h(value)}</li>`).join("")}</ul></section>
      <section><span class="eyebrow">Relationships</span><div class="relationship-list">${(relationSource.related ?? []).map((id) => `<button data-preview="${h(id)}"><span>${h(subject(id).code)}</span><b>${h(subject(id).name)}</b><i>Preview</i></button>`).join("") || `<p>No fixture relationships.</p>`}</div></section>
      ${finding ? renderFindingDetail(finding) : ""}
    </div>` : ""}
  </aside>`;
}

function renderVariantA() {
  return `<div class="variant variant-a">
    ${renderHeader()}
    <div class="a-layout">
      ${renderNav("rail")}
      <main class="a-workspace">${state.view === "canvas" ? renderCanvas() : `${renderDenseHeader()}${renderTable()}`}</main>
      ${renderInspector()}
    </div>
  </div>`;
}

function matrixLensForView(view) {
  if (["systems", "connections", "interfaces", "canvas"].includes(view)) return "topology";
  if (["routes", "harnesses", "bom"].includes(view)) return "build";
  if (["calculations", "evidence", "compare"].includes(view)) return "engineering";
  return "validation";
}

function renderMatrixTable() {
  if (state.view === "compare") {
    const rows = filterRows(rowsByView.compare);
    if (!rows.length) {
      return `<div class="empty-state"><span>⌕</span><h2>No matching state differences</h2><p>Clear “${h(state.query || state.filter)}” to restore the comparison.</p><button data-clear-filter>Clear filter</button></div>`;
    }
    return `<div class="table-scroll"><table class="data-table matrix-table"><thead><tr>${columnsByView.compare.slice(1).map((column) => `<th>${h(column)}</th>`).join("")}<th>Actions</th></tr></thead><tbody>
      ${rows.map((row) => `<tr class="${state.previewId === row[0] ? "preview" : ""}">${row.slice(1).map((cell, cellIndex) => `<td>${cellIndex === 0 ? `<button class="row-subject" data-preview="${h(row[0])}"><b>${h(cell)}</b><small>${h(row[0])}</small></button>` : `<span class="cell-value ${severityTone(cell)}">${h(cell)}</span>`}</td>`).join("")}<td class="row-action"><button data-follow="${h(row[0])}">Follow</button>${renderRevealButton(row[0])}</td></tr>`).join("")}
    </tbody></table></div>`;
  }

  const lensColumns = {
    topology: ["Subject", "Kind", "Domain", "Continuity", "System state"],
    build: ["Subject", "Kind", "Route / assembly", "Evidence", "Build status"],
    engineering: ["Subject", "Evidence", "Result", "Completeness", "Provenance"],
    validation: ["Subject", "Finding", "Severity", "Disposition", "Coverage"],
  };
  const columns = lensColumns[state.matrixLens];
  const sourceRows = state.matrixLens === "build"
    ? matrixRows.flatMap((row) => row[0] === "route-rf" ? [row, ...matrixSegmentRows] : [row])
    : matrixRows;
  const rows = filterRows(sourceRows);
  if (!rows.length) {
    return `<div class="empty-state"><span>⌕</span><h2>No matching matrix rows</h2><p>Clear “${h(state.query || state.filter)}” to restore this synchronized projection.</p><button data-clear-filter>Clear filter</button></div>`;
  }
  return `<div class="table-scroll"><table class="data-table matrix-table"><thead><tr>${columns.map((column) => `<th>${h(column)}</th>`).join("")}<th>Actions</th></tr></thead><tbody>
    ${rows.map((row) => {
      const findingId = matrixFindingBySubject[row[0]];
      const finding = findingId ? subject(findingId) : null;
      const cells = {
        topology: [row[2], row[3], row[4], row[5], row[9]],
        build: [row[2], row[3], row[6], row[7], row[9]],
        engineering: [row[2], row[7], row[8], row[9], row[4]],
        validation: [row[2], finding ? `${finding.code} · ${finding.name}` : "—", finding ? finding.kind.replace("Finding · ", "") : "—", finding ? state.findingDispositions[findingId] : "—", row[7]],
      }[state.matrixLens];
      return `<tr class="${state.previewId === row[0] ? "preview" : ""}">${cells.map((cell, cellIndex) => `<td>${cellIndex === 0 ? `<button class="row-subject" data-preview="${h(row[0])}"><b>${h(cell)}</b><small>${h(row[1])}</small></button>` : `<span class="cell-value ${severityTone(cell)}">${h(cell)}</span>`}</td>`).join("")}<td class="row-action"><button data-follow="${h(row[0])}">Follow</button>${renderRevealButton(row[0])}</td></tr>`;
    }).join("")}
  </tbody></table></div>`;
}

function renderMiniCanvas() {
  return `<div class="mini-canvas" aria-label="Spatial context preview"><span class="eyebrow">Spatial context</span><svg viewBox="0 0 240 120" role="img" aria-label="Mini topology map"><path class="mini-wire" d="M20 75 H88 V38 H174"></path><path class="mini-hose" d="M110 88 C150 100 195 78 218 30"></path><circle cx="88" cy="38" r="7"></circle><circle cx="110" cy="88" r="8"></circle><circle cx="218" cy="30" r="8"></circle></svg>${renderRevealButton(state.selectedId, "Reveal on Canvas")}</div>`;
}

function renderVariantB() {
  return `<div class="variant variant-b">
    ${renderHeader()}
    <div class="b-capabilities">${VIEWS.map(([id, label]) => `<button class="${state.view === id ? "active" : ""}" data-view="${id}">${h(label)}</button>`).join("")}</div>
    ${state.view === "canvas" ? `<main class="b-canvas">${renderCanvas()}${renderInspector({ floating: true })}</main>` : `<main class="b-layout">
      <aside class="matrix-lenses"><span class="eyebrow">Matrix lens</span>${["topology", "build", "engineering", "validation"].map((lens) => `<button class="${state.matrixLens === lens ? "active" : ""}" data-matrix-lens="${lens}"><b>${h(lens)}</b><small>${lens === "topology" ? "Systems · topology" : lens === "build" ? "Routes · assemblies · BOM" : lens === "engineering" ? "Evidence · results · states" : "Findings · coverage"}</small></button>`).join("")}${renderMiniCanvas()}</aside>
      <section class="matrix-workspace">${renderDenseHeader()}${renderMatrixTable()}</section>
      <section class="matrix-tray">${renderInspector()}</section>
    </main>`}
  </div>`;
}

function renderLensContent() {
  const tabletFinding = state.view === "findings" && state.selectedFinding
    ? renderFindingDetail(subject(state.selectedFinding), "lens-finding-detail")
    : "";
  return `<section class="lens-workspace" aria-label="${h(viewName())} lens">
    <div class="lens-title"><div><span class="eyebrow">Focused workspace lens</span><h1>${h(viewName())}</h1><p>Canvas viewport retained beneath this projection</p></div><div><button data-view="canvas">Close lens</button>${renderRevealButton(state.selectedId, "Reveal selection")}</div></div>
    ${renderBreadcrumbs()}${renderFilters()}${renderTable()}${tabletFinding}
  </section>`;
}

function renderCMatrixContent() {
  return `<section class="lens-workspace c-matrix-workspace" aria-label="Context Matrix lens">
    <div class="lens-title"><div><span class="eyebrow">Optional power view</span><h1>Context Matrix</h1><p>${h(viewName())} remains the canonical view anchor · canvas viewport retained</p></div><div><button data-c-lens>Lens view</button>${renderRevealButton(state.selectedId, "Reveal selection")}</div></div>
    <div class="c-matrix-lenses" aria-label="Context Matrix lenses">${["topology", "build", "engineering", "validation"].map((lens) => `<button class="${state.matrixLens === lens ? "active" : ""}" data-matrix-lens="${lens}">${h(lens)}</button>`).join("")}</div>
    ${renderMatrixTable()}
  </section>`;
}

function renderVariantC() {
  return `<div class="variant variant-c">
    ${renderHeader()}
    <main class="c-stage">
      ${renderCanvas()}
      ${renderNav("floating-launcher")}
      ${renderInspector({ floating: true })}
      ${state.cMatrix || state.view !== "canvas" ? `<div class="lens-backdrop">${state.cMatrix ? renderCMatrixContent() : renderLensContent()}</div>` : ""}
    </main>
  </div>`;
}

function renderStatePanel() {
  if (!state.stateOpen) return "";
  const selected = subject();
  return `<aside class="state-panel" aria-label="Prototype state">
    <div><span class="eyebrow">Shared in-memory state</span><button data-toggle-state>×</button></div>
    <dl>
      <div><dt>Variant</dt><dd>${state.variant} · ${h(VARIANTS[state.variant])}</dd></div>
      <div><dt>View</dt><dd>${h(viewName())}</dd></div>
      <div><dt>Variant C presentation</dt><dd>${state.cMatrix ? "Context Matrix" : "Focused lens"}</dd></div>
      <div><dt>Scope</dt><dd>${h(state.system)}</dd></div>
      <div><dt>Operating State</dt><dd>${h(state.operatingState)}</dd></div>
      <div><dt>Primary subject</dt><dd>${h(selected.code)} · ${h(selected.name)}</dd></div>
      <div><dt>Preview</dt><dd>${state.previewId ? h(subject(state.previewId).code) : "none"}</dd></div>
      <div><dt>Filter</dt><dd>${h(state.filter)}${state.query ? ` · “${h(state.query)}”` : ""}</dd></div>
      <div><dt>Viewport</dt><dd>${state.viewport.zoom}% · ${state.viewport.panX}, ${state.viewport.panY}</dd></div>
      <div><dt>Return slot</dt><dd>${state.returnViewport ? `${state.returnViewport.zoom}% · ${state.returnViewport.panX}, ${state.returnViewport.panY}` : "empty"}</dd></div>
      <div><dt>F-001 disposition</dt><dd>${h(state.findingDispositions["finding-wire"])}</dd></div>
    </dl>
  </aside>`;
}

function renderReviewPanel() {
  if (!state.reviewOpen) return "";
  const current = state.review[state.variant];
  return `<aside class="review-panel" aria-label="Prototype comparison recorder">
    <div class="review-panel-head"><div><span class="eyebrow">Comparison recorder</span><h2>${state.variant} · ${h(VARIANTS[state.variant])}</h2></div><button data-toggle-review>×</button></div>
    <div class="metrics"><div><b>${current.actions}</b><span>actions</span></div><button data-review-mark="contextLoss"><b>${current.contextLoss}</b><span>context lost +</span></button><button data-review-mark="reorientation"><b>${current.reorientation}</b><span>reoriented +</span></button></div>
    <label><span>Variant verdict</span><textarea data-verdict placeholder="What felt fast, clear, or disorienting?">${h(current.verdict)}</textarea></label>
    <div class="review-actions"><button data-reset-review>Reset current measures</button><span>Stored in memory only</span></div>
    <div class="variant-summary">${Object.entries(state.review).map(([key, value]) => `<div class="${key === state.variant ? "active" : ""}"><b>${key}</b><span>${value.actions} actions · ${value.contextLoss} lost · ${value.reorientation} reoriented</span><small>${h(value.verdict || "Verdict pending")}</small></div>`).join("")}</div>
  </aside>`;
}

function renderSwitcher() {
  return `<div class="prototype-switcher" aria-label="Prototype variant switcher">
    <button data-variant-step="-1" aria-label="Previous variant">←</button>
    <div><span>Variant</span><b>${state.variant} · ${h(VARIANTS[state.variant])}</b></div>
    <button data-variant-step="1" aria-label="Next variant">→</button>
    <button data-toggle-review class="switcher-tool" aria-label="Open comparison recorder">✓</button>
    <button data-toggle-state class="switcher-tool" aria-label="Inspect shared prototype state">{ }</button>
  </div>`;
}

function renderMobile() {
  const selected = state.previewId ? subject(state.previewId) : subject();
  const mobileSubjects = ["pump", "radiator", "fan", "wire-fan", "line-102", "finding-wire", "finding-temp"];
  return `<section class="mobile-shell">
    <header class="mobile-header">${renderBrand(true)}<span>Read-only</span></header>
    <div class="mobile-context"><b>${state.operatingState === "run-hot" ? "Run Hot" : "Key Off"}</b><span>All systems · ${activeFindings()} active Findings</span></div>
    <form class="mobile-search" data-mobile-search-form><span>⌕</span><input value="${h(state.query)}" aria-label="Search project subjects" placeholder="Find a subject…" /></form>
    <nav class="mobile-tabs" aria-label="Mobile review views">${[["subjects", "Subjects"], ["topology", "Topology"], ["findings", "Findings"]].map(([id, label]) => `<button class="${state.mobileTab === id ? "active" : ""}" data-mobile-tab="${id}">${label}</button>`).join("")}</nav>
    <main class="mobile-content">
      ${state.mobileTab === "subjects" ? `<div class="mobile-subjects">${mobileSubjects.filter((id) => !state.query || subject(id).name.toLowerCase().includes(state.query.toLowerCase()) || subject(id).code.toLowerCase().includes(state.query.toLowerCase())).map((id) => { const item = subject(id); return `<button class="${state.selectedId === id ? "selected" : ""}" data-select="${id}"><span class="domain-dot ${item.domain}"></span><div><b>${h(item.name)}</b><small>${h(item.code)} · ${h(item.kind)}</small></div><i>›</i></button>`; }).join("")}</div>` : ""}
      ${state.mobileTab === "topology" ? `<div class="mobile-topology">${renderCanvas(true)}</div>` : ""}
      ${state.mobileTab === "findings" ? `<div class="mobile-findings">${["finding-wire", "finding-temp", "finding-route"].map((id) => { const item = subject(id); return `<button data-preview="${id}"><span class="severity-symbol">${item.kind.includes("Caution") ? "!" : "△"}</span><div><b>${h(item.name)}</b><small>${h(item.code)} · ${h(state.findingDispositions[id])}</small></div><i>›</i></button>`; }).join("")}</div>` : ""}
      <section class="mobile-detail"><span class="eyebrow">${state.previewId ? "Preview · primary selection unchanged" : "Selected subject"}</span><h1>${h(selected.name)}</h1><p>${h(selected.code)} · ${h(selected.kind)}</p><ul>${selected.values.map((value) => `<li>${h(value)}</li>`).join("")}${state.findingDispositions[selected.id] ? `<li>Disposition ${h(state.findingDispositions[selected.id])} · severity and lifecycle unchanged</li>` : ""}</ul><div class="readonly-note">Read-only review · edit and validation actions unavailable</div></section>
    </main>
  </section>`;
}

function render() {
  const variant = state.variant === "A" ? renderVariantA() : state.variant === "B" ? renderVariantB() : renderVariantC();
  app.innerHTML = `<div class="prototype">
    <div class="prototype-banner"><b>Prototype</b><span>Illustrative data — not engineering guidance</span></div>
    <div class="desktop-shell">${variant}</div>
    ${renderMobile()}
    ${renderStatePanel()}
    ${renderReviewPanel()}
    ${renderSwitcher()}
  </div>`;
}

function setVariant(step) {
  const keys = Object.keys(VARIANTS);
  const current = keys.indexOf(state.variant);
  state.variant = keys[(current + Number(step) + keys.length) % keys.length];
  const url = new URL(window.location.href);
  url.searchParams.set("variant", state.variant);
  history.replaceState({}, "", url);
  render();
}

function setView(view) {
  recordAction();
  state.previousView = state.view;
  state.view = view;
  state.cMatrix = false;
  state.previewId = null;
  state.selectedFinding = null;
  state.matrixLens = matrixLensForView(view);
  render();
}

function preview(id) {
  recordAction();
  state.previewId = id;
  state.selectedFinding = String(id).startsWith("finding-") ? id : null;
  render();
}

function follow(id) {
  recordAction();
  const target = subject(id).subjectId ?? id;
  if (target !== state.selectedId) state.breadcrumbs.push(state.selectedId);
  state.selectedId = target;
  state.previewId = null;
  state.selectedFinding = null;
  state.revealId = null;
  render();
}

function reveal(id) {
  if (!canReveal(id)) return;
  recordAction();
  if (!state.returnViewport) {
    state.returnViewport = { ...state.viewport };
    state.returnView = state.view;
    state.returnCMatrix = state.cMatrix;
  }
  state.revealId = revealTarget(id);
  state.view = "canvas";
  state.cMatrix = false;
  state.viewport = { ...canvasFrames[state.revealId] };
  render();
}

function returnReveal() {
  recordAction();
  state.viewport = { ...state.returnViewport };
  state.view = state.returnView ?? "canvas";
  state.cMatrix = state.returnCMatrix ?? false;
  state.returnViewport = null;
  state.returnView = null;
  state.returnCMatrix = null;
  state.revealId = null;
  render();
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button, [role='button']");
  if (!target) return;
  if (target.dataset.variantStep) return setVariant(target.dataset.variantStep);
  if (target.dataset.view) return setView(target.dataset.view);
  if (target.dataset.cMatrix !== undefined) {
    recordAction();
    state.cMatrix = !state.cMatrix;
    return render();
  }
  if (target.dataset.cLens !== undefined) {
    recordAction();
    state.cMatrix = false;
    return render();
  }
  if (target.dataset.preview) return preview(target.dataset.preview);
  if (target.dataset.follow) return follow(target.dataset.follow);
  if (target.dataset.reveal) return reveal(target.dataset.reveal);
  if (target.dataset.select) {
    recordAction();
    state.selectedId = target.dataset.select;
    state.previewId = null;
    state.selectedFinding = null;
    state.revealId = null;
    return render();
  }
  if (target.dataset.returnReveal !== undefined) return returnReveal();
  if (target.dataset.filter) {
    recordAction();
    state.filter = target.dataset.filter;
    return render();
  }
  if (target.dataset.clearFilter !== undefined) {
    state.filter = "all";
    state.query = "";
    return render();
  }
  if (target.dataset.matrixLens) {
    recordAction();
    state.matrixLens = target.dataset.matrixLens;
    return render();
  }
  if (target.dataset.toggleInspector !== undefined) {
    state.inspectorOpen = !state.inspectorOpen;
    return render();
  }
  if (target.dataset.toggleState !== undefined) {
    state.stateOpen = !state.stateOpen;
    return render();
  }
  if (target.dataset.toggleReview !== undefined) {
    state.reviewOpen = !state.reviewOpen;
    return render();
  }
  if (target.dataset.reviewMark) {
    state.review[state.variant][target.dataset.reviewMark] += 1;
    return render();
  }
  if (target.dataset.resetReview !== undefined) {
    state.review[state.variant] = { actions: 0, contextLoss: 0, reorientation: 0, verdict: "" };
    return render();
  }
  if (target.dataset.mobileTab) {
    state.mobileTab = target.dataset.mobileTab;
    return render();
  }
  if (target.dataset.zoom) {
    recordAction();
    state.viewport.zoom = Math.max(60, Math.min(160, state.viewport.zoom + (target.dataset.zoom === "in" ? 10 : -10)));
    return render();
  }
  if (target.dataset.pan) {
    recordAction();
    state.viewport.panX += target.dataset.pan === "left" ? -24 : 24;
    return render();
  }
  if (target.dataset.breadcrumb !== undefined) {
    recordAction();
    const index = Number(target.dataset.breadcrumb);
    state.selectedId = state.breadcrumbs[index];
    state.breadcrumbs = state.breadcrumbs.slice(0, index);
    state.previewId = null;
    return render();
  }
  if (target.dataset.ack) {
    recordAction();
    const input = target.closest("[data-finding-detail]")?.querySelector("[data-ack-reason]");
    state.findingDispositions[target.dataset.ack] = "acknowledged";
    state.findingRationale[target.dataset.ack] = input?.value || "Reviewed against current fixture evidence";
    return render();
  }
});

app.addEventListener("change", (event) => {
  if (event.target.matches("[data-system]")) {
    recordAction();
    state.system = event.target.value;
    render();
  }
  if (event.target.matches("[data-operating-state]")) {
    recordAction();
    state.operatingState = event.target.value;
    render();
  }
  if (event.target.matches("[data-verdict]")) {
    state.review[state.variant].verdict = event.target.value;
    render();
  }
});

app.addEventListener("submit", (event) => {
  if (event.target.matches("[data-search-form], [data-mobile-search-form]")) {
    event.preventDefault();
    recordAction();
    state.query = event.target.querySelector("input").value;
    render();
  }
});

document.addEventListener("keydown", (event) => {
  const tag = event.target.tagName?.toLowerCase();
  if (["input", "textarea", "select"].includes(tag) || event.target.isContentEditable) return;
  if (event.altKey && event.key === "ArrowLeft") {
    event.preventDefault();
    setVariant(-1);
  }
  if (event.altKey && event.key === "ArrowRight") {
    event.preventDefault();
    setVariant(1);
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.dataset?.select) {
    event.preventDefault();
    event.target.click();
  }
});

render();
