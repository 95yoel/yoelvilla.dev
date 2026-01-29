import { Pipe, PipeTransform, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TranslationService } from '../services/translation.service';
import { Subscription } from 'rxjs';

@Pipe({
  name: 'translate',
  pure: false,
  standalone: true
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private translationService = inject(TranslationService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private subscription?: Subscription
  private lastKey = ''

  constructor() {
    this.subscription = this.translationService.currentLang$.subscribe(() => {
      this.changeDetectorRef.markForCheck()
    })
  }

  transform(key: string): string {
    this.lastKey = key;
    return this.translationService.translate(key)
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe()
  }
}
