import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, Subscription, auditTime, catchError, combineLatest, distinctUntilChanged, fromEvent, map, merge, of, startWith, switchMap, tap, timer } from 'rxjs';
import gsap from 'gsap';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CustomCursorComponent } from '../../../../components/shared/custom-cursor/custom-cursor.component';
import { LanguagePanelComponent } from '../../../../components/shared/language-panel/language-panel.component';
import { LayoutService } from '../../../../services/layout.service';
import { TranslatePipe } from '../../../../translations/pipes/translate.pipe';
import { Language, TranslationService } from '../../../../translations/services/translation.service';
import { BlogGraphModalComponent } from '../../components/blog-graph-modal/blog-graph-modal.component';
import { BlogSidebarComponent } from '../../components/blog-sidebar/blog-sidebar.component';
import { BlogArticleGraphData, BlogArticleSummary } from '../../models/blog-article.model';
import { BlogRoutingService } from '../../services/blog-routing.service';
import { BlogService } from '../../services/blog.service';
import { PerformanceConfigService } from '../../../../services/performance-config.service';
import { ExploreRoutingService } from '../../../explore/services/explore-routing.service';

type IndexViewState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      featured: BlogArticleSummary | null;
      rest: BlogArticleSummary[];
      availableTags: string[];
      filteredCount: number;
      totalCount: number;
      graph: BlogArticleGraphData;
      hasActiveFilters: boolean;
      searchResults: BlogArticleSummary[];
      searchTerm: string;
    };

interface BlogFiltersFormValue {
  tag: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

@Component({
  selector: 'app-blog-index-page',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    BlogSidebarComponent,
    BlogGraphModalComponent,
    TranslatePipe,
    CustomCursorComponent,
    LanguagePanelComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './blog-index.page.html',
  styleUrl: './blog-index.page.css'
})
export class BlogIndexPage {
  @ViewChild('blogHero', { read: ElementRef }) private blogHero?: ElementRef<HTMLElement>;
  @ViewChild('blogSidebar', { read: ElementRef }) private blogSidebar?: ElementRef<HTMLElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly blogService = inject(BlogService);
  private readonly translationService = inject(TranslationService);
  private readonly blogRoutingService = inject(BlogRoutingService);
  private readonly layoutService = inject(LayoutService);
  private readonly doc = inject(DOCUMENT);
  private readonly performanceConfig = inject(PerformanceConfigService);
  private readonly exploreRoutingService = inject(ExploreRoutingService);
  private readonly reload$ = new Subject<void>();
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly filterForm = new FormGroup({
    tag: new FormControl<string>(''),
    startDate: new FormControl<Date | null>(null),
    endDate: new FormControl<Date | null>(null)
  });
  readonly layout$ = this.layoutService.layout$;
  showLanguagePanel = false;
  showScrollTopButton = false;
  filtersExpanded = false;
  showGraphModal = false;
  graphModalSlug: string | null = null;
  private searchInteractionSubscription: Subscription | null = null;
  private viewStateSubscription: Subscription | null = null;
  private previousBodyOverflow = '';
  private previousBodyOverflowX = '';
  private previousHtmlOverflow = '';
  private scrollSubscription: Subscription | null = null;
  private hasPlayedEntryAnimation = false;
  private readonly lang$ = this.route.data.pipe(
    map(() => this.blogRoutingService.getRouteLanguage()),
    map((routeLang) => this.blogRoutingService.resolveLanguage(routeLang)),
    tap(() => this.blogRoutingService.ensureLocalizedIndexRoute(this.blogRoutingService.getRouteLanguage()))
  );
  private readonly filters$ = this.filterForm.valueChanges.pipe(
    startWith(this.filterForm.getRawValue())
  );
  private readonly searchTerm$ = this.searchControl.valueChanges.pipe(
    startWith(this.searchControl.getRawValue()),
    map((value) => value.trim()),
    distinctUntilChanged(),
    switchMap((value) => value.length >= 3 ? timer(300).pipe(map(() => value)) : of(value))
  );

  readonly vm$ = combineLatest([
    this.lang$,
    this.reload$.pipe(startWith(undefined)),
    this.filters$,
    this.searchTerm$
  ]).pipe(
    switchMap(([lang, _reload, filters, searchTerm]) =>
      combineLatest([
        this.blogService.getIndex(lang),
        this.blogService.getGraphData(lang)
      ]).pipe(
        map(([articles, graph]): IndexViewState => this.buildViewState(articles, graph, this.normalizeFilters(filters), searchTerm)),
        startWith({ status: 'loading' } as IndexViewState),
        catchError(() => of({ status: 'error' } as IndexViewState))
      )
    )
  );

  ngOnInit(): void {
    this.previousBodyOverflow = this.doc.body.style.overflow;
    this.previousBodyOverflowX = this.doc.body.style.overflowX;
    this.previousHtmlOverflow = this.doc.documentElement.style.overflow;

    this.doc.body.style.overflow = 'auto';
    this.doc.body.style.overflowX = 'hidden';
    this.doc.documentElement.style.overflow = 'auto';
    this.searchInteractionSubscription = this.searchControl.valueChanges.subscribe((value) => {
      if (value.trim().length > 0) {
        this.filtersExpanded = false;
      }
    });
    this.viewStateSubscription = this.vm$.subscribe((vm) => {
      if (vm.status !== 'ready') {
        this.hasPlayedEntryAnimation = false;
        return;
      }

      if (this.hasPlayedEntryAnimation) {
        return;
      }

      requestAnimationFrame(() => this.animateEntry());
    });
    this.updateScrollTopButtonVisibility();
    this.startScrollWatcher();
  }

  ngOnDestroy(): void {
    this.doc.body.style.overflow = this.previousBodyOverflow;
    this.doc.body.style.overflowX = this.previousBodyOverflowX;
    this.doc.documentElement.style.overflow = this.previousHtmlOverflow;
    this.searchInteractionSubscription?.unsubscribe();
    this.searchInteractionSubscription = null;
    this.viewStateSubscription?.unsubscribe();
    this.viewStateSubscription = null;
    this.stopScrollWatcher();
  }

  scrollToTop(): void {
    this.scrollDocumentToTop();
  }

  retry(): void {
    this.blogService.clearCaches();
    this.reload$.next();
  }

  toggleLanguagePanel(): void {
    this.showLanguagePanel = !this.showLanguagePanel;
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

  toggleFilters(): void {
    this.filtersExpanded = !this.filtersExpanded;
  }

  clearFilters(): void {
    this.filterForm.reset({
      tag: '',
      startDate: null,
      endDate: null
    });
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  clearSearchAndFilters(): void {
    this.clearSearch();
    this.clearFilters();
  }

  submitSearch(results: BlogArticleSummary[]): void {
    const firstResult = results[0];
    if (!firstResult) {
      return;
    }

    this.router.navigate(this.getSearchLink(firstResult.slug));
  }

  onLanguageChange(lang: Language): void {
    this.blogRoutingService.goToIndex(lang);
  }

  get currentLanguage(): Language {
    return this.translationService.getCurrentLanguage();
  }

  get featuredLink(): (slug: string) => string[] {
    return (slug: string) => this.blogRoutingService.buildArticleLink(slug, this.currentLanguage);
  }

  getSearchLink(slug: string): string[] {
    return this.blogRoutingService.buildArticleLink(slug, this.currentLanguage);
  }

  get exploreLink(): string[] {
    return this.exploreRoutingService.buildExploreLink(this.currentLanguage);
  }

  hasGraphRelations(graph: BlogArticleGraphData, slug: string): boolean {
    return (graph.relatedBySlug[slug] || []).length > 0;
  }

  formatDate(date: string): string {
    return this.formatBlogDate(date, this.currentLanguage);
  }

  getFilterSummary(filteredCount: number, totalCount: number): string {
    return this.currentLanguage === 'es'
      ? `${filteredCount} de ${totalCount} articulos visibles`
      : `${filteredCount} of ${totalCount} articles visible`;
  }

  getEmptyStateMessage(hasActiveFilters: boolean): string {
    return hasActiveFilters
      ? this.translationService.translate('blog.filters.empty')
      : this.translationService.translate('blog.empty');
  }

  showSearchResults(searchTerm: string, resultsCount: number): boolean {
    return searchTerm.trim().length >= 3 && resultsCount > 0;
  }

  hasShortSearch(searchTerm: string): boolean {
    const trimmed = searchTerm.trim();
    return trimmed.length > 0 && trimmed.length < 3;
  }

  private buildViewState(
    articles: BlogArticleSummary[],
    graph: BlogArticleGraphData,
    filters: BlogFiltersFormValue,
    searchTerm: string
  ): IndexViewState {
    const availableTags = this.collectAvailableTags(articles);
    const filteredArticles = articles.filter((article) => this.matchesFilters(article, filters));
    const normalizedSearchTerm = searchTerm.trim();

    return {
      status: 'ready',
      featured: filteredArticles[0] ?? null,
      rest: filteredArticles.slice(1),
      availableTags,
      filteredCount: filteredArticles.length,
      totalCount: articles.length,
      graph,
      hasActiveFilters: Boolean(filters.tag || filters.startDate || filters.endDate),
      searchResults: this.findSearchResults(articles, normalizedSearchTerm),
      searchTerm: normalizedSearchTerm
    };
  }

  private normalizeFilters(filters: Partial<BlogFiltersFormValue>): BlogFiltersFormValue {
    return {
      tag: filters.tag ?? '',
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null
    };
  }

  private collectAvailableTags(articles: BlogArticleSummary[]): string[] {
    return [...new Set(articles.flatMap((article) => article.tags))]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  }

  private matchesFilters(article: BlogArticleSummary, filters: BlogFiltersFormValue): boolean {
    const selectedTag = filters.tag?.trim();
    if (selectedTag && !article.tags.includes(selectedTag)) {
      return false;
    }

    const hasDateFilter = !!filters.startDate || !!filters.endDate;
    if (!hasDateFilter) {
      return true;
    }

    const articleDate = this.parseArticleDate(article.date);
    if (!articleDate) {
      return false;
    }

    const articleTimestamp = articleDate.getTime();
    const effectiveStartDate = filters.startDate || filters.endDate;
    const effectiveEndDate = filters.endDate || filters.startDate;
    const startTimestamp = effectiveStartDate ? this.startOfDay(effectiveStartDate).getTime() : null;
    const endTimestamp = effectiveEndDate ? this.endOfDay(effectiveEndDate).getTime() : null;

    if (startTimestamp !== null && articleTimestamp < startTimestamp) {
      return false;
    }

    if (endTimestamp !== null && articleTimestamp > endTimestamp) {
      return false;
    }

    return true;
  }

  private findSearchResults(articles: BlogArticleSummary[], searchTerm: string): BlogArticleSummary[] {
    if (searchTerm.length < 3) {
      return [];
    }

    const normalizedSearch = this.normalizeText(searchTerm);

    return articles
      .filter((article) => {
        const searchableText = `${article.title} ${article.description}`;
        return this.normalizeText(searchableText).includes(normalizedSearch);
      })
      .slice(0, 6);
  }

  private formatBlogDate(date: string, lang: Language): string {
    if (!date) {
      return '';
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(parsedDate);
  }

  private parseArticleDate(date: string): Date | null {
    if (!date) {
      return null;
    }

    const parsedDate = new Date(date);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  private normalizeText(value: string): string {
    return value
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private updateScrollTopButtonVisibility(): void {
    const scrollTop = window.scrollY
      || this.doc.documentElement.scrollTop
      || this.doc.body.scrollTop
      || 0;

    this.showScrollTopButton = scrollTop > 180;
  }

  private scrollDocumentToTop(): void {
    const scrollTargets = [
      this.doc.scrollingElement,
      this.doc.documentElement,
      this.doc.body
    ].filter((target): target is HTMLElement => !!target);

    for (const target of scrollTargets) {
      target.scrollTo({ top: 0, behavior: this.performanceConfig.getScrollBehavior() });
      target.scrollTop = 0;
    }

    window.scrollTo({ top: 0, behavior: this.performanceConfig.getScrollBehavior() });

    requestAnimationFrame(() => {
      for (const target of scrollTargets) {
        target.scrollTop = 0;
      }
      window.scrollTo(0, 0);
      this.updateScrollTopButtonVisibility();
    });
  }

  private startScrollWatcher(): void {
    this.stopScrollWatcher();
    const view = this.doc.defaultView;
    if (!view) {
      return;
    }

    this.scrollSubscription = merge(
      fromEvent(view, 'scroll', { passive: true }),
      fromEvent(this.doc, 'scroll', { passive: true })
    ).pipe(
      startWith(null),
      auditTime(75)
    ).subscribe(() => {
      this.updateScrollTopButtonVisibility();
    });
  }

  private stopScrollWatcher(): void {
    this.scrollSubscription?.unsubscribe();
    this.scrollSubscription = null;
  }

  private animateEntry(): void {
    const hero = this.blogHero?.nativeElement;
    const sidebar = this.blogSidebar?.nativeElement;

    if (!hero || !sidebar) {
      return;
    }

    this.hasPlayedEntryAnimation = true;

    if (!this.performanceConfig.animationsEnabled) {
      gsap.set([hero, sidebar], { opacity: 1, x: 0 });
      return;
    }

    gsap.killTweensOf([hero, sidebar]);

    gsap.set(hero, { opacity: 0, x: -140 });
    gsap.set(sidebar, { opacity: 0, x: 140 });

    gsap.to(hero, { opacity: 1, x: 0, duration: 1.2, ease: 'power2.out' });
    gsap.to(sidebar, { opacity: 1, x: 0, duration: 1.2, ease: 'power2.out' });
  }
}
