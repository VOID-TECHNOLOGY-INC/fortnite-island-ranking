import type { DeltaValue, HypeBreakdownComponent, HypeBreakdownMetric, MetricKey } from './contracts.js';

export type HypeInput = {
  metrics: Partial<Record<MetricKey, number | null>>;
  deltas: Partial<Record<MetricKey, DeltaValue>>;
};

export type HypeNormalizationContext = Record<HypeBreakdownMetric, number>;

type HypeConfig = {
  label: string;
  weight: number;
  resolveValue: (input: HypeInput) => number | null;
};

const HYPE_CONFIG: Record<HypeBreakdownMetric, HypeConfig> = {
  uniquePlayers: {
    label: 'Unique Players',
    weight: 0.28,
    resolveValue: (input) => input.metrics.uniquePlayers ?? null
  },
  peakCcu: {
    label: 'Peak CCU',
    weight: 0.18,
    resolveValue: (input) => input.metrics.peakCcu ?? null
  },
  minutesPerPlayer: {
    label: 'Minutes / Player',
    weight: 0.12,
    resolveValue: (input) => input.metrics.minutesPerPlayer ?? null
  },
  retentionD1: {
    label: 'D1 Retention',
    weight: 0.16,
    resolveValue: (input) => input.metrics.retentionD1 ?? null
  },
  recommends: {
    label: 'Recommends',
    weight: 0.11,
    resolveValue: (input) => input.metrics.recommends ?? null
  },
  favorites: {
    label: 'Favorites',
    weight: 0.07,
    resolveValue: (input) => input.metrics.favorites ?? null
  },
  latestChange: {
    label: 'Latest Change',
    weight: 0.08,
    resolveValue: (input) => {
      const percent = input.deltas.uniquePlayers?.percent ?? null;
      if (percent === null) return null;
      return Math.max(0, percent);
    }
  },
  retentionD7: {
    label: 'D7 Retention',
    weight: 0,
    resolveValue: (input) => input.metrics.retentionD7 ?? null
  },
  plays: {
    label: 'Plays',
    weight: 0,
    resolveValue: (input) => input.metrics.plays ?? null
  },
  minutesPlayed: {
    label: 'Minutes Played',
    weight: 0,
    resolveValue: (input) => input.metrics.minutesPlayed ?? null
  }
};

const HYPE_ORDER: HypeBreakdownMetric[] = [
  'uniquePlayers',
  'peakCcu',
  'minutesPerPlayer',
  'retentionD1',
  'recommends',
  'favorites',
  'latestChange'
];

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function buildHypeNormalizationContext(inputs: HypeInput[]): HypeNormalizationContext {
  const context = {} as HypeNormalizationContext;

  for (const metric of HYPE_ORDER) {
    const maxValue = inputs.reduce((best, input) => {
      const value = HYPE_CONFIG[metric].resolveValue(input);
      if (value === null || !Number.isFinite(value)) return best;
      return Math.max(best, value);
    }, 0);

    context[metric] = maxValue;
  }

  return context;
}

export function computeHypeScore(input: HypeInput, context: HypeNormalizationContext): {
  score: number;
  breakdown: HypeBreakdownComponent[];
  trendScore: number | null;
} {
  const available = HYPE_ORDER.filter((metric) => {
    const value = HYPE_CONFIG[metric].resolveValue(input);
    return value !== null && Number.isFinite(value) && value >= 0 && (context[metric] ?? 0) > 0;
  });
  const totalWeight = available.reduce((sum, metric) => sum + HYPE_CONFIG[metric].weight, 0);

  const breakdown = HYPE_ORDER.map((metric) => {
    const config = HYPE_CONFIG[metric];
    const rawValue = config.resolveValue(input);
    const missing = rawValue === null || !Number.isFinite(rawValue) || (context[metric] ?? 0) <= 0;
    const effectiveWeight = missing || totalWeight === 0 ? 0 : config.weight / totalWeight;
    const normalized = missing ? null : Math.min(100, (rawValue / context[metric]) * 100);
    const contribution = normalized === null ? 0 : normalized * effectiveWeight;

    return {
      metric,
      label: config.label,
      value: rawValue,
      normalized: normalized === null ? null : round(normalized),
      weight: config.weight,
      effectiveWeight: round(effectiveWeight),
      contribution: round(contribution),
      missing
    };
  });

  const score = round(breakdown.reduce((sum, component) => sum + component.contribution, 0));
  const trendScore = breakdown.find((component) => component.metric === 'latestChange')?.normalized ?? null;
  return {
    score,
    breakdown,
    trendScore
  };
}
