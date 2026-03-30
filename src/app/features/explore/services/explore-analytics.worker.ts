/// <reference lib="webworker" />

import { Language } from '../../../translations/services/translation.service';
import { BlogArticleSummary } from '../../blog/models/blog-article.model';
import {
  ExploreWorkerDataset,
  ExploreWorkerSelectionResult,
  applyExploreSelection,
  buildExploreWorkerDataset
} from '../utils/explore-analytics.utils';

type ExploreWorkerRequest =
  | {
      requestId: number;
      type: 'prepare-dataset';
      lang: Language;
      articles: BlogArticleSummary[];
    }
  | {
      requestId: number;
      type: 'apply-selection';
      lang: Language;
      selectedTags: string[];
    };

type ExploreWorkerResponse =
  | {
      requestId: number;
      type: 'prepare-dataset';
      dataset: ExploreWorkerDataset;
    }
  | {
      requestId: number;
      type: 'apply-selection';
      result: ExploreWorkerSelectionResult;
    }
  | {
      requestId: number;
      type: 'error';
      message: string;
    };

const datasetCache = new Map<Language, ExploreWorkerDataset>();

addEventListener('message', ({ data }: MessageEvent<ExploreWorkerRequest>) => {
  try {
    if (data.type === 'prepare-dataset') {
      const dataset = buildExploreWorkerDataset(data.lang, data.articles);
      datasetCache.set(data.lang, dataset);
      const response: ExploreWorkerResponse = {
        requestId: data.requestId,
        type: 'prepare-dataset',
        dataset
      };
      postMessage(response);
      return;
    }

    const dataset = datasetCache.get(data.lang);
    if (!dataset) {
      const response: ExploreWorkerResponse = {
        requestId: data.requestId,
        type: 'error',
        message: `Explore dataset for ${data.lang} is not ready`
      };
      postMessage(response);
      return;
    }

    const result = applyExploreSelection(dataset, data.selectedTags);
    const response: ExploreWorkerResponse = {
      requestId: data.requestId,
      type: 'apply-selection',
      result
    };
    postMessage(response);
  } catch (error) {
    const response: ExploreWorkerResponse = {
      requestId: data.requestId,
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown explore worker error'
    };
    postMessage(response);
  }
});
