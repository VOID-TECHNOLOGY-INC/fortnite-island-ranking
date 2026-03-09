export const TIME_WINDOWS = ['10m', '1h', '24h'] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const METRIC_KEYS = [
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
export type MetricKey = (typeof METRIC_KEYS)[number];

export const DASHBOARD_SORTS = [
  'hype',
  'uniquePlayers',
  'peakCcu',
  'minutesPerPlayer',
  'retentionD1',
  'recommends',
  'favorites',
  'latestChange'
] as const;
export type DashboardSort = (typeof DASHBOARD_SORTS)[number];

export type MetricPoint = {
  ts: string;
  value: number;
};

export type MetricSeries = {
  metric: MetricKey;
  points: MetricPoint[];
};

export type DeltaValue = {
  absolute: number | null;
  percent: number | null;
  previous: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
};

export type IslandRecord = {
  code: string;
  name: string;
  creator: string;
  tags: string[];
};

export type MetricSnapshot = {
  metric: MetricKey;
  label: string;
  latest: number | null;
  previousDelta: DeltaValue;
  delta24h: DeltaValue;
  points: MetricPoint[];
};

export type HypeBreakdownMetric = MetricKey | 'latestChange';

export type HypeBreakdownComponent = {
  metric: HypeBreakdownMetric;
  label: string;
  value: number | null;
  normalized: number | null;
  weight: number;
  effectiveWeight: number;
  contribution: number;
  missing: boolean;
};

export type IslandSummary = IslandRecord & {
  metrics: Partial<Record<MetricKey, number | null>>;
  deltas: Partial<Record<MetricKey, DeltaValue>>;
  trendScore: number | null;
  trendValue: number | null;
  hypeScore: number;
  hypeScoreBreakdown: HypeBreakdownComponent[];
  updatedAt: string;
};

export type FacetValue = {
  value: string;
  count: number;
};

export type DashboardResponse = {
  window: TimeWindow;
  sort: DashboardSort;
  ranking: IslandSummary[];
  rising: IslandSummary[];
  highRetention: IslandSummary[];
  highRecommend: IslandSummary[];
  facets: {
    tags: FacetValue[];
    creators: FacetValue[];
  };
  updatedAt: string;
  degraded: boolean;
  partialFailures: number;
  totalCandidates: number;
  filteredCount: number;
};

export type IslandOverviewResponse = {
  window: TimeWindow;
  island: IslandSummary;
  kpis: MetricSnapshot[];
  related: IslandSummary[];
  updatedAt: string;
  degraded: boolean;
  researchStatus: {
    available: boolean;
  };
};

export type CompareMetricSeries = {
  metric: MetricKey;
  label: string;
  islands: Array<{
    code: string;
    name: string;
    points: MetricPoint[];
  }>;
};

export type CompareResponse = {
  window: TimeWindow;
  islands: IslandSummary[];
  metrics: CompareMetricSeries[];
  updatedAt: string;
  degraded: boolean;
  selectionLimit: number;
};
