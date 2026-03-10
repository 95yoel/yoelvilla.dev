import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, shareReplay, tap } from 'rxjs';
import { marked } from 'marked';
import { environment } from '../../../../environments/environment';
import { Language } from '../../../translations/services/translation.service';
import { BlogArticle, BlogArticleSummary } from '../models/blog-article.model';

interface FrontmatterData {
  title?: string;
  description?: string;
  date?: string;
  tags?: string[];
  coverImage?: string;
  published?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private readonly http = inject(HttpClient);
  private readonly articleCache = new Map<string, Observable<BlogArticle>>();
  private readonly indexCache = new Map<Language, Observable<BlogArticleSummary[]>>();
  private readonly lastArticleKey = 'blog-last-article';
  private readonly lastLanguageKey = 'blog-last-language';
  // Future extension point: mirror hot articles into IndexedDB without changing the service contract.
  private readonly blogBaseUrl = environment.BLOG_BASE_URL.replace(/\/+$/, '');

  getIndex(lang: Language): Observable<BlogArticleSummary[]> {
    const cached = this.indexCache.get(lang);
    if (cached) {
      return cached;
    }

    const request = this.http.get<unknown>(this.resolvePath('index.json')).pipe(
      map((payload) => this.normalizeIndexPayload(payload, lang)),
      tap(() => this.storeLastLanguage(lang)),
      shareReplay(1)
    );

    this.indexCache.set(lang, request);
    return request;
  }

  getArticle(slug: string, lang: Language): Observable<BlogArticle> {
    const cacheKey = `${lang}:${slug}`;
    const cached = this.articleCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const request = forkJoin({
      index: this.getIndex(lang),
      markdown: this.http.get(this.resolvePath(`articles/${lang}/${slug}.md`), { responseType: 'text' })
    }).pipe(
      map(({ index, markdown }) => this.toArticle(index, markdown, slug, lang)),
      tap(() => {
        this.storeLastArticle(slug);
        this.storeLastLanguage(lang);
      }),
      shareReplay(1)
    );

    this.articleCache.set(cacheKey, request);
    return request;
  }

  getLastOpenedSlug(): string | null {
    return localStorage.getItem(this.lastArticleKey);
  }

  getLastLanguage(): Language | null {
    const value = localStorage.getItem(this.lastLanguageKey);
    return value === 'es' || value === 'en' ? value : null;
  }

  clearCaches(): void {
    this.indexCache.clear();
    this.articleCache.clear();
  }

  private toArticle(index: BlogArticleSummary[], markdown: string, slug: string, lang: Language): BlogArticle {
    const { body, frontmatter } = this.extractFrontmatter(markdown);
    const fromIndex = index.find((article) => article.slug === slug);

    if (!body.trim() && !fromIndex) {
      throw new Error(`Blog article ${slug} not found`);
    }

    const summary: BlogArticleSummary = {
      slug,
      lang,
      title: fromIndex?.title || frontmatter.title || slug,
      description: fromIndex?.description || frontmatter.description || '',
      date: fromIndex?.date || frontmatter.date || '',
      tags: fromIndex?.tags?.length ? fromIndex.tags : (frontmatter.tags || []),
      coverImage: fromIndex?.coverImage || frontmatter.coverImage,
      published: fromIndex?.published ?? frontmatter.published ?? true
    };

    return {
      ...summary,
      markdown: body,
      html: marked.parse(body) as string
    };
  }

  private normalizeIndexPayload(payload: unknown, lang: Language): BlogArticleSummary[] {
    return this.unwrapEntries(payload)
      .map((entry) => this.normalizeSummary(entry, lang))
      .filter((entry): entry is BlogArticleSummary => !!entry)
      .filter((entry) => entry.published !== false)
      .filter((entry) => entry.lang === lang)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  private unwrapEntries(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const data = payload as Record<string, unknown>;
      if (Array.isArray(data['articles'])) {
        return data['articles'];
      }
      if (Array.isArray(data['items'])) {
        return data['items'];
      }
    }

    return [];
  }

  private normalizeSummary(value: unknown, fallbackLang: Language): BlogArticleSummary | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const entry = value as Record<string, unknown>;
    const slug = this.toStringValue(entry['slug']);
    if (!slug) {
      return null;
    }

    return {
      slug,
      title: this.toStringValue(entry['title']) || slug,
      description: this.toStringValue(entry['description']) || '',
      date: this.toStringValue(entry['date']) || '',
      lang: this.toLanguage(entry['lang']) || fallbackLang,
      tags: this.toStringArray(entry['tags']),
      coverImage: this.toStringValue(entry['coverImage']) || undefined,
      published: entry['published'] !== false
    };
  }

  private extractFrontmatter(markdown: string): { frontmatter: FrontmatterData; body: string } {
    if (!markdown.startsWith('---')) {
      return { frontmatter: {}, body: markdown };
    }

    const lines = markdown.split('\n');
    const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (endIndex === -1) {
      return { frontmatter: {}, body: markdown };
    }

    const parsed: FrontmatterData = {};

    for (const line of lines.slice(1, endIndex)) {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();

      switch (key) {
        case 'title':
        case 'description':
        case 'date':
        case 'coverImage':
          parsed[key] = this.cleanScalar(rawValue);
          break;
        case 'published':
          parsed.published = rawValue.toLowerCase() !== 'false';
          break;
        case 'tags':
          parsed.tags = this.parseTags(rawValue);
          break;
      }
    }

    return {
      frontmatter: parsed,
      body: lines.slice(endIndex + 1).join('\n').trim()
    };
  }

  private parseTags(rawValue: string): string[] {
    const value = this.cleanScalar(rawValue);
    if (!value) {
      return [];
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      return value
        .slice(1, -1)
        .split(',')
        .map((tag) => this.cleanScalar(tag))
        .filter(Boolean);
    }

    return value
      .split(',')
      .map((tag) => this.cleanScalar(tag))
      .filter(Boolean);
  }

  private cleanScalar(value: string): string {
    return value.replace(/^['"]|['"]$/g, '').trim();
  }

  private resolvePath(path: string): string {
    return `${this.blogBaseUrl}/${path.replace(/^\/+/, '')}`;
  }

  private storeLastArticle(slug: string): void {
    localStorage.setItem(this.lastArticleKey, slug);
  }

  private storeLastLanguage(lang: Language): void {
    localStorage.setItem(this.lastLanguageKey, lang);
  }

  private toStringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private toLanguage(value: unknown): Language | null {
    return value === 'es' || value === 'en' ? value : null;
  }
}
