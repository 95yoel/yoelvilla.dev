import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Language } from '../../../translations/services/translation.service';
import { BlogArticle, BlogArticleGraphData, BlogArticleSummary, BlogGraphArticleNode, BlogGraphRelation, BlogGraphRelationType, BlogGraphShared } from '../models/blog-article.model';

interface FrontmatterData {
  title?: string;
  description?: string;
  date?: string;
  tags?: string[];
  coverImage?: string;
  published?: boolean;
}

interface LocalizedFields {
  [key: string]: unknown;
}

interface BlogIndexResource {
  articles: BlogArticleSummary[];
  graph: BlogArticleGraphData;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private readonly http = inject(HttpClient);
  private readonly articleCache = new Map<string, Observable<BlogArticle>>();
  private readonly indexCache = new Map<Language, Observable<BlogIndexResource>>();
  private readonly sessionIndexPrefix = 'blog-session-index:';
  private readonly sessionArticlePrefix = 'blog-session-article:';
  private readonly lastArticleKey = 'blog-last-article';
  private readonly lastLanguageKey = 'blog-last-language';
  // Future extension point: mirror hot articles into IndexedDB without changing the service contract.
  private readonly blogBaseUrl = environment.BLOG_BASE_URL.replace(/\/+$/, '');

  getIndex(lang: Language): Observable<BlogArticleSummary[]> {
    return this.getIndexResource(lang).pipe(map((resource) => resource.articles));
  }

  getGraphData(lang: Language): Observable<BlogArticleGraphData> {
    return this.getIndexResource(lang).pipe(map((resource) => resource.graph));
  }

  private getIndexResource(lang: Language): Observable<BlogIndexResource> {
    const cached = this.indexCache.get(lang);
    if (cached) {
      return cached;
    }

    const sessionCached = this.readSessionIndex(lang);
    if (sessionCached) {
      const sessionRequest = of(sessionCached).pipe(shareReplay(1));
      this.indexCache.set(lang, sessionRequest);
      return sessionRequest;
    }

    const request = this.http.get<unknown>(this.resolvePath('index.json')).pipe(
      map((payload) => this.normalizeIndexPayload(payload, lang)),
      tap((resource) => {
        this.storeSessionIndex(lang, resource);
        this.storeLastLanguage(lang);
      }),
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

    const sessionCached = this.readSessionArticle(cacheKey);
    if (sessionCached) {
      const sessionRequest = of(sessionCached).pipe(
        tap(() => {
          this.storeLastArticle(slug);
          this.storeLastLanguage(lang);
        }),
        shareReplay(1)
      );
      this.articleCache.set(cacheKey, sessionRequest);
      return sessionRequest;
    }

    const request = this.getIndex(lang).pipe(
      map((index) => ({
        index,
        article: index.find((entry) => entry.slug === slug)
      })),
      switchMap(({ index, article }) =>
        this.http.get(
          this.resolvePath(`articles/${lang}/${article?.sourceSlug || slug}.md`),
          { responseType: 'text' }
        ).pipe(
          map((markdown) => ({
            index,
            article,
            markdown
          })),
          switchMap(({ index, article, markdown }) => from(this.toArticle(index, markdown, slug, lang, article)))
        )
      ),
      tap((resolvedArticle) => {
        this.storeSessionArticle(cacheKey, resolvedArticle);
        this.storeLastArticle(slug);
        this.storeLastLanguage(lang);
      }),
      shareReplay(1)
    );

    this.articleCache.set(cacheKey, request);
    return request;
  }

  getLastOpenedSlug(): string | null {
    return this.readStorageValue('local', this.lastArticleKey);
  }

  getLastLanguage(): Language | null {
    const value = this.readStorageValue('local', this.lastLanguageKey);
    return value === 'es' || value === 'en' ? value : null;
  }

  clearCaches(options?: { lang?: Language; slug?: string }): void {
    const lang = options?.lang;
    const slug = options?.slug;

    if (!lang && !slug) {
      this.indexCache.clear();
      this.articleCache.clear();
      this.clearSessionEntriesByPrefix(this.sessionIndexPrefix);
      this.clearSessionEntriesByPrefix(this.sessionArticlePrefix);
      return;
    }

    if (lang) {
      this.indexCache.delete(lang);
      this.removeStorageValue('session', this.getSessionIndexKey(lang));
      for (const key of [...this.articleCache.keys()]) {
        if (key.startsWith(`${lang}:`)) {
          this.articleCache.delete(key);
          this.removeStorageValue('session', this.getSessionArticleKey(key));
        }
      }
    }

    if (lang && slug) {
      const cacheKey = `${lang}:${slug}`;
      this.articleCache.delete(cacheKey);
      this.removeStorageValue('session', this.getSessionArticleKey(cacheKey));
    }
  }

  private async toArticle(
    index: BlogArticleSummary[],
    markdown: string,
    slug: string,
    lang: Language,
    matchedArticle?: BlogArticleSummary
  ): Promise<BlogArticle> {
    const { body, frontmatter } = this.extractFrontmatter(markdown);
    const fromIndex = matchedArticle || index.find((article) => article.slug === slug);

    if (!body.trim() && !fromIndex) {
      throw new Error(`Blog article ${slug} not found`);
    }

    const summary: BlogArticleSummary = {
      slug,
      sourceSlug: fromIndex?.sourceSlug || slug,
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
      html: await this.renderMarkdown(body),
      readingTimeMinutes: this.calculateReadingTimeMinutes(body)
    };
  }

  private async renderMarkdown(markdown: string): Promise<string> {
    const { marked } = await import('marked');
    return marked.parse(markdown) as string;
  }

  private normalizeIndexPayload(payload: unknown, lang: Language): BlogIndexResource {
    const articles = this.unwrapEntries(payload)
      .map((entry) => this.normalizeSummary(entry, lang))
      .filter((entry): entry is BlogArticleSummary => !!entry)
      .filter((entry) => entry.published !== false)
      .filter((entry) => entry.lang === lang)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return {
      articles,
      graph: this.normalizeGraphPayload(payload, articles)
    };
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
    const canonicalSlug = this.toStringValue(entry['slug']);
    if (!canonicalSlug) {
      return null;
    }

    const slug = this.normalizeRouteSlug(canonicalSlug);
    const sourceSlug = this.pickLocalizedValue(entry['sourceSlug'], fallbackLang) || canonicalSlug;

    const languages = this.toLanguageArray(entry['languages']);
    const localizedTitle = this.pickLocalizedValue(entry['title'], fallbackLang);
    const localizedSummary = this.pickLocalizedValue(entry['summary'], fallbackLang);
    const lang = this.toLanguage(entry['lang']) || (languages.includes(fallbackLang) ? fallbackLang : null);

    if (!lang) {
      return null;
    }

    return {
      slug,
      sourceSlug,
      title: localizedTitle || this.toStringValue(entry['title']) || slug,
      description: localizedSummary || this.toStringValue(entry['description']) || '',
      date: this.toNullableStringValue(entry['date']),
      lang,
      tags: this.pickLocalizedTags(entry, lang),
      coverImage: this.toNullableStringValue(entry['coverImage']) || undefined,
      published: entry['published'] !== false
    };
  }

  private normalizeGraphPayload(payload: unknown, articles: BlogArticleSummary[]): BlogArticleGraphData {
    const articlesBySlug = articles.reduce<Record<string, BlogGraphArticleNode>>((acc, article) => {
      acc[article.slug] = {
        ...article,
        summary: article.description
      };
      return acc;
    }, {});

    if (!payload || typeof payload !== 'object') {
      return {
        minScore: 0,
        maxRelated: 0,
        articlesBySlug,
        edges: [],
        relatedBySlug: {}
      };
    }

    const graph = (payload as Record<string, unknown>)['graph'];
    if (!graph || typeof graph !== 'object') {
      return {
        minScore: 0,
        maxRelated: 0,
        articlesBySlug,
        edges: [],
        relatedBySlug: {}
      };
    }

    const rawGraph = graph as Record<string, unknown>;
    const edges = this.toGraphRelations(rawGraph['edges']);
    const edgeLookup = this.createEdgeLookup(edges);
    const relatedBySlug = this.normalizeRelatedBySlug(rawGraph['relatedBySlug'], edgeLookup, articlesBySlug);

    return {
      minScore: this.toNumberValue((rawGraph['thresholds'] as Record<string, unknown> | null)?.['minScore']),
      maxRelated: this.toNumberValue(rawGraph['maxRelated']),
      articlesBySlug,
      edges,
      relatedBySlug
    };
  }

  private createEdgeLookup(edges: BlogGraphRelation[]): Map<string, BlogGraphRelation> {
    return edges.reduce((acc, edge) => {
      acc.set(this.toEdgeKey(edge.source, edge.target), edge);
      return acc;
    }, new Map<string, BlogGraphRelation>());
  }

  private normalizeRelatedBySlug(
    value: unknown,
    edgeLookup: Map<string, BlogGraphRelation>,
    articlesBySlug: Record<string, BlogGraphArticleNode>
  ): Record<string, BlogGraphRelation[]> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const rawMap = value as Record<string, unknown>;
    const normalized: Record<string, BlogGraphRelation[]> = {};

    for (const [slug, entries] of Object.entries(rawMap)) {
      if (!articlesBySlug[slug] || !Array.isArray(entries)) {
        continue;
      }

      normalized[slug] = entries
        .map((entry) => this.normalizeGraphRelation(entry, slug))
        .filter((entry): entry is BlogGraphRelation => !!entry && !!articlesBySlug[entry.target])
        .sort((left, right) => right.score - left.score);
    }

    for (const edge of edgeLookup.values()) {
      if (!articlesBySlug[edge.source] || !articlesBySlug[edge.target]) {
        continue;
      }

      normalized[edge.source] = normalized[edge.source] || [];
      normalized[edge.target] = normalized[edge.target] || [];

      if (!normalized[edge.source].some((relation) => relation.target === edge.target)) {
        normalized[edge.source].push(edge);
      }

      if (!normalized[edge.target].some((relation) => relation.target === edge.source)) {
        normalized[edge.target].push({
          ...edge,
          source: edge.target,
          target: edge.source
        });
      }
    }

    for (const slug of Object.keys(normalized)) {
      normalized[slug].sort((left, right) => right.score - left.score);
    }

    return normalized;
  }

  private toGraphRelations(value: unknown): BlogGraphRelation[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => this.normalizeGraphRelation(entry))
      .filter((entry): entry is BlogGraphRelation => !!entry);
  }

  private normalizeGraphRelation(value: unknown, fallbackSource = ''): BlogGraphRelation | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const relation = value as Record<string, unknown>;
    const source = this.normalizeRouteSlug(this.toStringValue(relation['source']) || fallbackSource);
    const target = this.normalizeRouteSlug(this.toStringValue(relation['target']));
    if (!source || !target || source === target) {
      return null;
    }

    return {
      source,
      target,
      score: this.toNumberValue(relation['score']),
      label: this.toStringValue(relation['label']),
      dominantType: this.toRelationType(relation['dominantType']),
      shared: this.normalizeSharedTags(relation['shared'])
    };
  }

  private normalizeSharedTags(value: unknown): BlogGraphShared {
    const raw = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};

    return {
      domain: this.toStringArray(raw['domain']),
      technology: this.toStringArray(raw['technology']),
      topic: this.toStringArray(raw['topic']),
      context: this.toStringArray(raw['context'])
    };
  }

  private toRelationType(value: unknown): BlogGraphRelationType {
    return value === 'domain' || value === 'technology' || value === 'topic' || value === 'context'
      ? value
      : 'mixed';
  }

  private toEdgeKey(source: string, target: string): string {
    return [source, target].sort().join('::');
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

  private normalizeRouteSlug(slug: string): string {
    return slug
      .trim()
      .toLowerCase()
      .replace(/[.\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private calculateReadingTimeMinutes(markdown: string): number {
    const wordsPerMinute = 180;
    const wordCount = this.countWords(markdown);

    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  }

  private countWords(markdown: string): number {
    const plainText = markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[#>*_~\-]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s']/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!plainText) {
      return 0;
    }

    return plainText.split(' ').filter(Boolean).length;
  }

  private resolvePath(path: string): string {
    return `${this.blogBaseUrl}/${path.replace(/^\/+/, '')}`;
  }

  private storeLastArticle(slug: string): void {
    this.writeStorageValue('local', this.lastArticleKey, slug);
  }

  private storeLastLanguage(lang: Language): void {
    this.writeStorageValue('local', this.lastLanguageKey, lang);
  }

  private readSessionIndex(lang: Language): BlogIndexResource | null {
    return this.readJsonStorageValue<BlogIndexResource>('session', this.getSessionIndexKey(lang));
  }

  private storeSessionIndex(lang: Language, resource: BlogIndexResource): void {
    this.writeJsonStorageValue('session', this.getSessionIndexKey(lang), resource);
  }

  private readSessionArticle(cacheKey: string): BlogArticle | null {
    return this.readJsonStorageValue<BlogArticle>('session', this.getSessionArticleKey(cacheKey));
  }

  private storeSessionArticle(cacheKey: string, article: BlogArticle): void {
    this.writeJsonStorageValue('session', this.getSessionArticleKey(cacheKey), article);
  }

  private getSessionIndexKey(lang: Language): string {
    return `${this.sessionIndexPrefix}${lang}`;
  }

  private getSessionArticleKey(cacheKey: string): string {
    return `${this.sessionArticlePrefix}${cacheKey}`;
  }

  private clearSessionEntriesByPrefix(prefix: string): void {
    const storage = this.getSafeStorage('session');
    if (!storage) {
      return;
    }

    const keysToDelete: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      storage.removeItem(key);
    }
  }

  private readJsonStorageValue<T>(storageType: 'local' | 'session', key: string): T | null {
    const rawValue = this.readStorageValue(storageType, key);
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      this.removeStorageValue(storageType, key);
      return null;
    }
  }

  private writeJsonStorageValue(storageType: 'local' | 'session', key: string, value: unknown): void {
    try {
      this.writeStorageValue(storageType, key, JSON.stringify(value));
    } catch {
      this.removeStorageValue(storageType, key);
    }
  }

  private readStorageValue(storageType: 'local' | 'session', key: string): string | null {
    const safeStorage = this.getSafeStorage(storageType);
    if (!safeStorage) {
      return null;
    }

    try {
      return safeStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorageValue(storageType: 'local' | 'session', key: string, value: string): void {
    const safeStorage = this.getSafeStorage(storageType);
    if (!safeStorage) {
      return;
    }

    try {
      safeStorage.setItem(key, value);
    } catch {
      // Ignore storage quota and browser privacy mode failures.
    }
  }

  private removeStorageValue(storageType: 'local' | 'session', key: string): void {
    const safeStorage = this.getSafeStorage(storageType);
    if (!safeStorage) {
      return;
    }

    try {
      safeStorage.removeItem(key);
    } catch {
      // Ignore storage access failures.
    }
  }

  private getSafeStorage(storageType: 'local' | 'session'): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return storageType === 'local' ? window.localStorage : window.sessionStorage;
  }

  private toStringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toNullableStringValue(value: unknown): string {
    return value == null ? '' : this.toStringValue(value);
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private toNumberValue(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private pickLocalizedTags(entry: Record<string, unknown>, lang: Language): string[] {
    const localizedKey = lang === 'es' ? 'tags_es' : 'tags_en';
    const localizedTags = this.toStringArray(entry[localizedKey]);

    if (localizedTags.length) {
      return localizedTags;
    }

    return this.toStringArray(entry['tags']);
  }

  private toLanguageArray(value: unknown): Language[] {
    return Array.isArray(value)
      ? value.filter((item): item is Language => item === 'es' || item === 'en')
      : [];
  }

  private toLanguage(value: unknown): Language | null {
    return value === 'es' || value === 'en' ? value : null;
  }

  private pickLocalizedValue(value: unknown, lang: Language): string {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return '';
    }

    const localized = value as LocalizedFields;
    return this.toStringValue(localized[lang]);
  }
}
