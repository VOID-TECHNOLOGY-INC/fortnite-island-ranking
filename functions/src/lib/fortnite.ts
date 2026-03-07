import { readFile } from 'node:fs/promises';
import fetch from 'node-fetch';
import { globalCache } from '../cache.js';
import { normalizeMetricName, normalizeSeries } from './metrics.js';
import { METRIC_NAMES, type IslandBasic, type MetricName, type MetricSeries, type TimeWindow } from './types.js';
import { toBucket, toBucketSlug, toMetricSlug, ttlForWindow, windowStepMs } from './windows.js';

const USE_MOCK = process.env.USE_MOCK === '1';
const FORTNITE_API_BASE = 'https://api.fortnite.com';

type MockIsland = IslandBasic & {
  metrics?: Record<string, number>;
};

async function runLimited<T, R>(inputs: T[], limit: number, worker: (input: T) => Promise<R>): Promise<R[]> {
  const size = Math.max(1, Math.min(limit, inputs.length));
  const results = new Array<R>(inputs.length);
  let cursor = 0;

  const workers = Array.from({ length: size }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= inputs.length) {
        return;
      }

      results[index] = await worker(inputs[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

function mapIsland(item: any): IslandBasic {
  return {
    code: item.code,
    name: item.name || item.title,
    creator: item.creator || item.creatorCode || item.creator?.name || 'Unknown',
    tags: Array.isArray(item.tags) ? item.tags : []
  };
}

async function loadMockIslands(): Promise<MockIsland[]> {
  const raw = await readFile(new URL('../../mocks/islands.json', import.meta.url), 'utf8');
  const items = (JSON.parse(raw) as any).items ?? [];
  return items.map((item: any) => ({
    ...mapIsland(item),
    metrics: item.metrics ?? {}
  }));
}

async function loadMockMetrics(): Promise<Record<string, Array<{ metric: string; points: Array<{ ts: string; value: number }> }>>> {
  const raw = await readFile(new URL('../../mocks/metrics_by_code.json', import.meta.url), 'utf8');
  return JSON.parse(raw) as Record<string, Array<{ metric: string; points: Array<{ ts: string; value: number }> }>>;
}

function buildSyntheticSeries(metric: MetricName, latest: number, window: TimeWindow): MetricSeries {
  const step = windowStepMs(window);
  const now = Date.now();
  const multipliers = metric.startsWith('retention') ? [0.92, 0.95, 0.98, 1] : [0.78, 0.86, 0.93, 1];
  const points = multipliers.map((multiplier, index) => ({
    ts: new Date(now - step * (multipliers.length - 1 - index)).toISOString(),
    value: Number((latest * multiplier).toFixed(metric.startsWith('retention') ? 4 : 2))
  }));

  return {
    metric,
    points
  };
}

function getMockSnapshotMetric(island: MockIsland, metric: MetricName): number | null {
  const snapshot = island.metrics ?? {};
  const aliases: Record<MetricName, string[]> = {
    uniquePlayers: ['uniquePlayers'],
    peakCcu: ['peakCcu', 'peakCCU'],
    minutesPerPlayer: ['minutesPerPlayer'],
    retentionD1: ['retentionD1'],
    retentionD7: ['retentionD7'],
    recommends: ['recommends'],
    favorites: ['favorites'],
    plays: ['plays'],
    minutesPlayed: ['minutesPlayed']
  };

  for (const key of aliases[metric]) {
    const value = snapshot[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export async function searchIslands(params: {
  window: TimeWindow;
  query?: string;
  sort?: string;
  limit?: number;
}): Promise<Array<IslandBasic & { metrics?: { uniquePlayers: number | null } }>> {
  const limit = params.limit ?? 50;
  const query = (params.query ?? '').trim().toLowerCase();
  const cacheKey = `islands:v6:${params.window}:${query}:${params.sort ?? 'hype'}:${limit}`;
  const cached = globalCache.get<Array<IslandBasic & { metrics?: { uniquePlayers: number | null } }>>(cacheKey);
  if (cached) {
    return cached;
  }

  if (USE_MOCK) {
    const islands = await loadMockIslands();
    const filtered = islands.filter(island => {
      if (!query) return true;
      return island.name.toLowerCase().includes(query) || island.code.includes(query);
    });

    const sorted = [...filtered].sort(
      (left, right) => (getMockSnapshotMetric(right, 'uniquePlayers') ?? 0) - (getMockSnapshotMetric(left, 'uniquePlayers') ?? 0)
    );
    const result = sorted.slice(0, limit).map(island => ({
      code: island.code,
      name: island.name,
      creator: island.creator,
      tags: island.tags,
      metrics: {
        uniquePlayers: getMockSnapshotMetric(island, 'uniquePlayers')
      }
    }));
    globalCache.set(cacheKey, result, ttlForWindow(params.window));
    return result;
  }

  const listUrl = new URL('/ecosystem/v1/islands', FORTNITE_API_BASE);
  if (query.length >= 2) {
    listUrl.searchParams.set('search', query);
  }
  listUrl.searchParams.set('limit', String(limit));

  const response = await fetch(listUrl.toString());
  if (!response.ok) {
    if ([400, 404, 422, 429].includes(response.status)) {
      globalCache.set(cacheKey, [], 120);
      return [];
    }
    throw new Error(`Upstream island list failed with ${response.status}`);
  }

  const body = (await response.json()) as any;
  const islands = ((body.items || body.data || []) as any[]).map(mapIsland);
  const result = islands.map(island => ({ ...island, metrics: { uniquePlayers: null } }));
  globalCache.set(cacheKey, result, ttlForWindow(params.window));
  return result;
}

export async function getIslandMetrics(code: string, window: TimeWindow): Promise<MetricSeries[]> {
  const cacheKey = `metrics:v3:${code}:${window}`;
  const cached = globalCache.get<MetricSeries[]>(cacheKey);
  if (cached) {
    return cached;
  }

  if (USE_MOCK) {
    const [metricMap, islands] = await Promise.all([loadMockMetrics(), loadMockIslands()]);
    const island = islands.find(entry => entry.code === code);
    const fromMock = (metricMap[code] ?? [])
      .map(entry => normalizeSeries(entry.metric, entry.points))
      .filter((entry): entry is MetricSeries => entry !== null);

    const existing = new Set(fromMock.map(entry => entry.metric));
    const synthetic = island
      ? METRIC_NAMES.filter(metric => !existing.has(metric))
          .map(metric => {
            const snapshot = getMockSnapshotMetric(island, metric);
            return snapshot === null ? null : buildSyntheticSeries(metric, snapshot, window);
          })
          .filter((entry): entry is MetricSeries => entry !== null)
      : [];

    const series = [...fromMock, ...synthetic];
    globalCache.set(cacheKey, series, ttlForWindow(window));
    return series;
  }

  const bucketSlug = toBucketSlug(toBucket(window));
  const series = await Promise.all(
    METRIC_NAMES.map(async metric => {
      const metricSlug = toMetricSlug(metric);
      const url = new URL(`/ecosystem/v1/islands/${encodeURIComponent(code)}/metrics/${bucketSlug}/${metricSlug}`, FORTNITE_API_BASE);
      const response = await fetch(url.toString());
      if (!response.ok) {
        return {
          metric,
          points: []
        } satisfies MetricSeries;
      }

      const body = (await response.json()) as any;
      const rawPoints = body.series || body.data || body.points || body.intervals || [];
      return {
        metric,
        points: Array.isArray(rawPoints)
          ? rawPoints.map((point: any) => ({
              ts: point.timestamp || point.ts || point.time || point[0],
              value: Number(point.value ?? point.v ?? point[1] ?? 0)
            }))
          : []
      } satisfies MetricSeries;
    })
  );

  globalCache.set(cacheKey, series, ttlForWindow(window));
  return series;
}

async function fetchIslandsPage(url: URL): Promise<{ items: any[]; nextUrl: URL | null }> {
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Upstream islands page failed: ${response.status}`);
  }

  const body = (await response.json()) as any;
  const items = (body.items || body.data || []) as any[];
  const next = body.next || body.nextUrl || body.links?.next;
  let nextUrl: URL | null = null;
  if (typeof next === 'string') {
    try {
      nextUrl = new URL(next, FORTNITE_API_BASE);
    } catch {
      nextUrl = null;
    }
  }

  return { items, nextUrl };
}

async function crawlAllIslands(maxPages: number, pageSize: number, search?: string): Promise<IslandBasic[]> {
  const first = new URL('/ecosystem/v1/islands', FORTNITE_API_BASE);
  first.searchParams.set('limit', String(pageSize));
  if (search) {
    first.searchParams.set('search', search);
  }

  let page = 0;
  let currentUrl: URL | null = first;
  const islands: IslandBasic[] = [];

  while (currentUrl && page < maxPages) {
    currentUrl.searchParams.set('page', String(page + 1));
    const { items, nextUrl } = await fetchIslandsPage(currentUrl);
    islands.push(...items.map(mapIsland).filter(item => item.code && item.name));
    page += 1;

    if (nextUrl) {
      currentUrl = nextUrl;
      continue;
    }

    if (items.length < pageSize) {
      break;
    }

    const guess = new URL('/ecosystem/v1/islands', FORTNITE_API_BASE);
    guess.searchParams.set('limit', String(pageSize));
    guess.searchParams.set('page', String(page + 1));
    if (search) {
      guess.searchParams.set('search', search);
    }
    currentUrl = guess;
  }

  return islands;
}

export async function getTopIslandBasics(window: TimeWindow, limit: number, query = ''): Promise<IslandBasic[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const cacheKey = `top:v2:${window}:${limit}:${normalizedQuery}`;
  const cached = globalCache.get<IslandBasic[]>(cacheKey);
  if (cached) {
    return cached;
  }

  if (USE_MOCK) {
    const islands = await loadMockIslands();
    const filtered = islands.filter(island => {
      if (!normalizedQuery) return true;
      return island.name.toLowerCase().includes(normalizedQuery) || island.code.includes(normalizedQuery);
    });
    const result = [...filtered]
      .sort((left, right) => (getMockSnapshotMetric(right, 'uniquePlayers') ?? 0) - (getMockSnapshotMetric(left, 'uniquePlayers') ?? 0))
      .slice(0, limit)
      .map(island => ({
        code: island.code,
        name: island.name,
        creator: island.creator,
        tags: island.tags
      }));
    globalCache.set(cacheKey, result, ttlForWindow(window));
    return result;
  }

  const basics = await crawlAllIslands(5, 100, normalizedQuery || undefined);
  const ranked = await runLimited(basics, 8, async island => {
    const metrics = await getIslandMetrics(island.code, window);
    const uniquePlayersSeries = metrics.find(series => series.metric === 'uniquePlayers');
    const uniquePlayersPoints = uniquePlayersSeries?.points ?? [];
    const uniquePlayers = uniquePlayersPoints[uniquePlayersPoints.length - 1]?.value ?? 0;
    return {
      island,
      uniquePlayers
    };
  });

  const result = ranked
    .sort((left, right) => right.uniquePlayers - left.uniquePlayers)
    .slice(0, limit)
    .map(entry => entry.island);

  globalCache.set(cacheKey, result, ttlForWindow(window));
  return result;
}

export async function findIslandBasic(code: string, window: TimeWindow): Promise<IslandBasic | null> {
  if (USE_MOCK) {
    const islands = await loadMockIslands();
    const island = islands.find(entry => entry.code === code);
    return island
      ? {
          code: island.code,
          name: island.name,
          creator: island.creator,
          tags: island.tags
        }
      : null;
  }

  const cachedTop = await getTopIslandBasics(window, 100);
  const topHit = cachedTop.find(island => island.code === code);
  if (topHit) {
    return topHit;
  }

  const results = await searchIslands({
    window,
    query: code,
    limit: 5
  });

  return results.find(island => island.code === code) ?? null;
}
