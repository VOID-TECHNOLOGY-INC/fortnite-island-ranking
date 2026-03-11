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
const DEFAULT_CATALOG_PAGE_SIZE = 100;
const DEFAULT_CATALOG_MAX_PAGES = 8;
const SEARCH_CATALOG_MAX_PAGES = 4;
const POPULAR_SCAN_PAGE_SIZE = 24;
const POPULAR_SCAN_MAX_PAGES = 4;
const POPULAR_TARGET_MULTIPLIER = 1.25;
const POPULAR_MAX_SCORED_CANDIDATES = 48;
const POPULAR_SCORE_CONCURRENCY = 1;
const ISLANDS_PAGE_FETCH_ATTEMPTS = 3;
const ISLANDS_PAGE_FETCH_BACKOFF_MS = 400;
const METRIC_FETCH_CONCURRENCY = 1;
const METRIC_FETCH_ATTEMPTS = 3;
const SHORT_FAILURE_TTL = 60;
const EXPECTED_MISSING_METRICS = new Set<MetricKey>(['minutesPerPlayer', 'retentionD1', 'retentionD7', 'recommends']);

type RawIsland = {
  code?: string;
  title?: string;
  name?: string;
  creatorCode?: string;
  creator?: string | { name?: string };
  tags?: string[];
};

type ScoredIsland = {
  island: IslandRecord;
  latest: number;
  hasData: boolean;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableMetricFailure(metric: MetricKey, status: number) {
  if (status === 408 || status === 425) {
    return true;
  }
  if (status >= 500) {
    return true;
  }
  return false;
}

function isRetryableIslandsPageFailure(status: number) {
  return status === 403 || status === 408 || status === 425 || status === 429 || status >= 500;
}

function createIslandsUrl(pageSize: number, search?: string) {
  const url = new URL('/ecosystem/v1/islands', FORTNITE_API_BASE);
  url.searchParams.set('size', String(pageSize));
  if (search) {
    url.searchParams.set('search', search);
  }
  return url;
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
  for (let attempt = 1; attempt <= ISLANDS_PAGE_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'fortnite-island-ranking/1.0'
        }
      });
      if (!res.ok) {
        if (isRetryableIslandsPageFailure(res.status) && attempt < ISLANDS_PAGE_FETCH_ATTEMPTS) {
          await sleep(attempt * ISLANDS_PAGE_FETCH_BACKOFF_MS);
          continue;
        }
        throw new Error(`Upstream islands page failed: ${res.status}`);
      }

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
    } catch (error) {
      if (attempt < ISLANDS_PAGE_FETCH_ATTEMPTS) {
        await sleep(attempt * ISLANDS_PAGE_FETCH_BACKOFF_MS);
        continue;
      }
      throw error;
    }
  }

  throw new Error('Upstream islands page failed');
}

async function crawlAllIslands(maxPages: number, pageSize: number, search?: string): Promise<IslandRecord[]> {
  let page = 0;
  let url: URL | null = createIslandsUrl(pageSize, search);
  const out: IslandRecord[] = [];

  while (url && page < maxPages) {
    let pageData: { items: RawIsland[]; nextUrl: URL | null };
    try {
      pageData = await fetchIslandsPage(url);
    } catch (error) {
      if (out.length === 0) {
        throw error;
      }
      console.warn('crawlAllIslands partial failure', {
        page: page + 1,
        pageSize,
        search: search || null,
        error: String(error)
      });
      break;
    }

    for (const item of pageData.items) {
      const island = toIslandRecord(item);
      if (island) out.push(island);
    }

    page += 1;
    url = pageData.nextUrl;
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
    : await crawlAllIslands(
        normalizedSearch ? SEARCH_CATALOG_MAX_PAGES : DEFAULT_CATALOG_MAX_PAGES,
        DEFAULT_CATALOG_PAGE_SIZE,
        normalizedSearch && normalizedSearch.length >= 2 ? normalizedSearch : undefined
      );

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
  let hadUnexpectedMetricFailure = false;

  await runLimited(normalizedMetrics, METRIC_FETCH_CONCURRENCY, async (metric) => {
    const metricSlug = toMetricSlug(metric);
    const url = new URL(`/ecosystem/v1/islands/${encodeURIComponent(code)}/metrics/${bucketSlug}/${metricSlug}`, FORTNITE_API_BASE);

    for (let attempt = 1; attempt <= METRIC_FETCH_ATTEMPTS; attempt += 1) {
      try {
        const res = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'fortnite-island-ranking/1.0'
          }
        });
        const body = await res.text();

        if (res.ok) {
          const json = JSON.parse(body) as any;
          results.set(metric, {
            metric,
            points: normalizePoints(json.series || json.data || json.points || json.intervals)
          });
          return;
        }

        const retryable = isRetryableMetricFailure(metric, res.status);
        if (retryable && attempt < METRIC_FETCH_ATTEMPTS) {
          await sleep(attempt * 250);
          continue;
        }

        if (!EXPECTED_MISSING_METRICS.has(metric) || res.status !== 404) {
          hadUnexpectedMetricFailure = true;
          console.warn('fetchIslandSeries upstream failure', {
            code,
            window,
            metric,
            status: res.status,
            body: body.slice(0, 120)
          });
        }

        results.set(metric, { metric, points: [] });
        return;
      } catch (error) {
        if (attempt < METRIC_FETCH_ATTEMPTS) {
          await sleep(attempt * 250);
          continue;
        }

        hadUnexpectedMetricFailure = true;
        console.warn('fetchIslandSeries unexpected failure', {
          code,
          window,
          metric,
          error: String(error)
        });

        results.set(metric, { metric, points: [] });
        return;
      }
    }
  });

  const output = normalizedMetrics.map((metric) => results.get(metric) || { metric, points: [] });
  globalCache.set(cacheKey, output, hadUnexpectedMetricFailure ? SHORT_FAILURE_TTL : ttlForWindow(window));
  return output;
}

async function scoreIslandsByUniquePlayers(islands: IslandRecord[], window: TimeWindow): Promise<ScoredIsland[]> {
  const scored = new Array<ScoredIsland>(islands.length);

  await runLimited(islands.map((island, index) => ({ island, index })), POPULAR_SCORE_CONCURRENCY, async ({ island, index }) => {
    try {
      const series = await fetchIslandSeries(island.code, window, ['uniquePlayers']);
      const points = series[0]?.points || [];
      const latest = points.length > 0 ? (points[points.length - 1]?.value ?? 0) : 0;
      scored[index] = {
        island,
        latest,
        hasData: points.length > 0
      };
    } catch {
      scored[index] = {
        island,
        latest: 0,
        hasData: false
      };
    }
  });

  return scored;
}

async function collectCatalogCandidates(limit: number): Promise<IslandRecord[]> {
  let page = 0;
  let url: URL | null = createIslandsUrl(POPULAR_SCAN_PAGE_SIZE);
  const seenCodes = new Set<string>();
  const islands: IslandRecord[] = [];

  while (url && page < POPULAR_SCAN_MAX_PAGES && islands.length < limit) {
    let pageData: { items: RawIsland[]; nextUrl: URL | null };
    try {
      pageData = await fetchIslandsPage(url);
    } catch (error) {
      if (islands.length === 0) {
        throw error;
      }
      console.warn('collectCatalogCandidates page fetch failed', {
        page: page + 1,
        limit,
        error: String(error)
      });
      break;
    }

    for (const item of pageData.items) {
      const island = toIslandRecord(item);
      if (!island || seenCodes.has(island.code)) {
        continue;
      }
      seenCodes.add(island.code);
      islands.push(island);
      if (islands.length >= limit) {
        break;
      }
    }

    page += 1;
    url = pageData.nextUrl;
  }

  return islands;
}

export async function computePopularIslands(window: TimeWindow, limit: number, search?: string): Promise<IslandRecord[]> {
  const normalizedSearch = (search || '').trim();
  const cacheKey = `popular:v2:${window}:${limit}:${normalizedSearch}`;
  const cached = globalCache.get<IslandRecord[]>(cacheKey);
  if (cached) return cached;

  if (!normalizedSearch) {
    try {
      const islands = await collectCatalogCandidates(limit);
      const ttl = islands.length >= Math.min(limit, 12) ? ttlForWindow(window) : SHORT_FAILURE_TTL;
      globalCache.set(cacheKey, islands, ttl);
      return islands;
    } catch (error) {
      console.warn('computePopularIslands upstream failure', {
        window,
        limit,
        search: null,
        error: String(error)
      });
      globalCache.set(cacheKey, [], SHORT_FAILURE_TTL);
      return [];
    }
  }

  let scored: ScoredIsland[] = [];

  try {
    const islands = await listIslands(normalizedSearch || undefined);
    const candidates = islands.slice(0, Math.min(POPULAR_MAX_SCORED_CANDIDATES, 24));
    scored = await scoreIslandsByUniquePlayers(candidates, window);
  } catch (error) {
    console.warn('computePopularIslands upstream failure', {
      window,
      limit,
      search: normalizedSearch || null,
      error: String(error)
    });
  }

  const populated = scored
    .filter((item) => item.hasData && item.latest > 0)
    .sort((left, right) => right.latest - left.latest);
  const empty = scored
    .filter((item) => !item.hasData || item.latest <= 0)
    .sort((left, right) => right.latest - left.latest);

  const result = [...populated, ...empty]
    .slice(0, Math.min(limit, populated.length + empty.length))
    .map((entry) => entry.island);

  const ttl = populated.length >= Math.min(limit, 12) ? ttlForWindow(window) : SHORT_FAILURE_TTL;
  globalCache.set(cacheKey, result, ttl);
  return result;
}
