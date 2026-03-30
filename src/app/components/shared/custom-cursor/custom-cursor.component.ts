import { Component, DestroyRef, ElementRef, inject, Renderer2 } from '@angular/core';
import { CursorConfigService } from '../../../services/cursor-config.service';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PerformanceConfigService } from '../../../services/performance-config.service';

@Component({
  selector: 'custom-cursor',
  imports: [],
  templateUrl: './custom-cursor.component.html',
  styleUrl: './custom-cursor.component.css'
})
export class CustomCursorComponent {

  primaryColor = '#81b59d';
  secondaryColor = '#6e9a85';
  cursorSize = 40;
  dotSize = 6;
  brightness = 1;
  delay = 0.1;
  showOuterCircle = true;

  private readonly elRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly doc = inject(DOCUMENT);
  private readonly cursorConfig = inject(CursorConfigService);
  private readonly performanceConfig = inject(PerformanceConfigService);
  private readonly destroyRef = inject(DestroyRef);
  private rootEl?: HTMLElement;
  private cursorEl?: HTMLElement;
  private circleEl?: HTMLElement;
  private dotEl?: HTMLElement;
  private isGraphMode = false;
  private animationsEnabled = true;
  private isPointerInsideWindow = false;
  private isDocumentVisible = true;
  private lastModeTarget: Element | null = null;
  private circleX = 0;
  private circleY = 0;
  private dotX = 0;
  private dotY = 0;

  private onPointerDown = (e: PointerEvent) => this.spawnClickPulse(e.clientX, e.clientY);
  private onMouseMove = (e: MouseEvent) => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    this.isPointerInsideWindow = true;
    this.syncModeFromTarget(e.target);
    this.ensureAnimationLoop();
  };
  private onMouseLeave = () => {
    this.isPointerInsideWindow = false;
    this.stopAnimationLoop();
  };
  private onMouseEnter = () => {
    this.isPointerInsideWindow = true;
    this.ensureAnimationLoop();
  };
  private onVisibilityChange = () => {
    this.isDocumentVisible = this.doc.visibilityState === 'visible';

    if (this.isDocumentVisible) {
      this.ensureAnimationLoop();
      return;
    }

    this.stopAnimationLoop();
  };
  private animationFrameId?: number;
  private mouseX = 0;
  private mouseY = 0;

  ngOnInit(): void {
    this.cursorConfig.loadConfig();
    this.performanceConfig.loadConfig();

    this.performanceConfig.config$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(cfg => {
        this.animationsEnabled = cfg.animationsEnabled;
      });

    this.cursorConfig.config$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(cfg => {
        this.primaryColor = cfg.primaryColor;
        this.secondaryColor = cfg.secondaryColor;
        this.cursorSize = cfg.size;
        this.dotSize = cfg.dotSize;
        this.brightness = cfg.brightness;
        this.delay = cfg.delay;
        this.showOuterCircle = cfg.showOuterCircle;
        this.updateCursorStyle();
      });
  }

  ngOnDestroy(): void {
    window.removeEventListener('pointerdown', this.onPointerDown as any, true);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseleave', this.onMouseLeave);
    window.removeEventListener('mouseenter', this.onMouseEnter);
    this.doc.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.stopAnimationLoop();

    const host = this.elRef.nativeElement as HTMLElement;
    if (host.parentNode === this.doc.body) {
      this.doc.body.removeChild(host);
    }
  }

  ngAfterViewInit(): void {
    this.renderer.appendChild(this.doc.body, this.elRef.nativeElement);

    this.rootEl = this.elRef.nativeElement as HTMLElement;
    this.cursorEl = this.rootEl.querySelector('.custom-cursor') as HTMLElement;
    this.circleEl = this.rootEl.querySelector('.cursor-circle') as HTMLElement;
    this.dotEl = this.rootEl.querySelector('.cursor-dot') as HTMLElement;
    const cursor = this.cursorEl;
    const dot = this.dotEl;

    if (!cursor || !dot) {
      return;
    }

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseleave', this.onMouseLeave);
    window.addEventListener('mouseenter', this.onMouseEnter);
    this.doc.addEventListener('visibilitychange', this.onVisibilityChange);
    this.isDocumentVisible = this.doc.visibilityState === 'visible';

    const animate = () => {
      if (!this.shouldAnimateCursor()) {
        this.animationFrameId = undefined;
        return;
      }

      const circleDelay = this.delay;
      const dotDelay = circleDelay * 1.5;

      if (this.isGraphMode || !this.animationsEnabled) {
        this.circleX = this.mouseX;
        this.circleY = this.mouseY;
        this.dotX = this.mouseX;
        this.dotY = this.mouseY;
      } else {
        this.circleX += (this.mouseX - this.circleX) * circleDelay;
        this.circleY += (this.mouseY - this.circleY) * circleDelay;
        this.dotX += (this.mouseX - this.dotX) * dotDelay;
        this.dotY += (this.mouseY - this.dotY) * dotDelay;
      }

      cursor.style.transform = `translate3d(${this.circleX}px, ${this.circleY}px, 0) translate(-50%, -50%)`;

      const dx = this.dotX - this.circleX;
      const dy = this.dotY - this.circleY;
      dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;

      this.animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('pointerdown', this.onPointerDown, { passive: true, capture: true });
    this.updateCursorStyle();
    this.ensureAnimationLoop(animate);
  }

  private updateCursorStyle() {
    this.rootEl?.classList.toggle('hide-outer-circle', !this.showOuterCircle);

    if (this.cursorEl) {
      this.cursorEl.style.filter = '';
    }

    if (this.circleEl) {
      this.circleEl.style.width = `${this.cursorSize}px`;
      this.circleEl.style.height = `${this.cursorSize}px`;
      this.circleEl.style.border = `2px solid ${this.primaryColor}`;
      this.circleEl.style.setProperty('--cursor-primary', this.primaryColor);
      this.circleEl.style.setProperty('--cursor-secondary', this.secondaryColor);

      const blur = '3px';
      this.circleEl.style.setProperty('--blur', blur);
      this.circleEl.style.setProperty('backdrop-filter', `blur(${blur})`);
      this.circleEl.style.setProperty('-webkit-backdrop-filter', `blur(${blur})`);

      this.circleEl.style.filter = `brightness(${this.brightness})`;
    }

    if (this.dotEl) {
      this.dotEl.style.width = `${this.dotSize}px`;
      this.dotEl.style.height = `${this.dotSize}px`;
      this.dotEl.style.setProperty('--cursor-primary', this.primaryColor);
      this.dotEl.style.setProperty('--cursor-secondary', this.secondaryColor);
    }
  }

  private syncModeFromTarget(target: EventTarget | null): void {
    const targetElement = target instanceof Element ? target : null;
    if (targetElement === this.lastModeTarget) {
      return;
    }

    this.lastModeTarget = targetElement;
    const nextGraphMode = !!targetElement
      && !!targetElement.closest('.graph-stage, .article-cursor-zone, .chart-cursor-zone');
    if (nextGraphMode === this.isGraphMode || !this.rootEl) {
      return;
    }

    this.isGraphMode = nextGraphMode;
    this.rootEl.classList.toggle('graph-cursor-mode', nextGraphMode);
  }

  private spawnClickPulse(x: number, y: number) {
    if (!this.animationsEnabled || !this.isPointerInsideWindow || !this.isDocumentVisible) {
      return;
    }

    const el = this.doc.createElement('span');

    Object.assign(el.style, {
      position: 'fixed',
      left: x + 'px',
      top: y + 'px',
      width: '75px',
      height: '75px',
      borderRadius: '9999px',
      background: 'rgba(255, 255, 255, 0.95)',
      boxShadow: '0 0 18px rgba(255, 230, 92, .65)',
      transform: 'translate(-50%, -50%) scale(0)',
      opacity: '0.7',
      transition: 'transform 450ms ease-out, opacity 450ms ease-out',
      willChange: 'transform, opacity',
      pointerEvents: 'none',
      zIndex: '2147483647'
    });

    this.doc.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -50%) scale(1)';
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), 500);
  }

  private shouldAnimateCursor(): boolean {
    return this.isDocumentVisible && this.isPointerInsideWindow;
  }

  private ensureAnimationLoop(loop?: () => void): void {
    if (!this.shouldAnimateCursor() || this.animationFrameId !== undefined || !this.cursorEl || !this.dotEl) {
      return;
    }

    const animateLoop = loop ?? (() => {
      if (!this.shouldAnimateCursor()) {
        this.animationFrameId = undefined;
        return;
      }

      const circleDelay = this.delay;
      const dotDelay = circleDelay * 1.5;

      if (this.isGraphMode || !this.animationsEnabled) {
        this.circleX = this.mouseX;
        this.circleY = this.mouseY;
        this.dotX = this.mouseX;
        this.dotY = this.mouseY;
      } else {
        this.circleX += (this.mouseX - this.circleX) * circleDelay;
        this.circleY += (this.mouseY - this.circleY) * circleDelay;
        this.dotX += (this.mouseX - this.dotX) * dotDelay;
        this.dotY += (this.mouseY - this.dotY) * dotDelay;
      }

      this.cursorEl!.style.transform = `translate3d(${this.circleX}px, ${this.circleY}px, 0) translate(-50%, -50%)`;

      const dx = this.dotX - this.circleX;
      const dy = this.dotY - this.circleY;
      this.dotEl!.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;

      this.animationFrameId = requestAnimationFrame(animateLoop);
    });

    this.animationFrameId = requestAnimationFrame(animateLoop);
  }

  private stopAnimationLoop(): void {
    if (this.animationFrameId === undefined) {
      return;
    }

    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = undefined;
  }
}
