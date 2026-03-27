import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface PerformanceConfig {
  animationsEnabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceConfigService {
  private readonly STORAGE_KEY = 'performanceConfig';
  private readonly doc = inject(DOCUMENT);

  private readonly defaultConfig: PerformanceConfig = {
    animationsEnabled: true
  };

  private readonly configSubject = new BehaviorSubject<PerformanceConfig>(this.defaultConfig);
  readonly config$ = this.configSubject.asObservable();

  constructor() {
    this.loadConfig();
  }

  get animationsEnabled(): boolean {
    return this.configSubject.getValue().animationsEnabled;
  }

  loadConfig(): void {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY) : null;
    const parsed = saved ? JSON.parse(saved) as Partial<PerformanceConfig> : {};
    const nextConfig = { ...this.defaultConfig, ...parsed };

    this.configSubject.next(nextConfig);
    this.applyToDocument(nextConfig.animationsEnabled);
  }

  setAnimationsEnabled(animationsEnabled: boolean): void {
    const nextConfig = { animationsEnabled };
    this.configSubject.next(nextConfig);
    this.applyToDocument(animationsEnabled);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(nextConfig));
    }
  }

  getScrollBehavior(): ScrollBehavior {
    return this.animationsEnabled ? 'smooth' : 'auto';
  }

  private applyToDocument(animationsEnabled: boolean): void {
    this.doc.documentElement.dataset['performance'] = animationsEnabled ? 'full' : 'reduced';
  }
}
