import { AfterViewInit, Component, ElementRef, EventEmitter, Output, QueryList, ViewChild, ViewChildren, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../translations/pipes/translate.pipe';
import { ContactService } from '../../services/contact.service';
import { PortfolioService, PortfolioTab } from '../../services/portfolio.service';
import { RouterLink } from '@angular/router';
import { BlogRoutingService } from '../../features/blog/services/blog-routing.service';
import { TranslationService } from '../../translations/services/translation.service';

@Component({
  selector: 'villayoel-mobile',
  imports: [CommonModule, FormsModule, MatTooltipModule, TranslatePipe, RouterLink],
  templateUrl: './mobile-layout.component.html',
  styleUrl: './mobile-layout.component.css'
})
export class MobileLayoutComponent implements AfterViewInit {
  @Output() openLanguagePanel = new EventEmitter<void>();
  @ViewChild('mobileScrollContainer') mobileScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChildren('mobileSection') mobileSections?: QueryList<ElementRef<HTMLElement>>;
  
  showScrollTopButton = false
  
  private contactService = inject(ContactService)
  private portfolioService = inject(PortfolioService)
  private translationService = inject(TranslationService)
  private blogRoutingService = inject(BlogRoutingService)

  get activeTab(): PortfolioTab {
    return this.portfolioService.snapshot.activeTab
  }

  set activeTab(tab: PortfolioTab) {
    this.portfolioService.setActiveTab(tab)
  }

  get currentProjectIndex(): number {
    return this.portfolioService.snapshot.currentProjectIndex
  }

  get totalProjects(): number {
    return this.portfolioService.snapshot.totalProjects
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

  get blogIndexLink(): string[] {
    return this.blogRoutingService.buildIndexLink(this.translationService.getCurrentLanguage())
  }

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
    this.portfolioService.nextProject()
  }

  prevProject() {
    this.portfolioService.prevProject()
  }

  canGoNext(): boolean {
    return this.portfolioService.canGoNext()
  }

  canGoPrev(): boolean {
    return this.portfolioService.canGoPrev()
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
