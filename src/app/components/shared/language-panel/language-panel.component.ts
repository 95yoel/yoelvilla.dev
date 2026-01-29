import { Component, ElementRef, EventEmitter, HostListener, inject, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';
import { Language, TranslationService } from '../../../translations/services/translation.service';
import { TranslatePipe } from '../../../translations/pipes/translate.pipe';

@Component({
  selector: 'app-language-panel',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './language-panel.component.html',
  styleUrl: './language-panel.component.css'
})
export class LanguagePanelComponent {
  @ViewChild('panel', { static: true }) panel!: ElementRef<HTMLDivElement>;
  @Output() close = new EventEmitter<void>();

  private closing = false;
  private readonly translationService = inject(TranslationService);
  private ctx!: gsap.Context;

  currentLang: Language = 'es';

  ngOnInit() {
    this.currentLang = this.translationService.getCurrentLanguage();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.startCloseAnimation();
  }

  @HostListener('document:mousedown', ['$event'])
  @HostListener('document:touchstart', ['$event'])
  onDocPointerDown(ev: Event) {
    const target = ev.target as Node | null;
    if (!target) return;
    if (!this.panel.nativeElement.contains(target)) {
      this.startCloseAnimation();
    }
  }

  ngAfterViewInit(): void {
    this.ctx = gsap.context(() => {
      gsap.from(this.panel.nativeElement, {
        x: 100,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out'
      });
    });
  }

  selectLanguage(lang: Language) {
    this.translationService.setLanguage(lang);
    this.currentLang = lang;
    this.startCloseAnimation();
  }

  private startCloseAnimation() {
    if (this.closing) return;
    this.closing = true;

    gsap.to(this.panel.nativeElement, {
      x: 100,
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        this.close.emit();
        this.closing = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.ctx?.revert();
  }

  t(key: string): string {
    return this.translationService.translate(key);
  }
}
