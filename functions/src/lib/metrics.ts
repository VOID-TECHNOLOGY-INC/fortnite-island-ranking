import { METRIC_NAMES, type MetricDelta, type MetricName, type MetricPoint, type MetricSeries, type MetricSnapshot } from './types.js';

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function toFiniteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeMetricName(metric: string): MetricName | null {
  const compact = metric.replace(/[-_\s]/g, '').toLowerCase();

  return (
    METRIC_NAMES.find(candidate => candidate.replace(/[A-Z]/g, chunk => chunk.toLowerCase()).toLowerCase() === compact) ??
    METRIC_NAMES.find(candidate => candidate.toLowerCase() === compact) ??
    ({
      uniqueplayers: 'uniquePlayers',
      peakccu: 'peakCcu',
      minutesperplayer: 'minutesPerPlayer',
      retentiond1: 'retentionD1',
      retentiond7: 'retentionD7',
      recommends: 'recommends',
      favorites: 'favorites',
      plays: 'plays',
      minutesplayed: 'minutesPlayed'
    } as Record<string, MetricName | undefined>)[compact] ??
    null
  );
}

export function normalizePoints(points: MetricPoint[]): MetricPoint[] {
  return points
    .map(point => ({
      ts: point.ts,
      value: toFiniteNumber(point.value) ?? 0
    }))
    .filter(point => point.ts)
    .sort((left, right) => left.ts.localeCompare(right.ts));
}

function buildDelta(current: number | null, previous: number | null): MetricDelta {
  if (current === null || previous === null) {
    return { absolute: null, percent: null };
  }

  const absolute = round(current - previous);
  const percent = previous === 0 ? null : round(((current - previous) / previous) * 100);
  return { absolute, percent };
}

export function buildMetricSnapshot(points: MetricPoint[]): MetricSnapshot {
  const normalized = normalizePoints(points);
  if (normalized.length === 0) {
    return {
      latest: null,
      previous: null,
      latestDelta: { absolute: null, percent: null },
      dayDelta: { absolute: null, percent: null },
      points: []
    };
  }

  const latest = normalized[normalized.length - 1] ?? null;
  const previous = normalized.length > 1 ? normalized[normalized.length - 2] ?? null : null;
  const first = normalized[0] ?? null;

  return {
    latest: latest?.value ?? null,
    previous: previous?.value ?? null,
    latestDelta: buildDelta(latest?.value ?? null, previous?.value ?? null),
    dayDelta: buildDelta(latest?.value ?? null, first?.value ?? null),
    points: normalized
  };
}

export function normalizeSeries(metric: string, points: MetricPoint[]): MetricSeries | null {
  const normalizedMetric = normalizeMetricName(metric);
  if (!normalizedMetric) {
    return null;
  }

  return {
    metric: normalizedMetric,
    points: normalizePoints(points)
  };
}

export function createEmptyMetricSnapshots(): Record<MetricName, MetricSnapshot> {
  return METRIC_NAMES.reduce<Record<MetricName, MetricSnapshot>>((accumulator, metric) => {
    accumulator[metric] = buildMetricSnapshot([]);
    return accumulator;
  }, {} as Record<MetricName, MetricSnapshot>);
}

export function buildMetricSnapshots(seriesList: MetricSeries[]): Record<MetricName, MetricSnapshot> {
  const snapshots = createEmptyMetricSnapshots();
  for (const series of seriesList) {
    snapshots[series.metric] = buildMetricSnapshot(series.points);
  }
  return snapshots;
}
