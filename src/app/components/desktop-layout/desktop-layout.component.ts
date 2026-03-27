import { Component, ElementRef, HostListener, QueryList, ViewChild, ViewChildren, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import gsap from 'gsap';
import { ScrollBtnComponent } from '../shared/scroll-btn/scroll-btn.component';
import { CustomCursorComponent } from '../shared/custom-cursor/custom-cursor.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../translations/pipes/translate.pipe';
import { ContactService } from '../../services/contact.service';
import { PortfolioService, PortfolioTab } from '../../services/portfolio.service';
import { SectionNavigationService } from '../../services/section-navigation.service';
import { PerformanceConfigService } from '../../services/performance-config.service';

@Component({
  selector: 'villayoel-desktop',
  imports: [ScrollBtnComponent, CustomCursorComponent, CommonModule, FormsModule, MatTooltipModule, TranslatePipe],
  templateUrl: './desktop-layout.component.html',
  styleUrl: './desktop-layout.component.css'
})
export class DesktopLayoutComponent {

  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('carousel') carouselRef!: ElementRef<HTMLDivElement>;
  @ViewChildren('panel') panels!: QueryList<ElementRef>;

  private lastWorkTab: PortfolioTab = 'proyectos'

  private portfolioEl?: HTMLElement
  private isScrolling = false
  private contactService = inject(ContactService)
  private portfolioService = inject(PortfolioService)
  private sectionNavigationService = inject(SectionNavigationService)
  private performanceConfig = inject(PerformanceConfigService)
  
  // Carousel navigation state
  canScrollCarouselNext = false
  canScrollCarouselPrev = false

  get activeWorkTab(): PortfolioTab {
    return this.portfolioService.snapshot.activeTab
  }

  set activeWorkTab(tab: PortfolioTab) {
    this.portfolioService.setActiveTab(tab)
  }

  get contactName(): string {
    return this.contactService.snapshot.name
  }

  get contactEmail(): string {
    return this.contactService.snapshot.email
  }

  get contactMessage(): string {
    return this.contactService.snapshot.message
  }

  get showFeedback(): boolean {
    return this.contactService.snapshot.showFeedback
  }

  get feedbackMessage(): string {
    return this.contactService.snapshot.feedbackMessage
  }

  get feedbackType(): 'success' | 'error' {
    return this.contactService.snapshot.feedbackType
  }

  get isSending(): boolean {
    return this.contactService.snapshot.isSending
  }

  get currentSectionIndex(): number {
    return this.sectionNavigationService.snapshot.currentSectionIndex
  }

  private get animationsEnabled(): boolean {
    return this.performanceConfig.animationsEnabled
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent) {
    event.preventDefault()

    if (this.isScrolling) return

    const container = this.scrollContainer.nativeElement
    const panelWidth = window.innerWidth
    const direction = Math.sign(event.deltaY)

    const targetScrollLeft = container.scrollLeft + direction * panelWidth

    this.isScrolling = true

    container.scrollTo({
      left: targetScrollLeft,
      behavior: this.performanceConfig.getScrollBehavior()
    })

    if (this.animationsEnabled) {
      setTimeout(() => {
        this.isScrolling = false
      }, 250)
    } else {
      this.isScrolling = false
    }
  }

  ngAfterViewInit(): void {
    this.sectionNavigationService.registerSections(
      this.panels.toArray().map((panel) => panel.nativeElement as HTMLElement),
      {
        onSectionEnter: (sectionName, element) => this.handleSectionChange(sectionName, element),
        onSectionLeave: (sectionName, element) => this.handleSectionLeave(sectionName, element)
      }
    )

    // Initialize carousel buttons state
    setTimeout(() => this.updateCarouselButtons(), 100)
  }

  ngOnDestroy(): void {
    this.sectionNavigationService.disconnect()
  }

  private handleSectionChange(sectionName: string, element: HTMLElement) {
    const navItem = document.querySelector(`nav li[data-nav="${sectionName}"]`)
    if (navItem) {
      navItem.classList.add('active')
    }
    switch (sectionName) {
      case 'home':
        element.classList.add('home-section')
        this.animateTitle(element)
        break
      case 'about':
        element.classList.add('about-section')
        this.animateAbout(element)
        break
      case 'portfolio':
        element.classList.add('portfolio-section')
        this.portfolioEl = element
        const work = this.getWorkRoot(element)
        if (work) {
          if (this.animationsEnabled) {
            gsap.set(work, { opacity: 0, y: 12 })
            gsap.to(work, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
          } else {
            gsap.set(work, { opacity: 1, y: 0 })
          }
        }
        queueMicrotask(() => this.animateWorkTab(this.activeWorkTab, element))
        break
      case 'contact':
        element.classList.add('contact-section')
        this.animateContact(element)
        break
    }
  }

  private handleSectionLeave(sectionName: string, element: HTMLElement) {
    const navItem = document.querySelector(`nav li[data-nav="${sectionName}"]`)
    if (navItem) {
      navItem.classList.remove('active')
    }

    switch (sectionName) {
      case 'home':
        this.unanimateTitle(element)
        break
      case 'about':
        this.unanimateAbout(element)
        break
      case 'portfolio':
        this.unanimateWorkTab(this.activeWorkTab, element)
        const work = this.getWorkRoot(element)
        if (work) {
          if (this.animationsEnabled) {
            gsap.to(work, { opacity: 0, y: 12, duration: 0.4, ease: 'power2.inOut' })
          } else {
            gsap.set(work, { opacity: 0, y: 12 })
          }
        }
        break
      case 'contact':
        this.unanimateContact(element)
        break
    }
  }

  private animateTitle(element: HTMLElement) {
    const title = element.querySelector('.title')
    const subtitle = element.querySelector('.subtitle')

    if (!title || !subtitle) return

    if (!this.animationsEnabled) {
      gsap.set([title, subtitle], { opacity: 1, y: 0 })
      return
    }

    gsap.set(title, { opacity: 0, y: -500 })
    gsap.set(subtitle, { opacity: 0, y: 500 })

    gsap.to(title, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' })
    gsap.to(subtitle, { opacity: 1, y: 0, duration: 1.2, delay: 0.2, ease: 'power2.out' })
  }

  private unanimateTitle(element: HTMLElement) {
    const title = element.querySelector('.title')
    const subtitle = element.querySelector('.subtitle')

    if (title) {
      this.animationsEnabled
        ? gsap.to(title, { opacity: 0, duration: 0.5, ease: 'power2.inOut' })
        : gsap.set(title, { opacity: 0 })
    }

    if (subtitle) {
      this.animationsEnabled
        ? gsap.to(subtitle, { opacity: 0, y: 60, duration: 0.5, ease: 'power2.inOut' })
        : gsap.set(subtitle, { opacity: 0, y: 60 })
    }
  }

  private animateAbout(element: HTMLElement) {
    const aboutText = element.querySelector('.about')

    if (!aboutText) return

    if (!this.animationsEnabled) {
      gsap.set(aboutText, { opacity: 1, y: 0 })
      return
    }

    gsap.set(aboutText, { opacity: 0, y: -50 })

    gsap.to(aboutText, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
  }

  private unanimateAbout(element: HTMLElement) {
    const aboutText = element.querySelector('.about')

    if (aboutText) {
      this.animationsEnabled
        ? gsap.to(aboutText, { opacity: 0, y: -50, duration: 0.5, ease: 'power2.inOut' })
        : gsap.set(aboutText, { opacity: 0, y: -50 })
    }
  }

  public switchWorkTab(tab: PortfolioTab): void {
    if (this.activeWorkTab === tab) return

    this.unanimateWorkTab(this.activeWorkTab, this.portfolioEl)

    this.lastWorkTab = this.activeWorkTab
    this.activeWorkTab = tab

    queueMicrotask(() => this.animateWorkTab(tab, this.portfolioEl))
  }

  private animateWorkTab(tab: PortfolioTab, element?: HTMLElement): void {
    const work = this.getWorkRoot(element)
    if (!work) return

    gsap.killTweensOf(work.querySelectorAll('*'))

    if (tab === 'proyectos') {
      const panel = work.querySelector('#proyectos') as HTMLElement | null
      const cards = panel?.querySelectorAll('.card') ?? []
      if (!panel || !cards.length) return

      if (this.animationsEnabled) {
        gsap.set(panel, { opacity: 0, y: 8 })
        gsap.to(panel, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })

        gsap.set(cards, { opacity: 0, y: 10 })
        gsap.to(cards, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.08 })
      } else {
        gsap.set(panel, { opacity: 1, y: 0 })
        gsap.set(cards, { opacity: 1, y: 0 })
      }
    } else {
      const panel = work.querySelector('#experiencia') as HTMLElement | null
      const items = panel?.querySelectorAll('.xp li') ?? []
      if (!panel) return

      if (this.animationsEnabled) {
        gsap.set(panel, { opacity: 0, y: 8 })
        gsap.to(panel, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })

        if (items.length) {
          gsap.set(items, { opacity: 0, x: -8 })
          gsap.to(items, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out', stagger: 0.06 })
        }
      } else {
        gsap.set(panel, { opacity: 1, y: 0 })
        if (items.length) {
          gsap.set(items, { opacity: 1, x: 0 })
        }
      }
    }
  }

  private unanimateWorkTab(tab: PortfolioTab, element?: HTMLElement): void {
    const work = this.getWorkRoot(element)
    if (!work) return

    const panel = work.querySelector(tab === 'proyectos' ? '#proyectos' : '#experiencia') as HTMLElement | null
    if (!panel) return

    this.animationsEnabled
      ? gsap.to(panel, { opacity: 0, y: 8, duration: 0.35, ease: 'power2.inOut' })
      : gsap.set(panel, { opacity: 0, y: 8 })
  }

  private getWorkRoot(element?: HTMLElement): HTMLElement | null {
    const root = element ?? this.portfolioEl ?? document.querySelector('[data-section="portfolio"]') as HTMLElement | null
    return root?.querySelector('.work') as HTMLElement | null
  }

  private getCardStep(): number {
    const el = this.carouselRef?.nativeElement
    const card = el?.querySelector('.card') as HTMLElement | null
    if (!el || !card) return window.innerWidth * 0.8
    const styles = getComputedStyle(el)
    const gap = parseFloat(styles.columnGap || styles.gap || '16')
    return card.getBoundingClientRect().width + gap
  }

  public carouselNext(): void {
    const el = this.carouselRef?.nativeElement
    if (!el) return
    const step = this.getCardStep()
    if (this.animationsEnabled) {
      gsap.to(el, { 
        scrollLeft: el.scrollLeft + step, 
        duration: 0.5, 
        ease: 'power2.out',
        onComplete: () => this.updateCarouselButtons()
      })
      return
    }

    el.scrollLeft += step
    this.updateCarouselButtons()
  }

  public carouselPrev(): void {
    const el = this.carouselRef?.nativeElement
    if (!el) return
    const step = this.getCardStep()
    if (this.animationsEnabled) {
      gsap.to(el, { 
        scrollLeft: el.scrollLeft - step, 
        duration: 0.5, 
        ease: 'power2.out',
        onComplete: () => this.updateCarouselButtons()
      })
      return
    }

    el.scrollLeft -= step
    this.updateCarouselButtons()
  }

  private updateCarouselButtons(): void {
    const el = this.carouselRef?.nativeElement
    if (!el) return
    
    // Check if at start
    this.canScrollCarouselPrev = el.scrollLeft > 10
    
    // Check if at end
    const maxScroll = el.scrollWidth - el.clientWidth
    this.canScrollCarouselNext = el.scrollLeft < maxScroll - 10
  }

  private animateContact(element: HTMLElement) {
    const root = element.querySelector('.contact') as HTMLElement | null
    if (!root) return

    if (!this.animationsEnabled) {
      gsap.set(root, { opacity: 1, y: 0 })
      return
    }

    gsap.set(root, { opacity: 0, y: 12 })
    gsap.to(root, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
  }

  private unanimateContact(element: HTMLElement) {
    const root = element.querySelector('.contact') as HTMLElement | null
    if (!root) return
    this.animationsEnabled
      ? gsap.to(root, { opacity: 0, y: 12, duration: 0.4, ease: 'power2.inOut' })
      : gsap.set(root, { opacity: 0, y: 12 })
  }

  
  scrollToSection(sectionName: string) {
    const targetSection = this.sectionNavigationService.findSectionByName(sectionName)

    if (targetSection) {
      targetSection.scrollIntoView({ behavior: this.performanceConfig.getScrollBehavior(), inline: 'start' })
    }
  }

  scrollToNext() {
    const container = this.scrollContainer.nativeElement
    const nextPanel = this.sectionNavigationService.getNextSection()

    if (nextPanel) {
      const offsetLeft = nextPanel.offsetLeft

      container.scrollTo({
        left: offsetLeft,
        behavior: this.performanceConfig.getScrollBehavior()
      })
    }
  }

  scrollToPrev() {
    const container = this.scrollContainer.nativeElement
    const prevPanel = this.sectionNavigationService.getPrevSection()

    if (prevPanel) {
      const offsetLeft = prevPanel.offsetLeft

      container.scrollTo({
        left: offsetLeft,
        behavior: this.performanceConfig.getScrollBehavior()
      })
    }
  }

  isFirstSection(): boolean {
    return this.sectionNavigationService.isFirstSection()
  }

  isLastSection(): boolean {
    return this.sectionNavigationService.isLastSection()
  }

  // Send message via backend
  public sendMessage(ev: Event) {
    ev.preventDefault()
    const form = ev.target as HTMLFormElement
    this.contactService.submitForm(form)
  }

  // Form validation
  isFormValid(): boolean {
    return this.contactService.isFormValid()
  }

  // Update form values and clean spaces
  updateName(value: string) {
    this.contactService.updateName(value)
  }

  updateEmail(value: string) {
    this.contactService.updateEmail(value)
  }

  updateMessage(value: string) {
    this.contactService.updateMessage(value)
  }

  // Copy text to clipboard
  public copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Successfully copied
    }).catch(err => {
      // Copy error
    })
  }
}
