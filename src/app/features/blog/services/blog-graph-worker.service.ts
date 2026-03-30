import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BlogArticleGraphData } from '../models/blog-article.model';
import { SerializedBlogGraphBuildResult, buildArticleGraphSnapshot } from '../utils/blog-graph.utils';

@Injectable({
  providedIn: 'root'
})
export class BlogGraphWorkerService {
  private readonly platformId = inject(PLATFORM_ID);
  private worker: Worker | null = null;
  private requestId = 0;
  private readonly pending = new Map<number, {
    resolve: (value: SerializedBlogGraphBuildResult | null) => void;
    reject: (reason?: unknown) => void;
  }>();

  async buildGraph(
    graphData: BlogArticleGraphData,
    currentSlug: string,
    limit: number
  ): Promise<SerializedBlogGraphBuildResult | null> {
    const worker = this.getWorker();
    if (!worker) {
      return buildArticleGraphSnapshot(graphData, currentSlug, limit);
    }

    const requestId = ++this.requestId;

    return new Promise<SerializedBlogGraphBuildResult | null>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      worker.postMessage({
        requestId,
        type: 'build-graph',
        graphData,
        currentSlug,
        limit
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

    this.worker = new Worker(new URL('./blog-graph.worker', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', ({ data }: MessageEvent<{ requestId: number; type: string; result?: SerializedBlogGraphBuildResult | null; message?: string }>) => {
      const pending = this.pending.get(data.requestId);
      if (!pending) {
        return;
      }

      this.pending.delete(data.requestId);

      if (data.type === 'error') {
        pending.reject(new Error(data.message || 'Unknown blog graph worker error'));
        return;
      }

      pending.resolve(data.result ?? null);
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
