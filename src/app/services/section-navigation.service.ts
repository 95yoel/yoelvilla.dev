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

interface RegisterSectionOptions {
  root?: HTMLElement | null;
  threshold?: number | number[];
}

@Injectable({
  providedIn: 'root'
})
export class SectionNavigationService {
  private sections: HTMLElement[] = [];
  private observer?: IntersectionObserver;
  private activeSectionName = 'home';

  private readonly stateSubject = new BehaviorSubject<SectionNavigationState>({
    activeSection: 'home',
    currentSectionIndex: 0,
    totalSections: 0
  });

  readonly state$ = this.stateSubject.asObservable();

  get snapshot(): SectionNavigationState {
    return this.stateSubject.value;
  }

  registerSections(sections: HTMLElement[], callbacks: SectionCallbacks, options?: RegisterSectionOptions): void {
    this.disconnect();

    this.sections = sections;
    this.activeSectionName = sections[0]?.dataset['section'] || 'home';
    this.patchState({
      activeSection: this.activeSectionName,
      currentSectionIndex: 0,
      totalSections: sections.length
    });

    this.observer = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);

        const nextActive = entering[0];
        if (nextActive) {
          const section = nextActive.target as HTMLElement;
          const sectionName = section.dataset['section'] || '';
          if (sectionName && sectionName !== this.activeSectionName) {
            const previousSection = this.findSectionByName(this.activeSectionName);
            if (previousSection) {
              callbacks.onSectionLeave(this.activeSectionName, previousSection);
            }

            this.activeSectionName = sectionName;
            const sectionIndex = this.sections.findIndex((item) => item === section);
            this.patchState({
              activeSection: sectionName,
              currentSectionIndex: sectionIndex >= 0 ? sectionIndex : this.snapshot.currentSectionIndex
            });
            callbacks.onSectionEnter(sectionName, section);
          }
        }
      },
      {
        root: options?.root ?? null,
        threshold: options?.threshold ?? 0.5
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
    this.sections = [];
  }

  private patchState(patch: Partial<SectionNavigationState>): void {
    this.stateSubject.next({
      ...this.snapshot,
      ...patch
    });
  }
}
