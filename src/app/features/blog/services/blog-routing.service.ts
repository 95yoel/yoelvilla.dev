import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Language, TranslationService } from '../../../translations/services/translation.service';

@Injectable({
  providedIn: 'root'
})
export class BlogRoutingService {
  private readonly router = inject(Router);
  private readonly translationService = inject(TranslationService);

  getRouteLanguage(): Language | null {
    const url = this.router.url;
    if (url.startsWith('/blog/es')) {
      return 'es';
    }
    if (url.startsWith('/blog/en')) {
      return 'en';
    }

    return null;
  }

  resolveLanguage(routeLang: Language | null): Language {
    const lang = routeLang ?? this.translationService.getCurrentLanguage();

    if (this.translationService.getCurrentLanguage() !== lang) {
      this.translationService.setLanguage(lang);
    }

    return lang;
  }

  ensureLocalizedIndexRoute(routeLang: Language | null): void {
    if (routeLang) {
      return;
    }

    void this.router.navigate(this.buildIndexLink(), { replaceUrl: true });
  }

  ensureLocalizedArticleRoute(routeLang: Language | null, slug: string): void {
    if (routeLang || !slug) {
      return;
    }

    void this.router.navigate(this.buildArticleLink(slug), { replaceUrl: true });
  }

  buildIndexLink(lang: Language = this.translationService.getCurrentLanguage()): string[] {
    return ['/blog', lang];
  }

  buildArticleLink(slug: string, lang: Language = this.translationService.getCurrentLanguage()): string[] {
    return ['/blog', lang, slug];
  }

  goToIndex(lang: Language): void {
    this.translationService.setLanguage(lang);
    void this.router.navigate(this.buildIndexLink(lang));
  }

  goToArticle(slug: string, lang: Language): void {
    this.translationService.setLanguage(lang);
    void this.router.navigate(this.buildArticleLink(slug, lang));
  }
}
