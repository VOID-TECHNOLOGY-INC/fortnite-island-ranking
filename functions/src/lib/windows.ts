import type { Bucket, MetricName, TimeWindow } from './types.js';

export function toBucket(window: TimeWindow): Bucket {
  if (window === '10m') return 'TEN_MINUTE';
  if (window === '1h') return 'HOUR';
  return 'DAY';
}

export function toBucketSlug(bucket: Bucket): 'ten-minute' | 'hour' | 'day' {
  if (bucket === 'TEN_MINUTE') return 'ten-minute';
  if (bucket === 'HOUR') return 'hour';
  return 'day';
}

export function toMetricSlug(metric: MetricName): string {
  const map: Record<MetricName, string> = {
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

export function ttlForWindow(window: TimeWindow): number {
  if (window === '10m') return 600;
  return 900;
}

export function windowStepMs(window: TimeWindow): number {
  if (window === '10m') return 10 * 60 * 1000;
  if (window === '1h') return 60 * 60 * 1000;
  return 6 * 60 * 60 * 1000;
}
