import { Component, ElementRef, EventEmitter, HostListener, inject, Output, ViewChild } from '@angular/core';
import { gsap } from 'gsap';
import { CursorConfig, CursorConfigService } from '../../../services/cursor-config.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../translations/pipes/translate.pipe';

@Component({
  selector: 'app-config-panel',
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './config-panel.component.html',
  styleUrl: './config-panel.component.css'
})
export class ConfigPanelComponent {
  
  @ViewChild('panel', { static: true }) panel!: ElementRef<HTMLDivElement>;
  @Output() close = new EventEmitter<void>()

  private closing = false;
  private readonly cursorConfig = inject(CursorConfigService);
  private ctx!: gsap.Context;

  @HostListener('document:keydown.escape')
  onEsc() { this.startCloseAnimation(); }

  @HostListener('document:mousedown', ['$event'])
  @HostListener('document:touchstart', ['$event'])
  onDocPointerDown(ev: Event) {
    const target = ev.target as Node | null;
    if (!target) return
    if (!this.panel.nativeElement.contains(target)) {
      this.startCloseAnimation()
    }
  }

  cursorColor = '#81b59d';
  cursorSize = 40
  dotSize = 6
  brightness = 1
  delay = 0.1

  // Validation limits
  private readonly limits = {
    size: { min: 10, max: 200 },
    dotSize: { min: 2, max: 50 },
    brightness: { min: 0.5, max: 1.5 },
    delay: { min: 0.05, max: 0.30 }
  };

  ngAfterViewInit() {
    requestAnimationFrame(() => {
      this.ctx = gsap.context(() => {
        gsap.fromTo(
          this.panel.nativeElement,
          { x: '100%', opacity: 0 },
          { x: '0%', opacity: 1, duration: 0.4, ease: 'power2.out' }
        )
      }, this.panel.nativeElement)
    })
  }

  ngOnInit(): void {
    this.cursorConfig.loadConfig();
    this.cursorConfig.config$.subscribe(cfg => {
      this.cursorColor = cfg.color
      this.cursorSize = cfg.size
      this.dotSize = cfg.dotSize
      this.brightness = cfg.brightness
      this.delay = cfg.delay
    });
  }

  onLiveChange() {
    // Validate and limit values
    this.cursorSize = this.clamp(this.cursorSize, this.limits.size.min, this.limits.size.max)
    this.dotSize = this.clamp(this.dotSize, this.limits.dotSize.min, this.limits.dotSize.max)
    this.brightness = this.clamp(this.brightness, this.limits.brightness.min, this.limits.brightness.max)
    this.delay = this.clamp(this.delay, this.limits.delay.min, this.limits.delay.max)

    const cfg: CursorConfig = {
      color: this.cursorColor,
      size: this.cursorSize,
      dotSize: this.dotSize,
      brightness: this.brightness,
      delay: this.delay
    };
    this.cursorConfig.setConfig(cfg)
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  }

  ngOnDestroy() {
    this.ctx?.revert()
  }

  startCloseAnimation() {
    gsap.to(this.panel.nativeElement, {
      x: '100%',
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => this.close.emit()
    })
  }

  onCloseClick() {
    this.startCloseAnimation()
  }

  resetConfig() {
    const defaults: CursorConfig = {
      color: '#81b59d',
      size: 40,
      dotSize: 6,
      brightness: 1,
      delay: 0.1
    };
    this.cursorConfig.setConfig(defaults)
  }
}
