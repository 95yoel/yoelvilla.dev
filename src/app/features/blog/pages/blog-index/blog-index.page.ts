import { Component, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
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
import { BlogSidebarComponent } from '../../components/blog-sidebar/blog-sidebar.component';
import { BlogArticleSummary } from '../../models/blog-article.model';
import { BlogRoutingService } from '../../services/blog-routing.service';
import { BlogService } from '../../services/blog.service';

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
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);
  private readonly translationService = inject(TranslationService);
  private readonly blogRoutingService = inject(BlogRoutingService);
  private readonly layoutService = inject(LayoutService);
  private readonly doc = inject(DOCUMENT);
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
  private previousBodyOverflow = '';
  private previousBodyOverflowX = '';
  private previousHtmlOverflow = '';
  private scrollWatcherId: number | null = null;
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
    debounceTime(300),
    distinctUntilChanged()
  );

  readonly vm$ = combineLatest([
    this.lang$,
    this.reload$.pipe(startWith(undefined)),
    this.filters$,
    this.searchTerm$
  ]).pipe(
    switchMap(([lang, _reload, filters, searchTerm]) =>
      this.blogService.getIndex(lang).pipe(
        map((articles): IndexViewState => this.buildViewState(articles, this.normalizeFilters(filters), searchTerm)),
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
    this.updateScrollTopButtonVisibility();
    this.startScrollWatcher();
  }

  ngOnDestroy(): void {
    this.doc.body.style.overflow = this.previousBodyOverflow;
    this.doc.body.style.overflowX = this.previousBodyOverflowX;
    this.doc.documentElement.style.overflow = this.previousHtmlOverflow;
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
      .filter((article) => this.normalizeText(article.title).includes(normalizedSearch))
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
      target.scrollTo({ top: 0, behavior: 'smooth' });
      target.scrollTop = 0;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

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
    this.scrollWatcherId = window.setInterval(() => {
      this.updateScrollTopButtonVisibility();
    }, 150);
  }

  private stopScrollWatcher(): void {
    if (this.scrollWatcherId !== null) {
      window.clearInterval(this.scrollWatcherId);
      this.scrollWatcherId = null;
    }
  }
}
