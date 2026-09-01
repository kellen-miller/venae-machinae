import type { RendererPoint, RendererViewport } from '../../renderer/projection';

export const WORKSPACE_VIEWS = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'systems', label: 'Systems' },
  { id: 'circuits-lines', label: 'Circuits & Lines' },
  { id: 'interfaces', label: 'Interfaces' },
  { id: 'routes', label: 'Routes' },
  { id: 'harnesses-bundles', label: 'Harnesses & Bundles' },
  { id: 'calculations', label: 'Calculations' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'bom', label: 'BOM' },
  { id: 'findings', label: 'Findings' },
  { id: 'state-compare', label: 'State Compare' }
] as const;

export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number]['id'];
export type DenseWorkspaceView = Exclude<WorkspaceView, 'canvas'>;
export type WorkspaceMode = 'select' | 'pan' | 'add' | 'connect' | 'route';
export type WorkspaceSubjectKind = 'component' | 'connection' | 'route-point';

export type WorkspaceSubject = Readonly<{
  kind: WorkspaceSubjectKind;
  id: string;
}>;

type RevealFrame = Readonly<{
  activeView: WorkspaceView;
  canvasViewport: RendererViewport;
  domainFilter: 'all' | 'electrical' | 'fluid';
  systemFilterId: string | null;
}>;

const initialViewport = (): RendererViewport => ({ x: 0, y: 0, zoom: 1 });

export class WorkspacePresentation {
  mode = $state<WorkspaceMode>('select');
  activeView = $state<WorkspaceView>('canvas');
  selection = $state<WorkspaceSubject | null>(null);
  preview = $state<WorkspaceSubject | null>(null);
  domainFilter = $state<'all' | 'electrical' | 'fluid'>('all');
  systemFilterId = $state<string | null>(null);
  operatingStateId = $state<string | null>(null);
  commandPaletteOpen = $state(false);
  searchOpen = $state(false);
  searchQuery = $state('');
  canvasViewport = $state<RendererViewport>(initialViewport());
  lensViewports = $state<Record<DenseWorkspaceView, RendererViewport>>({
    systems: initialViewport(),
    'circuits-lines': initialViewport(),
    interfaces: initialViewport(),
    routes: initialViewport(),
    'harnesses-bundles': initialViewport(),
    calculations: initialViewport(),
    evidence: initialViewport(),
    bom: initialViewport(),
    findings: initialViewport(),
    'state-compare': initialViewport()
  });
  comparisonViewports = $state<{ left: RendererViewport; right: RendererViewport }>({
    left: initialViewport(),
    right: initialViewport()
  });
  revealFrame = $state<RevealFrame | null>(null);

  setMode(mode: WorkspaceMode): void {
    this.mode = mode;
  }

  openView(view: WorkspaceView): void {
    this.activeView = view;
  }

  select(subject: WorkspaceSubject): void {
    this.selection = subject;
    this.preview = null;
  }

  setPreview(subject: WorkspaceSubject | null): void {
    this.preview = subject;
  }

  followPreview(): void {
    if (!this.preview) return;
    this.selection = this.preview;
    this.preview = null;
  }

  updateCanvasViewport(viewport: RendererViewport): void {
    this.canvasViewport = viewport;
  }

  increaseLensZoom(view: DenseWorkspaceView): void {
    const zoom = Number(Math.min(2.25, this.lensViewports[view].zoom + 0.1).toFixed(1));
    this.lensViewports[view] = { ...this.lensViewports[view], zoom };
  }

  increaseComparisonZoom(side: 'left' | 'right'): void {
    const zoom = Number(Math.min(2.25, this.comparisonViewports[side].zoom + 0.1).toFixed(1));
    const viewport = { ...this.comparisonViewports[side], zoom };
    this.comparisonViewports = { left: viewport, right: viewport };
  }

  reveal(position: RendererPoint): void {
    if (!this.revealFrame) {
      this.revealFrame = {
        activeView: this.activeView,
        canvasViewport: { ...this.canvasViewport },
        domainFilter: this.domainFilter,
        systemFilterId: this.systemFilterId
      };
    }
    this.activeView = 'canvas';
    this.canvasViewport = {
      x: Math.round(470 - position.x * this.canvasViewport.zoom),
      y: Math.round(300 - position.y * this.canvasViewport.zoom),
      zoom: this.canvasViewport.zoom
    };
  }

  returnFromReveal(): void {
    if (!this.revealFrame) return;
    this.activeView = this.revealFrame.activeView;
    this.canvasViewport = this.revealFrame.canvasViewport;
    this.domainFilter = this.revealFrame.domainFilter;
    this.systemFilterId = this.revealFrame.systemFilterId;
    this.revealFrame = null;
  }
}
