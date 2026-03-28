import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BlogArticleSummary } from '../../models/blog-article.model';
import { TranslatePipe } from '../../../../translations/pipes/translate.pipe';
import { Language } from '../../../../translations/services/translation.service';
import { BlogRoutingService } from '../../services/blog-routing.service';

@Component({
  selector: 'app-blog-sidebar',
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './blog-sidebar.component.html',
  styleUrl: './blog-sidebar.component.css'
})
export class BlogSidebarComponent {
  @Input() articles: BlogArticleSummary[] = [];
  @Input() activeSlug?: string;
  @Input() lang: Language = 'es';
  @Output() openGraph = new EventEmitter<string>();

  constructor(private readonly blogRoutingService: BlogRoutingService) {}

  trackBySlug(_index: number, article: BlogArticleSummary): string {
    return article.slug;
  }

  getArticleLink(slug: string): string[] {
    return this.blogRoutingService.buildArticleLink(slug, this.lang);
  }

  emitOpenGraph(event: Event, slug: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.openGraph.emit(slug);
  }

  formatDate(date: string): string {
    if (!date) {
      return '';
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return new Intl.DateTimeFormat(this.lang === 'es' ? 'es-ES' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(parsedDate);
  }
}
