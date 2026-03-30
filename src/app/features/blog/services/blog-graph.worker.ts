/// <reference lib="webworker" />

import { BlogArticleGraphData } from '../models/blog-article.model';
import { SerializedBlogGraphBuildResult, buildArticleGraphSnapshot } from '../utils/blog-graph.utils';

type BlogGraphWorkerRequest = {
  requestId: number;
  type: 'build-graph';
  graphData: BlogArticleGraphData;
  currentSlug: string;
  limit: number;
};

type BlogGraphWorkerResponse =
  | {
      requestId: number;
      type: 'build-graph';
      result: SerializedBlogGraphBuildResult | null;
    }
  | {
      requestId: number;
      type: 'error';
      message: string;
    };

addEventListener('message', ({ data }: MessageEvent<BlogGraphWorkerRequest>) => {
  try {
    const result = buildArticleGraphSnapshot(data.graphData, data.currentSlug, data.limit);
    const response: BlogGraphWorkerResponse = {
      requestId: data.requestId,
      type: 'build-graph',
      result
    };
    postMessage(response);
  } catch (error) {
    const response: BlogGraphWorkerResponse = {
      requestId: data.requestId,
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown blog graph worker error'
    };
    postMessage(response);
  }
});
