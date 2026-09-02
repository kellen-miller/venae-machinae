import type { ProjectSnapshot } from '../project/project';

export type RendererPoint = Readonly<{
  x: number;
  y: number;
}>;

export type RendererPort = Readonly<{
  id: string;
  nodeId: string;
  label: string;
  domain: 'electrical' | 'fluid';
  direction: 'input' | 'output' | 'bidirectional';
  side: 'left' | 'right' | 'top' | 'bottom';
  offset: number;
  compatibility: 'idle' | 'compatible' | 'blocked';
}>;

export type RendererNode = Readonly<{
  id: string;
  label: string;
  kind: string;
  position: RendererPoint;
  width: number;
  height: number;
  selected: boolean;
  previewed?: boolean;
  ports: readonly RendererPort[];
}>;

export type RendererRoutePoint = Readonly<{
  id: string;
  position: RendererPoint;
}>;

export type RendererPhysicalConnection = Readonly<{
  kind: 'wire' | 'hose' | 'tube' | 'pipe';
  conductorColor?: string;
  conductorStripe?: string;
  conductorScale?: number;
  medium?: string;
  temperature?: string;
  direction?: 'forward' | 'reverse' | 'bidirectional' | 'unknown';
}>;

export type RendererConnection = Readonly<{
  id: string;
  label: string;
  sourcePortId: string;
  targetPortId: string;
  physical: RendererPhysicalConnection;
  routePoints: readonly RendererRoutePoint[];
  selected: boolean;
  previewed?: boolean;
}>;

export type RendererOverlayMark = Readonly<{
  id: string;
  connectionId: string;
  channel:
    | 'selection'
    | 'potential'
    | 'current'
    | 'signal'
    | 'direction'
    | 'temperature'
    | 'provenance'
    | 'unknown'
    | 'conflict'
    | 'finding';
  label: string;
}>;

export type RendererViewport = Readonly<{
  x: number;
  y: number;
  zoom: number;
}>;

export type RendererProjection = Readonly<{
  revision: number;
  nodes: readonly RendererNode[];
  connections: readonly RendererConnection[];
  overlayMarks: readonly RendererOverlayMark[];
}>;

export type ProjectProjectionOptions = Readonly<{
  selectedSubjectId?: string | null;
  previewSubjectId?: string | null;
  previewSourcePortId?: string | null;
  domainFilter?: 'all' | 'electrical' | 'fluid';
  systemFilterId?: string | null;
  operatingStateId?: string | null;
  overlayChannels?: readonly (
    'potential' | 'current' | 'signal' | 'fluid-direction' | 'temperature' | 'finding' | 'selection'
  )[];
}>;

export type RendererCapabilityMode = 'author' | 'review' | 'mobile-review';

export function validateRendererProjection(projection: RendererProjection): RendererProjection {
  if (!Number.isSafeInteger(projection.revision) || projection.revision < 0) {
    throw new Error('Renderer projection revision must be a nonnegative safe integer');
  }

  const nodes = new Set<string>();
  const ports = new Map<string, RendererPort>();
  for (const node of projection.nodes) {
    if (nodes.has(node.id)) throw new Error(`Duplicate Renderer Node ${node.id}`);
    if (!(node.width > 0) || !(node.height > 0)) {
      throw new Error(`Renderer Node ${node.id} must have positive dimensions`);
    }

    nodes.add(node.id);
    for (const port of node.ports) {
      if (port.nodeId !== node.id) {
        throw new Error(`Renderer Port ${port.id} belongs to ${port.nodeId}, not ${node.id}`);
      }
      if (ports.has(port.id)) throw new Error(`Duplicate Renderer Port ${port.id}`);
      if (!(port.offset > 0 && port.offset < 1)) {
        throw new Error(`Renderer Port ${port.id} offset must be between zero and one`);
      }

      ports.set(port.id, port);
    }
  }

  const connections = new Set<string>();
  const routePoints = new Set<string>();
  for (const connection of projection.connections) {
    if (connections.has(connection.id)) {
      throw new Error(`Duplicate Renderer Connection ${connection.id}`);
    }

    const source = ports.get(connection.sourcePortId);
    const target = ports.get(connection.targetPortId);
    if (!source || !target) {
      throw new Error(`Connection ${connection.id} references an absent Renderer Port`);
    }
    if (connection.physical.kind === 'wire') {
      if (source.domain !== 'electrical' || target.domain !== 'electrical') {
        throw new Error(`Connection ${connection.id} uses wire between non-electrical Ports`);
      }
    } else if (source.domain !== 'fluid' || target.domain !== 'fluid') {
      throw new Error(
        `Connection ${connection.id} uses ${connection.physical.kind} between non-fluid Ports`
      );
    }

    connections.add(connection.id);
    for (const routePoint of connection.routePoints) {
      if (routePoints.has(routePoint.id)) {
        throw new Error(`Duplicate Renderer Route Point ${routePoint.id}`);
      }

      routePoints.add(routePoint.id);
    }
  }

  const overlayMarks = new Set<string>();
  for (const mark of projection.overlayMarks) {
    if (overlayMarks.has(mark.id)) throw new Error(`Duplicate Renderer Overlay Mark ${mark.id}`);
    if (!connections.has(mark.connectionId)) {
      throw new Error(`Renderer Overlay Mark ${mark.id} references absent Connection`);
    }

    overlayMarks.add(mark.id);
  }

  return projection;
}

export function rendererPortsCanConnect(
  projection: RendererProjection,
  sourcePortId: string,
  targetPortId: string
): boolean {
  let source: RendererPort | undefined;
  let target: RendererPort | undefined;
  for (const node of projection.nodes) {
    for (const port of node.ports) {
      if (port.id === sourcePortId) source = port;
      if (port.id === targetPortId) target = port;
    }
  }

  if (!source || !target || source.nodeId === target.nodeId || source.domain !== target.domain) {
    return false;
  }

  return (
    (source.direction === 'output' || source.direction === 'bidirectional') &&
    (target.direction === 'input' || target.direction === 'bidirectional')
  );
}

export function projectSnapshotToRendererProjection(
  snapshot: ProjectSnapshot,
  options: ProjectProjectionOptions = {}
): RendererProjection {
  const activeOverlayResult = snapshot.results.find(
    (result) =>
      (result.status === 'current' || result.status === 'stale' || result.status === 'failed') &&
      result.detail?.type === 'overlay' &&
      result.detail.overlay.operatingStateId === options.operatingStateId
  );
  const activeOverlay =
    activeOverlayResult?.detail?.type === 'overlay' ? activeOverlayResult.detail.overlay : null;
  const validationResult = snapshot.results.find(
    (result) =>
      (result.status === 'current' || result.status === 'stale') &&
      result.detail?.type === 'validation'
  );
  const validationHistory =
    validationResult?.detail?.type === 'validation' ? validationResult.detail.history : null;
  const selectedOverlayChannels = new Set(
    options.overlayChannels ?? [
      'potential',
      'current',
      'signal',
      'fluid-direction',
      'temperature',
      'finding',
      'selection'
    ]
  );
  const previewSource = snapshot.topology.components
    .flatMap((component) => component.ports)
    .find((port) => port.id === options.previewSourcePortId);
  const filteredConnections = snapshot.topology.connections.filter(
    (connection) =>
      (options.domainFilter === undefined ||
        options.domainFilter === 'all' ||
        connection.domain === options.domainFilter) &&
      (!options.systemFilterId || connection.systemId === options.systemFilterId)
  );
  const filteredConnectionPortIds = new Set(
    filteredConnections.flatMap((connection) => [connection.sourcePortId, connection.targetPortId])
  );
  const filteredComponents = snapshot.topology.components.filter((component) => {
    if (options.systemFilterId) {
      return component.ports.some((port) => filteredConnectionPortIds.has(port.id));
    }
    if (options.domainFilter && options.domainFilter !== 'all') {
      return component.ports.some((port) => port.domain === options.domainFilter);
    }
    return true;
  });
  const visiblePortIds = new Set(
    filteredComponents.flatMap((component) => component.ports.map((port) => port.id))
  );
  const nodes: RendererNode[] = filteredComponents.map((component) => ({
    id: component.id,
    label: component.label,
    kind: component.kind,
    position: { x: Number(component.position.x), y: Number(component.position.y) },
    width: 176,
    height: Math.max(96, 64 + component.ports.length * 24),
    selected: options.selectedSubjectId === component.id,
    previewed: options.previewSubjectId === component.id,
    ports: component.ports.map((port, index) => ({
      id: port.id,
      nodeId: component.id,
      label: port.label,
      domain: port.domain,
      direction: 'bidirectional',
      side: index % 2 === 0 ? 'left' : 'right',
      offset: (index + 1) / (component.ports.length + 1),
      compatibility:
        previewSource?.id === port.id
          ? 'compatible'
          : previewSource
            ? previewSource.componentId !== port.componentId &&
              previewSource.domain === port.domain &&
              previewSource.mediumId === port.mediumId &&
              (previewSource.interfaceKey === null ||
                port.interfaceKey === null ||
                previewSource.interfaceKey === port.interfaceKey)
              ? 'compatible'
              : 'blocked'
            : 'idle'
    }))
  }));
  const connections: RendererConnection[] = filteredConnections
    .filter(
      (connection) =>
        visiblePortIds.has(connection.sourcePortId) && visiblePortIds.has(connection.targetPortId)
    )
    .map((connection) => {
      const route = snapshot.topology.routes.find(
        (candidate) => candidate.id === connection.routeId
      );
      const direction = activeOverlay?.marks.find(
        (mark) =>
          mark.connectionId === connection.id &&
          mark.channel === 'fluid-direction' &&
          selectedOverlayChannels.has('fluid-direction')
      )?.direction;
      return {
        id: connection.id,
        label: connection.label,
        sourcePortId: connection.sourcePortId,
        targetPortId: connection.targetPortId,
        physical:
          connection.domain === 'electrical'
            ? {
                kind: 'wire',
                conductorColor: '#b4483d',
                conductorStripe: '#f3d48a',
                conductorScale: 12,
                direction: 'unknown'
              }
            : {
                kind: connection.kind.replace('fluid-', '') as 'hose' | 'tube' | 'pipe',
                ...(connection.mediumId ? { medium: connection.mediumId } : {}),
                direction:
                  direction === 'forward' ||
                  direction === 'reverse' ||
                  direction === 'bidirectional'
                    ? direction
                    : 'unknown'
              },
        routePoints:
          route?.segmentIds.flatMap((segmentId) => {
            const segment = snapshot.topology.segments.find(
              (candidate) => candidate.id === segmentId
            );
            return segment
              ? [
                  {
                    id: `${connection.id}:${segment.id}`,
                    position: { x: Number(segment.end.x), y: Number(segment.end.y) }
                  }
                ]
              : [];
          }) ?? [],
        selected: options.selectedSubjectId === connection.id,
        previewed: options.previewSubjectId === connection.id
      };
    });

  const visibleConnectionIds = new Set(connections.map((connection) => connection.id));
  const overlayMarks: RendererOverlayMark[] = [];
  for (const connection of snapshot.topology.connections) {
    if (!visibleConnectionIds.has(connection.id)) continue;
    if (options.selectedSubjectId === connection.id && selectedOverlayChannels.has('selection')) {
      overlayMarks.push({
        id: `selection:${connection.id}`,
        connectionId: connection.id,
        channel: 'selection',
        label: `Selected ${connection.label}`
      });
    }
    if (activeOverlay) {
      for (const mark of activeOverlay.marks.filter(
        (candidate) =>
          candidate.connectionId === connection.id && selectedOverlayChannels.has(candidate.channel)
      )) {
        const channel = mark.channel === 'fluid-direction' ? 'direction' : mark.channel;
        overlayMarks.push({
          id: mark.id,
          connectionId: connection.id,
          channel,
          label: `${mark.staticCue} · ${mark.label}${
            activeOverlayResult?.status === 'stale' ? ' · stale' : ''
          }`
        });
        if (mark.trace.sources.length > 0) {
          overlayMarks.push({
            id: `provenance:${mark.id}`,
            connectionId: connection.id,
            channel: 'provenance',
            label: `${mark.channel} provenance: ${mark.trace.sources.join('; ')}`
          });
        }
        if (mark.status === 'unavailable') {
          overlayMarks.push({
            id: `unknown:${mark.id}`,
            connectionId: connection.id,
            channel: 'unknown',
            label: `${mark.channel} unavailable`
          });
        }
        if (mark.status === 'conflicting') {
          overlayMarks.push({
            id: `conflict:${mark.id}`,
            connectionId: connection.id,
            channel: 'conflict',
            label: `${mark.channel} conflicts: ${mark.trace.conflicts.join('; ')}`
          });
        }
      }
    } else if (connection.domain === 'fluid' && selectedOverlayChannels.has('fluid-direction')) {
      overlayMarks.push({
        id: `direction:${connection.id}`,
        connectionId: connection.id,
        channel: 'direction',
        label: `Direction unknown for ${connection.label}`
      });
    }
    for (const evidence of snapshot.evidence.filter(
      (candidate) => candidate.subjectId === connection.id
    )) {
      if (evidence.provenance) {
        overlayMarks.push({
          id: `provenance:${evidence.id}`,
          connectionId: connection.id,
          channel: 'provenance',
          label: `${evidence.label} provenance recorded`
        });
      }
      if (evidence.state === 'unknown') {
        overlayMarks.push({
          id: `unknown:${evidence.id}`,
          connectionId: connection.id,
          channel: 'unknown',
          label: `${evidence.label} unknown`
        });
      }
      if (evidence.state === 'conflicting') {
        overlayMarks.push({
          id: `conflict:${evidence.id}`,
          connectionId: connection.id,
          channel: 'conflict',
          label: `${evidence.label} conflicting`
        });
      }
      if (
        selectedOverlayChannels.has('temperature') &&
        evidence.label.toLowerCase().includes('temperature')
      ) {
        overlayMarks.push({
          id: `temperature:${evidence.id}`,
          connectionId: connection.id,
          channel: 'temperature',
          label: `${evidence.value ?? 'Unknown'} ${evidence.unit ?? ''}`.trim()
        });
      }
    }
    if (selectedOverlayChannels.has('finding')) {
      const findings =
        validationHistory?.findings.filter(
          (finding) => finding.lifecycle === 'active' && finding.subjectId === connection.id
        ) ?? [];
      for (const finding of findings) {
        overlayMarks.push({
          id: finding.id,
          connectionId: connection.id,
          channel: 'finding',
          label: `${finding.severity} Finding · ${finding.claim}${finding.evaluation === 'stale' ? ' · stale' : ''}`
        });
      }
    }
  }

  return validateRendererProjection({
    revision: snapshot.revision,
    nodes,
    connections,
    overlayMarks
  });
}
