import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import type { CompareResponse } from '../lib/types';

type Props = {
  compare: CompareResponse;
};

const COLORS = ['#f97316', '#0f766e', '#0ea5e9', '#6d28d9'];
const METRICS = ['uniquePlayers', 'peakCcu', 'minutesPerPlayer', 'retentionD1', 'recommends'];

function buildRows(compare: CompareResponse) {
  return METRICS.map((metric) => {
    const row: Record<string, string | number> = { metric };
    for (const entry of compare.islands) {
      const value = entry.island.metrics[metric as keyof typeof entry.island.metrics];
      row[entry.island.code] = value ?? 0;
    }
    return row;
  });
}

export function CompareRadarCard({ compare }: Props) {
  const rows = buildRows(compare);

  return (
    <section className="chart-card">
      <div className="chart-card__header">
        <div>
          <p className="chart-card__eyebrow">Compare</p>
          <h3 className="chart-card__title">Metric shape</h3>
        </div>
      </div>
      <div className="chart-card__body">
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={rows}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" />
            {compare.islands.map((entry, index) => (
              <Radar
                key={entry.island.code}
                name={entry.island.name}
                dataKey={entry.island.code}
                stroke={COLORS[index] ?? COLORS[0]}
                fill={COLORS[index] ?? COLORS[0]}
                fillOpacity={0.12}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
