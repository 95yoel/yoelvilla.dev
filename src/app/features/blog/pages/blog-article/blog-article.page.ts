import { Component, ElementRef, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, Subscription, auditTime, catchError, combineLatest, fromEvent, map, merge, of, startWith, switchMap, tap } from 'rxjs';
import gsap from 'gsap';
import { Meta, Title } from '@angular/platform-browser';
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
import { environment } from '../../../../../environments/environment';
import { PerformanceConfigService } from '../../../../services/performance-config.service';
import { ExploreRoutingService } from '../../../explore/services/explore-routing.service';

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
        coverImage?: string;
        html: string;
      };
      articles: BlogArticleSummary[];
      graph: BlogArticleGraphData;
    };

type ArticleViewData = Extract<ArticleVm, { status: 'ready' }>['article'];

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
  private readonly performanceConfig = inject(PerformanceConfigService);
  private readonly exploreRoutingService = inject(ExploreRoutingService);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly reload$ = new Subject<void>();
  readonly layout$ = this.layoutService.layout$;
  showLanguagePanel = false;
  showScrollTopButton = false;
  showGraphModal = false;
  graphModalSlug: string | null = null;
  private shareFeedbackKey = 'blog.actions.share';
  private viewStateSubscription: Subscription | null = null;
  private previousBodyOverflow = '';
  private previousBodyOverflowX = '';
  private previousHtmlOverflow = '';
  private scrollSubscription: Subscription | null = null;
  private shareFeedbackTimeoutId: number | null = null;
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
            coverImage: article.coverImage,
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
        this.resetSeo();
        return;
      }

      this.applyArticleSeo(vm.article);

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
    this.clearShareFeedbackTimeout();
    this.resetSeo();
  }

  scrollToTop(): void {
    this.scrollDocumentToTop();
  }

  retry(): void {
    this.blogService.clearCaches();
    this.showGraphModal = false;
    this.graphModalSlug = null;
    this.reload$.next();
  }

  toggleLanguagePanel(): void {
    this.showLanguagePanel = !this.showLanguagePanel;
  }

  openGraphModal(slug?: string): void {
    this.graphModalSlug = slug || this.route.snapshot.paramMap.get('slug') || null;
    this.showGraphModal = true;
  }

  closeGraphModal(): void {
    this.showGraphModal = false;
    this.graphModalSlug = null;
  }

  async shareArticle(article: ArticleViewData): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const url = this.buildArticleUrl(article.slug);
    const shareData = {
      title: article.title,
      text: article.description,
      url
    };

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(shareData);
        this.setShareFeedback('blog.actions.shareShared');
        return;
      }

      await this.copyToClipboard(url);
      this.setShareFeedback('blog.actions.shareCopied');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      this.setShareFeedback('blog.actions.shareUnavailable');
    }
  }

  navigateFromGraph(slug: string): void {
    this.closeGraphModal();
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

  get shareButtonLabel(): string {
    return this.translationService.translate(this.shareFeedbackKey);
  }

  get exploreLink(): string[] {
    return this.exploreRoutingService.buildExploreLink(this.currentLanguage);
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

  private applyArticleSeo(article: ArticleViewData): void {
    const articleUrl = this.buildArticleUrl(article.slug);
    const articleTitle = `${article.title} | ${this.translationService.translate('blog.seo.articleTitleSuffix')}`;
    const description = article.description || this.translationService.translate('blog.seo.defaultDescription');
    const image = this.resolveAbsoluteUrl(article.coverImage) || environment.DEFAULT_OG_IMAGE;

    this.title.setTitle(articleTitle);
    this.updateMetaTag('name', 'description', description);
    this.updateMetaTag('name', 'robots', 'index, follow');
    this.updateMetaTag('name', 'keywords', article.tags.length
      ? article.tags.join(', ')
      : 'Yoel Villa, Full Stack, Angular, Java, Python, Cloud, Development, Desarrollo, Software, IA');
    this.updateMetaTag('property', 'og:title', articleTitle);
    this.updateMetaTag('property', 'og:description', description);
    this.updateMetaTag('property', 'og:type', 'article');
    this.updateMetaTag('property', 'og:url', articleUrl);
    this.updateMetaTag('property', 'og:image', image);
    this.updateMetaTag('property', 'og:locale', this.currentLanguage === 'es' ? 'es_ES' : 'en_US');
    this.updateMetaTag('name', 'twitter:card', 'summary_large_image');
    this.updateMetaTag('name', 'twitter:title', articleTitle);
    this.updateMetaTag('name', 'twitter:description', description);
    this.updateMetaTag('name', 'twitter:image', image);

    if (article.date) {
      this.updateMetaTag('property', 'article:published_time', article.date);
    } else {
      this.removeMetaTag('property', 'article:published_time');
    }

    this.updateCanonicalLink(articleUrl);
  }

  private resetSeo(): void {
    const siteTitle = this.translationService.translate('blog.seo.siteTitle');
    const description = this.translationService.translate('blog.seo.defaultDescription');

    this.title.setTitle(siteTitle);
    this.updateMetaTag('name', 'description', description);
    this.updateMetaTag('name', 'keywords', 'Yoel Villa, Full Stack, Angular, Java, Python, Cloud, Development, Desarrollo, Software, IA');
    this.updateMetaTag('name', 'robots', 'index, follow');
    this.updateMetaTag('property', 'og:title', siteTitle);
    this.updateMetaTag('property', 'og:description', description);
    this.updateMetaTag('property', 'og:type', 'website');
    this.updateMetaTag('property', 'og:url', environment.SITE_URL);
    this.updateMetaTag('property', 'og:image', environment.DEFAULT_OG_IMAGE);
    this.updateMetaTag('property', 'og:locale', this.currentLanguage === 'es' ? 'es_ES' : 'en_US');
    this.updateMetaTag('name', 'twitter:card', 'summary_large_image');
    this.updateMetaTag('name', 'twitter:title', siteTitle);
    this.updateMetaTag('name', 'twitter:description', description);
    this.updateMetaTag('name', 'twitter:image', environment.DEFAULT_OG_IMAGE);
    this.removeMetaTag('property', 'article:published_time');
    this.updateCanonicalLink(environment.SITE_URL);
  }

  private updateMetaTag(attribute: 'name' | 'property', selectorValue: string, content: string): void {
    this.meta.updateTag({ [attribute]: selectorValue, content }, `${attribute}="${selectorValue}"`);
  }

  private removeMetaTag(attribute: 'name' | 'property', selectorValue: string): void {
    this.meta.removeTag(`${attribute}="${selectorValue}"`);
  }

  private updateCanonicalLink(url: string): void {
    let link = this.doc.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;

    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }

    link.setAttribute('href', url);
  }

  private buildArticleUrl(slug: string): string {
    return `${environment.SITE_URL}/blog/${this.currentLanguage}/${slug}`;
  }

  private resolveAbsoluteUrl(value?: string): string {
    if (!value) {
      return '';
    }

    try {
      return new URL(value, environment.SITE_URL).toString();
    } catch {
      return '';
    }
  }

  private async copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = this.doc.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    this.doc.body.appendChild(textarea);
    textarea.select();

    const copied = this.doc.execCommand('copy');
    this.doc.body.removeChild(textarea);

    if (!copied) {
      throw new Error('Copy command failed');
    }
  }

  private setShareFeedback(translationKey: string): void {
    this.shareFeedbackKey = translationKey;
    this.clearShareFeedbackTimeout();
    this.shareFeedbackTimeoutId = window.setTimeout(() => {
      this.shareFeedbackKey = 'blog.actions.share';
      this.shareFeedbackTimeoutId = null;
    }, 2200);
  }

  private clearShareFeedbackTimeout(): void {
    if (this.shareFeedbackTimeoutId !== null) {
      window.clearTimeout(this.shareFeedbackTimeoutId);
      this.shareFeedbackTimeoutId = null;
    }
  }

  private updateScrollTopButtonVisibility(): void {
    const scrollTop = Math.max(
      this.doc.defaultView?.scrollY ?? 0,
      this.doc.scrollingElement?.scrollTop ?? 0,
      this.doc.documentElement.scrollTop ?? 0,
      this.doc.body.scrollTop ?? 0
    );

    this.showScrollTopButton = scrollTop > 0;
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
    const scrollTargets = [
      view,
      this.doc,
      this.doc.scrollingElement,
      this.doc.documentElement,
      this.doc.body
    ].filter((target, index, array) => !!target && array.indexOf(target) === index);

    if (!scrollTargets.length) {
      return;
    }

    this.scrollSubscription = merge(
      ...scrollTargets.map((target) => fromEvent(target as EventTarget, 'scroll', { passive: true }))
    ).pipe(
      startWith(null),
      auditTime(50)
    ).subscribe(() => {
      this.updateScrollTopButtonVisibility();
    });
  }

  private stopScrollWatcher(): void {
    this.scrollSubscription?.unsubscribe();
    this.scrollSubscription = null;
  }

  private animateEntry(): void {
    const articleCard = this.articleCard?.nativeElement;
    const articleSidebar = this.articleSidebar?.nativeElement;

    if (!articleCard || !articleSidebar) {
      return;
    }

    this.hasPlayedEntryAnimation = true;

    if (!this.performanceConfig.animationsEnabled) {
      gsap.set([articleCard, articleSidebar], { opacity: 1, x: 0 });
      return;
    }

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
