import { Language } from '../../../translations/services/translation.service';

export interface BlogArticleSummary {
  slug: string;
  sourceSlug: string;
  title: string;
  description: string;
  date: string;
  lang: Language;
  tags: string[];
  coverImage?: string;
  published: boolean;
}

export interface BlogArticle extends BlogArticleSummary {
  markdown: string;
  html: string;
  readingTimeMinutes: number;
}

export type BlogGraphRelationType = 'domain' | 'technology' | 'topic' | 'context' | 'mixed';

export interface BlogGraphShared {
  domain: string[];
  technology: string[];
  topic: string[];
  context: string[];
}

export interface BlogGraphRelation {
  source: string;
  target: string;
  score: number;
  label: string;
  dominantType: BlogGraphRelationType;
  shared: BlogGraphShared;
}

export interface BlogGraphArticleNode extends BlogArticleSummary {
  summary: string;
}

export interface BlogArticleGraphData {
  minScore: number;
  maxRelated: number;
  articlesBySlug: Record<string, BlogGraphArticleNode>;
  edges: BlogGraphRelation[];
  relatedBySlug: Record<string, BlogGraphRelation[]>;
}
