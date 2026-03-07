import { buildMetricRanges, computeHypeScore } from './hypeScore.js';
import { buildMetricSnapshots } from './metrics.js';
import { METRIC_NAMES, type IslandBasic, type IslandMetricDeltas, type IslandMetricValues, type IslandSummary, type MetricName, type MetricSeries, type RankedIslandSummary, type SummarySortKey } from './types.js';

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function buildIslandSummary(basic: IslandBasic, seriesList: MetricSeries[]): IslandSummary {
  const metrics = buildMetricSnapshots(seriesList);
  const latestValues = Object.fromEntries(
    METRIC_NAMES.map(metric => [metric, metrics[metric].latest])
  ) as Partial<Record<MetricName, number | null>>;

  const timestamps = seriesList.flatMap(series => series.points.map(point => point.ts)).sort();
  const updatedAt = timestamps.length > 0 ? timestamps[timestamps.length - 1] ?? new Date().toISOString() : new Date().toISOString();
  const populatedMetricCount = METRIC_NAMES.filter(metric => metrics[metric].points.length > 0).length;
  const hypeScore = computeHypeScore(latestValues, {});

  return {
    ...basic,
    metrics,
    hypeScore,
    updatedAt,
    partial: populatedMetricCount < 4
  };
}

export function applyHypeScores(summaries: IslandSummary[]): IslandSummary[] {
  const ranges = buildMetricRanges(summaries);
  return summaries.map(summary => {
    const latestValues = Object.fromEntries(
      METRIC_NAMES.map(metric => [metric, summary.metrics[metric].latest])
    ) as Partial<Record<MetricName, number | null>>;

    return {
      ...summary,
      hypeScore: computeHypeScore(latestValues, ranges)
    };
  });
}

function toRankedSummary(summary: IslandSummary): RankedIslandSummary {
  const metrics = Object.fromEntries(
    METRIC_NAMES.map(metric => [metric, summary.metrics[metric].latest])
  ) as IslandMetricValues;

  const deltas = Object.fromEntries(
    METRIC_NAMES.map(metric => [
      metric,
      {
        latest: summary.metrics[metric].latestDelta,
        day: summary.metrics[metric].dayDelta
      }
    ])
  ) as IslandMetricDeltas;

  return {
    code: summary.code,
    name: summary.name,
    creator: summary.creator,
    tags: summary.tags,
    hypeScore: summary.hypeScore.score,
    metrics,
    deltas,
    hypeBreakdown: summary.hypeScore.components,
    updatedAt: summary.updatedAt,
    partial: summary.partial
  };
}

function sortValue(summary: IslandSummary, sort: SummarySortKey): number {
  if (sort === 'hype') return summary.hypeScore.score;
  if (sort === 'latestChange') return summary.metrics.uniquePlayers.latestDelta.percent ?? Number.NEGATIVE_INFINITY;
  return summary.metrics[sort].latest ?? Number.NEGATIVE_INFINITY;
}

export function sortSummaries(summaries: IslandSummary[], sort: SummarySortKey): IslandSummary[] {
  return [...summaries].sort((left, right) => sortValue(right, sort) - sortValue(left, sort));
}

export function filterSummaries(summaries: IslandSummary[], tags: string[], creator: string): IslandSummary[] {
  const normalizedCreator = creator.trim().toLowerCase();
  return summaries.filter(summary => {
    const matchesTags = tags.length === 0 || tags.every(tag => summary.tags.includes(tag));
    const matchesCreator = normalizedCreator.length === 0 || summary.creator.toLowerCase().includes(normalizedCreator);
    return matchesTags && matchesCreator;
  });
}

export function rankSummaries(summaries: IslandSummary[], sort: SummarySortKey): RankedIslandSummary[] {
  return sortSummaries(summaries, sort).map(toRankedSummary);
}

export function pickTopRanked(summaries: IslandSummary[], sort: SummarySortKey, limit = 20): RankedIslandSummary[] {
  return rankSummaries(summaries, sort).slice(0, limit);
}

export function risingRanked(summaries: IslandSummary[], limit = 20): RankedIslandSummary[] {
  return [...summaries]
    .sort(
      (left, right) =>
        (right.metrics.uniquePlayers.latestDelta.percent ?? Number.NEGATIVE_INFINITY) -
        (left.metrics.uniquePlayers.latestDelta.percent ?? Number.NEGATIVE_INFINITY)
    )
    .map(toRankedSummary)
    .slice(0, limit);
}

export function retentionRanked(summaries: IslandSummary[], limit = 10): RankedIslandSummary[] {
  return [...summaries]
    .sort((left, right) => (right.metrics.retentionD1.latest ?? Number.NEGATIVE_INFINITY) - (left.metrics.retentionD1.latest ?? Number.NEGATIVE_INFINITY))
    .map(toRankedSummary)
    .slice(0, limit);
}

export function recommendRanked(summaries: IslandSummary[], limit = 10): RankedIslandSummary[] {
  return [...summaries]
    .sort((left, right) => (right.metrics.recommends.latest ?? Number.NEGATIVE_INFINITY) - (left.metrics.recommends.latest ?? Number.NEGATIVE_INFINITY))
    .map(toRankedSummary)
    .slice(0, limit);
}

export function buildRelated(target: IslandSummary, candidates: IslandSummary[], limit = 6): RankedIslandSummary[] {
  return candidates
    .filter(candidate => candidate.code !== target.code)
    .map(candidate => {
      const sharedTags = candidate.tags.filter(tag => target.tags.includes(tag)).length;
      const sameCreator = candidate.creator === target.creator ? 2 : 0;
      const score = round(sharedTags * 10 + sameCreator * 10 + candidate.hypeScore.score, 2);
      return {
        candidate,
        score
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(entry => toRankedSummary(entry.candidate));
}

export function toRanked(summary: IslandSummary): RankedIslandSummary {
  return toRankedSummary(summary);
}
