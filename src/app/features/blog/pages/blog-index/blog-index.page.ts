import { Component, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import { BlogSidebarComponent } from '../../components/blog-sidebar/blog-sidebar.component';
import { BlogService } from '../../services/blog.service';
import { BlogArticleSummary } from '../../models/blog-article.model';
import { Language, TranslationService } from '../../../../translations/services/translation.service';
import { TranslatePipe } from '../../../../translations/pipes/translate.pipe';
import { LayoutService } from '../../../../services/layout.service';
import { CustomCursorComponent } from '../../../../components/shared/custom-cursor/custom-cursor.component';
import { LanguagePanelComponent } from '../../../../components/shared/language-panel/language-panel.component';
import { BlogRoutingService } from '../../services/blog-routing.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

type IndexViewState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      featured: BlogArticleSummary | null;
      rest: BlogArticleSummary[];
      availableTags: string[];
      selectedTag: string;
      filteredCount: number;
      totalCount: number;
      hasActiveFilters: boolean;
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
  readonly filterForm = new FormGroup({
    tag: new FormControl<string>(''),
    startDate: new FormControl<Date | null>(null),
    endDate: new FormControl<Date | null>(null)
  });
  readonly layout$ = this.layoutService.layout$;
  showLanguagePanel = false;
  showScrollTopButton = false;
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

  readonly vm$ = combineLatest([
    this.lang$,
    this.reload$.pipe(startWith(undefined)),
    this.filters$
  ]).pipe(
    switchMap(([lang, _reload, filters]) =>
      this.blogService.getIndex(lang).pipe(
        map((articles): IndexViewState => this.buildViewState(articles, this.normalizeFilters(filters))),
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

  clearFilters(): void {
    this.filterForm.reset({
      tag: '',
      startDate: null,
      endDate: null
    });
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

  formatDate(date: string): string {
    return this.formatBlogDate(date, this.currentLanguage);
  }

  getFilterSummary(filteredCount: number, totalCount: number): string {
    return this.currentLanguage === 'es'
      ? `${filteredCount} de ${totalCount} artículos visibles`
      : `${filteredCount} of ${totalCount} articles visible`;
  }

  getEmptyStateMessage(hasActiveFilters: boolean): string {
    return hasActiveFilters
      ? this.translationService.translate('blog.filters.empty')
      : this.translationService.translate('blog.empty');
  }

  private buildViewState(articles: BlogArticleSummary[], filters: BlogFiltersFormValue): IndexViewState {
    const availableTags = this.collectAvailableTags(articles);
    const filteredArticles = articles.filter((article) => this.matchesFilters(article, filters));

    return {
      status: 'ready',
      featured: filteredArticles[0] ?? null,
      rest: filteredArticles.slice(1),
      availableTags,
      selectedTag: filters.tag?.trim() || '',
      filteredCount: filteredArticles.length,
      totalCount: articles.length,
      hasActiveFilters: Boolean(filters.tag || filters.startDate || filters.endDate)
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
    const startTimestamp = filters.startDate ? this.startOfDay(filters.startDate).getTime() : null;
    const endTimestamp = filters.endDate ? this.endOfDay(filters.endDate).getTime() : null;

    if (startTimestamp !== null && articleTimestamp < startTimestamp) {
      return false;
    }

    if (endTimestamp !== null && articleTimestamp > endTimestamp) {
      return false;
    }

    return true;
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
