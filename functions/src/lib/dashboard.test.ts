import { beforeEach, describe, expect, it } from 'vitest';
import { globalCache } from '../cache.js';
import { buildCompareResponse, buildDashboardResponse, buildIslandOverviewResponse } from './dashboard.js';
import type { IslandRecord, MetricKey, MetricSeries } from './contracts.js';

const DASHBOARD_BASE_METRICS: MetricKey[] = [
  'uniquePlayers',
  'peakCcu',
  'favorites'
];

const ISLANDS: IslandRecord[] = [
  { code: 'A', name: 'Alpha', creator: 'Creator 1', tags: ['PvP', 'Arena'] },
  { code: 'B', name: 'Bravo', creator: 'Creator 2', tags: ['Arena'] },
  { code: 'C', name: 'Charlie', creator: 'Creator 1', tags: ['PvE'] }
];

const SERIES: Record<string, Partial<Record<MetricKey, number[]>>> = {
  A: {
    uniquePlayers: [100, 130],
    peakCcu: [50, 70],
    minutesPerPlayer: [12, 15],
    retentionD1: [0.2, 0.28],
    recommends: [120, 140],
    favorites: [80, 90],
    plays: [200, 260],
    minutesPlayed: [1200, 1950]
  },
  B: {
    uniquePlayers: [80, 150],
    peakCcu: [40, 95],
    minutesPerPlayer: [8, 11],
    retentionD1: [0.12, 0.16],
    recommends: [100, 130],
    favorites: [70, 72],
    plays: [180, 280],
    minutesPlayed: [960, 1640]
  },
  C: {
    uniquePlayers: [60, 62],
    peakCcu: [25, 28],
    minutesPerPlayer: [18, 19],
    retentionD1: [0.35, 0.37],
    recommends: [40, 45],
    favorites: [50, 52],
    plays: [90, 94],
    minutesPlayed: [1080, 1178]
  }
};

function buildSeries(code: string): MetricSeries[] {
  return Object.entries(SERIES[code] || {}).map(([metric, values]) => ({
    metric: metric as MetricKey,
    points: (values || []).map((value, index) => ({
      ts: new Date(Date.UTC(2025, 0, index + 1)).toISOString(),
      value
    }))
  }));
}

const deps = {
  computePopularIslands: async () => ISLANDS,
  fetchIslandSeries: async (code: string) => {
    if (code === 'B') {
      return buildSeries(code).filter((entry) => entry.metric !== 'favorites');
    }
    return buildSeries(code);
  },
  getIslandByCode: async (code: string) => ISLANDS.find((item) => item.code === code) || null,
  now: () => '2025-01-02T00:00:00.000Z',
  isResearchAvailable: () => true
};

const coreOnlyDeps = {
  ...deps,
  fetchIslandSeries: async (code: string) =>
    buildSeries(code).filter((entry) => ['uniquePlayers', 'peakCcu', 'favorites'].includes(entry.metric))
};

function clearCache() {
  ((globalCache as unknown as { store: Map<string, unknown> }).store).clear();
}

describe('dashboard builders', () => {
  beforeEach(() => {
    clearCache();
  });

  it('returns degraded dashboards without breaking array shapes', async () => {
    const dashboard = await buildDashboardResponse({
      window: '10m',
      sort: 'hype'
    }, deps);

    expect(dashboard.degraded).toBe(true);
    expect(dashboard.ranking).toHaveLength(3);
    expect(dashboard.highRetention[0]?.code).toBe('C');
    expect(dashboard.facets.tags[0]?.value).toBe('Arena');
  });

  it('does not mark dashboards degraded when only optional metrics are absent', async () => {
    const dashboard = await buildDashboardResponse({
      window: '24h',
      sort: 'hype'
    }, coreOnlyDeps);

    expect(dashboard.degraded).toBe(false);
    expect(dashboard.partialFailures).toBe(0);
    expect(dashboard.ranking[0]?.metrics.uniquePlayers).toBeGreaterThan(0);
  });

  it('requests only the dashboard base metric subset for ranking data', async () => {
    const metricRequests: MetricKey[][] = [];
    const trackingDeps = {
      ...deps,
      fetchIslandSeries: async (code: string, _window: string, metrics?: MetricKey[]) => {
        metricRequests.push([...(metrics || [])]);
        return buildSeries(code).filter((entry) => !metrics || metrics.includes(entry.metric));
      }
    };

    const dashboard = await buildDashboardResponse({
      window: '24h',
      sort: 'hype'
    }, trackingDeps);

    expect(dashboard.ranking).toHaveLength(3);
    expect(metricRequests).toHaveLength(3);
    expect(metricRequests.every((request) => request.join(',') === DASHBOARD_BASE_METRICS.join(','))).toBe(true);
  });

  it('builds island overview with related islands', async () => {
    const overview = await buildIslandOverviewResponse('A', '10m', deps);
    expect(overview?.island.code).toBe('A');
    expect(overview?.kpis[0]?.metric).toBe('uniquePlayers');
    expect(overview?.related.map((item) => item.code)).toContain('C');
    expect(overview?.researchStatus.available).toBe(true);
  });

  it('refetches full metrics for overview even when dashboard base is subset-cached', async () => {
    const metricRequests: Array<{ code: string; metrics: MetricKey[] | null }> = [];
    const trackingDeps = {
      ...deps,
      fetchIslandSeries: async (code: string, _window: string, metrics?: MetricKey[]) => {
        metricRequests.push({ code, metrics: metrics ? [...metrics] : null });
        return buildSeries(code).filter((entry) => !metrics || metrics.includes(entry.metric));
      }
    };

    await buildDashboardResponse({
      window: '24h',
      sort: 'hype'
    }, trackingDeps);
    const overview = await buildIslandOverviewResponse('A', '24h', trackingDeps);

    expect(overview?.kpis.find((snapshot) => snapshot.metric === 'plays')?.latest).toBe(260);
    expect(metricRequests.slice(0, 3).every((request) => request.metrics?.join(',') === DASHBOARD_BASE_METRICS.join(','))).toBe(true);
    expect(metricRequests[metricRequests.length - 1]).toEqual({ code: 'A', metrics: null });
  });

  it('builds compare response for selected islands', async () => {
    const compare = await buildCompareResponse(['A', 'C'], '10m', deps);
    expect(compare.islands).toHaveLength(2);
    expect(compare.metrics[0]?.islands).toHaveLength(2);
    expect(compare.selectionLimit).toBe(4);
  });
});
