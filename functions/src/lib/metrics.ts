import type { DeltaValue, MetricKey, MetricPoint, MetricSeries, MetricSnapshot, TimeWindow } from './contracts.js';

export type Bucket = 'MINUTE' | 'HOUR' | 'DAY';

export const METRIC_LABELS: Record<MetricKey, string> = {
  uniquePlayers: 'Unique Players',
  peakCcu: 'Peak CCU',
  minutesPerPlayer: 'Minutes / Player',
  retentionD1: 'D1 Retention',
  retentionD7: 'D7 Retention',
  recommends: 'Recommends',
  favorites: 'Favorites',
  plays: 'Plays',
  minutesPlayed: 'Minutes Played'
};

const METRIC_ALIASES: Record<string, MetricKey> = {
  uniqueplayers: 'uniquePlayers',
  uniquePlayers: 'uniquePlayers',
  'unique-players': 'uniquePlayers',
  peakccu: 'peakCcu',
  peakCcu: 'peakCcu',
  'peak-ccu': 'peakCcu',
  minutesperplayer: 'minutesPerPlayer',
  minutesPerPlayer: 'minutesPerPlayer',
  'minutes-per-player': 'minutesPerPlayer',
  retentiond1: 'retentionD1',
  retentionD1: 'retentionD1',
  'retention-d1': 'retentionD1',
  retentiond7: 'retentionD7',
  retentionD7: 'retentionD7',
  'retention-d7': 'retentionD7',
  recommends: 'recommends',
  favorites: 'favorites',
  plays: 'plays',
  minutesplayed: 'minutesPlayed',
  minutesPlayed: 'minutesPlayed',
  'minutes-played': 'minutesPlayed'
};

export function toBucket(window: TimeWindow): Bucket {
  if (window === '10m') return 'MINUTE';
  if (window === '1h') return 'HOUR';
  return 'DAY';
}

export function toBucketSlug(bucket: Bucket): 'minute' | 'hour' | 'day' {
  if (bucket === 'MINUTE') return 'minute';
  if (bucket === 'HOUR') return 'hour';
  return 'day';
}

export function ttlForWindow(window: TimeWindow) {
  if (window === '10m') return 600;
  if (window === '1h') return 900;
  return 900;
}

export function toMetricSlug(metric: MetricKey): string {
  const map: Record<MetricKey, string> = {
    uniquePlayers: 'unique-players',
    peakCcu: 'peak-ccu',
    minutesPerPlayer: 'minutes-per-player',
    retentionD1: 'retention-d1',
    retentionD7: 'retention-d7',
    recommends: 'recommends',
    favorites: 'favorites',
    plays: 'plays',
    minutesPlayed: 'minutes-played'
  };
  return map[metric];
}

export function normalizeMetricKey(metric: string): MetricKey | null {
  const normalized = metric.replace(/[_\s]/g, '').replace(/[A-Z]/g, (chunk) => chunk.toLowerCase());
  return METRIC_ALIASES[metric] || METRIC_ALIASES[normalized] || null;
}

export function normalizePoints(pointsRaw: unknown): MetricPoint[] {
  if (!Array.isArray(pointsRaw)) return [];

  return pointsRaw
    .map((point) => {
      if (Array.isArray(point)) {
        const [ts, value] = point;
        const normalizedValue = value == null ? Number.NaN : Number(value);
        return {
          ts: String(ts ?? ''),
          value: normalizedValue
        };
      }

      if (point && typeof point === 'object') {
        const candidate = point as Record<string, unknown>;
        const rawValue = candidate.value ?? candidate.v;
        return {
          ts: String(candidate.timestamp ?? candidate.ts ?? candidate.time ?? ''),
          value: rawValue == null ? Number.NaN : Number(rawValue)
        };
      }

      return {
        ts: '',
        value: Number.NaN
      };
    })
    .filter((point) => point.ts && Number.isFinite(point.value))
    .sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
}

export function latestValue(points: MetricPoint[]): number | null {
  if (points.length === 0) return null;
  return points[points.length - 1]?.value ?? null;
}

function buildDelta(latest: number | null, previous: number | null): DeltaValue {
  if (latest === null || previous === null || !Number.isFinite(latest) || !Number.isFinite(previous)) {
    return {
      absolute: null,
      percent: null,
      previous,
      direction: 'unknown'
    };
  }

  const absolute = latest - previous;
  const percent = previous === 0 ? null : absolute / previous;
  let direction: DeltaValue['direction'] = 'flat';
  if (absolute > 0) direction = 'up';
  if (absolute < 0) direction = 'down';

  return {
    absolute,
    percent,
    previous,
    direction
  };
}

export function previousWindowDelta(points: MetricPoint[]): DeltaValue {
  if (points.length < 2) {
    return buildDelta(latestValue(points), null);
  }
  return buildDelta(points[points.length - 1]?.value ?? null, points[points.length - 2]?.value ?? null);
}

export function deltaWithinHours(points: MetricPoint[], hours: number): DeltaValue {
  const latest = points[points.length - 1];
  if (!latest) return buildDelta(null, null);

  const target = Date.parse(latest.ts) - (hours * 60 * 60 * 1000);
  let match: MetricPoint | null = null;

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const point = points[index];
    if (Date.parse(point.ts) <= target) {
      match = point;
      break;
    }
  }

  return buildDelta(latest.value, match?.value ?? null);
}

export function buildMetricSnapshot(metric: MetricKey, points: MetricPoint[]): MetricSnapshot {
  return {
    metric,
    label: METRIC_LABELS[metric],
    latest: latestValue(points),
    previousDelta: previousWindowDelta(points),
    delta24h: deltaWithinHours(points, 24),
    points
  };
}

export function buildMetricSeries(rawSeries: unknown): MetricSeries[] {
  if (!Array.isArray(rawSeries)) return [];

  const buckets = new Map<MetricKey, MetricPoint[]>();
  for (const raw of rawSeries) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Record<string, unknown>;
    const metric = normalizeMetricKey(String(candidate.metric ?? ''));
    if (!metric) continue;
    buckets.set(metric, normalizePoints(candidate.points ?? candidate.series ?? candidate.data ?? candidate.intervals));
  }

  return Array.from(buckets.entries()).map(([metric, points]) => ({ metric, points }));
}
