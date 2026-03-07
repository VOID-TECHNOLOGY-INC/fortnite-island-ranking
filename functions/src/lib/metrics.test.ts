import { describe, expect, it } from 'vitest';
import { buildMetricSnapshot, normalizeSeries } from './metrics.js';

describe('metrics utility', () => {
  it('returns null deltas for empty series', () => {
    const snapshot = buildMetricSnapshot([]);

    expect(snapshot.latest).toBeNull();
    expect(snapshot.previous).toBeNull();
    expect(snapshot.latestDelta).toEqual({ absolute: null, percent: null });
    expect(snapshot.dayDelta).toEqual({ absolute: null, percent: null });
  });

  it('calculates latest and day deltas from normalized points', () => {
    const series = normalizeSeries('uniquePlayers', [
      { ts: '2025-08-11T10:20:00Z', value: 20 },
      { ts: '2025-08-11T10:00:00Z', value: 10 },
      { ts: '2025-08-11T10:10:00Z', value: 15 }
    ]);

    expect(series).not.toBeNull();

    const snapshot = buildMetricSnapshot(series!.points);
    expect(snapshot.latest).toBe(20);
    expect(snapshot.previous).toBe(15);
    expect(snapshot.latestDelta).toEqual({ absolute: 5, percent: 33.33 });
    expect(snapshot.dayDelta).toEqual({ absolute: 10, percent: 100 });
  });
});
