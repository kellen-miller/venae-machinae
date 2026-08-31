/* THROWAWAY PROTOTYPE — illustrative fixture data, no engineering guidance. */

const VARIANTS = {
  A: "Systems Workbench",
  B: "Guided Build",
  C: "Trace Lens",
};

const queryVariant = new URLSearchParams(window.location.search)
  .get("variant")
  ?.toUpperCase();

const state = {
  variant: VARIANTS[queryVariant] ? queryVariant : "A",
  system: "all",
  operatingState: "run-hot",
  mode: "select",
  selectedId: "pump",
  selectedPort: null,
  overlay: true,
  addedRelay: false,
  connectedRelay: false,
  routedRelay: false,
  showState: false,
  query: "",
  zoom: 100,
  panX: 0,
  panY: 0,
};

let spacePressed = false;
let panGesture = null;
let suppressNextClick = false;

const components = [
  {
    id: "battery",
    name: "Battery",
    code: "BAT",
    kind: "Electrical source",
    systems: ["electrical"],
    x: 9,
    y: 61,
    ports: [
      { id: "battery-pos", label: "B+", domain: "electrical", side: "right" },
      { id: "battery-neg", label: "B−", domain: "electrical", side: "bottom" },
    ],
    values: ["12.8 V · measured", "680 CCA · manufacturer"],
  },
  {
    id: "fuse",
    name: "Main fuse",
    code: "F1",
    kind: "Protection",
    systems: ["electrical"],
    x: 25,
    y: 48,
    ports: [
      { id: "fuse-in", label: "IN", domain: "electrical", side: "left" },
      { id: "fuse-out", label: "OUT", domain: "electrical", side: "right" },
    ],
    values: ["40 A · manufacturer", "fault current · unknown"],
  },
  {
    id: "relay",
    name: "Fan relay",
    code: "K1",
    kind: "Switch",
    systems: ["electrical"],
    x: 43,
    y: 33,
    ports: [
      { id: "relay-30", label: "30", domain: "electrical", side: "left" },
      { id: "relay-87", label: "87", domain: "electrical", side: "right" },
      { id: "relay-86", label: "86", domain: "electrical", side: "bottom" },
    ],
    values: ["Normally open", "coil: 180 mA · sourced"],
  },
  {
    id: "ecu",
    name: "Engine ECU",
    code: "ECU",
    kind: "Controller",
    systems: ["electrical"],
    x: 26,
    y: 78,
    ports: [
      { id: "ecu-fan", label: "DPO 2", domain: "electrical", side: "right" },
      { id: "ecu-gnd", label: "GND", domain: "electrical", side: "left" },
    ],
    values: ["Fan request: 96 °C · user target", "output limit: 1 A · sourced"],
  },
  {
    id: "fan",
    name: "Radiator fan",
    code: "M1",
    kind: "Electrical load",
    systems: ["electrical", "coolant"],
    x: 76,
    y: 23,
    ports: [
      { id: "fan-pos", label: "+", domain: "electrical", side: "left" },
      { id: "fan-neg", label: "−", domain: "electrical", side: "bottom" },
    ],
    values: ["18 A running · measured", "startup current · unknown"],
  },
  {
    id: "pump",
    name: "Electric water pump",
    code: "P1",
    kind: "Load + fluid pump",
    systems: ["electrical", "coolant"],
    x: 45,
    y: 76,
    ports: [
      { id: "pump-power", label: "+12 V", domain: "electrical", side: "left" },
      { id: "pump-in", label: "IN", domain: "fluid", side: "bottom" },
      { id: "pump-out", label: "OUT", domain: "fluid", side: "right" },
    ],
    values: ["Flow: 92 L/min · manufacturer", "actual flow · unknown"],
  },
  {
    id: "thermostat",
    name: "Thermostat",
    code: "TH",
    kind: "Fluid valve",
    systems: ["coolant"],
    x: 65,
    y: 70,
    ports: [
      { id: "thermostat-in", label: "ENGINE", domain: "fluid", side: "left" },
      { id: "thermostat-out", label: "RAD", domain: "fluid", side: "right" },
      { id: "thermostat-bypass", label: "BYPASS", domain: "fluid", side: "bottom" },
    ],
    values: ["Begin open: 82 °C · sourced", "actual position · unknown"],
  },
  {
    id: "radiator",
    name: "Radiator",
    code: "HX1",
    kind: "Heat exchanger",
    systems: ["coolant"],
    x: 84,
    y: 52,
    ports: [
      { id: "radiator-hot", label: "HOT", domain: "fluid", side: "top" },
      { id: "radiator-cool", label: "COOL", domain: "fluid", side: "bottom" },
    ],
    values: ["Outlet: 79 °C · sensor", "Outlet: 84 °C · log (conflict)"],
  },
  {
    id: "reservoir",
    name: "Expansion tank",
    code: "R1",
    kind: "Fluid reservoir",
    systems: ["coolant"],
    x: 79,
    y: 86,
    ports: [
      { id: "reservoir-in", label: "IN", domain: "fluid", side: "top" },
      { id: "reservoir-out", label: "OUT", domain: "fluid", side: "left" },
    ],
    values: ["Cap: 1.1 bar · sourced", "level hot · user entered"],
  },
];

const auxiliaryRelay = {
  id: "aux-relay",
  name: "Aux fan relay",
  code: "K2",
  kind: "Switch · newly added",
  systems: ["electrical"],
  x: 52,
  y: 19,
  ports: [
    { id: "aux-relay-in", label: "30", domain: "electrical", side: "left" },
    { id: "aux-relay-out", label: "87", domain: "electrical", side: "right" },
  ],
  values: ["Part definition selected", "terminal family · unknown"],
};

const baseConnections = [
  {
    id: "wire-bat-fuse",
    name: "W-001",
    domain: "electrical",
    from: "battery-pos",
    to: "fuse-in",
    via: [[190, 385], [190, 300]],
    labelX: 19,
    labelY: 59,
    routeLength: "0.82 m",
    segments: ["S-01 battery rise · 0.28 m", "S-02 left bay · 0.54 m"],
  },
  {
    id: "wire-fuse-relay",
    name: "W-002",
    domain: "electrical",
    from: "fuse-out",
    to: "relay-30",
    via: [[350, 300], [350, 220]],
    labelX: 36,
    labelY: 43,
    routeLength: "1.08 m",
    segments: ["S-02 left bay · 0.54 m", "S-03 RF bay · 0.54 m"],
  },
  {
    id: "wire-relay-fan",
    name: "W-003",
    domain: "electrical",
    from: "relay-87",
    to: "fan-pos",
    via: [[610, 220], [610, 155]],
    labelX: 61,
    labelY: 28,
    routeLength: "1.46 m",
    segments: ["S-03 RF bay · 0.54 m", "S-04 fan rise · 0.92 m"],
  },
  {
    id: "wire-ecu-relay",
    name: "W-004",
    domain: "electrical",
    from: "ecu-fan",
    to: "relay-86",
    via: [[430, 485]],
    labelX: 38,
    labelY: 67,
    routeLength: "1.72 m",
    segments: ["S-05 cabin pass · 1.18 m", "S-03 RF bay · 0.54 m"],
  },
  {
    id: "wire-fuse-pump",
    name: "W-005",
    domain: "electrical",
    from: "fuse-out",
    to: "pump-power",
    via: [[350, 300], [350, 475]],
    labelX: 35,
    labelY: 73,
    routeLength: "1.31 m",
    segments: ["S-02 left bay · 0.54 m", "S-06 lower bay · 0.77 m"],
  },
  {
    id: "line-pump-thermostat",
    name: "L-101",
    domain: "coolant",
    from: "pump-out",
    to: "thermostat-in",
    via: [[555, 440], [595, 440]],
    labelX: 57,
    labelY: 70,
    routeLength: "0.74 m",
    segments: ["S-06 lower bay · 0.39 m", "S-07 engine front · 0.35 m"],
    temperature: "92 °C",
  },
  {
    id: "line-thermostat-radiator",
    name: "L-102",
    domain: "coolant",
    from: "thermostat-out",
    to: "radiator-hot",
    via: [[780, 415], [815, 355]],
    labelX: 75,
    labelY: 58,
    routeLength: "0.91 m",
    segments: ["S-07 engine front · 0.35 m", "S-03 RF bay · 0.56 m"],
    temperature: "94 °C",
  },
  {
    id: "line-radiator-reservoir",
    name: "L-103",
    domain: "coolant",
    from: "radiator-cool",
    to: "reservoir-in",
    via: [[840, 400], [840, 500]],
    labelX: 85,
    labelY: 72,
    routeLength: "0.63 m",
    segments: ["S-08 radiator drop · 0.63 m"],
    temperature: "79 / 84 °C",
  },
  {
    id: "line-reservoir-pump",
    name: "L-104",
    domain: "coolant",
    from: "reservoir-out",
    to: "pump-in",
    via: [[660, 565], [540, 560]],
    labelX: 62,
    labelY: 88,
    routeLength: "1.18 m",
    segments: ["S-09 lower return · 1.18 m"],
    temperature: "78 °C",
  },
];

const seededWarnings = [
  {
    id: "clearance",
    level: "warning",
    subject: "S-03 · Right-front bay",
    text: "Illustrative: wire bundle shares a hot coolant corridor; clearance evidence is missing.",
  },
  {
    id: "terminal",
    level: "unknown",
    subject: "K2:87 → M1:+",
    text: "Illustrative: terminal family compatibility is unknown.",
  },
  {
    id: "temperature",
    level: "conflict",
    subject: "HX1 · Coolant outlet",
    text: "Illustrative: sensor says 79 °C; imported log says 84 °C.",
  },
];

const app = document.querySelector("#app");

function allComponents() {
  return state.addedRelay ? [...components, auxiliaryRelay] : components;
}

function allConnections() {
  if (!state.connectedRelay) return baseConnections;

  return [
    ...baseConnections,
    {
      id: "wire-aux-fan",
      name: "W-006",
      domain: "electrical",
      from: "aux-relay-out",
      to: "fan-pos",
      via: state.routedRelay ? [[640, 135], [640, 155]] : [],
      labelX: 65,
      labelY: 18,
      routeLength: state.routedRelay ? "1.84 m" : "unrouted",
      segments: state.routedRelay
        ? ["S-10 aux lead · 1.30 m", "S-03 RF bay · 0.54 m"]
        : [],
    },
  ];
}

function selectedEntity() {
  return (
    allComponents().find((item) => item.id === state.selectedId) ||
    allConnections().find((item) => item.id === state.selectedId) ||
    allComponents().find((item) => item.id === "pump")
  );
}

function visibleForSystem(item) {
  if (state.system === "all") return true;
  if (item.domain) return item.domain === state.system;
  return item.systems.includes(state.system);
}

function portFallbackPosition(portId) {
  for (const component of allComponents()) {
    const port = component.ports.find((candidate) => candidate.id === portId);
    if (!port) continue;

    const siblings = component.ports.filter((candidate) => candidate.side === port.side);
    const index = siblings.findIndex((candidate) => candidate.id === portId);
    const offset = (index + 1) / (siblings.length + 1);
    const position = { x: component.x * 10, y: component.y * 6.2 };

    if (port.side === "left") return { x: position.x - 62, y: position.y - 31 + offset * 62 };
    if (port.side === "right") return { x: position.x + 62, y: position.y - 31 + offset * 62 };
    if (port.side === "top") return { x: position.x - 56 + offset * 112, y: position.y - 30 };
    return { x: position.x - 56 + offset * 112, y: position.y + 30 };
  }

  return { x: 500, y: 310 };
}

function roundedPath(points, radius = 16) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y);
    const bend = Math.min(radius, incoming / 2, outgoing / 2);
    const before = {
      x: corner.x - ((corner.x - previous.x) / incoming) * bend,
      y: corner.y - ((corner.y - previous.y) / incoming) * bend,
    };
    const after = {
      x: corner.x + ((next.x - corner.x) / outgoing) * bend,
      y: corner.y + ((next.y - corner.y) / outgoing) * bend,
    };

    path += ` L ${before.x} ${before.y} Q ${corner.x} ${corner.y} ${after.x} ${after.y}`;
  }

  const end = points.at(-1);
  return `${path} L ${end.x} ${end.y}`;
}

function connectionPath(connection, start = portFallbackPosition(connection.from), end = portFallbackPosition(connection.to)) {
  const via = connection.via.map(([x, y]) => ({ x, y }));
  return roundedPath([start, ...via, end], connection.domain === "coolant" ? 28 : 14);
}

function temperatureTone(connection) {
  if (connection.domain !== "coolant") return "";
  if (connection.temperature.includes("/")) return "temp-conflict";
  const temperature = Number.parseFloat(connection.temperature);
  if (temperature >= 94) return "temp-hot";
  if (temperature >= 85) return "temp-warm";
  return "temp-cool";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function controlsMarkup({ compact = false } = {}) {
  return `
    <label class="control-field ${compact ? "compact" : ""}">
      <span>System</span>
      <select data-control="system" aria-label="Visible system">
        <option value="all" ${state.system === "all" ? "selected" : ""}>All systems</option>
        <option value="electrical" ${state.system === "electrical" ? "selected" : ""}>Electrical</option>
        <option value="coolant" ${state.system === "coolant" ? "selected" : ""}>Coolant</option>
      </select>
    </label>
    <label class="control-field ${compact ? "compact" : ""}">
      <span>Operating state</span>
      <select data-control="operatingState" aria-label="Operating state">
        <option value="key-off" ${state.operatingState === "key-off" ? "selected" : ""}>Key Off</option>
        <option value="run-hot" ${state.operatingState === "run-hot" ? "selected" : ""}>Run Hot</option>
      </select>
    </label>
  `;
}

function toolButtonsMarkup({ labels = true } = {}) {
  return ["select", "add", "connect", "route"]
    .map(
      (mode) => `
        <button
          class="tool-button edit-control ${state.mode === mode ? "active" : ""}"
          data-mode="${mode}"
          aria-pressed="${state.mode === mode}"
          title="${mode[0].toUpperCase() + mode.slice(1)} tool"
        >
          <span class="tool-glyph">${{ select: "↖", add: "+", connect: "↝", route: "⌁" }[mode]}</span>
          ${labels ? `<span>${mode}</span>` : ""}
        </button>
      `,
    )
    .join("");
}

function statusStripMarkup() {
  const selected = selectedEntity();
  return `
    <div class="status-strip" aria-label="Current prototype state">
      <span><b>System</b> ${state.system === "all" ? "All" : state.system}</span>
      <span><b>State</b> ${state.operatingState === "run-hot" ? "Run Hot" : "Key Off"}</span>
      <span><b>Tool</b> ${state.mode}</span>
      <span><b>Selection</b> ${escapeHtml(selected.name)}</span>
      <span class="status-warning"><b>3</b> illustrative findings</span>
    </div>
  `;
}

function prototypeBannerMarkup() {
  return `
    <div class="prototype-banner" role="note">
      <span>Prototype</span>
      Illustrative data — not engineering guidance
    </div>
    <div class="mobile-readonly" role="status">Mobile review · editing controls hidden</div>
  `;
}

function brandMarkup({ compact = false } = {}) {
  return `
    <div class="brand ${compact ? "compact" : ""}">
      <span class="brand-mark" aria-hidden="true">VM</span>
      <span><b>Venae Machinae</b><small>RX-7 systems plan</small></span>
    </div>
  `;
}

function topologyCanvasMarkup({ variant }) {
  const activeOverlay = state.overlay && state.operatingState === "run-hot";
  const visibleComponents = allComponents()
    .filter(visibleForSystem)
    .filter((component) =>
      state.query
        ? `${component.code} ${component.name} ${component.kind} ${component.ports.map((port) => port.label).join(" ")}`
            .toLowerCase()
            .includes(state.query.toLowerCase())
        : true,
    );
  const visiblePortIds = new Set(visibleComponents.flatMap((component) => component.ports.map((port) => port.id)));
  const visibleConnections = allConnections()
    .filter(visibleForSystem)
    .filter((connection) => !state.query || (visiblePortIds.has(connection.from) && visiblePortIds.has(connection.to)));

  const paths = visibleConnections
    .map((connection) => {
      const classes = [
        "connection-group",
        connection.domain,
        activeOverlay ? "overlay-active" : "overlay-inactive",
        temperatureTone(connection),
        state.selectedId === connection.id ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const path = connectionPath(connection);

      return `
        <g class="${classes}">
          <path
            class="connection-hit"
            d="${path}"
            tabindex="0"
            role="button"
            aria-label="Select ${connection.name}, ${connection.domain === "electrical" ? "wire" : "coolant hose"}"
            data-connection="${connection.id}"
            data-connection-path="${connection.id}"
            data-from-port="${connection.from}"
            data-to-port="${connection.to}"
          ></path>
          <path class="connection-shell" d="${path}" data-connection-path="${connection.id}" aria-hidden="true"></path>
          <path class="connection-core" d="${path}" data-connection-path="${connection.id}" aria-hidden="true"></path>
          ${activeOverlay ? `<path class="connection-flow" d="${path}" data-connection-path="${connection.id}" aria-hidden="true"></path>` : ""}
          <circle class="connection-coupler start" r="${connection.domain === "coolant" ? 9 : 5}" data-snap-start="${connection.id}" aria-hidden="true"></circle>
          <circle class="connection-coupler end" r="${connection.domain === "coolant" ? 9 : 5}" data-snap-end="${connection.id}" aria-hidden="true"></circle>
        </g>
      `;
    })
    .join("");

  const labels = visibleConnections
    .map(
      (connection) => `
        <button
          class="connection-chip ${connection.domain} ${state.selectedId === connection.id ? "selected" : ""}"
          style="left:${connection.labelX}%;top:${connection.labelY}%"
          data-connection="${connection.id}"
        >
          <span class="connection-kind">${connection.domain === "electrical" ? "Wire" : "Coolant hose"} ${activeOverlay ? "→" : "—"}</span>
          <b>${connection.name}</b>
          <small>${connection.routeLength}${connection.temperature ? ` · ${connection.temperature}` : ""}</small>
        </button>
      `,
    )
    .join("");

  const nodes = visibleComponents.map((component) => componentMarkup(component)).join("");

  const temperatures =
    activeOverlay && state.system !== "electrical"
      ? `
        <div class="temperature-sample hot" style="left:68%;top:56%"><b>94 °C</b><span>engine outlet · measured</span></div>
        <div class="temperature-sample conflict" style="left:82%;top:62%"><b>79 / 84 °C</b><span>radiator outlet · conflict</span></div>
        <div class="temperature-sample warm" style="left:62%;top:83%"><b>78 °C</b><span>return · measured</span></div>
      `
      : "";

  return `
    <section class="canvas-frame canvas-${variant.toLowerCase()}" aria-label="Vehicle system topology canvas">
      <div class="canvas-heading">
        <span><b>ENGINE BAY · TOP</b><small>Scaled background 1:12 · illustrative</small></span>
        <div class="canvas-heading-actions">
          <button class="quiet-button" data-action="toggle-overlay" aria-pressed="${state.overlay}">
            ${state.overlay ? "Overlay on" : "Overlay off"}
          </button>
          <button class="quiet-button" data-action="fit-view">Fit</button>
        </div>
      </div>
      <div class="topology-canvas mode-${state.mode} ${activeOverlay ? "state-running" : "state-off"}">
        <div class="canvas-world" style="--canvas-zoom:${variant === "C" ? state.zoom / 100 : 1};--canvas-pan-x:${variant === "C" ? state.panX : 0}px;--canvas-pan-y:${variant === "C" ? state.panY : 0}px">
          <svg class="vehicle-blueprint" viewBox="0 0 1000 620" aria-hidden="true">
            <path d="M130 110 C220 48 780 48 870 110 L930 245 L900 515 C775 585 225 585 100 515 L70 245 Z"></path>
            <path d="M245 125 L755 125 L825 235 L790 480 L210 480 L175 235 Z"></path>
            <path d="M500 95 L500 535 M180 300 L820 300"></path>
            <rect x="515" y="115" width="180" height="105" rx="24"></rect>
            <circle cx="165" cy="190" r="44"></circle><circle cx="835" cy="190" r="44"></circle>
            <circle cx="165" cy="445" r="44"></circle><circle cx="835" cy="445" r="44"></circle>
          </svg>
          <div class="shared-segment" style="left:57%;top:21%;width:25%;height:22%">
            <span>S-03 · RF bay</span><small>shared corridor · 0.54 m</small>
          </div>
          <svg class="topology-lines" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-label="Connections">
            ${paths}
          </svg>
          ${temperatures}
          ${labels}
          ${nodes}
        </div>
        <div class="canvas-legend">
          <span><i class="legend-line electrical"></i>Wire</span>
          <span><i class="legend-line coolant"></i>Coolant hose</span>
          <span><i class="legend-heat"></i>cool → hot</span>
          <span><i class="legend-arrow">› ›</i>${activeOverlay ? "flow direction" : "inactive"}</span>
          <span><i class="legend-unknown">?</i>unknown</span>
        </div>
        ${
          variant === "C"
            ? `<div class="canvas-viewport-controls" role="group" aria-label="Infinite canvas view controls">
                <button data-action="zoom-out" aria-label="Zoom out">−</button>
                <button data-action="fit-view" aria-label="Reset zoom">${state.zoom}%</button>
                <button data-action="zoom-in" aria-label="Zoom in">+</button>
                <span>Infinite canvas · Space + drag to pan</span>
              </div>`
            : ""
        }
      </div>
    </section>
  `;
}

function componentMarkup(component) {
  const portsBySide = component.ports.reduce((result, port) => {
    result[port.side] = [...(result[port.side] || []), port];
    return result;
  }, {});

  const ports = component.ports
    .map((port) => {
      const index = portsBySide[port.side].findIndex((item) => item.id === port.id);
      const count = portsBySide[port.side].length;
      const offset = ((index + 1) / (count + 1)) * 100;
      return `
        <button
          class="port ${port.domain} ${state.selectedPort === port.id ? "selected" : ""} side-${port.side}"
          style="--port-offset:${offset}%"
          data-port="${port.id}"
          data-component="${component.id}"
          aria-label="${component.name} ${port.label}, ${port.domain} port"
          title="${port.label} · ${port.domain} Port"
        >${escapeHtml(port.label)}</button>
      `;
    })
    .join("");

  return `
    <div
      class="component-node ${component.systems.join(" ")} ${state.selectedId === component.id ? "selected" : ""}"
      style="left:${component.x}%;top:${component.y}%"
      data-component-shell="${component.id}"
    >
      <button class="node-body" data-component="${component.id}" aria-pressed="${state.selectedId === component.id}">
        <span class="node-code">${component.code}</span>
        <span><b>${escapeHtml(component.name)}</b><small>${escapeHtml(component.kind)}</small></span>
      </button>
      ${ports}
    </div>
  `;
}

function inspectorMarkup({ compact = false } = {}) {
  const selected = selectedEntity();
  const isConnection = Boolean(selected.domain);
  const values = isConnection
    ? [
        `${selected.from} → ${selected.to}`,
        `Route Length: ${selected.routeLength}`,
        ...(selected.segments.length ? selected.segments : ["Segments: not routed"]),
      ]
    : selected.values;

  const ports = isConnection
    ? `<div class="endpoint-row"><span>${escapeHtml(selected.from)}</span><b>two-ended ${selected.domain}</b><span>${escapeHtml(selected.to)}</span></div>`
    : `<div class="port-list">${selected.ports
        .map(
          (port) => `<button data-port="${port.id}" data-component="${selected.id}"><b>${escapeHtml(port.label)}</b><span>${port.domain} Port</span></button>`,
        )
        .join("")}</div>`;

  return `
    <section class="inspector ${compact ? "compact" : ""}" aria-label="Selection inspector">
      <header><span class="eyebrow">Selection</span><h2>${escapeHtml(selected.name)}</h2><p>${escapeHtml(selected.kind || selected.domain)}</p></header>
      ${ports}
      <div class="property-list">
        ${values.map((value) => `<div><span>${escapeHtml(value)}</span><button aria-label="Inspect value">↗</button></div>`).join("")}
      </div>
      ${isConnection ? `<div class="segment-note"><b>Segment breakdown</b><span>${selected.segments.length ? "Route Length is the sum above." : "Choose Route to assign Segments."}</span></div>` : ""}
    </section>
  `;
}

function warningsMarkup({ compact = false } = {}) {
  return `
    <section class="warnings-panel ${compact ? "compact" : ""}" aria-label="Illustrative findings">
      <header><span class="eyebrow">Illustrative findings</span><strong>3</strong></header>
      ${seededWarnings
        .map(
          (warning) => `
            <button class="warning-row ${warning.level}" data-warning="${warning.id}">
              <span class="warning-symbol">${{ warning: "△", unknown: "?", conflict: "⇄" }[warning.level]}</span>
              <span><b>${escapeHtml(warning.subject)}</b><small>${escapeHtml(warning.text)}</small></span>
            </button>
          `,
        )
        .join("")}
    </section>
  `;
}

function partShelfMarkup() {
  return `
    <section class="part-shelf">
      <header><span class="eyebrow">Part shelf</span><button aria-label="Search parts">⌕</button></header>
      <button class="part-row edit-control" data-action="add-relay" ${state.addedRelay ? "disabled" : ""}>
        <span class="part-icon">K</span><span><b>Micro relay</b><small>2 electrical Ports</small></span><span>+</span>
      </button>
      <button class="part-row edit-control"><span class="part-icon">T</span><span><b>3-way tee</b><small>3 fluid Ports</small></span><span>+</span></button>
      <button class="part-row edit-control"><span class="part-icon">S</span><span><b>Pressure sensor</b><small>cross-domain</small></span><span>+</span></button>
    </section>
  `;
}

function projectTreeMarkup() {
  return `
    <nav class="project-tree" aria-label="Project systems">
      <span class="eyebrow">Vehicle Project</span>
      <button class="tree-root" data-system="all"><span>RX</span><b>1993 RX-7</b><small>12 components</small></button>
      <button class="tree-item electrical" data-system="electrical"><i></i><span><b>Electrical</b><small>5 connections · 1 unknown</small></span></button>
      <button class="tree-item coolant" data-system="coolant"><i></i><span><b>Engine coolant</b><small>4 lines · 1 conflict</small></span></button>
      <div class="tree-sub"><span>S-03</span><small>Shared RF bay Segment</small></div>
    </nav>
  `;
}

function renderVariantA() {
  return `
    <main class="prototype variant-a">
      ${prototypeBannerMarkup()}
      <header class="app-header">
        ${brandMarkup()}
        <div class="header-controls">${controlsMarkup({ compact: true })}</div>
        <button class="review-button">Review build <span>3</span></button>
      </header>
      ${statusStripMarkup()}
      <div class="workbench-layout">
        <aside class="workbench-left">
          ${projectTreeMarkup()}
          ${partShelfMarkup()}
        </aside>
        <section class="workbench-center">
          <div class="tool-ribbon" aria-label="Canvas tools">${toolButtonsMarkup()}</div>
          ${topologyCanvasMarkup({ variant: "A" })}
        </section>
        <aside class="workbench-right">
          ${inspectorMarkup()}
          ${warningsMarkup({ compact: true })}
        </aside>
      </div>
    </main>
  `;
}

function currentStep() {
  if (!state.addedRelay) return 0;
  if (!state.connectedRelay) return 1;
  if (!state.routedRelay) return 2;
  return 3;
}

function guidedPanelMarkup() {
  const step = currentStep();
  const panels = [
    {
      kicker: "Step 1 · Add",
      title: "Place the auxiliary fan relay",
      body: "Choose a reusable Part Definition. The Component arrives with two typed electrical Ports.",
      action: "add-relay",
      label: "Add micro relay",
    },
    {
      kicker: "Step 2 · Connect",
      title: "Join two explicit Ports",
      body: "Connect K2:87 to M1:+. Compatibility remains unknown until terminal evidence is supplied.",
      action: "connect-relay",
      label: "Connect K2:87 → M1:+",
    },
    {
      kicker: "Step 3 · Route",
      title: "Reuse the right-front bay Segment",
      body: "Assign S-03 to the Wire Route. The 0.54 m Segment is already shared with the coolant corridor.",
      action: "route-relay",
      label: "Route through S-03",
    },
    {
      kicker: "Step 4 · Verify",
      title: "Trace the result in Run Hot",
      body: "The new Wire is routed. Inspect its Segment breakdown, unknown terminal, and the seeded Overlay.",
      action: "select-aux-wire",
      label: "Inspect W-006",
    },
  ];
  const panel = panels[step];

  return `
    <section class="guided-task" aria-live="polite">
      <span class="eyebrow">${panel.kicker}</span>
      <h2>${panel.title}</h2>
      <p>${panel.body}</p>
      <button class="primary-action edit-control" data-action="${panel.action}">${panel.label} <span>→</span></button>
      <button class="text-action" data-action="show-selection">Inspect current selection</button>
    </section>
  `;
}

function renderVariantB() {
  const step = currentStep();
  return `
    <main class="prototype variant-b">
      ${prototypeBannerMarkup()}
      <header class="guided-header">
        ${brandMarkup({ compact: true })}
        <div class="guided-title"><span class="eyebrow">Guided task</span><b>Wire the auxiliary radiator fan</b></div>
        <div class="guided-controls">${controlsMarkup({ compact: true })}</div>
      </header>
      ${statusStripMarkup()}
      <ol class="step-rail" aria-label="Build steps">
        ${["Add", "Connect", "Route", "Verify"]
          .map(
            (label, index) => `<li class="${index === step ? "active" : ""} ${index < step ? "done" : ""}"><span>${index < step ? "✓" : index + 1}</span><b>${label}</b><small>${["Component", "Ports", "Segments", "Evidence"][index]}</small></li>`,
          )
          .join("")}
      </ol>
      <div class="guided-layout">
        <aside class="guided-panel">
          ${guidedPanelMarkup()}
          ${inspectorMarkup({ compact: true })}
          ${step === 3 ? warningsMarkup({ compact: true }) : ""}
        </aside>
        <section class="guided-canvas">
          <div class="guided-tools"><span>Canvas tool</span>${toolButtonsMarkup({ labels: false })}</div>
          ${topologyCanvasMarkup({ variant: "B" })}
        </section>
      </div>
    </main>
  `;
}

function renderVariantC() {
  return `
    <main class="prototype variant-c">
      ${prototypeBannerMarkup()}
      <div class="trace-canvas">${topologyCanvasMarkup({ variant: "C" })}</div>
      <header class="trace-header">
        ${brandMarkup({ compact: true })}
        <label class="command-search">
          <span>⌘ K</span>
          <input data-control="query" value="${escapeHtml(state.query)}" placeholder="Find a component, Port, or command…" />
        </label>
        <button class="trace-review" data-action="show-warnings">△ 3</button>
      </header>
      <div class="trace-lenses" aria-label="Trace lenses">
        <button class="lens ${state.system === "all" ? "active" : ""}" data-system="all">All</button>
        <button class="lens electrical ${state.system === "electrical" ? "active" : ""}" data-system="electrical">⚡ Electrical</button>
        <button class="lens coolant ${state.system === "coolant" ? "active" : ""}" data-system="coolant">↝ Coolant</button>
        <button class="lens ${state.overlay ? "active" : ""}" data-action="toggle-overlay">Overlay</button>
      </div>
      <div class="trace-state">${controlsMarkup({ compact: true })}</div>
      ${statusStripMarkup()}
      <aside class="trace-sheet">
        <div class="sheet-handle"></div>
        <div class="trace-commands edit-control">
          <button data-action="add-relay"><span>+</span>Add relay</button>
          <button data-action="connect-relay"><span>↝</span>Connect Ports</button>
          <button data-action="route-relay"><span>⌁</span>Route S-03</button>
        </div>
        <div class="trace-detail">${inspectorMarkup({ compact: true })}</div>
        <div class="trace-findings">${warningsMarkup({ compact: true })}</div>
      </aside>
    </main>
  `;
}

function variantSwitcherMarkup() {
  return `
    <nav class="prototype-switcher" aria-label="Prototype variants">
      <button data-variant-step="-1" aria-label="Previous variant">←</button>
      <span><small>Variant</small><b>${state.variant} · ${VARIANTS[state.variant]}</b></span>
      <button data-variant-step="1" aria-label="Next variant">→</button>
      <button class="state-toggle" data-action="toggle-state" aria-pressed="${state.showState}">{ }</button>
    </nav>
  `;
}

function statePanelMarkup() {
  if (!state.showState) return "";
  const selected = selectedEntity();
  const snapshot = {
    variant: state.variant,
    system: state.system,
    operatingState: state.operatingState,
    mode: state.mode,
    selected: selected.id,
    selectedPort: state.selectedPort,
    overlay: state.overlay,
    zoom: `${state.zoom}%`,
    pan: { x: state.panX, y: state.panY },
    task: {
      relayAdded: state.addedRelay,
      portsConnected: state.connectedRelay,
      routeAssigned: state.routedRelay,
    },
    illustrativeFindings: seededWarnings.map((warning) => ({
      level: warning.level,
      subject: warning.subject,
    })),
  };

  return `
    <aside class="prototype-state" aria-label="Full prototype state">
      <header><b>Shared in-memory state</b><button data-action="toggle-state" aria-label="Close state">×</button></header>
      <pre>${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre>
    </aside>
  `;
}

function livePortPosition(canvas, portId) {
  const surface = canvas.querySelector(".canvas-world");
  const port = surface?.querySelector(`[data-port="${portId}"]`);
  if (!port) return null;

  const canvasRect = surface.getBoundingClientRect();
  const portRect = port.getBoundingClientRect();
  if (!canvasRect.width || !canvasRect.height || !portRect.width || !portRect.height) return null;

  return {
    x: ((portRect.left + portRect.width / 2 - canvasRect.left) / canvasRect.width) * 1000,
    y: ((portRect.top + portRect.height / 2 - canvasRect.top) / canvasRect.height) * 620,
  };
}

function syncConnectionGeometry() {
  const canvas = app.querySelector(".topology-canvas");
  if (!canvas) return;

  for (const connection of allConnections().filter(visibleForSystem)) {
    const start = livePortPosition(canvas, connection.from);
    const end = livePortPosition(canvas, connection.to);
    if (!start || !end) continue;

    const path = connectionPath(connection, start, end);
    canvas.querySelectorAll(`[data-connection-path="${connection.id}"]`).forEach((element) => {
      element.setAttribute("d", path);
    });

    const startCoupler = canvas.querySelector(`[data-snap-start="${connection.id}"]`);
    const endCoupler = canvas.querySelector(`[data-snap-end="${connection.id}"]`);
    startCoupler?.setAttribute("cx", start.x);
    startCoupler?.setAttribute("cy", start.y);
    endCoupler?.setAttribute("cx", end.x);
    endCoupler?.setAttribute("cy", end.y);
  }
}

function render() {
  const variantMarkup = {
    A: renderVariantA,
    B: renderVariantB,
    C: renderVariantC,
  }[state.variant]();

  app.innerHTML = `${variantMarkup}${variantSwitcherMarkup()}${statePanelMarkup()}`;
  window.requestAnimationFrame(syncConnectionGeometry);
}

function setVariant(nextVariant) {
  state.variant = nextVariant;
  const url = new URL(window.location.href);
  url.searchParams.set("variant", nextVariant);
  window.history.replaceState({}, "", url);
  render();
}

function cycleVariant(direction) {
  const keys = Object.keys(VARIANTS);
  const current = keys.indexOf(state.variant);
  setVariant(keys[(current + direction + keys.length) % keys.length]);
}

function runAction(action) {
  if (action === "toggle-overlay") state.overlay = !state.overlay;
  if (action === "toggle-state") state.showState = !state.showState;
  if (action === "zoom-out") state.zoom = Math.max(70, state.zoom - 10);
  if (action === "zoom-in") state.zoom = Math.min(150, state.zoom + 10);
  if (action === "fit-view") {
    state.zoom = 100;
    state.panX = 0;
    state.panY = 0;
  }
  if (action === "add-relay") {
    state.addedRelay = true;
    state.mode = "connect";
    state.selectedId = "aux-relay";
  }
  if (action === "connect-relay") {
    state.addedRelay = true;
    state.connectedRelay = true;
    state.mode = "route";
    state.selectedId = "wire-aux-fan";
    state.selectedPort = null;
  }
  if (action === "route-relay") {
    state.addedRelay = true;
    state.connectedRelay = true;
    state.routedRelay = true;
    state.mode = "select";
    state.selectedId = "wire-aux-fan";
  }
  if (action === "select-aux-wire") state.selectedId = "wire-aux-fan";
  if (action === "show-warnings") state.selectedId = "radiator";
  if (action === "show-selection") state.showState = true;
  render();
}

function handlePortSelection(portId, componentId) {
  state.selectedId = componentId;
  if (state.mode !== "connect") {
    state.selectedPort = portId;
    render();
    return;
  }

  if (!state.selectedPort) {
    state.selectedPort = portId;
  } else if (state.selectedPort !== portId) {
    state.addedRelay = true;
    state.connectedRelay = true;
    state.mode = "route";
    state.selectedId = "wire-aux-fan";
    state.selectedPort = null;
  }
  render();
}

app.addEventListener("click", (event) => {
  if (suppressNextClick) {
    suppressNextClick = false;
    event.preventDefault();
    return;
  }

  const target = event.target.closest("button, path[data-connection]");
  if (!target) return;

  if (target.dataset.variantStep) {
    cycleVariant(Number(target.dataset.variantStep));
    return;
  }
  if (target.dataset.action) {
    runAction(target.dataset.action);
    return;
  }
  if (target.dataset.mode) {
    state.mode = target.dataset.mode;
    render();
    return;
  }
  if (target.dataset.system) {
    state.system = target.dataset.system;
    render();
    return;
  }
  if (target.dataset.port) {
    handlePortSelection(target.dataset.port, target.dataset.component);
    return;
  }
  if (target.dataset.component) {
    state.selectedId = target.dataset.component;
    state.selectedPort = null;
    render();
    return;
  }
  if (target.dataset.connection) {
    state.selectedId = target.dataset.connection;
    state.selectedPort = null;
    render();
  }
});

app.addEventListener("change", (event) => {
  const control = event.target.dataset.control;
  if (!control) return;
  state[control] = event.target.value;
  render();
});

app.addEventListener("input", (event) => {
  if (event.target.dataset.control === "query") {
    const cursor = event.target.selectionStart;
    state.query = event.target.value;
    render();
    const query = app.querySelector('[data-control="query"]');
    query?.focus();
    query?.setSelectionRange(cursor, cursor);
  }
});

app.addEventListener("keydown", (event) => {
  const connection = event.target.closest("path[data-connection]");
  if (!connection || !["Enter", " "].includes(event.key)) return;

  event.preventDefault();
  state.selectedId = connection.dataset.connection;
  state.selectedPort = null;
  render();
});

app.addEventListener("pointerdown", (event) => {
  const canvas = event.target.closest(".variant-c .topology-canvas");
  if (!canvas || !spacePressed) return;

  event.preventDefault();
  panGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: state.panX,
    originY: state.panY,
    moved: false,
  };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-panning");
});

app.addEventListener("pointermove", (event) => {
  if (!panGesture || panGesture.pointerId !== event.pointerId) return;

  const deltaX = event.clientX - panGesture.startX;
  const deltaY = event.clientY - panGesture.startY;
  panGesture.moved ||= Math.hypot(deltaX, deltaY) > 3;
  state.panX = panGesture.originX + deltaX;
  state.panY = panGesture.originY + deltaY;
  const world = app.querySelector(".canvas-world");
  world?.style.setProperty("--canvas-pan-x", `${state.panX}px`);
  world?.style.setProperty("--canvas-pan-y", `${state.panY}px`);
});

function finishPan(event) {
  if (!panGesture || panGesture.pointerId !== event.pointerId) return;

  suppressNextClick = panGesture.moved;
  event.target.closest(".topology-canvas")?.classList.remove("is-panning");
  panGesture = null;
}

app.addEventListener("pointerup", finishPan);
app.addEventListener("pointercancel", finishPan);

window.addEventListener("keydown", (event) => {
  const tag = event.target.tagName;
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tag) || event.target.isContentEditable) return;
  if (event.code === "Space") {
    event.preventDefault();
    spacePressed = true;
    app.querySelector(".variant-c .topology-canvas")?.classList.add("is-pan-ready");
    return;
  }
  if (event.key === "ArrowLeft") cycleVariant(-1);
  if (event.key === "ArrowRight") cycleVariant(1);
});

window.addEventListener("keyup", (event) => {
  if (event.code !== "Space") return;
  spacePressed = false;
  app.querySelector(".topology-canvas")?.classList.remove("is-pan-ready");
});

window.addEventListener("blur", () => {
  spacePressed = false;
  panGesture = null;
});

window.addEventListener("resize", () => window.requestAnimationFrame(syncConnectionGeometry));

render();
