import { Language } from '../../../translations/services/translation.service';
import { BlogArticleSummary } from '../../blog/models/blog-article.model';

export interface TagAggregate {
  tag: string;
  count: number;
}

export interface TimelinePoint {
  time: string;
  value: number;
}

export interface ExploreWorkerDataset {
  lang: Language;
  articleOrder: string[];
  topTags: TagAggregate[];
  articlesByTag: Record<string, string[]>;
  timelineByTag: Record<string, TimelinePoint[]>;
}

export interface ExploreWorkerSelectionResult {
  topTags: TagAggregate[];
  normalizedSelectedTags: string[];
  activeTags: string[];
  filteredArticleSlugs: string[];
  timelineByTag: Record<string, TimelinePoint[]>;
}

export function buildExploreWorkerDataset(lang: Language, articles: BlogArticleSummary[]): ExploreWorkerDataset {
  const tagCounts = new Map<string, number>();
  const articlesByTag = new Map<string, string[]>();
  const articlesBySlug = new Map(articles.map((article) => [article.slug, article] as const));
  const articleMonths = articles
    .map((article) => toMonthStart(article.date))
    .filter((value): value is string => !!value)
    .sort();

  for (const article of articles) {
    for (const tag of article.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      const taggedArticles = articlesByTag.get(tag);
      if (taggedArticles) {
        taggedArticles.push(article.slug);
      } else {
        articlesByTag.set(tag, [article.slug]);
      }
    }
  }

  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, 10);
  const monthRange = articleMonths.length
    ? buildMonthRange(articleMonths[0], articleMonths[articleMonths.length - 1])
    : [];
  const timelineByTag: Record<string, TimelinePoint[]> = {};

  for (const entry of topTags) {
    const counts = new Map<string, number>();
    const taggedSlugs = articlesByTag.get(entry.tag) ?? [];

    for (const slug of taggedSlugs) {
      const article = articlesBySlug.get(slug);
      if (!article) {
        continue;
      }

      const monthKey = toMonthStart(article.date);
      if (!monthKey) {
        continue;
      }

      counts.set(monthKey, (counts.get(monthKey) || 0) + 1);
    }

    timelineByTag[entry.tag] = monthRange.map((monthKey) => ({
      time: monthKey,
      value: counts.get(monthKey) || 0
    }));
  }

  return {
    lang,
    articleOrder: articles.map((article) => article.slug),
    topTags,
    articlesByTag: Object.fromEntries(articlesByTag.entries()),
    timelineByTag
  };
}

export function applyExploreSelection(
  dataset: ExploreWorkerDataset,
  selectedTags: string[]
): ExploreWorkerSelectionResult {
  const topTagSet = new Set(dataset.topTags.map((entry) => entry.tag));
  const normalizedSelectedTags = selectedTags.filter((tag) => topTagSet.has(tag));
  const activeTags = normalizedSelectedTags.length
    ? normalizedSelectedTags
    : dataset.topTags.slice(0, Math.min(3, dataset.topTags.length)).map((entry) => entry.tag);

  if (!normalizedSelectedTags.length) {
    return {
      topTags: dataset.topTags,
      normalizedSelectedTags,
      activeTags,
      filteredArticleSlugs: dataset.articleOrder,
      timelineByTag: pickTimelineByTags(dataset.timelineByTag, activeTags)
    };
  }

  const matchingSlugs = new Set<string>();
  for (const tag of normalizedSelectedTags) {
    const taggedSlugs = dataset.articlesByTag[tag] ?? [];
    for (const slug of taggedSlugs) {
      matchingSlugs.add(slug);
    }
  }

  return {
    topTags: dataset.topTags,
    normalizedSelectedTags,
    activeTags,
    filteredArticleSlugs: dataset.articleOrder.filter((slug) => matchingSlugs.has(slug)),
    timelineByTag: pickTimelineByTags(dataset.timelineByTag, activeTags)
  };
}

function pickTimelineByTags(
  source: Record<string, TimelinePoint[]>,
  tags: string[]
): Record<string, TimelinePoint[]> {
  return tags.reduce<Record<string, TimelinePoint[]>>((acc, tag) => {
    acc[tag] = source[tag] ?? [];
    return acc;
  }, {});
}

function toMonthStart(value: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const utcDate = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), 1));

  return utcDate.toISOString().slice(0, 10);
}

function buildMonthRange(start: string, end: string): string[] {
  const range: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (cursor.getTime() <= last.getTime()) {
    range.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return range;
}
