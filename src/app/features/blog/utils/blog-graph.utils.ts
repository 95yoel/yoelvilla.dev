import Graph from 'graphology';
import { BlogArticleGraphData, BlogGraphArticleNode, BlogGraphRelation, BlogGraphRelationType, BlogGraphShared } from '../models/blog-article.model';

const CENTER_NODE_SIZE = 24;
const RELATED_MIN_NODE_SIZE = 11;
const RELATED_MAX_NODE_SIZE = 18;
const EDGE_MIN_SIZE = 1.4;
const EDGE_MAX_SIZE = 4.6;
const INNER_RADIUS = 2;
const OUTER_RADIUS = 3.5;
const ELLIPSE_RATIO = 0.8;
const TYPE_ORDER: BlogGraphRelationType[] = ['topic', 'technology', 'domain', 'context', 'mixed'];

const TYPE_COLORS: Record<BlogGraphRelationType, string> = {
  topic: '#f4b267',
  technology: '#7bc2a5',
  domain: '#7aa2f7',
  context: '#e86a78',
  mixed: '#c7b8ff'
};

export interface BlogGraphNodeAttributes {
  x: number;
  y: number;
  size: number;
  label: string;
  color: string;
  type: 'circle';
  hidden: boolean;
  highlighted: boolean;
  forceLabel: boolean;
  zIndex: number;
  nodeType: 'center' | 'related';
  routeSlug: string;
  fullTitle: string;
}

export interface BlogGraphEdgeAttributes {
  size: number;
  color: string;
  label: string;
  type: 'line';
  hidden: boolean;
  forceLabel: boolean;
  score: number;
  dominantType: BlogGraphRelationType;
}

export interface BlogGraphNodeMeta {
  article: BlogGraphArticleNode;
  nodeType: 'center' | 'related';
  relationToCenter: BlogGraphRelation | null;
  visibleNeighborCount: number;
  visibleNeighborSlugs: string[];
  exploratoryImportance: number;
  similarityScore: number;
}

export interface BlogGraphBuildResult {
  graph: Graph<BlogGraphNodeAttributes, BlogGraphEdgeAttributes>;
  centerSlug: string;
  nodeMetaBySlug: Record<string, BlogGraphNodeMeta>;
  adjacency: Map<string, Set<string>>;
  edgeKeysByNode: Map<string, Set<string>>;
  edgeMetaByKey: Map<string, BlogGraphRelation>;
}

export function buildArticleGraph(
  graphData: BlogArticleGraphData,
  centerSlug: string,
  limit = 8
): BlogGraphBuildResult | null {
  const centerArticle = graphData.articlesBySlug[centerSlug];
  if (!centerArticle) {
    return null;
  }

  const graph = new Graph<BlogGraphNodeAttributes, BlogGraphEdgeAttributes>({ type: 'undirected' });
  const nodeMetaBySlug: Record<string, BlogGraphNodeMeta> = {};
  const adjacency = new Map<string, Set<string>>();
  const edgeKeysByNode = new Map<string, Set<string>>();
  const edgeMetaByKey = new Map<string, BlogGraphRelation>();

  const topRelations = (graphData.relatedBySlug[centerSlug] || [])
    .filter((relation) => !!graphData.articlesBySlug[relation.target])
    .slice(0, Math.max(1, Math.min(limit, graphData.maxRelated || limit)));

  const visibleSlugs = new Set<string>([centerSlug, ...topRelations.map((relation) => relation.target)]);
  const visibleEdges = collectVisibleEdges(centerSlug, topRelations, graphData, visibleSlugs);

  const weightedDegree = computeWeightedDegree(visibleEdges);
  const centerScores = topRelations.map((relation) => relation.score);
  const weightedScores = [...visibleSlugs]
    .filter((slug) => slug !== centerSlug)
    .map((slug) => weightedDegree.get(slug) || 0);
  const centerMinScore = Math.min(...centerScores, graphData.minScore || 0);
  const centerMaxScore = Math.max(...centerScores, graphData.minScore || 1);
  const weightedMin = weightedScores.length ? Math.min(...weightedScores) : 0;
  const weightedMax = weightedScores.length ? Math.max(...weightedScores) : 1;
  const edgeScores = visibleEdges.map((edge) => edge.score);
  const edgeMin = edgeScores.length ? Math.min(...edgeScores) : 0;
  const edgeMax = edgeScores.length ? Math.max(...edgeScores) : 1;

  graph.addNode(centerSlug, {
    x: 0,
    y: 0,
    size: CENTER_NODE_SIZE,
    label: truncateLabel(centerArticle.title, 38),
    color: '#fff7f2',
    type: 'circle',
    hidden: false,
    highlighted: false,
    forceLabel: true,
    zIndex: 10,
    nodeType: 'center',
    routeSlug: centerArticle.slug,
    fullTitle: centerArticle.title
  });

  nodeMetaBySlug[centerSlug] = {
    article: centerArticle,
    nodeType: 'center',
    relationToCenter: null,
    visibleNeighborCount: 0,
    visibleNeighborSlugs: [],
    exploratoryImportance: 1,
    similarityScore: 1
  };

  const orderedRelations = [...topRelations].sort((left, right) => {
    const typeDiff = TYPE_ORDER.indexOf(left.dominantType) - TYPE_ORDER.indexOf(right.dominantType);
    return typeDiff !== 0 ? typeDiff : right.score - left.score;
  });

  orderedRelations.forEach((relation, index) => {
    const article = graphData.articlesBySlug[relation.target];
    if (!article) {
      return;
    }

    const similarity = normalizeValue(relation.score, centerMinScore, centerMaxScore, 1);
    const weight = normalizeValue(weightedDegree.get(article.slug) || 0, weightedMin, weightedMax, 1);
    const importance = clamp(0.65 * similarity + 0.35 * weight, 0, 1);
    const size = interpolate(RELATED_MIN_NODE_SIZE, RELATED_MAX_NODE_SIZE, importance);
    const radius = interpolate(OUTER_RADIUS, INNER_RADIUS, similarity);
    const angle = resolveNodeAngle(index, orderedRelations.length);

    graph.addNode(article.slug, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * ELLIPSE_RATIO,
      size,
      label: truncateLabel(article.title, 24),
      color: TYPE_COLORS[relation.dominantType] || TYPE_COLORS.mixed,
      type: 'circle',
      hidden: false,
      highlighted: false,
      forceLabel: importance > 0.72,
      zIndex: 5,
      nodeType: 'related',
      routeSlug: article.slug,
      fullTitle: article.title
    });

    nodeMetaBySlug[article.slug] = {
      article,
      nodeType: 'related',
      relationToCenter: relation,
      visibleNeighborCount: 0,
      visibleNeighborSlugs: [],
      exploratoryImportance: importance,
      similarityScore: relation.score
    };
  });

  visibleEdges.forEach((edge) => {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      return;
    }

    const edgeKey = createEdgeKey(edge.source, edge.target);
    const edgeSize = interpolate(EDGE_MIN_SIZE, EDGE_MAX_SIZE, normalizeValue(edge.score, edgeMin, edgeMax, 1));

    graph.addEdgeWithKey(edgeKey, edge.source, edge.target, {
      size: edgeSize,
      color: withAlpha(TYPE_COLORS[edge.dominantType] || TYPE_COLORS.mixed, edge.source === centerSlug || edge.target === centerSlug ? 0.72 : 0.42),
      label: edge.label,
      type: 'line',
      hidden: false,
      forceLabel: false,
      score: edge.score,
      dominantType: edge.dominantType
    });

    edgeMetaByKey.set(edgeKey, edge);
    connect(adjacency, edge.source, edge.target);
    connect(adjacency, edge.target, edge.source);
    rememberEdge(edgeKeysByNode, edge.source, edgeKey);
    rememberEdge(edgeKeysByNode, edge.target, edgeKey);
  });

  Object.entries(nodeMetaBySlug).forEach(([slug, meta]) => {
    const neighbors = [...(adjacency.get(slug) || new Set<string>())];
    meta.visibleNeighborSlugs = neighbors;
    meta.visibleNeighborCount = neighbors.length;
  });

  return {
    graph,
    centerSlug,
    nodeMetaBySlug,
    adjacency,
    edgeKeysByNode,
    edgeMetaByKey
  };
}

export function collectSharedTags(shared: BlogGraphShared): string[] {
  return [...new Set([
    ...shared.domain,
    ...shared.technology,
    ...shared.topic,
    ...shared.context
  ])];
}

export function createEdgeKey(source: string, target: string): string {
  return [source, target].sort().join('::');
}

export function withAlpha(color: string, alpha: number): string {
  const normalized = color.replace('#', '');
  const parsed = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;

  const r = Number.parseInt(parsed.slice(0, 2), 16);
  const g = Number.parseInt(parsed.slice(2, 4), 16);
  const b = Number.parseInt(parsed.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function collectVisibleEdges(
  centerSlug: string,
  topRelations: BlogGraphRelation[],
  graphData: BlogArticleGraphData,
  visibleSlugs: Set<string>
): BlogGraphRelation[] {
  const visibleEdges = [...topRelations.map((relation) => ({ ...relation, source: centerSlug }))];
  const seen = new Set<string>(visibleEdges.map((edge) => createEdgeKey(edge.source, edge.target)));

  for (const source of visibleSlugs) {
    const relations = graphData.relatedBySlug[source] || [];
    for (const relation of relations) {
      if (!visibleSlugs.has(relation.target)) {
        continue;
      }

      const edgeKey = createEdgeKey(source, relation.target);
      if (seen.has(edgeKey)) {
        continue;
      }

      seen.add(edgeKey);
      visibleEdges.push({
        ...relation,
        source
      });
    }
  }

  return visibleEdges;
}

function computeWeightedDegree(edges: BlogGraphRelation[]): Map<string, number> {
  const weights = new Map<string, number>();

  for (const edge of edges) {
    weights.set(edge.source, (weights.get(edge.source) || 0) + edge.score);
    weights.set(edge.target, (weights.get(edge.target) || 0) + edge.score);
  }

  return weights;
}

function connect(map: Map<string, Set<string>>, source: string, target: string): void {
  const set = map.get(source) || new Set<string>();
  set.add(target);
  map.set(source, set);
}

function rememberEdge(map: Map<string, Set<string>>, slug: string, edgeKey: string): void {
  const set = map.get(slug) || new Set<string>();
  set.add(edgeKey);
  map.set(slug, set);
}

function truncateLabel(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…` : value;
}

function normalizeValue(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return fallback;
  }

  return clamp((value - min) / (max - min), 0, 1);
}

function interpolate(min: number, max: number, ratio: number): number {
  return min + (max - min) * clamp(ratio, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveNodeAngle(index: number, total: number): number {
  if (total <= 1) {
    return -Math.PI / 2;
  }

  if (total === 2) {
    return index === 0 ? -2.35 : -0.8;
  }

  if (total === 3) {
    return [-2.45, -Math.PI / 2, -0.7][index];
  }

  const start = -2.35;
  const end = -0.8;
  return start + ((end - start) * index) / (total - 1);
}
