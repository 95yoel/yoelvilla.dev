import { Component, HostBinding, Input, inject } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslationService } from '../../../translations/services/translation.service';
import { TranslatePipe } from '../../../translations/pipes/translate.pipe';

@Component({
  selector: 'scroll-btn',
  imports: [MatTooltipModule, TranslatePipe],
  templateUrl: './scroll-btn.component.html',
  styleUrl: './scroll-btn.component.css'
})
export class ScrollBtnComponent {
  @HostBinding('class.prev') @Input() isPrev = false;
  private translationService = inject(TranslationService);

  getTooltip(): string {
    return this.isPrev 
      ? this.translationService.translate('tooltips.previous')
      : this.translationService.translate('tooltips.next');
  }
}
