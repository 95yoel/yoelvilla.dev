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

interface DesktopSectionCache {
  navItem?: HTMLElement;
  title?: HTMLElement;
  subtitle?: HTMLElement;
  aboutText?: HTMLElement;
  contactRoot?: HTMLElement;
  workRoot?: HTMLElement;
  projectsPanel?: HTMLElement;
  projectCards: HTMLElement[];
  experiencePanel?: HTMLElement;
  experienceItems: HTMLElement[];
}

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
  private carouselStep = window.innerWidth * 0.8
  private readonly sectionCache = new Map<string, DesktopSectionCache>()
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

  @HostListener('window:resize')
  onResize() {
    this.refreshCarouselMetrics()
    this.updateCarouselButtons()
  }

  ngAfterViewInit(): void {
    this.buildSectionCache()
    this.sectionNavigationService.registerSections(
      this.panels.toArray().map((panel) => panel.nativeElement as HTMLElement),
      {
        onSectionEnter: (sectionName, element) => this.handleSectionChange(sectionName, element),
        onSectionLeave: (sectionName, element) => this.handleSectionLeave(sectionName, element)
      },
      {
        root: this.scrollContainer.nativeElement,
        threshold: 0.55
      }
    )

    const initialSection = this.panels.first?.nativeElement as HTMLElement | undefined
    if (initialSection) {
      const initialSectionName = initialSection.dataset['section'] || 'home'
      this.handleSectionChange(initialSectionName, initialSection)
    }

    setTimeout(() => {
      this.refreshCarouselMetrics()
      this.updateCarouselButtons()
    }, 100)
  }

  ngOnDestroy(): void {
    this.sectionNavigationService.disconnect()
  }

  private handleSectionChange(sectionName: string, element: HTMLElement) {
    const cache = this.getSectionCache(sectionName, element)
    const navItem = cache.navItem
    if (navItem) {
      navItem.classList.add('active')
    }
    switch (sectionName) {
      case 'home':
        element.classList.add('home-section')
        this.animateTitle(cache)
        break
      case 'about':
        element.classList.add('about-section')
        this.animateAbout(cache)
        break
      case 'portfolio':
        element.classList.add('portfolio-section')
        this.portfolioEl = element
        this.refreshCarouselMetrics()
        this.updateCarouselButtons()
        const work = cache.workRoot
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
        this.animateContact(cache)
        break
    }
  }

  private handleSectionLeave(sectionName: string, element: HTMLElement) {
    const cache = this.getSectionCache(sectionName, element)
    const navItem = cache.navItem
    if (navItem) {
      navItem.classList.remove('active')
    }

    switch (sectionName) {
      case 'home':
        this.unanimateTitle(cache)
        break
      case 'about':
        this.unanimateAbout(cache)
        break
      case 'portfolio':
        this.unanimateWorkTab(this.activeWorkTab, cache)
        const work = cache.workRoot
        if (work) {
          if (this.animationsEnabled) {
            gsap.to(work, { opacity: 0, y: 12, duration: 0.4, ease: 'power2.inOut' })
          } else {
            gsap.set(work, { opacity: 0, y: 12 })
          }
        }
        break
      case 'contact':
        this.unanimateContact(cache)
        break
    }
  }

  private animateTitle(cache: DesktopSectionCache) {
    const title = cache.title
    const subtitle = cache.subtitle

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

  private unanimateTitle(cache: DesktopSectionCache) {
    const title = cache.title
    const subtitle = cache.subtitle

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

  private animateAbout(cache: DesktopSectionCache) {
    const aboutText = cache.aboutText

    if (!aboutText) return

    if (!this.animationsEnabled) {
      gsap.set(aboutText, { opacity: 1, y: 0 })
      return
    }

    gsap.set(aboutText, { opacity: 0, y: -50 })

    gsap.to(aboutText, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
  }

  private unanimateAbout(cache: DesktopSectionCache) {
    const aboutText = cache.aboutText

    if (aboutText) {
      this.animationsEnabled
        ? gsap.to(aboutText, { opacity: 0, y: -50, duration: 0.5, ease: 'power2.inOut' })
        : gsap.set(aboutText, { opacity: 0, y: -50 })
    }
  }

  public switchWorkTab(tab: PortfolioTab): void {
    if (this.activeWorkTab === tab) return

    this.unanimateWorkTab(this.activeWorkTab, this.getWorkSectionCache())

    this.lastWorkTab = this.activeWorkTab
    this.activeWorkTab = tab

    queueMicrotask(() => this.animateWorkTab(tab, this.portfolioEl))
  }

  private animateWorkTab(tab: PortfolioTab, element?: HTMLElement): void {
    const cache = this.getWorkSectionCache(element)
    const work = cache.workRoot
    if (!work) return

    gsap.killTweensOf([
      ...(cache.projectCards || []),
      ...(cache.experienceItems || []),
      cache.projectsPanel,
      cache.experiencePanel
    ].filter(Boolean))

    if (tab === 'proyectos') {
      const panel = cache.projectsPanel
      const cards = cache.projectCards
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
      const panel = cache.experiencePanel
      const items = cache.experienceItems
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

  private unanimateWorkTab(tab: PortfolioTab, cache?: DesktopSectionCache): void {
    const sectionCache = cache ?? this.getWorkSectionCache()
    const panel = tab === 'proyectos' ? sectionCache.projectsPanel : sectionCache.experiencePanel
    if (!panel) return

    this.animationsEnabled
      ? gsap.to(panel, { opacity: 0, y: 8, duration: 0.35, ease: 'power2.inOut' })
      : gsap.set(panel, { opacity: 0, y: 8 })
  }

  private getCardStep(): number {
    return this.carouselStep
  }

  public carouselNext(): void {
    const el = this.carouselRef?.nativeElement
    if (!el) return
    this.refreshCarouselMetrics()
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
    this.refreshCarouselMetrics()
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

  private animateContact(cache: DesktopSectionCache) {
    const root = cache.contactRoot
    if (!root) return

    if (!this.animationsEnabled) {
      gsap.set(root, { opacity: 1, y: 0 })
      return
    }

    gsap.set(root, { opacity: 0, y: 12 })
    gsap.to(root, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
  }

  private unanimateContact(cache: DesktopSectionCache) {
    const root = cache.contactRoot
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

  private buildSectionCache(): void {
    this.sectionCache.clear()

    for (const panelRef of this.panels.toArray()) {
      const panel = panelRef.nativeElement as HTMLElement
      const sectionName = panel.dataset['section'] || ''
      if (!sectionName) {
        continue
      }

      const workRoot = panel.querySelector('.work') as HTMLElement | null
      const projectsPanel = workRoot?.querySelector('#proyectos') as HTMLElement | null
      const experiencePanel = workRoot?.querySelector('#experiencia') as HTMLElement | null

      this.sectionCache.set(sectionName, {
        navItem: document.querySelector(`nav li[data-nav="${sectionName}"]`) as HTMLElement | null || undefined,
        title: panel.querySelector('.title') as HTMLElement | null || undefined,
        subtitle: panel.querySelector('.subtitle') as HTMLElement | null || undefined,
        aboutText: panel.querySelector('.about') as HTMLElement | null || undefined,
        contactRoot: panel.querySelector('.contact') as HTMLElement | null || undefined,
        workRoot: workRoot || undefined,
        projectsPanel: projectsPanel || undefined,
        projectCards: Array.from(projectsPanel?.querySelectorAll('.card') ?? []),
        experiencePanel: experiencePanel || undefined,
        experienceItems: Array.from(experiencePanel?.querySelectorAll('.xp li') ?? [])
      })
    }
  }

  private getSectionCache(sectionName: string, element?: HTMLElement): DesktopSectionCache {
    const cached = this.sectionCache.get(sectionName)
    if (cached) {
      return cached
    }

    const fallbackElement = element ?? this.sectionNavigationService.findSectionByName(sectionName)
    const workRoot = fallbackElement?.querySelector('.work') as HTMLElement | null
    const projectsPanel = workRoot?.querySelector('#proyectos') as HTMLElement | null
    const experiencePanel = workRoot?.querySelector('#experiencia') as HTMLElement | null

    return {
      navItem: document.querySelector(`nav li[data-nav="${sectionName}"]`) as HTMLElement | null || undefined,
      title: fallbackElement?.querySelector('.title') as HTMLElement | null || undefined,
      subtitle: fallbackElement?.querySelector('.subtitle') as HTMLElement | null || undefined,
      aboutText: fallbackElement?.querySelector('.about') as HTMLElement | null || undefined,
      contactRoot: fallbackElement?.querySelector('.contact') as HTMLElement | null || undefined,
      workRoot: workRoot || undefined,
      projectsPanel: projectsPanel || undefined,
      projectCards: Array.from(projectsPanel?.querySelectorAll('.card') ?? []),
      experiencePanel: experiencePanel || undefined,
      experienceItems: Array.from(experiencePanel?.querySelectorAll('.xp li') ?? [])
    }
  }

  private getWorkSectionCache(element?: HTMLElement): DesktopSectionCache {
    const sectionName = element?.dataset['section'] || this.portfolioEl?.dataset['section'] || 'portfolio'
    return this.getSectionCache(sectionName, element ?? this.portfolioEl)
  }

  private refreshCarouselMetrics(): void {
    const el = this.carouselRef?.nativeElement
    const firstCard = this.getWorkSectionCache().projectCards[0]
    if (!el || !firstCard) {
      this.carouselStep = window.innerWidth * 0.8
      return
    }

    const styles = getComputedStyle(el)
    const gap = parseFloat(styles.columnGap || styles.gap || '16')
    this.carouselStep = firstCard.getBoundingClientRect().width + gap
  }
}
