import { Component, DestroyRef, ViewChild, inject } from '@angular/core';
import { DesktopLayoutComponent } from '../desktop-layout/desktop-layout.component';
import { CommonModule } from '@angular/common';
import { MobileLayoutComponent } from '../mobile-layout/mobile-layout.component';
import { LayoutService } from '../../services/layout.service';
import { ConfigPanelComponent } from '../shared/config-panel/config-panel.component';
import { LanguagePanelComponent } from '../shared/language-panel/language-panel.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslationService } from '../../translations/services/translation.service';

@Component({
  selector: 'app-layout',
  imports: [MobileLayoutComponent, DesktopLayoutComponent, CommonModule, ConfigPanelComponent, LanguagePanelComponent, MatTooltipModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {

  @ViewChild('configPanel') configPanel?: ConfigPanelComponent;
  @ViewChild('languagePanel') languagePanel?: LanguagePanelComponent;

  layout: 'mobile' | 'desktop' = 'desktop';
  showConfigPanel = false;
  showLanguagePanel = false;
  private destroyRef = inject(DestroyRef);
  private translationService = inject(TranslationService);

  constructor(private layoutService: LayoutService) {}

  ngOnInit() {
    this.layoutService.layout$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(l => {
        this.layout = l;
      });
  }

  toggleConfigPanel() {
    if (this.showConfigPanel && this.configPanel) {
      this.configPanel.startCloseAnimation();
    } else {
      this.showConfigPanel = true;
    }
  }

  toggleLanguagePanel() {
    if (this.showLanguagePanel && this.languagePanel) {
      this.showLanguagePanel = false;
    } else {
      this.showLanguagePanel = true;
    }
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }
}
