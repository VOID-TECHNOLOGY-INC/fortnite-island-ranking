import { buildRelated, toRanked } from './summary.js';
import { METRIC_NAMES, type IslandOverviewResponse, type IslandSummary, type TimeWindow } from './types.js';

export function buildOverviewResponse(params: {
  target: IslandSummary;
  candidates: IslandSummary[];
  window: TimeWindow;
  researchConfigured: boolean;
}): IslandOverviewResponse {
  const target = params.target;

  return {
    window: params.window,
    island: toRanked(target),
    kpis: {
      hypeScore: target.hypeScore.score,
      uniquePlayers: target.metrics.uniquePlayers.latest,
      peakCcu: target.metrics.peakCcu.latest,
      minutesPerPlayer: target.metrics.minutesPerPlayer.latest,
      retentionD1: target.metrics.retentionD1.latest,
      retentionD7: target.metrics.retentionD7.latest,
      recommends: target.metrics.recommends.latest,
      favorites: target.metrics.favorites.latest,
      plays: target.metrics.plays.latest,
      minutesPlayed: target.metrics.minutesPlayed.latest
    },
    deltas: Object.fromEntries(
      METRIC_NAMES.map(metric => [
        metric,
        {
          latest: target.metrics[metric].latestDelta,
          day: target.metrics[metric].dayDelta
        }
      ])
    ) as IslandOverviewResponse['deltas'],
    related: buildRelated(target, params.candidates, 6),
    researchStatus: {
      available: params.researchConfigured,
      configured: params.researchConfigured
    },
    updatedAt: target.updatedAt,
    degraded: target.partial
  };
}
