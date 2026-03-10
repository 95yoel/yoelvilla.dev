import { Component, HostListener, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

type IndexViewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; featured: BlogArticleSummary | null; rest: BlogArticleSummary[] };

@Component({
  selector: 'app-blog-index-page',
  imports: [CommonModule, RouterLink, BlogSidebarComponent, TranslatePipe, CustomCursorComponent, LanguagePanelComponent],
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
  readonly layout$ = this.layoutService.layout$;
  showLanguagePanel = false;
  showScrollTopButton = false;
  private previousBodyOverflow = '';
  private previousBodyOverflowX = '';
  private previousHtmlOverflow = '';
  private readonly lang$ = this.route.data.pipe(
    map(() => this.blogRoutingService.getRouteLanguage()),
    map((routeLang) => this.blogRoutingService.resolveLanguage(routeLang)),
    tap(() => this.blogRoutingService.ensureLocalizedIndexRoute(this.blogRoutingService.getRouteLanguage()))
  );

  readonly vm$ = combineLatest([
    this.lang$,
    this.reload$.pipe(startWith(undefined))
  ]).pipe(
    switchMap(([lang]) =>
      this.blogService.getIndex(lang).pipe(
        map((articles): IndexViewState => ({
          status: 'ready',
          featured: articles[0] ?? null,
          rest: articles.slice(1)
        })),
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
  }

  ngOnDestroy(): void {
    this.doc.body.style.overflow = this.previousBodyOverflow;
    this.doc.body.style.overflowX = this.previousBodyOverflowX;
    this.doc.documentElement.style.overflow = this.previousHtmlOverflow;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.showScrollTopButton = window.scrollY > 240;
  }

  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  retry(): void {
    this.blogService.clearCaches();
    this.reload$.next();
  }

  toggleLanguagePanel(): void {
    this.showLanguagePanel = !this.showLanguagePanel;
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
}
