import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BlogArticleSummary } from '../../models/blog-article.model';
import { TranslatePipe } from '../../../../translations/pipes/translate.pipe';

@Component({
  selector: 'app-blog-sidebar',
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './blog-sidebar.component.html',
  styleUrl: './blog-sidebar.component.css'
})
export class BlogSidebarComponent {
  @Input() articles: BlogArticleSummary[] = [];
  @Input() activeSlug?: string;

  trackBySlug(_index: number, article: BlogArticleSummary): string {
    return article.slug;
  }
}
