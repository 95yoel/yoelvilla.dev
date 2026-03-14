import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { BlogArticleGraphData, BlogGraphRelationType } from '../../models/blog-article.model';
import { buildArticleGraph, BlogGraphBuildResult, BlogGraphNodeAttributes, BlogGraphNodeMeta, BlogGraphEdgeAttributes, collectSharedTags, createEdgeKey, withAlpha } from '../../utils/blog-graph.utils';
import { Language } from '../../../../translations/services/translation.service';

type SigmaRenderer = {
  on(event: string, listener: (payload: { node?: string }) => void): SigmaRenderer;
  off(event: string, listener: (payload: { node?: string }) => void): SigmaRenderer;
  getCamera(): { animatedReset(options?: { duration?: number }): void };
  setSettings(settings: Record<string, unknown>): SigmaRenderer;
  refresh(): SigmaRenderer;
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
  private sigma: SigmaRenderer | null = null;
  private graphBuildResult: BlogGraphBuildResult | null = null;
  private hoveredSlug: string | null = null;
  private selectedSlug: string | null = null;
  private previousBodyOverflow = '';

  readonly topLevelLimit = 8;
  inspector: BlogGraphInspectorState = this.createCenterInspector();
  visibleNodeCount = 0;
  visibleEdgeCount = 0;
  hasRelations = false;
  isReady = false;

  private readonly handleEnterNode = (payload: { node?: string }) => {
    if (!payload.node) {
      return;
    }

    this.hoveredSlug = payload.node;
    this.syncInspector();
    this.applySigmaReducers();
  };

  private readonly handleLeaveNode = (payload: { node?: string }) => {
    if (payload.node && this.hoveredSlug !== payload.node) {
      return;
    }

    this.hoveredSlug = null;
    this.syncInspector();
    this.applySigmaReducers();
  };

  private readonly handleClickNode = (payload: { node?: string }) => {
    if (!payload.node) {
      return;
    }

    this.selectedSlug = payload.node === this.selectedSlug ? null : payload.node;
    this.syncInspector();
    this.applySigmaReducers();
  };

  private readonly handleClickStage = () => {
    this.selectedSlug = null;
    this.hoveredSlug = null;
    this.syncInspector();
    this.applySigmaReducers();
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

  onInspectorAction(): void {
    if (this.inspector.slug && this.inspector.canNavigate) {
      this.navigateToArticle.emit(this.inspector.slug);
    }
  }

  resetView(): void {
    this.sigma?.getCamera().animatedReset({ duration: 350 });
    this.selectedSlug = null;
    this.hoveredSlug = null;
    this.syncInspector();
    this.applySigmaReducers();
  }

  private async rebuildGraph(): Promise<void> {
    this.isReady = false;
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

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const container = this.graphContainer?.nativeElement;
    if (!container) {
      return;
    }

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
      edgeLabelColor: { color: '#fff7f2' },
      defaultEdgeColor: 'rgba(255, 247, 242, 0.36)',
      defaultNodeColor: '#fff7f2',
      defaultNodeType: 'point',
      stagePadding: 32,
      hideEdgesOnMove: false,
      hideLabelsOnMove: false,
      zIndex: true,
      minCameraRatio: 0.65,
      maxCameraRatio: 2.8
    }) as SigmaRenderer;

    this.sigma.on('enterNode', this.handleEnterNode);
    this.sigma.on('leaveNode', this.handleLeaveNode);
    this.sigma.on('clickNode', this.handleClickNode);
    this.sigma.on('clickStage', this.handleClickStage);

    this.applySigmaReducers();
    this.isReady = true;
    this.cdr.detectChanges();
  }

  private destroySigma(): void {
    if (!this.sigma) {
      return;
    }

    this.sigma.off('enterNode', this.handleEnterNode);
    this.sigma.off('leaveNode', this.handleLeaveNode);
    this.sigma.off('clickNode', this.handleClickNode);
    this.sigma.off('clickStage', this.handleClickStage);
    this.sigma.kill();
    this.sigma = null;
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
            color: data.color,
            label: data.label,
            forceLabel: data.forceLabel || node === this.currentSlug,
            zIndex: data.zIndex
          };
        }

        const isActive = node === activeSlug;
        const isConnected = highlightedNodes.has(node);

        return {
          color: isConnected ? data.color : withAlpha('#cbd5e1', 0.2),
          label: isConnected ? data.label : '',
          forceLabel: isActive || node === this.currentSlug,
          zIndex: isActive ? 15 : data.zIndex
        };
      },
      edgeReducer: (edge: string, data: BlogGraphEdgeAttributes) => {
        if (!activeSlug) {
          return {
            color: data.color,
            forceLabel: false,
            size: data.size
          };
        }

        const isHighlighted = highlightedEdges.has(edge);

        return {
          color: isHighlighted ? withAlpha(typeColor(data.dominantType), 0.88) : withAlpha('#94a3b8', 0.1),
          forceLabel: isHighlighted,
          size: isHighlighted ? data.size + 0.7 : Math.max(0.8, data.size * 0.45)
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
        relationLabel: this.lang === 'es'
          ? `Centro del grafo · ${meta.visibleNeighborCount} conexiones visibles`
          : `Graph center · ${meta.visibleNeighborCount} visible connections`,
        relationType: this.lang === 'es'
          ? 'Explora articulos relacionados a partir del actual.'
          : 'Explore related articles starting from the current one.',
        sharedTags: meta.article.tags.slice(0, 5),
        scoreText: this.lang === 'es'
          ? 'La distancia se calcula con la similitud frente al articulo abierto.'
          : 'Distance is driven by similarity to the current article.',
        canNavigate: false,
        slug: null
      };
    }

    const relation = meta.relationToCenter;
    return {
      title: meta.article.title,
      summary: meta.article.summary || meta.article.description,
      relationLabel: relation?.label
        ? `${this.lang === 'es' ? 'Conexion principal' : 'Primary connection'}: ${relation.label}`
        : this.lang === 'es'
          ? 'Conexion relacionada'
          : 'Related connection',
      relationType: this.lang === 'es'
        ? `Tipo dominante: ${translateType(relation?.dominantType || 'mixed', this.lang)}`
        : `Dominant type: ${translateType(relation?.dominantType || 'mixed', this.lang)}`,
      sharedTags: collectSharedTags(relation?.shared || { domain: [], technology: [], topic: [], context: [] }),
      scoreText: relation
        ? `${this.lang === 'es' ? 'Score de similitud' : 'Similarity score'}: ${relation.score.toFixed(2)}`
        : '',
      canNavigate: true,
      slug: meta.article.slug
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
}

function translateType(type: BlogGraphRelationType, lang: Language): string {
  const translations: Record<BlogGraphRelationType, { es: string; en: string }> = {
    domain: { es: 'dominio', en: 'domain' },
    technology: { es: 'tecnologia', en: 'technology' },
    topic: { es: 'tema', en: 'topic' },
    context: { es: 'contexto', en: 'context' },
    mixed: { es: 'mixto', en: 'mixed' }
  };

  return translations[type][lang];
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
