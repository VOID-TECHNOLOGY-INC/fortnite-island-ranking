import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MetricSeries } from '../lib/types';

type Props = {
  series: MetricSeries[];
  selectedMetrics: string[];
  onSelectedMetricsChange: (metrics: string[]) => void;
};

const METRIC_LABELS: Record<string, string> = {
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

const METRIC_COLORS = ['#f97316', '#0f766e', '#c2410c', '#0ea5e9'];

function buildChartRows(series: MetricSeries[], selectedMetrics: string[]) {
  const rowMap = new Map<string, Record<string, number | string | null>>();

  for (const metric of series) {
    if (!selectedMetrics.includes(metric.metric)) {
      continue;
    }

    for (const point of metric.points) {
      const row = rowMap.get(point.ts) ?? { ts: point.ts };
      row[metric.metric] = point.value;
      rowMap.set(point.ts, row);
    }
  }

  return [...rowMap.values()].sort((left, right) => String(left.ts).localeCompare(String(right.ts)));
}

function toggleMetric(selectedMetrics: string[], metric: string) {
  if (selectedMetrics.includes(metric)) {
    return selectedMetrics.filter((item) => item !== metric);
  }
  return [...selectedMetrics.slice(-1), metric];
}

export function MetricsChart({ series, selectedMetrics, onSelectedMetricsChange }: Props) {
  const availableMetrics = series.filter((entry) => entry.points.length > 0);
  const rows = buildChartRows(availableMetrics, selectedMetrics);

  return (
    <section className="chart-card">
      <div className="chart-card__header">
        <div>
          <p className="chart-card__eyebrow">Metrics</p>
          <h3 className="chart-card__title">Trend lines</h3>
        </div>
        <div className="chart-card__toggles">
          {availableMetrics.map((entry) => {
            const active = selectedMetrics.includes(entry.metric);
            return (
              <button
                key={entry.metric}
                type="button"
                className={active ? 'tag-pill is-active' : 'tag-pill'}
                onClick={() => onSelectedMetricsChange(toggleMetric(selectedMetrics, entry.metric))}
              >
                {METRIC_LABELS[entry.metric] ?? entry.metric}
              </button>
            );
          })}
        </div>
      </div>

      <div className="chart-card__body">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows}>
            <XAxis dataKey="ts" tickFormatter={(value) => String(value).slice(11, 16)} minTickGap={32} />
            <YAxis width={72} />
            <Tooltip />
            {selectedMetrics.map((metric, index) => (
              <Line
                key={metric}
                dataKey={metric}
                type="monotone"
                stroke={METRIC_COLORS[index] ?? METRIC_COLORS[0]}
                strokeWidth={2.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
