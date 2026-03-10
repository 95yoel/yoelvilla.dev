import { Component, DestroyRef, ElementRef, inject, Renderer2 } from '@angular/core';
import { CursorConfigService } from '../../../services/cursor-config.service';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'custom-cursor',
  imports: [],
  templateUrl: './custom-cursor.component.html',
  styleUrl: './custom-cursor.component.css'
})
export class CustomCursorComponent {

  cursorColor = '#81b59d';
  cursorSize = 40;
  dotSize = 6;
  brightness = 1;
  delay = 0.1;

  private readonly elRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly doc = inject(DOCUMENT);
  private readonly cursorConfig = inject(CursorConfigService);
  private readonly destroyRef = inject(DestroyRef);

  private onPointerDown = (e: PointerEvent) => this.spawnClickPulse(e.clientX, e.clientY);
  private onMouseMove = (e: MouseEvent) => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };
  private animationFrameId?: number;
  private mouseX = 0;
  private mouseY = 0;

  ngOnInit(): void {
    this.cursorConfig.loadConfig();
    this.cursorConfig.config$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(cfg => {
        this.cursorColor = cfg.color;
        this.cursorSize = cfg.size;
        this.dotSize = cfg.dotSize;
        this.brightness = cfg.brightness;
        this.delay = cfg.delay;
        this.updateCursorStyle();
      });
  }

  ngOnDestroy(): void {
    window.removeEventListener('pointerdown', this.onPointerDown as any, true);
    window.removeEventListener('mousemove', this.onMouseMove);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const host = this.elRef.nativeElement as HTMLElement;
    if (host.parentNode === this.doc.body) {
      this.doc.body.removeChild(host);
    }
  }

  ngAfterViewInit(): void {
    this.renderer.appendChild(this.doc.body, this.elRef.nativeElement);

    const root = this.elRef.nativeElement as HTMLElement;
    const cursor = root.querySelector('.custom-cursor') as HTMLElement;
    const circle = root.querySelector('.cursor-circle') as HTMLElement;
    const dot = root.querySelector('.cursor-dot') as HTMLElement;

    let circleX = 0, circleY = 0;
    let dotX = 0, dotY = 0;

    window.addEventListener('mousemove', this.onMouseMove);

    const animate = () => {
      const circleDelay = this.delay;
      const dotDelay = circleDelay * 1.5;

      circleX += (this.mouseX - circleX) * circleDelay;
      circleY += (this.mouseY - circleY) * circleDelay;
      cursor.style.left = `${circleX}px`;
      cursor.style.top = `${circleY}px`;

      dotX += (this.mouseX - dotX) * dotDelay;
      dotY += (this.mouseY - dotY) * dotDelay;

      const dx = dotX - circleX;
      const dy = dotY - circleY;
      dot.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

      this.animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('pointerdown', this.onPointerDown, { passive: true, capture: true });
    this.updateCursorStyle();
    animate();
  }

  private updateCursorStyle() {
    const root = this.elRef.nativeElement as HTMLElement;
    const cursor = root.querySelector('.custom-cursor') as HTMLElement;
    const circle = root.querySelector('.cursor-circle') as HTMLElement;
    const dot = root.querySelector('.cursor-dot') as HTMLElement;

    if (cursor) {
      cursor.style.filter = '';
    }

    if (circle) {
      circle.style.width = `${this.cursorSize}px`;
      circle.style.height = `${this.cursorSize}px`;
      circle.style.border = `2px solid ${this.cursorColor}`;

      const blur = '3px';
      circle.style.setProperty('--blur', blur);
      circle.style.setProperty('backdrop-filter', `blur(${blur})`);
      circle.style.setProperty('-webkit-backdrop-filter', `blur(${blur})`);

      circle.style.filter = `brightness(${this.brightness})`;
    }

    if (dot) {
      dot.style.width = `${this.dotSize}px`;
      dot.style.height = `${this.dotSize}px`;
      dot.style.background = this.cursorColor;
    }
  }

  private spawnClickPulse(x: number, y: number) {
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
}
