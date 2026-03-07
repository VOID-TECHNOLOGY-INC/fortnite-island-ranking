import { METRIC_NAMES, type CompareResponse, type IslandSummary, type TimeWindow } from './types.js';
import { toRanked } from './summary.js';

export function buildCompareResponse(params: {
  items: IslandSummary[];
  window: TimeWindow;
}): CompareResponse {
  const items = params.items.slice(0, 4);

  return {
    window: params.window,
    codes: items.map(item => item.code),
    islands: items.map(toRanked),
    metrics: METRIC_NAMES.map(metric => ({
      metric,
      series: items.map(item => ({
        code: item.code,
        name: item.name,
        points: item.metrics[metric].points
      }))
    })),
    updatedAt: (() => {
      const updatedAt = items.map(item => item.updatedAt).sort();
      return updatedAt[updatedAt.length - 1] ?? new Date().toISOString();
    })(),
    degraded: items.some(item => item.partial)
  };
}
