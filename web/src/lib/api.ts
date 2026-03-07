import type {
  CompareResponse,
  DashboardRequest,
  DashboardResponse,
  Island,
  IslandOverviewResponse,
  IslandsSearchParams,
  MetricSeries,
  Research,
  TimeWindow
} from './types';

export type { Research } from './types';

type QueryValue = string | number | boolean | undefined | null | string[];

function getBaseOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
}

function buildUrl(pathname: string, query?: Record<string, QueryValue>) {
  const url = new URL(pathname, getBaseOrigin());

  if (!query) return url;

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      if (value.length > 0) {
        url.searchParams.set(key, value.join(','));
      }
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
}

async function fetchJson<T>(pathname: string, query?: Record<string, QueryValue>): Promise<T> {
  const response = await fetch(buildUrl(pathname, query).toString());
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchIslands(params: IslandsSearchParams): Promise<Island[]> {
  return fetchJson<Island[]>('/api/islands', params);
}

export async function fetchDashboard(params: DashboardRequest): Promise<DashboardResponse> {
  return fetchJson<DashboardResponse>('/api/dashboard', {
    window: params.window,
    sort: params.sort,
    tags: params.tags,
    creator: params.creator
  });
}

export async function fetchIslandOverview(code: string, window: TimeWindow): Promise<IslandOverviewResponse> {
  return fetchJson<IslandOverviewResponse>(`/api/islands/${code}/overview`, { window });
}

export async function fetchCompare(codes: string[], window: TimeWindow): Promise<CompareResponse> {
  return fetchJson<CompareResponse>('/api/compare', {
    window,
    codes
  });
}

export async function fetchIslandResearch(code: string, name?: string, lang?: string): Promise<Research> {
  return fetchJson<Research>(`/api/islands/${code}/research`, {
    name,
    lang
  });
}

export async function fetchIslandMetrics(code: string, window: TimeWindow): Promise<MetricSeries[]> {
  return fetchJson<MetricSeries[]>(`/api/islands/${code}/metrics`, { window });
}
