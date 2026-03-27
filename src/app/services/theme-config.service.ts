import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeId = 'default' | 'light' | 'dark';

export interface ThemePreview {
  id: ThemeId;
  nameKey: string;
  swatches: [string, string, string, string];
  available: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeConfigService {

  private readonly STORAGE_KEY = 'siteTheme';
  private readonly doc = inject(DOCUMENT);

  private readonly themes: ThemePreview[] = [
    {
      id: 'default',
      nameKey: 'config.themePanel.defaultTheme',
      swatches: ['#8B2F3C', '#F4B267', '#546E64', '#E86A78'],
      available: true
    },
    {
      id: 'light',
      nameKey: 'config.themePanel.lightTheme',
      swatches: ['#f3f4f6', '#e5e7eb', '#cbd5e1', '#94a3b8'],
      available: false
    },
    {
      id: 'dark',
      nameKey: 'config.themePanel.darkTheme',
      swatches: ['#0f172a', '#1e293b', '#334155', '#475569'],
      available: false
    }
  ];

  private readonly activeThemeSubject = new BehaviorSubject<ThemeId>('default');
  readonly activeTheme$ = this.activeThemeSubject.asObservable();

  getAvailableThemes(): ThemePreview[] {
    return this.themes;
  }

  loadTheme(): void {
    const savedTheme = localStorage.getItem(this.STORAGE_KEY) as ThemeId | null;
    const nextTheme = this.isKnownTheme(savedTheme) ? savedTheme : 'default';
    this.activeThemeSubject.next(nextTheme);
    this.applyTheme(nextTheme);
  }

  setTheme(themeId: ThemeId): void {
    const theme = this.themes.find((item) => item.id === themeId);
    if (!theme || !theme.available) {
      return;
    }

    this.activeThemeSubject.next(themeId);
    this.applyTheme(themeId);
    localStorage.setItem(this.STORAGE_KEY, themeId);
  }

  private applyTheme(themeId: ThemeId): void {
    this.doc.documentElement.dataset['theme'] = themeId;
  }

  private isKnownTheme(themeId: string | null): themeId is ThemeId {
    return this.themes.some((theme) => theme.id === themeId);
  }
}
