import { Component, ElementRef, HostListener, QueryList, ViewChild, ViewChildren, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import gsap from 'gsap';
import { ScrollBtnComponent } from '../shared/scroll-btn/scroll-btn.component';
import { CustomCursorComponent } from '../shared/custom-cursor/custom-cursor.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../translations/pipes/translate.pipe';
import { TranslationService } from '../../translations/services/translation.service';
import { environment } from '../../../environments/environment';

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

  public activeWorkTab: 'proyectos' | 'experiencia' = 'proyectos'
  private lastWorkTab: 'proyectos' | 'experiencia' = 'proyectos'

  private portfolioEl?: HTMLElement
  private isScrolling = false
  private translationService = inject(TranslationService)
  private http = inject(HttpClient)
  
  // Track current section
  currentSectionIndex = 0

  // Carousel navigation state
  canScrollCarouselNext = false
  canScrollCarouselPrev = false

  // Form validation
  contactName = ''
  contactEmail = ''
  contactMessage = ''

  // Feedback state
  showFeedback = false
  feedbackMessage = ''
  feedbackType: 'success' | 'error' = 'success'
  isSending = false

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
      behavior: 'smooth'
    })

    setTimeout(() => {
      this.isScrolling = false
    }, 250)
  }

  ngAfterViewInit(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const section = entry.target as HTMLElement
          const sectionName = section.dataset['section'] || ''

          if (entry.isIntersecting) {
            this.handleSectionChange(sectionName, section)
          } else {
            this.handleSectionLeave(sectionName, section)
          }
        })
      },
      {
        root: null,
        threshold: 0.5,
      }
    )

    this.panels.forEach((panel) => {
      observer.observe(panel.nativeElement)
    })

    // Initialize carousel buttons state
    setTimeout(() => this.updateCarouselButtons(), 100)
  }

  private handleSectionChange(sectionName: string, element: HTMLElement) {
    const navItem = document.querySelector(`nav li[data-nav="${sectionName}"]`)
    if (navItem) {
      navItem.classList.add('active')
    }
    
    // Update current section index
    const panelsArray = this.panels.toArray()
    this.currentSectionIndex = panelsArray.findIndex(p => p.nativeElement === element)

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
        if (!this.activeWorkTab) this.activeWorkTab = 'proyectos'
        const work = this.getWorkRoot(element)
        if (work) {
          gsap.set(work, { opacity: 0, y: 12 })
          gsap.to(work, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
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
        if (work) gsap.to(work, { opacity: 0, y: 12, duration: 0.4, ease: 'power2.inOut' })
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

    gsap.set(title, { opacity: 0, y: -500 })
    gsap.set(subtitle, { opacity: 0, y: 500 })

    gsap.to(title, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' })
    gsap.to(subtitle, { opacity: 1, y: 0, duration: 1.2, delay: 0.2, ease: 'power2.out' })
  }

  private unanimateTitle(element: HTMLElement) {
    const title = element.querySelector('.title')
    const subtitle = element.querySelector('.subtitle')

    if (title) {
      gsap.to(title, { opacity: 0, duration: 0.5, ease: 'power2.inOut' })
    }

    if (subtitle) {
      gsap.to(subtitle, { opacity: 0, y: 60, duration: 0.5, ease: 'power2.inOut' })
    }
  }

  private animateAbout(element: HTMLElement) {
    const aboutText = element.querySelector('.about')

    if (!aboutText) return

    gsap.set(aboutText, { opacity: 0, y: -50 })

    gsap.to(aboutText, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
  }

  private unanimateAbout(element: HTMLElement) {
    const aboutText = element.querySelector('.about')

    if (aboutText) {
      gsap.to(aboutText, { opacity: 0, y: -50, duration: 0.5, ease: 'power2.inOut' })
    }
  }

  public switchWorkTab(tab: 'proyectos' | 'experiencia'): void {
    if (this.activeWorkTab === tab) return

    this.unanimateWorkTab(this.activeWorkTab, this.portfolioEl)

    this.lastWorkTab = this.activeWorkTab
    this.activeWorkTab = tab

    queueMicrotask(() => this.animateWorkTab(tab, this.portfolioEl))
  }

  private animateWorkTab(tab: 'proyectos' | 'experiencia', element?: HTMLElement): void {
    const work = this.getWorkRoot(element)
    if (!work) return

    gsap.killTweensOf(work.querySelectorAll('*'))

    if (tab === 'proyectos') {
      const panel = work.querySelector('#proyectos') as HTMLElement | null
      const cards = panel?.querySelectorAll('.card') ?? []
      if (!panel || !cards.length) return

      gsap.set(panel, { opacity: 0, y: 8 })
      gsap.to(panel, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })

      gsap.set(cards, { opacity: 0, y: 10 })
      gsap.to(cards, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.08 })
    } else {
      const panel = work.querySelector('#experiencia') as HTMLElement | null
      const items = panel?.querySelectorAll('.xp li') ?? []
      if (!panel) return

      gsap.set(panel, { opacity: 0, y: 8 })
      gsap.to(panel, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })

      if (items.length) {
        gsap.set(items, { opacity: 0, x: -8 })
        gsap.to(items, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out', stagger: 0.06 })
      }
    }
  }

  private unanimateWorkTab(tab: 'proyectos' | 'experiencia', element?: HTMLElement): void {
    const work = this.getWorkRoot(element)
    if (!work) return

    const panel = work.querySelector(tab === 'proyectos' ? '#proyectos' : '#experiencia') as HTMLElement | null
    if (!panel) return

    gsap.to(panel, { opacity: 0, y: 8, duration: 0.35, ease: 'power2.inOut' })
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
    gsap.to(el, { 
      scrollLeft: el.scrollLeft + step, 
      duration: 0.5, 
      ease: 'power2.out',
      onComplete: () => this.updateCarouselButtons()
    })
  }

  public carouselPrev(): void {
    const el = this.carouselRef?.nativeElement
    if (!el) return
    const step = this.getCardStep()
    gsap.to(el, { 
      scrollLeft: el.scrollLeft - step, 
      duration: 0.5, 
      ease: 'power2.out',
      onComplete: () => this.updateCarouselButtons()
    })
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

    gsap.set(root, { opacity: 0, y: 12 })
    gsap.to(root, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
  }

  private unanimateContact(element: HTMLElement) {
    const root = element.querySelector('.contact') as HTMLElement | null
    if (!root) return
    gsap.to(root, { opacity: 0, y: 12, duration: 0.4, ease: 'power2.inOut' })
  }

  
  scrollToSection(sectionName: string) {
    const targetSection = this.panels.find(ref =>
      ref.nativeElement.dataset.section === sectionName
    )

    if (targetSection) {
      targetSection.nativeElement.scrollIntoView({ behavior: 'smooth', inline: 'start' })
    }
  }

  scrollToNext() {
    const panelsArray = this.panels.toArray()
    const container = this.scrollContainer.nativeElement

    const currentScroll = container.scrollLeft
    const screenWidth = window.innerWidth

    const currentIndex = Math.round(currentScroll / screenWidth)
    const nextPanel = panelsArray[currentIndex + 1]

    if (nextPanel) {
      const offsetLeft = nextPanel.nativeElement.offsetLeft

      container.scrollTo({
        left: offsetLeft,
        behavior: 'smooth'
      })
    }
  }

  scrollToPrev() {
    const panelsArray = this.panels.toArray()
    const container = this.scrollContainer.nativeElement

    const currentScroll = container.scrollLeft
    const screenWidth = window.innerWidth

    const currentIndex = Math.round(currentScroll / screenWidth)
    const prevPanel = panelsArray[currentIndex - 1]

    if (prevPanel) {
      const offsetLeft = prevPanel.nativeElement.offsetLeft

      container.scrollTo({
        left: offsetLeft,
        behavior: 'smooth'
      })
    }
  }

  isFirstSection(): boolean {
    return this.currentSectionIndex === 0
  }

  isLastSection(): boolean {
    const panelsArray = this.panels?.toArray()
    if (!panelsArray) return false
    return this.currentSectionIndex >= panelsArray.length - 1
  }

  // Send message via backend
  public sendMessage(ev: Event) {
    ev.preventDefault()

    const form = ev.target as HTMLFormElement
    const data = new FormData(form)
    
    // Bot detection: if honeypot has value, it's a bot
    const honeypotValue = (data.get('hp_field') || '').toString().trim()
    if (honeypotValue.length > 0) {
      return
    }

    const name = (data.get('name') || '').toString().trim()
    const email = (data.get('email') || '').toString().trim()
    const message = (data.get('message') || '').toString().trim()

    // Capture current language
    const currentLang = this.translationService.getCurrentLanguage()

    // Create payload for backend
    const payload = {
      name,
      email,
      message,
      lang: currentLang
    }

    // Activate sending state
    this.isSending = true

    // HTTP call to backend
    const apiUrl = `${environment.CONTACT_API}${environment.CONTACT_ENDPOINT}`

    this.http.post(apiUrl, payload).subscribe({
      next: (response) => {
        this.isSending = false
        this.feedbackType = 'success'
        this.feedbackMessage = this.translationService.translate('contact.feedback.success')
        this.showFeedback = true

        // Clear form
        this.contactName = ''
        this.contactEmail = ''
        this.contactMessage = ''

        // Hide after 3 seconds
        setTimeout(() => {
          this.showFeedback = false
        }, 3000)
      },
      error: (error) => {
        this.isSending = false
        this.feedbackType = 'error'
        this.feedbackMessage = this.translationService.translate('contact.feedback.error')
        this.showFeedback = true

        setTimeout(() => {
          this.showFeedback = false
        }, 3000)
      }
    })
  }

  // Form validation
  isFormValid(): boolean {
    const name = this.contactName.trim()
    const email = this.contactEmail.trim()
    const message = this.contactMessage.trim()

    // Name: minimum 2 characters
    if (name.length < 2) return false

    // Email: not empty and valid format
    if (!email || !this.isValidEmail(email)) return false

    // Message: minimum 3 characters
    if (message.length < 3) return false

    return true
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Update form values and clean spaces
  updateName(event: Event) {
    const input = event.target as HTMLInputElement
    this.contactName = input.value
  }

  updateEmail(event: Event) {
    const input = event.target as HTMLInputElement
    this.contactEmail = input.value
  }

  updateMessage(event: Event) {
    const textarea = event.target as HTMLTextAreaElement
    this.contactMessage = textarea.value
  }

  // Copy text to clipboard
  public copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Successfully copied
    }).catch(err => {
      // Copy error
    })
  }

  t(key: string): string {
    return this.translationService.translate(key)
  }

}
