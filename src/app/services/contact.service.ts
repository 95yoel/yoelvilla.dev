import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { TranslationService } from '../translations/services/translation.service';

export type ContactFeedbackType = 'success' | 'error';

export interface ContactState {
  name: string;
  email: string;
  message: string;
  showFeedback: boolean;
  feedbackMessage: string;
  feedbackType: ContactFeedbackType;
  isSending: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private readonly http = inject(HttpClient);
  private readonly translationService = inject(TranslationService);

  private readonly initialState: ContactState = {
    name: '',
    email: '',
    message: '',
    showFeedback: false,
    feedbackMessage: '',
    feedbackType: 'success',
    isSending: false
  };

  private readonly stateSubject = new BehaviorSubject<ContactState>(this.initialState);
  readonly state$ = this.stateSubject.asObservable();

  private feedbackTimeoutId?: ReturnType<typeof setTimeout>;

  get snapshot(): ContactState {
    return this.stateSubject.value;
  }

  updateName(name: string): void {
    this.patchState({ name });
  }

  updateEmail(email: string): void {
    this.patchState({ email });
  }

  updateMessage(message: string): void {
    this.patchState({ message });
  }

  isFormValid(state: ContactState = this.snapshot): boolean {
    const name = state.name.trim();
    const email = state.email.trim();
    const message = state.message.trim();

    if (name.length < 2) return false;
    if (!email || !this.isValidEmail(email)) return false;
    if (message.length < 3) return false;

    return true;
  }

  submitForm(form: HTMLFormElement): void {
    const data = new FormData(form);

    const honeypotValue = (data.get('hp_field') || '').toString().trim();
    if (honeypotValue.length > 0) {
      return;
    }

    const name = (data.get('name') || '').toString().trim();
    const email = (data.get('email') || '').toString().trim();
    const message = (data.get('message') || '').toString().trim();

    this.patchState({
      name,
      email,
      message,
      isSending: true
    });

    const payload = {
      name,
      email,
      message,
      lang: this.translationService.getCurrentLanguage()
    };

    const apiUrl = `${environment.CONTACT_API}${environment.CONTACT_ENDPOINT}`;

    this.http.post(apiUrl, payload).subscribe({
      next: () => {
        this.patchState({
          name: '',
          email: '',
          message: '',
          isSending: false,
          feedbackType: 'success',
          feedbackMessage: this.translationService.translate('contact.feedback.success'),
          showFeedback: true
        });

        this.scheduleFeedbackHide();
      },
      error: () => {
        this.patchState({
          isSending: false,
          feedbackType: 'error',
          feedbackMessage: this.translationService.translate('contact.feedback.error'),
          showFeedback: true
        });

        this.scheduleFeedbackHide();
      }
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private scheduleFeedbackHide(): void {
    if (this.feedbackTimeoutId) {
      clearTimeout(this.feedbackTimeoutId);
    }

    this.feedbackTimeoutId = setTimeout(() => {
      this.patchState({ showFeedback: false });
    }, 3000);
  }

  private patchState(patch: Partial<ContactState>): void {
    this.stateSubject.next({
      ...this.snapshot,
      ...patch
    });
  }
}
