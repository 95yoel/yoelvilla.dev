import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CursorConfigService } from './cursor-config.service';

export type ThemeId = 'default' | 'light' | 'dark';

export interface ThemePreview {
  id: ThemeId;
  nameKey: string;
  swatches: [string, string, string, string];
  available: boolean;
  cursorPrimary: string;
  cursorSecondary: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeConfigService {

  private readonly STORAGE_KEY = 'siteTheme';
  private readonly doc = inject(DOCUMENT);
  private readonly cursorConfig = inject(CursorConfigService);

  private readonly themes: ThemePreview[] = [
    {
      id: 'default',
      nameKey: 'config.themePanel.defaultTheme',
      swatches: ['#8B2F3C', '#F4B267', '#546E64', '#E86A78'],
      available: true,
      cursorPrimary: '#81b59d',
      cursorSecondary: '#6e9a85'
    },
    {
      id: 'light',
      nameKey: 'config.themePanel.lightTheme',
      swatches: ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8'],
      available: true,
      cursorPrimary: '#475569',
      cursorSecondary: '#475569'
    },
    {
      id: 'dark',
      nameKey: 'config.themePanel.darkTheme',
      swatches: ['#0f172a', '#1e293b', '#334155', '#64748b'],
      available: true,
      cursorPrimary: '#e2e8f0',
      cursorSecondary: '#e2e8f0'
    }
  ];

  private readonly activeThemeSubject = new BehaviorSubject<ThemeId>('default');
  readonly activeTheme$ = this.activeThemeSubject.asObservable();

  getAvailableThemes(): ThemePreview[] {
    return this.themes;
  }

  loadTheme(): void {
    this.cursorConfig.loadConfig();
    const savedTheme = localStorage.getItem(this.STORAGE_KEY) as ThemeId | null;
    const nextTheme = this.isKnownTheme(savedTheme) ? savedTheme : 'default';
    const theme = this.themes.find((item) => item.id === nextTheme);
    this.activeThemeSubject.next(nextTheme);
    this.applyTheme(nextTheme);
    if (theme) {
      this.applyCursorTheme(theme);
    }
  }

  setTheme(themeId: ThemeId): void {
    const theme = this.themes.find((item) => item.id === themeId);
    if (!theme || !theme.available) {
      return;
    }

    this.activeThemeSubject.next(themeId);
    this.applyTheme(themeId);
    this.applyCursorTheme(theme);
    localStorage.setItem(this.STORAGE_KEY, themeId);
  }

  private applyTheme(themeId: ThemeId): void {
    this.doc.documentElement.dataset['theme'] = themeId;
  }

  private applyCursorTheme(theme: ThemePreview): void {
    const currentConfig = this.cursorConfig.getCurrentConfig();
    this.cursorConfig.setConfig({
      ...currentConfig,
      primaryColor: theme.cursorPrimary,
      secondaryColor: theme.cursorSecondary
    });
  }

  private isKnownTheme(themeId: string | null): themeId is ThemeId {
    return this.themes.some((theme) => theme.id === themeId);
  }
}
