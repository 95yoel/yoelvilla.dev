import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import enTranslations from '../en.json';
import esTranslations from '../es.json';

export type Language = 'es' | 'en';

interface Translations {
  [key: string]: string | Translations;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private translations: Record<Language, Translations> = {
    en: enTranslations,
    es: esTranslations
  };

  private currentLangSubject = new BehaviorSubject<Language>('es');
  public currentLang$ = this.currentLangSubject.asObservable();

  constructor() {
    this.loadLanguage();
  }

  private loadLanguage(): void {
    const savedLang = localStorage.getItem('app-language') as Language;
    if (savedLang && (savedLang === 'es' || savedLang === 'en')) {
      this.currentLangSubject.next(savedLang);
    } else {
      // Detectar idioma del navegador
      const browserLang = navigator.language.toLowerCase();
      const detectedLang: Language = browserLang.startsWith('es') ? 'es' : 'en';
      this.setLanguage(detectedLang);
    }
  }

  public setLanguage(lang: Language): void {
    this.currentLangSubject.next(lang);
    localStorage.setItem('app-language', lang);
  }

  public getCurrentLanguage(): Language {
    return this.currentLangSubject.value;
  }

  public translate(key: string): string {
    const lang = this.getCurrentLanguage();
    const keys = key.split('.');
    let value: any = this.translations[lang];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Devolver la clave si no se encuentra la traducción
      }
    }

    return typeof value === 'string' ? value : key;
  }

  public t(key: string): string {
    return this.translate(key);
  }
}
