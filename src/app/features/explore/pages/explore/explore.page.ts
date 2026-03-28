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
import { BlogArticleSummary } from '../../../blog/models/blog-article.model';
import { BlogRoutingService } from '../../../blog/services/blog-routing.service';
import { BlogService } from '../../../blog/services/blog.service';
import { ExploreRoutingService } from '../../services/explore-routing.service';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { createChart, type IChartApi, LineSeries, ColorType } from 'lightweight-charts';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface TagAggregate {
  tag: string;
  count: number;
}

interface MonthlyPoint {
  time: string;
  value: number;
}

type ExploreVm =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      topTags: TagAggregate[];
      selectedTag: string | null;
      timelineTag: string | null;
      timelineData: MonthlyPoint[];
      filteredArticles: BlogArticleSummary[];
      totalArticles: number;
      barChartOptions: EChartsCoreOption;
    };

@Component({
  selector: 'app-explore-page',
  imports: [CommonModule, RouterLink, TranslatePipe, LanguagePanelComponent, CustomCursorComponent, NgxEchartsDirective],
  templateUrl: './explore.page.html',
  styleUrl: './explore.page.css',
  providers: [provideEchartsCore({ echarts })]
})
export class ExplorePage implements AfterViewInit, OnDestroy {
  @ViewChild('timelineChart') private timelineChartRef?: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translationService = inject(TranslationService);
  private readonly blogService = inject(BlogService);
  private readonly blogRoutingService = inject(BlogRoutingService);
  private readonly exploreRoutingService = inject(ExploreRoutingService);
  private readonly layoutService = inject(LayoutService);
  private readonly performanceConfig = inject(PerformanceConfigService);
  private selectedTag: string | null = null;
  private readonly selectedTag$ = new Subject<string | null>();
  private readonly reload$ = new Subject<void>();
  private vmSubscription: Subscription | null = null;
  private timelineChart: IChartApi | null = null;
  private timelineSeries: { setData(data: MonthlyPoint[]): void } | null = null;
  private previousBodyOverflow = '';
  private previousBodyOverflowX = '';
  private previousHtmlOverflow = '';
  private latestVm: ExploreVm = { status: 'loading' };

  readonly layout$ = this.layoutService.layout$;
  showLanguagePanel = false;
  readonly routeLang$ = this.route.data.pipe(
    map(() => this.exploreRoutingService.getRouteLanguage()),
    map((routeLang) => this.exploreRoutingService.resolveLanguage(routeLang)),
    tap(() => this.exploreRoutingService.ensureLocalizedExploreRoute(this.exploreRoutingService.getRouteLanguage()))
  );

  readonly vm$ = combineLatest([
    this.routeLang$,
    this.reload$.pipe(startWith(undefined)),
    this.selectedTag$.pipe(startWith<string | null>(null))
  ]).pipe(
    switchMap(([lang, _reload, selectedTag]) =>
      this.blogService.getIndex(lang).pipe(
        map((articles) => this.buildViewModel(articles, selectedTag)),
        startWith({ status: 'loading' } as ExploreVm),
        catchError(() => of({ status: 'error' } as ExploreVm))
      )
    )
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

    this.doc.body.style.overflow = 'hidden';
    this.doc.body.style.overflowX = 'hidden';
    this.doc.documentElement.style.overflow = 'hidden';

    this.vmSubscription = this.vm$.subscribe((vm) => {
      this.latestVm = vm;
      if (vm.status === 'ready') {
        this.syncTimelineChart(vm.timelineData);
      } else {
        this.syncTimelineChart([]);
      }
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    requestAnimationFrame(() => this.ensureTimelineChart());
  }

  ngOnDestroy(): void {
    this.doc.body.style.overflow = this.previousBodyOverflow;
    this.doc.body.style.overflowX = this.previousBodyOverflowX;
    this.doc.documentElement.style.overflow = this.previousHtmlOverflow;
    this.vmSubscription?.unsubscribe();
    this.vmSubscription = null;
    this.timelineChart?.remove();
    this.timelineChart = null;
    this.timelineSeries = null;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeTimelineChart();
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

  selectTag(tag: string): void {
    this.selectedTag = this.selectedTag === tag ? null : tag;
    this.selectedTag$.next(this.selectedTag);
  }

  clearSelectedTag(): void {
    this.selectedTag = null;
    this.selectedTag$.next(null);
  }

  onBarChartClick(event: { name?: string }): void {
    if (!event.name) {
      return;
    }

    this.selectTag(event.name);
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

  private buildViewModel(articles: BlogArticleSummary[], selectedTag: string | null): ExploreVm {
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

    const normalizedSelectedTag = selectedTag && topTags.some((entry) => entry.tag === selectedTag)
      ? selectedTag
      : null;
    const timelineTag = normalizedSelectedTag || topTags[0]?.tag || null;
    const filteredArticles = normalizedSelectedTag
      ? articles.filter((article) => article.tags.includes(normalizedSelectedTag))
      : articles;

    return {
      status: 'ready',
      topTags,
      selectedTag: normalizedSelectedTag,
      timelineTag,
      timelineData: this.buildTimelineData(articles, timelineTag),
      filteredArticles,
      totalArticles: articles.length,
      barChartOptions: this.createBarChartOptions(topTags, normalizedSelectedTag)
    };
  }

  private buildTimelineData(articles: BlogArticleSummary[], tag: string | null): MonthlyPoint[] {
    if (!tag) {
      return [];
    }

    const articleMonths = articles
      .map((article) => this.toMonthKey(article.date))
      .filter((value): value is string => !!value)
      .sort();

    if (!articleMonths.length) {
      return [];
    }

    const start = articleMonths[0];
    const end = articleMonths[articleMonths.length - 1];
    const monthKeys = this.buildMonthRange(start, end);
    const counts = new Map<string, number>();

    for (const article of articles) {
      if (!article.tags.includes(tag)) {
        continue;
      }

      const monthKey = this.toMonthKey(article.date);
      if (!monthKey) {
        continue;
      }

      counts.set(monthKey, (counts.get(monthKey) || 0) + 1);
    }

    return monthKeys.map((monthKey) => ({
      time: `${monthKey}-01`,
      value: counts.get(monthKey) || 0
    }));
  }

  private createBarChartOptions(topTags: TagAggregate[], selectedTag: string | null): EChartsCoreOption {
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
          if (!item) {
            return '';
          }

          return `${item.name}: ${item.value}`;
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
              color: entry.tag === selectedTag ? '#e86a78' : '#7bc2a5',
              borderRadius: [10, 10, 0, 0]
            }
          })),
          barWidth: '52%'
        }
      ]
    };
  }

  private ensureTimelineChart(): void {
    if (!isPlatformBrowser(this.platformId) || this.timelineChart || !this.timelineChartRef?.nativeElement) {
      return;
    }

    const container = this.timelineChartRef.nativeElement;
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
        timeVisible: true
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.14)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.14)' }
      },
      crosshair: {
        vertLine: {
          color: 'rgba(232, 106, 120, 0.24)'
        },
        horzLine: {
          color: 'rgba(123, 194, 165, 0.24)'
        }
      }
    });
    this.timelineSeries = this.timelineChart.addSeries(LineSeries, {
      color: '#e86a78',
      lineWidth: 3,
      crosshairMarkerBackgroundColor: '#e86a78',
      priceLineVisible: false,
      lastValueVisible: false
    });
    this.syncTimelineChart(this.latestVm.status === 'ready' ? this.latestVm.timelineData : []);
  }

  private syncTimelineChart(data: MonthlyPoint[]): void {
    this.ensureTimelineChart();
    this.timelineSeries?.setData(data);
    this.timelineChart?.timeScale().fitContent();
    this.resizeTimelineChart();
  }

  private resizeTimelineChart(): void {
    const container = this.timelineChartRef?.nativeElement;
    if (!container || !this.timelineChart) {
      return;
    }

    this.timelineChart.applyOptions({
      width: container.clientWidth,
      height: Math.max(280, container.clientHeight || 320)
    });
  }

  private toMonthKey(value: string): string | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    return `${parsed.getFullYear()}-${month}`;
  }

  private buildMonthRange(start: string, end: string): string[] {
    const [startYear, startMonth] = start.split('-').map((part) => Number.parseInt(part, 10));
    const [endYear, endMonth] = end.split('-').map((part) => Number.parseInt(part, 10));
    const months: string[] = [];
    let year = startYear;
    let month = startMonth;

    while (year < endYear || (year === endYear && month <= endMonth)) {
      months.push(`${year}-${`${month}`.padStart(2, '0')}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    return months;
  }
}
