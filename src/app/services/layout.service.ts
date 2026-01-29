import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {

  private layoutSubject = new BehaviorSubject<'mobile' | 'desktop'>(this.detectLayout())
  layout$ = this.layoutSubject.asObservable()

  private sectionSubject = new BehaviorSubject<string>('home')
  section$ = this.sectionSubject.asObservable()

  constructor(private breakpointObserver: BreakpointObserver) {
    this.breakpointObserver.observe('(max-width: 768px)').subscribe(result => {
      this.layoutSubject.next(result.matches ? 'mobile' : 'desktop')
    })
  }

  private detectLayout(): 'mobile' | 'desktop' {
    return window.innerWidth <= 768 ? 'mobile' : 'desktop'
  }

  setSection(section: string) {
    this.sectionSubject.next(section)
  }

  getCurrentSection(): string {
    return this.sectionSubject.getValue()
  }

  getLayout(): 'mobile' | 'desktop' {
    return this.layoutSubject.getValue()
  }
}
