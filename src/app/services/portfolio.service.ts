import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type PortfolioTab = 'proyectos' | 'experiencia';

export interface PortfolioState {
  activeTab: PortfolioTab;
  currentProjectIndex: number;
  totalProjects: number;
}

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private readonly stateSubject = new BehaviorSubject<PortfolioState>({
    activeTab: 'proyectos',
    currentProjectIndex: 0,
    totalProjects: 2
  });

  readonly state$ = this.stateSubject.asObservable();

  get snapshot(): PortfolioState {
    return this.stateSubject.value;
  }

  setActiveTab(tab: PortfolioTab): void {
    this.patchState({ activeTab: tab });
  }

  nextProject(): void {
    if (this.canGoNext()) {
      this.patchState({ currentProjectIndex: this.snapshot.currentProjectIndex + 1 });
    }
  }

  prevProject(): void {
    if (this.canGoPrev()) {
      this.patchState({ currentProjectIndex: this.snapshot.currentProjectIndex - 1 });
    }
  }

  canGoNext(): boolean {
    return this.snapshot.currentProjectIndex < this.snapshot.totalProjects - 1;
  }

  canGoPrev(): boolean {
    return this.snapshot.currentProjectIndex > 0;
  }

  private patchState(patch: Partial<PortfolioState>): void {
    this.stateSubject.next({
      ...this.snapshot,
      ...patch
    });
  }
}
