import type { HypeScoreResult, IslandSummary, MetricName } from './types.js';

const HYPE_WEIGHTS: Record<MetricName, number> = {
  uniquePlayers: 0.28,
  peakCcu: 0.18,
  minutesPerPlayer: 0.14,
  retentionD1: 0.16,
  retentionD7: 0,
  recommends: 0.12,
  favorites: 0.12,
  plays: 0,
  minutesPlayed: 0
};

const HYPE_METRICS = Object.entries(HYPE_WEIGHTS)
  .filter(([, weight]) => weight > 0)
  .map(([metric]) => metric as MetricName);

type MetricRange = {
  min: number;
  max: number;
};

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function buildMetricRanges(summaries: IslandSummary[]): Partial<Record<MetricName, MetricRange>> {
  const ranges: Partial<Record<MetricName, MetricRange>> = {};

  for (const metric of HYPE_METRICS) {
    const values = summaries
      .map(summary => summary.metrics[metric].latest)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    if (values.length > 0) {
      ranges[metric] = {
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }
  }

  return ranges;
}

function normalizeValue(value: number, range?: MetricRange): number {
  if (!range) {
    return 0;
  }

  if (range.max === range.min) {
    return value > 0 ? 1 : 0;
  }

  return Math.max(0, Math.min(1, (value - range.min) / (range.max - range.min)));
}

export function computeHypeScore(
  latestValues: Partial<Record<MetricName, number | null>>,
  ranges: Partial<Record<MetricName, MetricRange>>
): HypeScoreResult {
  const availableMetrics = HYPE_METRICS.filter(metric => {
    const value = latestValues[metric];
    return typeof value === 'number' && Number.isFinite(value);
  });

  const availableWeight = availableMetrics.reduce((total, metric) => total + HYPE_WEIGHTS[metric], 0);

  if (availableMetrics.length === 0 || availableWeight === 0) {
    return {
      score: 0,
      availableWeight: 0,
      missingMetrics: [...HYPE_METRICS],
      components: HYPE_METRICS.map(metric => ({
        metric,
        raw: latestValues[metric] ?? null,
        normalized: 0,
        weight: 0,
        contribution: 0
      }))
    };
  }

  const components = HYPE_METRICS.map(metric => {
    const raw = latestValues[metric] ?? null;
    if (raw === null || !Number.isFinite(raw)) {
      return {
        metric,
        raw: null,
        normalized: 0,
        weight: 0,
        contribution: 0
      };
    }

    const weight = HYPE_WEIGHTS[metric] / availableWeight;
    const normalized = normalizeValue(raw, ranges[metric]);
    const contribution = normalized * weight * 100;

    return {
      metric,
      raw,
      normalized: round(normalized, 4),
      weight: round(weight, 4),
      contribution: round(contribution, 2)
    };
  });

  return {
    score: round(components.reduce((total, component) => total + component.contribution, 0), 2),
    availableWeight: round(availableWeight, 4),
    missingMetrics: HYPE_METRICS.filter(metric => !availableMetrics.includes(metric)),
    components
  };
}
