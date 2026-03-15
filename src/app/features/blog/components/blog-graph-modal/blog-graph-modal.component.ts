import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Router } from '@angular/router';
import { BlogArticleGraphData, BlogGraphRelationType } from '../../models/blog-article.model';
import { buildArticleGraph, BlogGraphBuildResult, BlogGraphNodeAttributes, BlogGraphNodeMeta, BlogGraphEdgeAttributes, collectSharedTags, withAlpha } from '../../utils/blog-graph.utils';
import { Language } from '../../../../translations/services/translation.service';
import { BlogRoutingService } from '../../services/blog-routing.service';

type SigmaRenderer = {
  on(event: string, listener: (payload: { node?: string; event?: { x: number; y: number }; preventSigmaDefault?: () => void }) => void): SigmaRenderer;
  off(event: string, listener: (payload: { node?: string; event?: { x: number; y: number }; preventSigmaDefault?: () => void }) => void): SigmaRenderer;
  getCamera(): { animatedReset(options?: { duration?: number }): void };
  viewportToGraph(point: { x: number; y: number }): { x: number; y: number };
  setCustomBBox(bbox: { x: [number, number]; y: [number, number] } | null): SigmaRenderer;
  setSetting(key: string, value: unknown): SigmaRenderer;
  setSettings(settings: Record<string, unknown>): SigmaRenderer;
  refresh(opts?: {
    partialGraph?: {
      nodes?: string[];
      edges?: string[];
    };
    skipIndexation?: boolean;
    schedule?: boolean;
  }): SigmaRenderer;
  kill(): void;
};

interface BlogGraphInspectorState {
  title: string;
  summary: string;
  relationLabel: string;
  relationType: string;
  sharedTags: string[];
  scoreText: string;
  canNavigate: boolean;
  slug: string | null;
}

@Component({
  selector: 'app-blog-graph-modal',
  imports: [CommonModule, CdkTrapFocus],
  templateUrl: './blog-graph-modal.component.html',
  styleUrl: './blog-graph-modal.component.css'
})
export class BlogGraphModalComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) graphData!: BlogArticleGraphData;
  @Input({ required: true }) currentSlug!: string;
  @Input() lang: Language = 'es';
  @Output() close = new EventEmitter<void>();
  @Output() navigateToArticle = new EventEmitter<string>();

  @ViewChild('graphContainer') private graphContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;

  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly blogRoutingService = inject(BlogRoutingService);
  private sigma: SigmaRenderer | null = null;
  private graphBuildResult: BlogGraphBuildResult | null = null;
  private hoveredSlug: string | null = null;
  private selectedSlug: string | null = null;
  private draggingSlug: string | null = null;
  private dragOffset: { x: number; y: number } | null = null;
  private previousBodyOverflow = '';

  readonly topLevelLimit = 8;
  inspector: BlogGraphInspectorState = this.createCenterInspector();
  visibleNodeCount = 0;
  visibleEdgeCount = 0;
  hasRelations = false;
  isReady = false;
  loadError: string | null = null;

  private readonly handleEnterNode = (payload: { node?: string }) => {
    if (this.draggingSlug) {
      return;
    }

    if (!payload.node) {
      return;
    }

    this.hoveredSlug = payload.node;
    this.syncInspector();
    this.applySigmaReducers();
  };

  private readonly handleLeaveNode = (payload: { node?: string }) => {
    if (this.draggingSlug) {
      return;
    }

    if (payload.node && this.hoveredSlug !== payload.node) {
      return;
    }

    this.hoveredSlug = null;
    this.syncInspector();
    this.applySigmaReducers();
  };

  private readonly handleClickNode = (payload: { node?: string }) => {
    if (this.draggingSlug) {
      return;
    }

    if (!payload.node) {
      return;
    }

    this.selectedSlug = payload.node === this.selectedSlug ? null : payload.node;
    this.syncInspector();
    this.applySigmaReducers();
  };

  private readonly handleDoubleClickNode = (payload: { node?: string }) => {
    if (this.draggingSlug) {
      return;
    }

    if (!payload.node || payload.node === this.currentSlug) {
      return;
    }

    const urlTree = this.router.createUrlTree(this.blogRoutingService.buildArticleLink(payload.node, this.lang));
    const url = this.router.serializeUrl(urlTree);
    window.open(url, '_blank', 'noopener');
  };

  private readonly handleClickStage = () => {
    if (this.draggingSlug) {
      return;
    }

    this.selectedSlug = null;
    this.hoveredSlug = null;
    this.syncInspector();
    this.applySigmaReducers();
  };

  private readonly handleDownNode = (payload: { node?: string; event?: { x: number; y: number }; preventSigmaDefault?: () => void }) => {
    if (!payload.node || !payload.event || !this.graphBuildResult || !this.sigma) {
      return;
    }

    payload.preventSigmaDefault?.();
    const graphPoint = this.sigma.viewportToGraph({ x: payload.event.x, y: payload.event.y });
    const nodeData = this.graphBuildResult.graph.getNodeAttributes(payload.node);

    this.draggingSlug = payload.node;
    this.dragOffset = {
      x: nodeData.x - graphPoint.x,
      y: nodeData.y - graphPoint.y
    };
    this.sigma.setSetting('enableCameraPanning', false);
    this.sigma.setSetting('enableCameraZooming', false);
  };

  private readonly handleMoveBody = (payload: { event?: { x: number; y: number } }) => {
    if (!this.draggingSlug || !this.dragOffset || !payload.event || !this.graphBuildResult || !this.sigma) {
      return;
    }

    const graphPoint = this.sigma.viewportToGraph({ x: payload.event.x, y: payload.event.y });
    this.graphBuildResult.graph.mergeNodeAttributes(this.draggingSlug, {
      x: graphPoint.x + this.dragOffset.x,
      y: graphPoint.y + this.dragOffset.y
    });
      this.sigma.refresh({
        partialGraph: {
          nodes: [this.draggingSlug]
        },
        skipIndexation: true
      });
  };

  private readonly handlePointerRelease = () => {
    if (!this.draggingSlug || !this.sigma) {
      return;
    }

    this.draggingSlug = null;
    this.dragOffset = null;
    this.sigma.setSetting('enableCameraPanning', true);
    this.sigma.setSetting('enableCameraZooming', true);
  };

  ngAfterViewInit(): void {
    this.previousBodyOverflow = this.doc.body.style.overflow;
    this.doc.body.style.overflow = 'hidden';
    window.setTimeout(() => {
      void this.rebuildGraph();
      this.closeButton?.nativeElement.focus();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['graphData'] || changes['currentSlug']) && this.graphContainer) {
      window.setTimeout(() => {
        void this.rebuildGraph();
      });
    }
  }

  ngOnDestroy(): void {
    this.doc.body.style.overflow = this.previousBodyOverflow;
    this.destroySigma();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeModal();
  }

  closeModal(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  resetView(): void {
    void this.rebuildGraph();
  }

  private async rebuildGraph(): Promise<void> {
    this.isReady = false;
    this.loadError = null;
    this.destroySigma();

    this.graphBuildResult = buildArticleGraph(this.graphData, this.currentSlug, this.topLevelLimit);
    this.visibleNodeCount = this.graphBuildResult?.graph.order || 0;
    this.visibleEdgeCount = this.graphBuildResult?.graph.size || 0;
    this.hasRelations = (this.graphData.relatedBySlug[this.currentSlug] || []).length > 0;
    this.selectedSlug = null;
    this.hoveredSlug = null;
    this.syncInspector();
    this.cdr.detectChanges();

    if (!isPlatformBrowser(this.platformId) || !this.graphBuildResult || !this.hasRelations) {
      return;
    }

    const container = await this.waitForGraphContainer();
    if (!container) {
      this.loadError = this.lang === 'es'
        ? 'El contenedor del grafo no estuvo listo a tiempo.'
        : 'The graph container was not ready in time.';
      this.cdr.detectChanges();
      return;
    }

    try {
      const { default: Sigma } = await import('sigma');

      this.sigma = new Sigma(this.graphBuildResult.graph, container, {
        allowInvalidContainer: true,
        renderLabels: true,
        renderEdgeLabels: true,
        labelFont: 'Inter, sans-serif',
        labelSize: 13,
        labelWeight: '500',
        labelDensity: 0.06,
        labelRenderedSizeThreshold: 14,
        edgeLabelFont: 'Inter, sans-serif',
        edgeLabelSize: 11,
        edgeLabelWeight: '600',
        edgeLabelColor: { color: '#111827' },
        defaultEdgeColor: 'rgba(255, 247, 242, 0.36)',
        defaultNodeColor: '#fff7f2',
        defaultNodeType: 'circle',
        stagePadding: 32,
        hideEdgesOnMove: false,
        hideLabelsOnMove: false,
        zIndex: true,
        minCameraRatio: 0.65,
        maxCameraRatio: 2.8
      }) as SigmaRenderer;

      this.sigma.setCustomBBox(this.createStableBBox());

      this.sigma.on('enterNode', this.handleEnterNode);
      this.sigma.on('leaveNode', this.handleLeaveNode);
      this.sigma.on('clickNode', this.handleClickNode);
      this.sigma.on('doubleClickNode', this.handleDoubleClickNode);
      this.sigma.on('downNode', this.handleDownNode);
      this.sigma.on('moveBody', this.handleMoveBody);
      this.sigma.on('upNode', this.handlePointerRelease);
      this.sigma.on('upStage', this.handlePointerRelease);
      this.sigma.on('clickStage', this.handleClickStage);

      this.applySigmaReducers();
      this.isReady = true;
      this.cdr.detectChanges();
    } catch (error) {
      console.error(error);
      this.loadError = this.lang === 'es'
        ? 'Sigma no pudo inicializar el grafo en este modal.'
        : 'Sigma could not initialize the graph in this modal.';
      this.cdr.detectChanges();
    }
  }

  private destroySigma(): void {
    if (!this.sigma) {
      return;
    }

    this.sigma.off('enterNode', this.handleEnterNode);
    this.sigma.off('leaveNode', this.handleLeaveNode);
    this.sigma.off('clickNode', this.handleClickNode);
    this.sigma.off('doubleClickNode', this.handleDoubleClickNode);
    this.sigma.off('downNode', this.handleDownNode);
    this.sigma.off('moveBody', this.handleMoveBody);
    this.sigma.off('upNode', this.handlePointerRelease);
    this.sigma.off('upStage', this.handlePointerRelease);
    this.sigma.off('clickStage', this.handleClickStage);
    this.sigma.kill();
    this.sigma = null;
    this.draggingSlug = null;
    this.dragOffset = null;
  }

  private applySigmaReducers(): void {
    if (!this.sigma || !this.graphBuildResult) {
      return;
    }

    const activeSlug = this.hoveredSlug || this.selectedSlug;
    const highlightedNodes = this.getHighlightedNodes(activeSlug);
    const highlightedEdges = this.getHighlightedEdges(activeSlug);

    this.sigma.setSettings({
      nodeReducer: (node: string, data: BlogGraphNodeAttributes) => {
        if (!activeSlug) {
          return {
            x: data.x,
            y: data.y,
            size: data.size,
            color: data.color,
            label: data.label,
            hidden: false,
            highlighted: node === this.currentSlug,
            type: data.type,
            forceLabel: data.forceLabel || node === this.currentSlug,
            zIndex: data.zIndex
          };
        }

        const isActive = node === activeSlug;
        const isConnected = highlightedNodes.has(node);

        return {
          x: data.x,
          y: data.y,
          size: data.size,
          color: isConnected ? data.color : withAlpha('#cbd5e1', 0.2),
          label: isConnected ? data.label : '',
          hidden: false,
          highlighted: isActive || node === this.currentSlug,
          type: data.type,
          forceLabel: isActive || node === this.currentSlug,
          zIndex: isActive ? 15 : data.zIndex
        };
      },
      edgeReducer: (edge: string, data: BlogGraphEdgeAttributes) => {
        if (!activeSlug) {
          return {
            size: data.size,
            color: data.color,
            hidden: false,
            type: data.type,
            forceLabel: false,
            label: data.label
          };
        }

        const isHighlighted = highlightedEdges.has(edge);

        return {
          size: isHighlighted ? data.size + 0.7 : Math.max(0.8, data.size * 0.45),
          color: isHighlighted ? withAlpha(typeColor(data.dominantType), 0.88) : withAlpha('#94a3b8', 0.1),
          hidden: false,
          type: data.type,
          forceLabel: isHighlighted,
          label: isHighlighted ? data.label : ''
        };
      }
    });

    this.sigma.refresh();
  }

  private getHighlightedNodes(activeSlug: string | null): Set<string> {
    if (!activeSlug || !this.graphBuildResult) {
      return new Set<string>();
    }

    const nodes = new Set<string>([activeSlug]);
    nodes.add(this.currentSlug);

    for (const neighbor of this.graphBuildResult.adjacency.get(activeSlug) || []) {
      nodes.add(neighbor);
    }

    return nodes;
  }

  private getHighlightedEdges(activeSlug: string | null): Set<string> {
    if (!activeSlug || !this.graphBuildResult) {
      return new Set<string>();
    }

    return new Set<string>(this.graphBuildResult.edgeKeysByNode.get(activeSlug) || []);
  }

  private syncInspector(): void {
    const focusSlug = this.hoveredSlug || this.selectedSlug || this.currentSlug;
    const meta = this.graphBuildResult?.nodeMetaBySlug[focusSlug];
    this.inspector = meta ? this.buildInspector(meta) : this.createCenterInspector();
  }

  private buildInspector(meta: BlogGraphNodeMeta): BlogGraphInspectorState {
    if (meta.nodeType === 'center') {
      return {
        title: meta.article.title,
        summary: meta.article.summary || meta.article.description,
        relationLabel: '',
        relationType: '',
        sharedTags: meta.article.tags.slice(0, 5),
        scoreText: '',
        canNavigate: false,
        slug: null
      };
    }

    const relation = meta.relationToCenter;
    return {
      title: meta.article.title,
      summary: meta.article.summary || meta.article.description,
      relationLabel: '',
      relationType: '',
      sharedTags: collectSharedTags(relation?.shared || { domain: [], technology: [], topic: [], context: [] }),
      scoreText: '',
      canNavigate: false,
      slug: null
    };
  }

  private createCenterInspector(): BlogGraphInspectorState {
    return {
      title: '',
      summary: '',
      relationLabel: '',
      relationType: '',
      sharedTags: [],
      scoreText: '',
      canNavigate: false,
      slug: null
    };
  }

  private async waitForGraphContainer(maxFrames = 10): Promise<HTMLDivElement | null> {
    for (let attempt = 0; attempt < maxFrames; attempt += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const container = this.graphContainer?.nativeElement;
      if (container && container.clientWidth > 0 && container.clientHeight > 0) {
        return container;
      }
    }

    return null;
  }

  private createStableBBox(): { x: [number, number]; y: [number, number] } | null {
    if (!this.graphBuildResult) {
      return null;
    }

    const positions = this.graphBuildResult.graph.mapNodes((_, attributes) => ({
      x: attributes.x,
      y: attributes.y,
      size: attributes.size
    }));

    if (!positions.length) {
      return null;
    }

    const padding = 1.2;
    const minX = Math.min(...positions.map((node) => node.x - node.size / 10)) - padding;
    const maxX = Math.max(...positions.map((node) => node.x + node.size / 10)) + padding;
    const minY = Math.min(...positions.map((node) => node.y - node.size / 10)) - padding;
    const maxY = Math.max(...positions.map((node) => node.y + node.size / 10)) + padding;

    return {
      x: [minX, maxX],
      y: [minY, maxY]
    };
  }
}

function typeColor(type: BlogGraphRelationType): string {
  switch (type) {
    case 'context':
      return '#e86a78';
    case 'domain':
      return '#7aa2f7';
    case 'technology':
      return '#7bc2a5';
    case 'topic':
      return '#f4b267';
    default:
      return '#c7b8ff';
  }
}
