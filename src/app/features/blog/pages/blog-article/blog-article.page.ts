import { Component, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { BlogSidebarComponent } from '../../components/blog-sidebar/blog-sidebar.component';
import { BlogService } from '../../services/blog.service';
import { BlogArticleSummary } from '../../models/blog-article.model';
import { TranslatePipe } from '../../../../translations/pipes/translate.pipe';
import { TranslationService } from '../../../../translations/services/translation.service';
import { LayoutService } from '../../../../services/layout.service';
import { CustomCursorComponent } from '../../../../components/shared/custom-cursor/custom-cursor.component';

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
        tags: string[];
        html: string;
      };
      articles: BlogArticleSummary[];
    };

@Component({
  selector: 'app-blog-article-page',
  imports: [CommonModule, RouterLink, BlogSidebarComponent, TranslatePipe, CustomCursorComponent],
  templateUrl: './blog-article.page.html',
  styleUrl: './blog-article.page.css'
})
export class BlogArticlePage {
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);
  private readonly translationService = inject(TranslationService);
  private readonly layoutService = inject(LayoutService);
  private readonly doc = inject(DOCUMENT);
  private readonly reload$ = new Subject<void>();
  readonly layout$ = this.layoutService.layout$;
  private previousBodyOverflow = '';
  private previousBodyOverflowX = '';
  private previousHtmlOverflow = '';

  readonly vm$ = combineLatest([
    this.route.paramMap.pipe(map((params) => params.get('slug') || '')),
    this.translationService.currentLang$,
    this.reload$.pipe(startWith(undefined))
  ]).pipe(
    switchMap(([slug, lang]) =>
      combineLatest([
        this.blogService.getIndex(lang),
        this.blogService.getArticle(slug, lang)
      ]).pipe(
        map(([articles, article]): ArticleVm => ({
          status: 'ready',
          article: {
            slug: article.slug,
            title: article.title,
            description: article.description,
            date: article.date,
            tags: article.tags,
            html: article.html
          },
          articles
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
  }

  ngOnDestroy(): void {
    this.doc.body.style.overflow = this.previousBodyOverflow;
    this.doc.body.style.overflowX = this.previousBodyOverflowX;
    this.doc.documentElement.style.overflow = this.previousHtmlOverflow;
  }

  retry(): void {
    this.blogService.clearCaches();
    this.reload$.next();
  }
}
