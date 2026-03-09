import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';
import { globalCache } from '../cache.js';
import { METRIC_KEYS, type IslandRecord, type MetricKey, type MetricSeries, type TimeWindow } from './contracts.js';
import { buildMetricSeries, normalizePoints, toBucket, toBucketSlug, toMetricSlug, ttlForWindow } from './metrics.js';

const USE_MOCK = process.env.USE_MOCK === '1';
const FORTNITE_API_BASE = process.env.FORTNITE_API_BASE || 'https://api.fortnite.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCKS_DIR = path.resolve(__dirname, '../../mocks');

type RawIsland = {
  code?: string;
  title?: string;
  name?: string;
  creatorCode?: string;
  creator?: string | { name?: string };
  tags?: string[];
};

async function runLimited<T>(inputs: T[], limit: number, worker: (input: T) => Promise<void>): Promise<void> {
  const size = Math.max(1, Math.min(limit, inputs.length));
  let cursor = 0;

  const workers = Array.from({ length: size }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= inputs.length) break;
      await worker(inputs[index]);
    }
  });

  await Promise.all(workers);
}

function toIslandRecord(raw: RawIsland): IslandRecord | null {
  const code = raw.code?.trim();
  const name = (raw.title || raw.name || '').trim();
  if (!code || !name) return null;

  const creator = typeof raw.creator === 'string'
    ? raw.creator
    : raw.creator?.name || raw.creatorCode || 'Unknown';

  return {
    code,
    name,
    creator,
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : []
  };
}

async function fetchIslandsPage(url: URL): Promise<{ items: RawIsland[]; nextUrl: URL | null }> {
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Upstream islands page failed: ${res.status}`);

  const json = (await res.json()) as any;
  const items = (json.items || json.data || []) as RawIsland[];
  const next = json.next || json.nextUrl || json.links?.next;
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

async function crawlAllIslands(maxPages: number, pageSize: number, search?: string): Promise<IslandRecord[]> {
  const first = new URL('/ecosystem/v1/islands', FORTNITE_API_BASE);
  first.searchParams.set('limit', String(pageSize));
  if (search) first.searchParams.set('search', search);

  let page = 0;
  let url: URL | null = first;
  const out: IslandRecord[] = [];

  while (url && page < maxPages) {
    url.searchParams.set('page', String(page + 1));
    const { items, nextUrl } = await fetchIslandsPage(url);

    for (const item of items) {
      const island = toIslandRecord(item);
      if (island) out.push(island);
    }

    page += 1;
    if (nextUrl) {
      url = nextUrl;
      continue;
    }

    if (items.length < pageSize) break;

    const guess = new URL('/ecosystem/v1/islands', FORTNITE_API_BASE);
    guess.searchParams.set('limit', String(pageSize));
    guess.searchParams.set('page', String(page + 1));
    if (search) guess.searchParams.set('search', search);
    url = guess;
  }

  return out;
}

async function readMockIslands(): Promise<IslandRecord[]> {
  const raw = await readFile(path.join(MOCKS_DIR, 'islands.json'), 'utf8');
  const data = JSON.parse(raw) as { items?: RawIsland[] };
  const items = data.items || [];
  return items.map(toIslandRecord).filter((item): item is IslandRecord => item !== null);
}

export async function listIslands(search?: string): Promise<IslandRecord[]> {
  const normalizedSearch = (search || '').trim().toLowerCase();
  const cacheKey = `catalog:v2:${normalizedSearch}`;
  const cached = globalCache.get<IslandRecord[]>(cacheKey);
  if (cached) return cached;

  const islands = USE_MOCK
    ? await readMockIslands()
    : await crawlAllIslands(normalizedSearch ? 4 : 8, 100, normalizedSearch && normalizedSearch.length >= 2 ? normalizedSearch : undefined);

  const filtered = normalizedSearch.length >= 2
    ? islands.filter((item) => item.code.includes(normalizedSearch) || item.name.toLowerCase().includes(normalizedSearch))
    : islands;

  globalCache.set(cacheKey, filtered, normalizedSearch ? 600 : 900);
  return filtered;
}

export async function getIslandByCode(code: string): Promise<IslandRecord | null> {
  const exactSearch = await listIslands(code);
  const exactMatch = exactSearch.find((item) => item.code === code);
  if (exactMatch) return exactMatch;

  const all = await listIslands();
  return all.find((item) => item.code === code) || null;
}

export async function fetchIslandSeries(code: string, window: TimeWindow, metrics: MetricKey[] = [...METRIC_KEYS]): Promise<MetricSeries[]> {
  const normalizedMetrics = Array.from(new Set(metrics));
  const cacheKey = `metrics:v3:${code}:${window}:${normalizedMetrics.join(',')}`;
  const cached = globalCache.get<MetricSeries[]>(cacheKey);
  if (cached) return cached;

  if (USE_MOCK) {
    const raw = await readFile(path.join(MOCKS_DIR, 'metrics_by_code.json'), 'utf8');
    const rawSeries = JSON.parse(raw) as Record<string, unknown>;
    const normalized = buildMetricSeries(rawSeries[code] || []);
    const byMetric = new Map(normalized.map((entry) => [entry.metric, entry]));
    const result = normalizedMetrics.map((metric) => byMetric.get(metric) || { metric, points: [] });
    globalCache.set(cacheKey, result, ttlForWindow(window));
    return result;
  }

  const bucketSlug = toBucketSlug(toBucket(window));
  const results = new Map<MetricKey, MetricSeries>();

  await runLimited(normalizedMetrics, 4, async (metric) => {
    try {
      const metricSlug = toMetricSlug(metric);
      const url = new URL(`/ecosystem/v1/islands/${encodeURIComponent(code)}/metrics/${bucketSlug}/${metricSlug}`, FORTNITE_API_BASE);
      const res = await fetch(url.toString());
      if (!res.ok) {
        results.set(metric, { metric, points: [] });
        return;
      }

      const json = (await res.json()) as any;
      results.set(metric, {
        metric,
        points: normalizePoints(json.series || json.data || json.points || json.intervals)
      });
    } catch {
      results.set(metric, { metric, points: [] });
    }
  });

  const output = normalizedMetrics.map((metric) => results.get(metric) || { metric, points: [] });
  globalCache.set(cacheKey, output, ttlForWindow(window));
  return output;
}

export async function computePopularIslands(window: TimeWindow, limit: number, search?: string): Promise<IslandRecord[]> {
  const normalizedSearch = (search || '').trim();
  const cacheKey = `popular:v2:${window}:${limit}:${normalizedSearch}`;
  const cached = globalCache.get<IslandRecord[]>(cacheKey);
  if (cached) return cached;

  const islands = await listIslands(normalizedSearch || undefined);
  const candidates = normalizedSearch ? islands.slice(0, 24) : islands;

  const values = new Map<string, number>();
  await runLimited(candidates, normalizedSearch ? 4 : 8, async (island) => {
    try {
      const series = await fetchIslandSeries(island.code, window, ['uniquePlayers']);
      const points = series[0]?.points || [];
      const latest = points.length > 0 ? (points[points.length - 1]?.value ?? 0) : 0;
      values.set(island.code, latest);
    } catch {
      values.set(island.code, 0);
    }
  });

  const sorted = [...candidates].sort((left, right) => (values.get(right.code) || 0) - (values.get(left.code) || 0));
  const result = sorted.slice(0, Math.min(limit, sorted.length));
  globalCache.set(cacheKey, result, ttlForWindow(window));
  return result;
}
