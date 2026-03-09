import { AfterViewInit, Component, ElementRef, EventEmitter, Output, QueryList, ViewChild, ViewChildren, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../translations/pipes/translate.pipe';
import { TranslationService } from '../../translations/services/translation.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'villayoel-mobile',
  imports: [CommonModule, FormsModule, MatTooltipModule, TranslatePipe],
  templateUrl: './mobile-layout.component.html',
  styleUrl: './mobile-layout.component.css'
})
export class MobileLayoutComponent implements AfterViewInit {
  @Output() openLanguagePanel = new EventEmitter<void>();
  @ViewChild('mobileScrollContainer') mobileScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChildren('mobileSection') mobileSections?: QueryList<ElementRef<HTMLElement>>;
  
  activeTab: 'proyectos' | 'experiencia' = 'proyectos'
  currentProjectIndex = 0
  totalProjects = 1 // Update to add more projects
  showScrollTopButton = false
  
  private translationService = inject(TranslationService)
  private http = inject(HttpClient)

  // Form validation
  contactName = ''
  contactEmail = ''
  contactMessage = ''

  // Feedback state
  showFeedback = false
  feedbackMessage = ''
  feedbackType: 'success' | 'error' = 'success'
  isSending = false

  ngAfterViewInit(): void {
    this.updateScrollTopButtonVisibility()
  }

  toggleLanguagePanel() {
    this.openLanguagePanel.emit()
  }

  onContainerScroll(): void {
    this.updateScrollTopButtonVisibility()
  }

  scrollToTop(): void {
    this.mobileScrollContainer?.nativeElement.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  private updateScrollTopButtonVisibility(): void {
    const container = this.mobileScrollContainer?.nativeElement
    const sections = this.mobileSections?.toArray() ?? []

    if (!container || sections.length < 2) {
      this.showScrollTopButton = false
      return
    }

    const viewportMidpoint = container.scrollTop + (container.clientHeight / 2)

    const currentSectionIndex = sections.findIndex((section, index) => {
      const element = section.nativeElement
      const start = element.offsetTop
      const end = index === sections.length - 1
        ? Number.POSITIVE_INFINITY
        : start + element.offsetHeight

      return viewportMidpoint >= start && viewportMidpoint < end
    })

    this.showScrollTopButton = currentSectionIndex > 0
  }

  nextProject() {
    if (this.currentProjectIndex < this.totalProjects - 1) {
      this.currentProjectIndex++
    }
  }

  prevProject() {
    if (this.currentProjectIndex > 0) {
      this.currentProjectIndex--
    }
  }

  canGoNext(): boolean {
    return this.currentProjectIndex < this.totalProjects - 1
  }

  canGoPrev(): boolean {
    return this.currentProjectIndex > 0
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

    // HTTP call to backend
    const apiUrl = `${environment.CONTACT_API}${environment.CONTACT_ENDPOINT}`

    this.http.post(apiUrl, payload).subscribe({
      next: (response) => {
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
}
