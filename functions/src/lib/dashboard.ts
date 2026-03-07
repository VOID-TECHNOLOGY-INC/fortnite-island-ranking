import { filterSummaries, pickTopRanked, recommendRanked, retentionRanked, risingRanked } from './summary.js';
import type { DashboardResponse, IslandSummary, SummarySortKey, TimeWindow } from './types.js';

export function buildDashboardResponse(params: {
  summaries: IslandSummary[];
  window: TimeWindow;
  sort: SummarySortKey;
  tags?: string[];
  creator?: string;
}): DashboardResponse {
  const tags = params.tags ?? [];
  const creator = params.creator ?? '';
  const filtered = filterSummaries(params.summaries, tags, creator);
  const updatedAtCandidates = filtered.map(summary => summary.updatedAt).sort();
  const updatedAt = updatedAtCandidates[updatedAtCandidates.length - 1] ?? new Date().toISOString();

  return {
    window: params.window,
    ranking: pickTopRanked(filtered, params.sort, 20),
    rising: risingRanked(filtered, 20),
    highRetention: retentionRanked(filtered, 6),
    highRecommend: recommendRanked(filtered, 6),
    facets: {
      tags: [...new Set(params.summaries.flatMap(summary => summary.tags))].sort((left, right) => left.localeCompare(right)),
      creators: [...new Set(params.summaries.map(summary => summary.creator))].sort((left, right) => left.localeCompare(right))
    },
    updatedAt,
    degraded: filtered.some(summary => summary.partial)
  };
}
