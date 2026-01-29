import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CursorConfig {
  color: string;
  size: number;
  dotSize: number;
  brightness: number;
  delay: number;
}

@Injectable({
  providedIn: 'root'
})
export class CursorConfigService {
  
  private STORAGE_KEY = 'cursorConfig';

  private defaultConfig: CursorConfig = {
    color: '#81b59d',
    size: 40,
    dotSize: 6,
    brightness: 1,
    delay: 0.1
  }

  private configSubject = new BehaviorSubject<CursorConfig>(this.defaultConfig);
  config$ = this.configSubject.asObservable()

  setConfig(config: CursorConfig) {
    this.configSubject.next(config)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config))
  }

  loadConfig() {
    const saved = localStorage.getItem(this.STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      const merged: CursorConfig = { ...this.defaultConfig, ...parsed }
      this.configSubject.next(merged)
    }
  }
}
