export type TimeWindow = '10m' | '1h' | '24h';

export type Island = {
  code: string;
  name: string;
  creator: string;
  tags?: string[];
};

export type RankedIsland = Island & {
  hypeScore: number;
  uniquePlayers: number;
  peakCCU: number;
  minutesPerPlayer: number;
  retentionD1: number;
  retentionD7?: number;
  recommends?: number;
  favorites?: number;
};

export type IslandMetricSerie = {
  metric: string;
  name: string;
  creator: string;
  hypeScore: number;
};

export type MetricPoint = { ts: string; value: number };


