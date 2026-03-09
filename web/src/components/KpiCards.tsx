import type { IslandMetricName, MetricDelta, SummaryMetricMap } from '../lib/types';

type Props = {
  metrics: SummaryMetricMap;
  deltas: Partial<Record<IslandMetricName, MetricDelta>>;
  formatNumber: (value: number | null) => string;
};

const KPI_ORDER: Array<{ key: keyof SummaryMetricMap; label: string }> = [
  { key: 'uniquePlayers', label: 'Unique Players' },
  { key: 'peakCcu', label: 'Peak CCU' },
  { key: 'minutesPerPlayer', label: 'Minutes / Player' },
  { key: 'retentionD1', label: 'D1 Retention' },
  { key: 'recommends', label: 'Recommends' },
  { key: 'favorites', label: 'Favorites' }
];

function formatDelta(value: number | null) {
  if (value == null) {
    return 'No change data';
  }
  if (value === 0) {
    return 'Flat';
  }
  return `${value > 0 ? '+' : ''}${Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}`;
}

export function KpiCards({ metrics, deltas, formatNumber }: Props) {
  return (
    <section className="kpi-grid">
      {KPI_ORDER.map(({ key, label }) => (
        <article key={key} className="kpi-card">
          <p className="kpi-card__label">{label}</p>
          <p className="kpi-card__value">{formatNumber(metrics[key])}</p>
          <p className="kpi-card__delta">{formatDelta(deltas[key]?.delta ?? null)}</p>
        </article>
      ))}
    </section>
  );
}
