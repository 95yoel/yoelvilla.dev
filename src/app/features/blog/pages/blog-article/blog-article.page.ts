import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, Subscription, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import gsap from 'gsap';
import { BlogGraphModalComponent } from '../../components/blog-graph-modal/blog-graph-modal.component';
import { BlogSidebarComponent } from '../../components/blog-sidebar/blog-sidebar.component';
import { BlogService } from '../../services/blog.service';
import { BlogArticleGraphData, BlogArticleSummary } from '../../models/blog-article.model';
import { TranslatePipe } from '../../../../translations/pipes/translate.pipe';
import { Language, TranslationService } from '../../../../translations/services/translation.service';
import { LayoutService } from '../../../../services/layout.service';
import { CustomCursorComponent } from '../../../../components/shared/custom-cursor/custom-cursor.component';
import { LanguagePanelComponent } from '../../../../components/shared/language-panel/language-panel.component';
import { BlogRoutingService } from '../../services/blog-routing.service';

type ArticleVm =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      article: {
        slug: string;
        title: string;
        description: string;
        date: string;
        readingTimeMinutes: number;
        tags: string[];
        html: string;
      };
      articles: BlogArticleSummary[];
      graph: BlogArticleGraphData;
    };

@Component({
  selector: 'app-blog-article-page',
  imports: [CommonModule, RouterLink, BlogSidebarComponent, BlogGraphModalComponent, TranslatePipe, CustomCursorComponent, LanguagePanelComponent],
  templateUrl: './blog-article.page.html',
  styleUrl: './blog-article.page.css'
})
export class BlogArticlePage {
  @ViewChild('articleCard', { read: ElementRef }) private articleCard?: ElementRef<HTMLElement>;
  @ViewChild('articleSidebar', { read: ElementRef }) private articleSidebar?: ElementRef<HTMLElement>;

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
  showGraphModal = false;
  private viewStateSubscription: Subscription | null = null;
  private previousBodyOverflow = '';
  private previousBodyOverflowX = '';
  private previousHtmlOverflow = '';
  private scrollWatcherId: number | null = null;
  private hasPlayedEntryAnimation = false;
  private readonly routeState$ = combineLatest([
    this.route.paramMap.pipe(map((params) => params.get('slug') || '')),
    this.route.data.pipe(map(() => this.blogRoutingService.getRouteLanguage()))
  ]).pipe(
    map(([slug, routeLang]) => ({
      slug,
      lang: this.blogRoutingService.resolveLanguage(routeLang),
      routeLang
    })),
    tap(({ slug, routeLang }) => this.blogRoutingService.ensureLocalizedArticleRoute(routeLang, slug))
  );

  readonly vm$ = combineLatest([
    this.routeState$,
    this.reload$.pipe(startWith(undefined))
  ]).pipe(
    switchMap(([state]) =>
      combineLatest([
        this.blogService.getIndex(state.lang),
        this.blogService.getArticle(state.slug, state.lang),
        this.blogService.getGraphData(state.lang)
      ]).pipe(
        map(([articles, article, graph]): ArticleVm => ({
          status: 'ready',
          article: {
            slug: article.slug,
            title: article.title,
            description: article.description,
            date: article.date,
            readingTimeMinutes: article.readingTimeMinutes,
            tags: article.tags,
            html: article.html
          },
          articles,
          graph
        })),
        startWith({ status: 'loading' } as ArticleVm),
        catchError(() => of({ status: 'error' } as ArticleVm))
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
    this.viewStateSubscription?.unsubscribe();
    this.viewStateSubscription = null;
    this.stopScrollWatcher();
  }

  scrollToTop(): void {
    this.scrollDocumentToTop();
  }

  retry(): void {
    this.blogService.clearCaches();
    this.showGraphModal = false;
    this.reload$.next();
  }

  toggleLanguagePanel(): void {
    this.showLanguagePanel = !this.showLanguagePanel;
  }

  openGraphModal(): void {
    this.showGraphModal = true;
  }

  closeGraphModal(): void {
    this.showGraphModal = false;
  }

  navigateFromGraph(slug: string): void {
    this.showGraphModal = false;
    this.blogRoutingService.goToArticle(slug, this.currentLanguage);
  }

  hasGraphRelations(graph: BlogArticleGraphData, slug: string): boolean {
    return (graph.relatedBySlug[slug] || []).length > 0;
  }

  onLanguageChange(lang: Language, slug: string): void {
    this.blogRoutingService.goToArticle(slug, lang);
  }

  get currentLanguage(): Language {
    return this.translationService.getCurrentLanguage();
  }

  get blogIndexLink(): string[] {
    return this.blogRoutingService.buildIndexLink(this.currentLanguage);
  }

  formatDate(date: string): string {
    return this.formatBlogDate(date, this.currentLanguage);
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

  private animateEntry(): void {
    const articleCard = this.articleCard?.nativeElement;
    const articleSidebar = this.articleSidebar?.nativeElement;

    if (!articleCard || !articleSidebar) {
      return;
    }

    this.hasPlayedEntryAnimation = true;

    gsap.killTweensOf([articleCard, articleSidebar]);
    gsap.set(articleCard, { opacity: 0, x: -50 });
    gsap.set(articleSidebar, { opacity: 0, x: 50 });

    gsap.to(articleCard, {
      opacity: 1,
      x: 0,
      duration: 0.8,
      ease: 'power2.out'
    });

    gsap.to(articleSidebar, {
      opacity: 1,
      x: 0,
      duration: 0.8,
      ease: 'power2.out'
    });
  }
}
