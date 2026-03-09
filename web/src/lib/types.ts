export type TimeWindow = '10m' | '1h' | '24h';

export type DashboardTab = 'top' | 'rising' | 'watchlist';
export type DashboardView = 'table' | 'cards';
export type DashboardSort =
  | 'hype'
  | 'uniquePlayers'
  | 'peakCcu'
  | 'minutesPerPlayer'
  | 'retentionD1'
  | 'recommends'
  | 'favorites'
  | 'latestChange';

export type TrendDirection = 'up' | 'down' | 'flat' | 'unknown';

export type IslandMetricName =
  | 'uniquePlayers'
  | 'peakCcu'
  | 'minutesPerPlayer'
  | 'retentionD1'
  | 'retentionD7'
  | 'recommends'
  | 'favorites'
  | 'plays'
  | 'minutesPlayed';

export type Island = {
  code: string;
  name: string;
  creator: string;
  tags: string[];
};

export type MetricPoint = {
  ts: string;
  value: number | null;
};

export type MetricSeries = {
  metric: IslandMetricName | string;
  points: MetricPoint[];
};

export type HypeScoreComponent = {
  metric: IslandMetricName | string;
  label: string;
  weight: number;
  appliedWeight: number;
  normalizedValue: number | null;
  contribution: number;
};

export type SummaryMetricMap = {
  uniquePlayers: number | null;
  peakCcu: number | null;
  minutesPerPlayer: number | null;
  retentionD1: number | null;
  retentionD7: number | null;
  recommends: number | null;
  favorites: number | null;
};

export type MetricDelta = {
  latest: number | null;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
  delta24h: number | null;
  direction: TrendDirection;
};

export type RankedIslandSummary = Island & {
  rank?: number;
  hypeScore: number;
  updatedAt?: string;
  metrics: SummaryMetricMap;
  deltas: Partial<Record<IslandMetricName, MetricDelta>> & {
    latestChange?: number | null;
  };
  breakdown: HypeScoreComponent[];
};

export type RankedIsland = RankedIslandSummary;

export type DashboardFacet = {
  value: string;
  count: number;
};

export type DashboardResponse = {
  window: TimeWindow;
  ranking: RankedIslandSummary[];
  rising: RankedIslandSummary[];
  highRetention: RankedIslandSummary[];
  highRecommend: RankedIslandSummary[];
  facets: {
    tags: DashboardFacet[];
    creators: DashboardFacet[];
  };
  updatedAt: string;
  degraded: boolean;
  partialFailures: string[];
};

export type IslandOverviewResponse = {
  window: TimeWindow;
  island: Island;
  kpis: SummaryMetricMap;
  deltas: Partial<Record<IslandMetricName, MetricDelta>> & {
    latestChange?: number | null;
  };
  hypeScore: {
    score: number;
    breakdown: HypeScoreComponent[];
  };
  related: RankedIslandSummary[];
  series: MetricSeries[];
  researchStatus: {
    available: boolean;
    updatedAt?: string | null;
  };
  updatedAt: string;
  degraded: boolean;
};

export type CompareMetricScore = {
  raw: number | null;
  normalized: number | null;
};

export type CompareIslandResult = {
  island: RankedIslandSummary;
  series: MetricSeries[];
  normalizedScores: Partial<Record<IslandMetricName, CompareMetricScore>>;
};

export type CompareResponse = {
  window: TimeWindow;
  islands: CompareIslandResult[];
  updatedAt: string;
  degraded: boolean;
};

export type ResearchSource = {
  title?: string;
  url: string;
};

export type Research = {
  summary: string;
  highlights?: string[];
  sources?: ResearchSource[];
  updatedAt: string;
};

export type IslandsSearchParams = {
  window: TimeWindow;
  query?: string;
  category?: string;
  limit?: number;
  sort?: string;
};

export type DashboardRequest = {
  window: TimeWindow;
  sort?: DashboardSort;
  tags?: string[];
  creator?: string;
};

export type IslandOverviewRequest = {
  code: string;
  window: TimeWindow;
};

export type CompareRequest = {
  codes: string[];
  window: TimeWindow;
};

export type HomeQueryState = {
  window: TimeWindow;
  tab: DashboardTab;
  sort: DashboardSort;
  query: string;
  tags: string[];
  creator: string;
  view: DashboardView;
};

export type DetailQueryState = {
  window: TimeWindow;
};

export type CompareQueryState = {
  window: TimeWindow;
  codes: string[];
};

export type CompareDraft = {
  codes: string[];
  updatedAt: string;
};

export type WatchlistEntry = {
  code: string;
  name: string;
  creator: string;
  tags?: string[];
  savedAt: string;
};

export type RecentSearchEntry = {
  query: string;
  usedAt: string;
};

export type RecentViewEntry = {
  code: string;
  name: string;
  creator: string;
  viewedAt: string;
  window: TimeWindow;
};

export type IslandMetricSerie = MetricSeries;
