import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Language, TranslationService } from '../../../translations/services/translation.service';

@Injectable({
  providedIn: 'root'
})
export class ExploreRoutingService {
  private readonly router = inject(Router);
  private readonly translationService = inject(TranslationService);

  getRouteLanguage(): Language | null {
    const url = this.router.url;
    if (url.startsWith('/explore/es')) {
      return 'es';
    }
    if (url.startsWith('/explore/en')) {
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

  ensureLocalizedExploreRoute(routeLang: Language | null): void {
    if (routeLang) {
      return;
    }

    void this.router.navigate(this.buildExploreLink(), { replaceUrl: true });
  }

  buildExploreLink(lang: Language = this.translationService.getCurrentLanguage()): string[] {
    return ['/explore', lang];
  }

  goToExplore(lang: Language): void {
    this.translationService.setLanguage(lang);
    void this.router.navigate(this.buildExploreLink(lang));
  }
}
