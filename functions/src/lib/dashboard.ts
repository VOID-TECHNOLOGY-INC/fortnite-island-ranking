import { globalCache } from '../cache.js';
import { buildHypeNormalizationContext, computeHypeScore, type HypeInput } from './hypeScore.js';
import { METRIC_LABELS, buildMetricSnapshot } from './metrics.js';
import type {
  CompareMetricSeries,
  CompareResponse,
  DashboardResponse,
  DashboardSort,
  IslandOverviewResponse,
  IslandRecord,
  IslandSummary,
  MetricKey,
  MetricSnapshot,
  MetricSeries,
  TimeWindow
} from './contracts.js';
import { METRIC_KEYS } from './contracts.js';
import { computePopularIslands, fetchIslandSeries, getIslandByCode } from './fortnite.js';
import type { DeltaValue } from './contracts.js';

type PreparedIsland = {
  island: IslandRecord;
  kpis: MetricSnapshot[];
  metrics: Partial<Record<MetricKey, number | null>>;
  deltas: Partial<Record<MetricKey, DeltaValue>>;
  missingMetrics: number;
};

type DashboardDependencies = {
  computePopularIslands: typeof computePopularIslands;
  fetchIslandSeries: typeof fetchIslandSeries;
  getIslandByCode: typeof getIslandByCode;
  now: () => string;
  isResearchAvailable: () => boolean;
};

const DEFAULT_DEPENDENCIES: DashboardDependencies = {
  computePopularIslands,
  fetchIslandSeries,
  getIslandByCode,
  now: () => new Date().toISOString(),
  isResearchAvailable: () => Boolean(process.env.PERPLEXITY_API_KEY)
};

type DashboardBase = {
  summaries: IslandSummary[];
  kpisByCode: Map<string, MetricSnapshot[]>;
  updatedAt: string;
  degraded: boolean;
  partialFailures: number;
};

const CORE_HEALTH_METRICS = new Set<MetricKey>(['uniquePlayers', 'peakCcu', 'favorites']);
const DASHBOARD_BASE_METRICS: MetricKey[] = [
  'uniquePlayers',
  'peakCcu',
  'favorites'
];
const ISLAND_SUMMARY_CONCURRENCY = 2;

async function mapLimited<T, R>(inputs: T[], limit: number, worker: (input: T) => Promise<R>): Promise<R[]> {
  const size = Math.max(1, Math.min(limit, inputs.length));
  let cursor = 0;
  const results = new Array<R>(inputs.length);

  const workers = Array.from({ length: size }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= inputs.length) {
        break;
      }
      results[index] = await worker(inputs[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

function prepareIsland(island: IslandRecord, series: MetricSeries[]): PreparedIsland {
  const metricSeries = new Map(series.map((entry) => [entry.metric, entry.points]));
  const kpis = METRIC_KEYS.map((metric) => buildMetricSnapshot(metric, metricSeries.get(metric) || []));
  const metrics = Object.fromEntries(kpis.map((snapshot) => [snapshot.metric, snapshot.latest])) as Partial<Record<MetricKey, number | null>>;
  const deltas = Object.fromEntries(kpis.map((snapshot) => [snapshot.metric, snapshot.previousDelta])) as Partial<Record<MetricKey, DeltaValue>>;
  const missingMetrics = kpis.filter((snapshot) => snapshot.latest === null && CORE_HEALTH_METRICS.has(snapshot.metric)).length;

  return {
    island,
    kpis,
    metrics,
    deltas,
    missingMetrics
  };
}

function rehydratePreparedIsland(summary: IslandSummary, kpis: MetricSnapshot[] = []): PreparedIsland {
  return {
    island: {
      code: summary.code,
      name: summary.name,
      creator: summary.creator,
      tags: summary.tags
    },
    kpis,
    metrics: summary.metrics,
    deltas: summary.deltas,
    missingMetrics: kpis.filter((snapshot) => snapshot.latest === null && CORE_HEALTH_METRICS.has(snapshot.metric)).length
  };
}

function summarizePrepared(prepared: PreparedIsland[], updatedAt: string): IslandSummary[] {
  const normalization = buildHypeNormalizationContext(prepared.map<HypeInput>((item) => ({
    metrics: item.metrics,
    deltas: item.deltas
  })));

  return prepared.map((item) => {
    const hype = computeHypeScore({
      metrics: item.metrics,
      deltas: item.deltas
    }, normalization);

    return {
      ...item.island,
      metrics: item.metrics,
      deltas: item.deltas,
      trendScore: hype.trendScore,
      trendValue: item.deltas.uniquePlayers?.absolute ?? null,
      hypeScore: hype.score,
      hypeScoreBreakdown: hype.breakdown,
      updatedAt
    };
  });
}

function sortSummaries(summaries: IslandSummary[], sort: DashboardSort): IslandSummary[] {
  const score = (summary: IslandSummary) => {
    if (sort === 'hype') return summary.hypeScore;
    if (sort === 'latestChange') return summary.deltas.uniquePlayers?.absolute ?? Number.NEGATIVE_INFINITY;
    return summary.metrics[sort] ?? Number.NEGATIVE_INFINITY;
  };

  return [...summaries].sort((left, right) => score(right) - score(left));
}

function buildFacets(summaries: IslandSummary[]) {
  const tagCounts = new Map<string, number>();
  const creatorCounts = new Map<string, number>();

  for (const summary of summaries) {
    creatorCounts.set(summary.creator, (creatorCounts.get(summary.creator) || 0) + 1);
    for (const tag of summary.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  return {
    tags: Array.from(tagCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
      .slice(0, 24),
    creators: Array.from(creatorCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
      .slice(0, 24)
  };
}

function filterSummaries(summaries: IslandSummary[], tags: string[], creator?: string) {
  return summaries.filter((summary) => {
    if (creator && summary.creator !== creator) return false;
    if (tags.length > 0 && !tags.every((tag) => summary.tags.includes(tag))) return false;
    return true;
  });
}

async function buildDashboardBase(window: TimeWindow, dependencies: DashboardDependencies): Promise<DashboardBase> {
  const cacheKey = `dashboard:base:v3:${window}`;
  const cached = globalCache.get<DashboardBase>(cacheKey);
  if (cached) return cached;

  const islands = await dependencies.computePopularIslands(window, 24);
  const base = await buildSummariesForIslands(islands, window, dependencies, DASHBOARD_BASE_METRICS);
  globalCache.set(cacheKey, base, 600);
  return base;
}

async function buildSummariesForIslands(
  islands: IslandRecord[],
  window: TimeWindow,
  dependencies: DashboardDependencies,
  metrics: MetricKey[] = [...METRIC_KEYS]
): Promise<DashboardBase> {
  const updatedAt = dependencies.now();
  let partialFailures = 0;

  const prepared = await mapLimited(islands, ISLAND_SUMMARY_CONCURRENCY, async (island) => {
    try {
      const series = await dependencies.fetchIslandSeries(island.code, window, metrics);
      const preparedIsland = prepareIsland(island, series);
      if (preparedIsland.missingMetrics > 0) partialFailures += 1;
      return preparedIsland;
    } catch {
      partialFailures += 1;
      return prepareIsland(island, []);
    }
  });

  const summaries = summarizePrepared(prepared, updatedAt);
  return {
    summaries,
    kpisByCode: new Map(prepared.map((item) => [item.island.code, item.kpis])),
    updatedAt,
    degraded: partialFailures > 0,
    partialFailures
  };
}

export async function buildDashboardResponse(
  options: {
    window: TimeWindow;
    sort: DashboardSort;
    tags?: string[];
    creator?: string;
  },
  dependencies: Partial<DashboardDependencies> = {}
): Promise<DashboardResponse> {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const base = await buildDashboardBase(options.window, deps);
  const activeTags = (options.tags || []).filter(Boolean);
  const filtered = filterSummaries(base.summaries, activeTags, options.creator);
  const ranking = sortSummaries(filtered, options.sort);
  const rising = sortSummaries(filtered, 'latestChange').slice(0, 8);
  const highRetention = sortSummaries(filtered, 'retentionD1').slice(0, 8);
  const highRecommend = sortSummaries(filtered, 'recommends').slice(0, 8);

  return {
    window: options.window,
    sort: options.sort,
    ranking,
    rising,
    highRetention,
    highRecommend,
    facets: buildFacets(base.summaries),
    updatedAt: base.updatedAt,
    degraded: base.degraded,
    partialFailures: base.partialFailures,
    totalCandidates: base.summaries.length,
    filteredCount: filtered.length
  };
}

export async function buildSearchResponse(
  options: {
    window: TimeWindow;
    sort: DashboardSort;
    query: string;
    limit: number;
  },
  dependencies: Partial<DashboardDependencies> = {}
): Promise<DashboardBase> {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const islands = await deps.computePopularIslands(options.window, options.limit, options.query);
  return buildSummariesForIslands(islands, options.window, deps, DASHBOARD_BASE_METRICS);
}

function scoreRelated(origin: IslandSummary, candidate: IslandSummary): number {
  const sharedTags = candidate.tags.filter((tag) => origin.tags.includes(tag)).length;
  let score = sharedTags * 10;
  if (origin.creator === candidate.creator) score += 25;
  score += candidate.hypeScore / 10;
  return score;
}

export async function buildIslandOverviewResponse(
  code: string,
  window: TimeWindow,
  dependencies: Partial<DashboardDependencies> = {}
): Promise<IslandOverviewResponse | null> {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const cacheKey = `overview:v3:${code}:${window}`;
  const cached = globalCache.get<IslandOverviewResponse>(cacheKey);
  if (cached) return cached;

  const base = await buildDashboardBase(window, deps);
  const basePrepared = base.summaries.map((summary) => rehydratePreparedIsland(summary, base.kpisByCode.get(summary.code) || []));
  const existing = basePrepared.find((summary) => summary.island.code === code) || null;
  const island = existing?.island || await deps.getIslandByCode(code);
  if (!island) return null;

  let degraded = base.degraded;
  let prepared = existing;

  try {
    const series = await deps.fetchIslandSeries(code, window);
    prepared = prepareIsland(island, series);
  } catch {
    degraded = true;
    prepared = existing || prepareIsland(island, []);
  }

  if (!prepared) return null;

  degraded = degraded || prepared.missingMetrics > 0;
  const updatedAt = deps.now();
  const mergedSummaries = summarizePrepared([
    ...basePrepared.filter((summary) => summary.island.code !== code),
    prepared
  ], updatedAt);
  const islandSummary = mergedSummaries.find((summary) => summary.code === code) || null;
  if (!islandSummary) return null;

  const related = mergedSummaries
    .filter((summary) => summary.code !== islandSummary?.code)
    .sort((left, right) => scoreRelated(islandSummary!, right) - scoreRelated(islandSummary!, left))
    .slice(0, 6);

  const response = {
    window,
    island: islandSummary,
    kpis: prepared.kpis,
    related,
    updatedAt,
    degraded,
    researchStatus: {
      available: deps.isResearchAvailable()
    }
  };

  globalCache.set(cacheKey, response, 600);
  return response;
}

export async function buildCompareResponse(
  codes: string[],
  window: TimeWindow,
  dependencies: Partial<DashboardDependencies> = {}
): Promise<CompareResponse> {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const uniqueCodes = Array.from(new Set(codes.filter(Boolean))).slice(0, 4);
  const cacheKey = `compare:v2:${window}:${uniqueCodes.join(',')}`;
  const cached = globalCache.get<CompareResponse>(cacheKey);
  if (cached) return cached;

  if (uniqueCodes.length === 0) {
    return {
      window,
      islands: [],
      metrics: [],
      updatedAt: deps.now(),
      degraded: false,
      selectionLimit: 4
    };
  }

  let degraded = false;
  const prepared = await Promise.all(uniqueCodes.map(async (code) => {
    const island = await deps.getIslandByCode(code);
    if (!island) {
      degraded = true;
      return null;
    }

    try {
      const series = await deps.fetchIslandSeries(code, window);
      return prepareIsland(island, series);
    } catch {
      degraded = true;
      return prepareIsland(island, []);
    }
  }));

  const available = prepared.filter((item): item is PreparedIsland => item !== null);
  const updatedAt = deps.now();
  const islands = summarizePrepared(available, updatedAt);

  const metrics: CompareMetricSeries[] = METRIC_KEYS.map((metric) => ({
    metric,
    label: METRIC_LABELS[metric],
    islands: available.map((item) => ({
      code: item.island.code,
      name: item.island.name,
      points: item.kpis.find((snapshot) => snapshot.metric === metric)?.points || []
    }))
  }));

  const response = {
    window,
    islands,
    metrics,
    updatedAt,
    degraded,
    selectionLimit: 4
  };

  globalCache.set(cacheKey, response, 600);
  return response;
}
