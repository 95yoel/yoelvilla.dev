import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { BlogSidebarComponent } from '../../components/blog-sidebar/blog-sidebar.component';
import { BlogService } from '../../services/blog.service';
import { BlogArticleSummary } from '../../models/blog-article.model';
import { TranslatePipe } from '../../../../translations/pipes/translate.pipe';
import { TranslationService } from '../../../../translations/services/translation.service';

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
  imports: [CommonModule, RouterLink, BlogSidebarComponent, TranslatePipe],
  templateUrl: './blog-article.page.html',
  styleUrl: './blog-article.page.css'
})
export class BlogArticlePage {
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);
  private readonly translationService = inject(TranslationService);
  private readonly reload$ = new Subject<void>();

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

  retry(): void {
    this.blogService.clearCaches();
    this.reload$.next();
  }
}
