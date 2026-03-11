import { describe, expect, it } from 'vitest';
import { buildMetricSnapshot, buildMetricSeries, deltaWithinHours, normalizeMetricKey, normalizePoints, previousWindowDelta } from './metrics.js';

describe('metrics helpers', () => {
  it('normalizes mixed point formats and sorts them', () => {
    const points = normalizePoints([
      ['2025-01-01T01:00:00Z', 12],
      { ts: '2025-01-01T00:00:00Z', value: 8 },
      { timestamp: '2025-01-01T02:00:00Z', v: 20 }
    ]);

    expect(points).toEqual([
      { ts: '2025-01-01T00:00:00Z', value: 8 },
      { ts: '2025-01-01T01:00:00Z', value: 12 },
      { ts: '2025-01-01T02:00:00Z', value: 20 }
    ]);
  });

  it('drops upstream points whose value is null', () => {
    const points = normalizePoints([
      { ts: '2025-01-01T00:00:00Z', value: 10 },
      { ts: '2025-01-01T00:10:00Z', value: null },
      ['2025-01-01T00:20:00Z', null]
    ]);

    expect(points).toEqual([{ ts: '2025-01-01T00:00:00Z', value: 10 }]);
  });

  it('computes previous-window delta', () => {
    const delta = previousWindowDelta([
      { ts: '2025-01-01T00:00:00Z', value: 10 },
      { ts: '2025-01-01T01:00:00Z', value: 25 }
    ]);

    expect(delta).toEqual({
      absolute: 15,
      percent: 1.5,
      previous: 10,
      direction: 'up'
    });
  });

  it('returns unknown delta for empty series', () => {
    const snapshot = buildMetricSnapshot('uniquePlayers', []);
    expect(snapshot.latest).toBeNull();
    expect(snapshot.previousDelta.direction).toBe('unknown');
    expect(snapshot.delta24h.direction).toBe('unknown');
  });

  it('returns a 24 hour delta only when an older point exists', () => {
    const delta = deltaWithinHours([
      { ts: '2025-01-01T00:00:00Z', value: 10 },
      { ts: '2025-01-01T12:00:00Z', value: 15 },
      { ts: '2025-01-02T01:00:00Z', value: 30 }
    ], 24);

    expect(delta.absolute).toBe(20);
    expect(delta.previous).toBe(10);
  });

  it('builds series from mixed upstream metric names', () => {
    const series = buildMetricSeries([
      { metric: 'UniquePlayers', points: [{ ts: '2025-01-01T00:00:00Z', value: 10 }] },
      { metric: 'peak-ccu', data: [{ timestamp: '2025-01-01T00:00:00Z', value: 5 }] }
    ]);

    expect(series.map((item) => item.metric)).toEqual(['uniquePlayers', 'peakCcu']);
    expect(normalizeMetricKey('minutes-per-player')).toBe('minutesPerPlayer');
  });
});
