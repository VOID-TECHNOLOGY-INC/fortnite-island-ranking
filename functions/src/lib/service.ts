import { globalCache } from '../cache.js';
import { buildCompareResponse } from './compare.js';
import { buildDashboardResponse } from './dashboard.js';
import { getIslandMetrics, getTopIslandBasics, findIslandBasic } from './fortnite.js';
import { buildOverviewResponse } from './overview.js';
import { applyHypeScores, buildIslandSummary } from './summary.js';
import type { CompareResponse, DashboardResponse, IslandOverviewResponse, IslandSummary, SummarySortKey, TimeWindow } from './types.js';
import { ttlForWindow } from './windows.js';

async function buildSummaries(window: TimeWindow): Promise<IslandSummary[]> {
  const basics = await getTopIslandBasics(window, 100);
  const summaries = await Promise.all(
    basics.map(async basic => {
      const series = await getIslandMetrics(basic.code, window);
      return buildIslandSummary(basic, series);
    })
  );

  return applyHypeScores(summaries);
}

export async function getWindowSummaries(window: TimeWindow): Promise<IslandSummary[]> {
  const cacheKey = `dashboard-base:v2:${window}`;
  const cached = globalCache.get<IslandSummary[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const summaries = await buildSummaries(window);
  globalCache.set(cacheKey, summaries, ttlForWindow(window));
  return summaries;
}

export async function getDashboard(params: {
  window: TimeWindow;
  sort: SummarySortKey;
  tags?: string[];
  creator?: string;
}): Promise<DashboardResponse> {
  const summaries = await getWindowSummaries(params.window);
  return buildDashboardResponse({
    summaries,
    window: params.window,
    sort: params.sort,
    tags: params.tags,
    creator: params.creator
  });
}

export async function getIslandOverview(params: {
  code: string;
  window: TimeWindow;
  researchConfigured: boolean;
}): Promise<IslandOverviewResponse> {
  const summaries = await getWindowSummaries(params.window);
  let target = summaries.find(summary => summary.code === params.code) ?? null;

  if (!target) {
    const basic = (await findIslandBasic(params.code, params.window)) ?? {
      code: params.code,
      name: params.code,
      creator: 'Unknown',
      tags: []
    };
    const series = await getIslandMetrics(params.code, params.window);
    target = applyHypeScores([buildIslandSummary(basic, series)])[0];
  }

  return buildOverviewResponse({
    target,
    candidates: summaries,
    window: params.window,
    researchConfigured: params.researchConfigured
  });
}

export async function getCompare(params: {
  codes: string[];
  window: TimeWindow;
}): Promise<CompareResponse> {
  const requestedCodes = [...new Set(params.codes)].slice(0, 4);
  const summaries = await getWindowSummaries(params.window);
  const found = new Map(summaries.map(summary => [summary.code, summary]));

  const islands = await Promise.all(
    requestedCodes.map(async code => {
      const existing = found.get(code);
      if (existing) {
        return existing;
      }

      const basic = (await findIslandBasic(code, params.window)) ?? {
        code,
        name: code,
        creator: 'Unknown',
        tags: []
      };
      const series = await getIslandMetrics(code, params.window);
      return applyHypeScores([buildIslandSummary(basic, series)])[0];
    })
  );

  return buildCompareResponse({
    items: islands,
    window: params.window
  });
}
