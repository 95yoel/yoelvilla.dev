import { Language } from '../../../translations/services/translation.service';

export interface BlogArticleSummary {
  slug: string;
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
}
