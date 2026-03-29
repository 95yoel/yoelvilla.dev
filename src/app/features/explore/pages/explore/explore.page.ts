import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, Subject, Subscription, switchMap, tap } from 'rxjs';
import { LanguagePanelComponent } from '../../../../components/shared/language-panel/language-panel.component';
import { CustomCursorComponent } from '../../../../components/shared/custom-cursor/custom-cursor.component';
import { LayoutService } from '../../../../services/layout.service';
import { PerformanceConfigService } from '../../../../services/performance-config.service';
import { TranslatePipe } from '../../../../translations/pipes/translate.pipe';
import { Language, TranslationService } from '../../../../translations/services/translation.service';
import { BlogGraphModalComponent } from '../../../blog/components/blog-graph-modal/blog-graph-modal.component';
import { BlogArticleGraphData, BlogArticleSummary } from '../../../blog/models/blog-article.model';
import { BlogRoutingService } from '../../../blog/services/blog-routing.service';
import { BlogService } from '../../../blog/services/blog.service';
import { ExploreRoutingService } from '../../services/explore-routing.service';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import type { ECharts as EChartsInstance } from 'echarts/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { createChart, type IChartApi, type ISeriesApi, LineSeries, ColorType } from 'lightweight-charts';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface TagAggregate {
  tag: string;
  count: number;
}

interface TimelinePoint {
  time: string;
  value: number;
}

interface TimelineSeriesConfig {
  tag: string;
  color: string;
  data: TimelinePoint[];
}

type ExploreVm =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      topTags: TagAggregate[];
      selectedTags: string[];
      timelineSeries: TimelineSeriesConfig[];
      filteredArticles: BlogArticleSummary[];
      totalArticles: number;
      graph: BlogArticleGraphData;
      barChartOptions: EChartsCoreOption;
    };

@Component({
  selector: 'app-explore-page',
  imports: [CommonModule, RouterLink, TranslatePipe, LanguagePanelComponent, CustomCursorComponent, NgxEchartsDirective, BlogGraphModalComponent],
  templateUrl: './explore.page.html',
  styleUrl: './explore.page.css',
  providers: [provideEchartsCore({ echarts })]
})
export class ExplorePage implements AfterViewInit, OnDestroy {
  @ViewChild('timelineChart')
  set timelineChartRef(value: ElementRef<HTMLDivElement> | undefined) {
    this._timelineChartRef = value;
    this.queueTimelineChartRender();
  }

  private _timelineChartRef?: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translationService = inject(TranslationService);
  private readonly blogService = inject(BlogService);
  private readonly blogRoutingService = inject(BlogRoutingService);
  private readonly exploreRoutingService = inject(ExploreRoutingService);
  private readonly layoutService = inject(LayoutService);
  private readonly performanceConfig = inject(PerformanceConfigService);
  private readonly selectedTags$ = new Subject<string[]>();
  private readonly reload$ = new Subject<void>();
  private readonly palette = ['#e86a78', '#7bc2a5', '#7aa2f7', '#f4b267', '#c084fc', '#14b8a6', '#f97316', '#0f766e', '#dc2626', '#4338ca'];
  private selectedTags: string[] = [];
  private vmSubscription: Subscription | null = null;
  private timelineChart: IChartApi | null = null;
  private barChart: EChartsInstance | null = null;
  private latestBarChartOptions: EChartsCoreOption | null = null;
  private barChartRenderHandle: number | null = null;
  private latestTimelineSeries: TimelineSeriesConfig[] = [];
  private timelineChartRenderHandle: number | null = null;
  private timelineSeriesByTag = new Map<string, ISeriesApi<'Line'>>();
  private previousBodyOverflow = '';
  private previousBodyOverflowX = '';
  private previousHtmlOverflow = '';
  private latestVm: ExploreVm = { status: 'loading' };

  readonly layout$ = this.layoutService.layout$;
  showLanguagePanel = false;
  showGraphModal = false;
  graphModalSlug: string | null = null;
  readonly routeLang$ = this.route.data.pipe(
    map(() => this.exploreRoutingService.getRouteLanguage()),
    map((routeLang) => this.exploreRoutingService.resolveLanguage(routeLang)),
    tap(() => this.exploreRoutingService.ensureLocalizedExploreRoute(this.exploreRoutingService.getRouteLanguage()))
  );

  readonly vm$ = combineLatest([
    this.routeLang$,
    this.reload$.pipe(startWith(undefined)),
    this.selectedTags$.pipe(startWith<string[]>([]))
  ]).pipe(
    switchMap(([lang, _reload, selectedTags]) =>
      combineLatest([
        this.blogService.getIndex(lang),
        this.blogService.getGraphData(lang)
      ]).pipe(
        map(([articles, graph]) => this.buildViewModel(articles, graph, selectedTags)),
        catchError(() => of({ status: 'error' } as ExploreVm))
      )
    ),
    startWith({ status: 'loading' } as ExploreVm)
  );

  get currentLanguage(): Language {
    return this.translationService.getCurrentLanguage();
  }

  get blogIndexLink(): string[] {
    return this.blogRoutingService.buildIndexLink(this.currentLanguage);
  }

  ngOnInit(): void {
    this.previousBodyOverflow = this.doc.body.style.overflow;
    this.previousBodyOverflowX = this.doc.body.style.overflowX;
    this.previousHtmlOverflow = this.doc.documentElement.style.overflow;

    this.applyPageOverflowMode();

    this.vmSubscription = this.vm$.subscribe((vm) => {
      this.latestVm = vm;
      if (vm.status === 'ready') {
        this.selectedTags = [...vm.selectedTags];
        this.latestBarChartOptions = vm.barChartOptions;
        this.latestTimelineSeries = vm.timelineSeries;
        this.queueBarChartRender();
        this.queueTimelineChartRender();
      } else {
        this.latestBarChartOptions = null;
        this.latestTimelineSeries = [];
        this.queueBarChartRender();
        this.queueTimelineChartRender();
      }
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    requestAnimationFrame(() => {
      this.ensureTimelineChart();
      this.queueBarChartRender();
      this.queueTimelineChartRender();
    });
  }

  ngOnDestroy(): void {
    this.doc.body.style.overflow = this.previousBodyOverflow;
    this.doc.body.style.overflowX = this.previousBodyOverflowX;
    this.doc.documentElement.style.overflow = this.previousHtmlOverflow;
    if (this.barChartRenderHandle !== null && isPlatformBrowser(this.platformId)) {
      cancelAnimationFrame(this.barChartRenderHandle);
      this.barChartRenderHandle = null;
    }
    if (this.timelineChartRenderHandle !== null && isPlatformBrowser(this.platformId)) {
      cancelAnimationFrame(this.timelineChartRenderHandle);
      this.timelineChartRenderHandle = null;
    }
    this.vmSubscription?.unsubscribe();
    this.vmSubscription = null;
    this.barChart = null;
    this.timelineChart?.remove();
    this.timelineChart = null;
    this.timelineSeriesByTag.clear();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.applyPageOverflowMode();
    this.queueBarChartRender();
    this.queueTimelineChartRender();
  }

  toggleLanguagePanel(): void {
    this.showLanguagePanel = !this.showLanguagePanel;
  }

  onLanguageChange(lang: Language): void {
    this.showLanguagePanel = false;
    this.exploreRoutingService.goToExplore(lang);
  }

  retry(): void {
    this.blogService.clearCaches();
    this.reload$.next();
  }

  toggleTag(tag: string): void {
    this.selectedTags = this.selectedTags.includes(tag)
      ? this.selectedTags.filter((value) => value !== tag)
      : [...this.selectedTags, tag];
    this.selectedTags$.next([...this.selectedTags]);
  }

  removeTag(tag: string): void {
    this.selectedTags = this.selectedTags.filter((value) => value !== tag);
    this.selectedTags$.next([...this.selectedTags]);
  }

  clearSelectedTags(): void {
    this.selectedTags = [];
    this.selectedTags$.next([]);
  }

  onBarChartClick(event: { name?: string }): void {
    if (!event.name) {
      return;
    }

    this.toggleTag(event.name);
  }

  onBarChartInit(instance: EChartsInstance): void {
    this.barChart = instance;
    this.queueBarChartRender();
  }

  openGraphModal(slug: string): void {
    this.graphModalSlug = slug;
    this.showGraphModal = true;
  }

  closeGraphModal(): void {
    this.showGraphModal = false;
    this.graphModalSlug = null;
  }

  navigateFromGraph(slug: string): void {
    this.closeGraphModal();
    this.blogRoutingService.goToArticle(slug, this.currentLanguage);
  }

  hasGraphRelations(graph: BlogArticleGraphData, slug: string): boolean {
    return (graph.relatedBySlug[slug] || []).length > 0;
  }

  getArticleLink(slug: string): string[] {
    return this.blogRoutingService.buildArticleLink(slug, this.currentLanguage);
  }

  formatDate(date: string): string {
    if (!date) {
      return '';
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return new Intl.DateTimeFormat(this.currentLanguage === 'es' ? 'es-ES' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(parsedDate);
  }

  private buildViewModel(articles: BlogArticleSummary[], graph: BlogArticleGraphData, selectedTags: string[]): ExploreVm {
    const tagCounts = new Map<string, number>();

    for (const article of articles) {
      for (const tag of article.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const topTags = [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
      .slice(0, 10);

    const normalizedSelectedTags = selectedTags.filter((tag) => topTags.some((entry) => entry.tag === tag));
    const activeTags = normalizedSelectedTags.length ? normalizedSelectedTags : topTags.slice(0, Math.min(3, topTags.length)).map((entry) => entry.tag);
    const filteredArticles = normalizedSelectedTags.length
      ? articles.filter((article) => article.tags.some((tag) => normalizedSelectedTags.includes(tag)))
      : articles;

    return {
      status: 'ready',
      topTags,
      selectedTags: normalizedSelectedTags,
      timelineSeries: activeTags.map((tag, index) => ({
        tag,
        color: this.palette[index % this.palette.length],
        data: this.buildMonthlyData(articles, tag)
      })),
      filteredArticles,
      totalArticles: articles.length,
      graph,
      barChartOptions: this.createBarChartOptions(topTags, normalizedSelectedTags)
    };
  }

  private buildMonthlyData(articles: BlogArticleSummary[], tag: string): TimelinePoint[] {
    const articleMonths = articles
      .map((article) => this.toMonthStart(article.date))
      .filter((value): value is string => !!value)
      .sort();

    if (!articleMonths.length) {
      return [];
    }

    const range = this.buildMonthRange(articleMonths[0], articleMonths[articleMonths.length - 1]);
    const counts = new Map<string, number>();

    for (const article of articles) {
      if (!article.tags.includes(tag)) {
        continue;
      }

      const monthKey = this.toMonthStart(article.date);
      if (!monthKey) {
        continue;
      }

      counts.set(monthKey, (counts.get(monthKey) || 0) + 1);
    }

    return range.map((monthKey) => ({
      time: monthKey,
      value: counts.get(monthKey) || 0
    }));
  }

  private createBarChartOptions(topTags: TagAggregate[], selectedTags: string[]): EChartsCoreOption {
    return {
      animation: this.performanceConfig.animationsEnabled,
      grid: {
        top: 16,
        left: 56,
        right: 20,
        bottom: 48
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: Array<{ name: string; value: number }>) => {
          const item = params[0];
          return item ? `${item.name}: ${item.value}` : '';
        }
      },
      xAxis: {
        type: 'category',
        data: topTags.map((entry) => entry.tag),
        axisLabel: {
          rotate: 28,
          color: '#6b7280',
          fontSize: 12
        },
        axisLine: {
          lineStyle: {
            color: '#d6d3d1'
          }
        },
        axisTick: {
          show: false
        }
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.22)'
          }
        },
        axisLabel: {
          color: '#6b7280'
        }
      },
      series: [
        {
          type: 'bar',
          data: topTags.map((entry) => ({
            value: entry.count,
            itemStyle: {
              color: selectedTags.includes(entry.tag) ? '#e86a78' : '#7bc2a5',
              borderRadius: [10, 10, 0, 0]
            }
          })),
          barWidth: '52%'
        }
      ]
    };
  }

  private applyPageOverflowMode(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const shouldUsePageScroll = window.innerWidth <= 960;

    this.doc.body.style.overflow = shouldUsePageScroll ? 'auto' : 'hidden';
    this.doc.body.style.overflowX = 'hidden';
    this.doc.documentElement.style.overflow = shouldUsePageScroll ? 'auto' : 'hidden';
  }

  private ensureTimelineChart(): void {
    if (!isPlatformBrowser(this.platformId) || this.timelineChart || !this._timelineChartRef?.nativeElement) {
      return;
    }

    const container = this._timelineChartRef.nativeElement;
    this.timelineChart = createChart(container, {
      autoSize: true,
      height: Math.max(280, container.clientHeight || 320),
      layout: {
        background: { type: ColorType.Solid, color: '#fffaf6' },
        textColor: '#6b7280'
      },
      rightPriceScale: {
        borderColor: '#e7e5e4'
      },
      timeScale: {
        borderColor: '#e7e5e4',
        timeVisible: false,
        secondsVisible: false
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.14)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.14)' }
      },
      crosshair: {
        vertLine: { color: 'rgba(232, 106, 120, 0.24)' },
        horzLine: { color: 'rgba(123, 194, 165, 0.24)' }
      }
    });

    this.syncTimelineChart(this.latestTimelineSeries);
  }

  private queueBarChartRender(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.barChartRenderHandle !== null) {
      cancelAnimationFrame(this.barChartRenderHandle);
    }

    this.barChartRenderHandle = requestAnimationFrame(() => {
      this.barChartRenderHandle = null;
      this.syncBarChart(this.latestBarChartOptions);
      window.setTimeout(() => this.syncBarChart(this.latestBarChartOptions), 0);
    });
  }

  private syncBarChart(options: EChartsCoreOption | null): void {
    if (!this.barChart) {
      return;
    }

    if (!options) {
      this.barChart.clear();
      return;
    }

    this.barChart.setOption(options, true);
    this.barChart.resize();
  }

  private queueTimelineChartRender(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.timelineChartRenderHandle !== null) {
      cancelAnimationFrame(this.timelineChartRenderHandle);
    }

    this.timelineChartRenderHandle = requestAnimationFrame(() => {
      this.timelineChartRenderHandle = null;
      this.syncTimelineChart(this.latestTimelineSeries);
      window.setTimeout(() => this.syncTimelineChart(this.latestTimelineSeries), 0);
    });
  }

  private syncTimelineChart(seriesConfigs: TimelineSeriesConfig[]): void {
    this.ensureTimelineChart();
    if (!this.timelineChart) {
      return;
    }

    const activeTags = new Set(seriesConfigs.map((entry) => entry.tag));
    for (const [tag, series] of this.timelineSeriesByTag.entries()) {
      if (activeTags.has(tag)) {
        continue;
      }

      this.timelineChart.removeSeries(series);
      this.timelineSeriesByTag.delete(tag);
    }

    for (const config of seriesConfigs) {
      let series = this.timelineSeriesByTag.get(config.tag);
      if (!series) {
        series = this.timelineChart.addSeries(LineSeries, {
          color: config.color,
          lineWidth: 3,
          crosshairMarkerBackgroundColor: config.color,
          priceLineVisible: false,
          lastValueVisible: false,
          title: config.tag
        });
        this.timelineSeriesByTag.set(config.tag, series);
      } else {
        series.applyOptions({
          color: config.color,
          crosshairMarkerBackgroundColor: config.color,
          title: config.tag
        });
      }

      series.setData(config.data);
    }

    this.timelineChart.timeScale().fitContent();
    this.resizeTimelineChart();
  }

  private resizeTimelineChart(): void {
    const container = this._timelineChartRef?.nativeElement;
    if (!container || !this.timelineChart) {
      return;
    }

    this.timelineChart.applyOptions({
      width: container.clientWidth,
      height: Math.max(280, container.clientHeight || 320)
    });
  }

  private toMonthStart(value: string): string | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const utcDate = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), 1));

    return utcDate.toISOString().slice(0, 10);
  }

  private buildMonthRange(start: string, end: string): string[] {
    const range: string[] = [];
    const cursor = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);

    while (cursor.getTime() <= last.getTime()) {
      range.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return range;
  }
}
