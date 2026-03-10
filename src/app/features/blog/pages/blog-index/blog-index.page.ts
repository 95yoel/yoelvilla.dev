import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { BlogSidebarComponent } from '../../components/blog-sidebar/blog-sidebar.component';
import { BlogService } from '../../services/blog.service';
import { BlogArticleSummary } from '../../models/blog-article.model';
import { TranslationService } from '../../../../translations/services/translation.service';
import { TranslatePipe } from '../../../../translations/pipes/translate.pipe';
import { LayoutService } from '../../../../services/layout.service';
import { CustomCursorComponent } from '../../../../components/shared/custom-cursor/custom-cursor.component';

type IndexViewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; featured: BlogArticleSummary | null; rest: BlogArticleSummary[] };

@Component({
  selector: 'app-blog-index-page',
  imports: [CommonModule, RouterLink, BlogSidebarComponent, TranslatePipe, CustomCursorComponent],
  templateUrl: './blog-index.page.html',
  styleUrl: './blog-index.page.css'
})
export class BlogIndexPage {
  private readonly blogService = inject(BlogService);
  private readonly translationService = inject(TranslationService);
  private readonly layoutService = inject(LayoutService);
  private readonly reload$ = new Subject<void>();
  readonly layout$ = this.layoutService.layout$;

  readonly vm$ = combineLatest([
    this.translationService.currentLang$,
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

  retry(): void {
    this.blogService.clearCaches();
    this.reload$.next();
  }
}
