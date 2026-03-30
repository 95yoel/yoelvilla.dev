import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Language } from '../../../translations/services/translation.service';
import { BlogArticleSummary } from '../../blog/models/blog-article.model';
import {
  ExploreWorkerDataset,
  ExploreWorkerSelectionResult,
  applyExploreSelection,
  buildExploreWorkerDataset
} from '../utils/explore-analytics.utils';

interface PendingRequest {
  type: 'prepare-dataset' | 'apply-selection';
  resolve: (value: ExploreWorkerDataset | ExploreWorkerSelectionResult) => void;
  reject: (reason?: unknown) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ExploreAnalyticsWorkerService {
  private readonly platformId = inject(PLATFORM_ID);
  private worker: Worker | null = null;
  private requestId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly fallbackDatasetCache = new Map<Language, ExploreWorkerDataset>();

  async prepareDataset(lang: Language, articles: BlogArticleSummary[]): Promise<ExploreWorkerDataset> {
    const worker = this.getWorker();
    if (!worker) {
      const dataset = buildExploreWorkerDataset(lang, articles);
      this.fallbackDatasetCache.set(lang, dataset);
      return dataset;
    }

    return this.sendRequest<ExploreWorkerDataset>(worker, {
      type: 'prepare-dataset',
      lang,
      articles
    });
  }

  async applySelection(lang: Language, selectedTags: string[]): Promise<ExploreWorkerSelectionResult> {
    const worker = this.getWorker();
    if (!worker) {
      const dataset = this.fallbackDatasetCache.get(lang);
      if (!dataset) {
        throw new Error(`Explore dataset for ${lang} is not ready`);
      }

      return applyExploreSelection(dataset, selectedTags);
    }

    return this.sendRequest<ExploreWorkerSelectionResult>(worker, {
      type: 'apply-selection',
      lang,
      selectedTags
    });
  }

  clearFallbackCache(): void {
    this.fallbackDatasetCache.clear();
  }

  private sendRequest<T>(
    worker: Worker,
    payload: Omit<{ requestId: number } & Record<string, unknown>, 'requestId'>
  ): Promise<T> {
    const requestId = ++this.requestId;

    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        type: payload['type'] as PendingRequest['type'],
        resolve: resolve as (value: ExploreWorkerDataset | ExploreWorkerSelectionResult) => void,
        reject
      });
      worker.postMessage({
        requestId,
        ...payload
      });
    });
  }

  private getWorker(): Worker | null {
    if (!isPlatformBrowser(this.platformId) || typeof Worker === 'undefined') {
      return null;
    }

    if (this.worker) {
      return this.worker;
    }

    this.worker = new Worker(new URL('./explore-analytics.worker', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', ({ data }: MessageEvent<{ requestId: number; type: string; dataset?: ExploreWorkerDataset; result?: ExploreWorkerSelectionResult; message?: string }>) => {
      const pending = this.pending.get(data.requestId);
      if (!pending) {
        return;
      }

      this.pending.delete(data.requestId);

      if (data.type === 'error') {
        pending.reject(new Error(data.message || 'Unknown explore worker error'));
        return;
      }

      if (pending.type === 'prepare-dataset' && data.dataset) {
        pending.resolve(data.dataset);
        return;
      }

      if (pending.type === 'apply-selection' && data.result) {
        pending.resolve(data.result);
        return;
      }

      pending.reject(new Error('Explore worker returned an unexpected response'));
    });

    this.worker.addEventListener('error', (error) => {
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
      this.worker?.terminate();
      this.worker = null;
    });

    return this.worker;
  }
}
