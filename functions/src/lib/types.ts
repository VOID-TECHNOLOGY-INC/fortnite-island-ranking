export const TIME_WINDOWS = ['10m', '1h', '24h'] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const METRIC_NAMES = [
  'uniquePlayers',
  'peakCcu',
  'minutesPerPlayer',
  'retentionD1',
  'retentionD7',
  'recommends',
  'favorites',
  'plays',
  'minutesPlayed'
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

export type SummarySortKey =
  | 'hype'
  | 'uniquePlayers'
  | 'peakCcu'
  | 'minutesPerPlayer'
  | 'retentionD1'
  | 'recommends'
  | 'favorites'
  | 'latestChange';

export type Bucket = 'TEN_MINUTE' | 'HOUR' | 'DAY';

export type MetricPoint = {
  ts: string;
  value: number;
};

export type MetricSeries = {
  metric: MetricName;
  points: MetricPoint[];
};

export type MetricDelta = {
  absolute: number | null;
  percent: number | null;
};

export type MetricSnapshot = {
  latest: number | null;
  previous: number | null;
  latestDelta: MetricDelta;
  dayDelta: MetricDelta;
  points: MetricPoint[];
};

export type HypeScoreComponent = {
  metric: MetricName;
  raw: number | null;
  normalized: number;
  weight: number;
  contribution: number;
};

export type HypeScoreResult = {
  score: number;
  availableWeight: number;
  missingMetrics: MetricName[];
  components: HypeScoreComponent[];
};

export type IslandBasic = {
  code: string;
  name: string;
  creator: string;
  tags: string[];
};

export type IslandSummary = IslandBasic & {
  metrics: Record<MetricName, MetricSnapshot>;
  hypeScore: HypeScoreResult;
  updatedAt: string;
  partial: boolean;
};

export type IslandMetricValues = Record<MetricName, number | null>;

export type IslandMetricDeltas = Record<
  MetricName,
  {
    latest: MetricDelta;
    day: MetricDelta;
  }
>;

export type RankedIslandSummary = IslandBasic & {
  hypeScore: number;
  metrics: IslandMetricValues;
  deltas: IslandMetricDeltas;
  hypeBreakdown: HypeScoreComponent[];
  updatedAt: string;
  partial: boolean;
};

export type DashboardResponse = {
  window: TimeWindow;
  ranking: RankedIslandSummary[];
  rising: RankedIslandSummary[];
  highRetention: RankedIslandSummary[];
  highRecommend: RankedIslandSummary[];
  facets: {
    tags: string[];
    creators: string[];
  };
  updatedAt: string;
  degraded: boolean;
};

export type IslandKpis = IslandMetricValues & {
  hypeScore: number;
};

export type IslandOverviewResponse = {
  window: TimeWindow;
  island: RankedIslandSummary;
  kpis: IslandKpis;
  deltas: IslandMetricDeltas;
  related: RankedIslandSummary[];
  researchStatus: {
    available: boolean;
    configured: boolean;
  };
  updatedAt: string;
  degraded: boolean;
};

export type CompareMetricSeries = {
  metric: MetricName;
  series: Array<{
    code: string;
    name: string;
    points: MetricPoint[];
  }>;
};

export type CompareResponse = {
  window: TimeWindow;
  codes: string[];
  islands: RankedIslandSummary[];
  metrics: CompareMetricSeries[];
  updatedAt: string;
  degraded: boolean;
};
