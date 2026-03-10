import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SectionNavigationState {
  activeSection: string;
  currentSectionIndex: number;
  totalSections: number;
}

interface SectionCallbacks {
  onSectionEnter: (sectionName: string, element: HTMLElement) => void;
  onSectionLeave: (sectionName: string, element: HTMLElement) => void;
}

@Injectable({
  providedIn: 'root'
})
export class SectionNavigationService {
  private sections: HTMLElement[] = [];
  private observer?: IntersectionObserver;

  private readonly stateSubject = new BehaviorSubject<SectionNavigationState>({
    activeSection: 'home',
    currentSectionIndex: 0,
    totalSections: 0
  });

  readonly state$ = this.stateSubject.asObservable();

  get snapshot(): SectionNavigationState {
    return this.stateSubject.value;
  }

  registerSections(sections: HTMLElement[], callbacks: SectionCallbacks): void {
    this.disconnect();

    this.sections = sections;
    this.patchState({
      totalSections: sections.length
    });

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const section = entry.target as HTMLElement;
          const sectionName = section.dataset['section'] || '';

          if (entry.isIntersecting) {
            const sectionIndex = this.sections.findIndex((item) => item === section);
            this.patchState({
              activeSection: sectionName,
              currentSectionIndex: sectionIndex >= 0 ? sectionIndex : this.snapshot.currentSectionIndex
            });
            callbacks.onSectionEnter(sectionName, section);
          } else {
            callbacks.onSectionLeave(sectionName, section);
          }
        });
      },
      {
        root: null,
        threshold: 0.5
      }
    );

    this.sections.forEach((section) => {
      this.observer?.observe(section);
    });
  }

  findSectionByName(sectionName: string): HTMLElement | undefined {
    return this.sections.find((section) => section.dataset['section'] === sectionName);
  }

  getNextSection(): HTMLElement | undefined {
    return this.sections[this.snapshot.currentSectionIndex + 1];
  }

  getPrevSection(): HTMLElement | undefined {
    return this.sections[this.snapshot.currentSectionIndex - 1];
  }

  isFirstSection(): boolean {
    return this.snapshot.currentSectionIndex === 0;
  }

  isLastSection(): boolean {
    return this.snapshot.totalSections > 0 && this.snapshot.currentSectionIndex >= this.snapshot.totalSections - 1;
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private patchState(patch: Partial<SectionNavigationState>): void {
    this.stateSubject.next({
      ...this.snapshot,
      ...patch
    });
  }
}
