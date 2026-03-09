import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CompareResponse } from '../lib/types';

type Props = {
  compare: CompareResponse;
  metric: string;
};

const COLORS = ['#f97316', '#0f766e', '#0ea5e9', '#6d28d9'];

function buildRows(compare: CompareResponse, metric: string) {
  const rowMap = new Map<string, Record<string, number | string | null>>();

  for (const island of compare.islands) {
    const targetSeries = island.series.find((entry) => entry.metric === metric);
    if (!targetSeries) {
      continue;
    }

    for (const point of targetSeries.points) {
      const row = rowMap.get(point.ts) ?? { ts: point.ts };
      row[island.island.code] = point.value;
      rowMap.set(point.ts, row);
    }
  }

  return [...rowMap.values()].sort((left, right) => String(left.ts).localeCompare(String(right.ts)));
}

export function CompareTrendChart({ compare, metric }: Props) {
  const rows = buildRows(compare, metric);

  return (
    <section className="chart-card">
      <div className="chart-card__header">
        <div>
          <p className="chart-card__eyebrow">Compare</p>
          <h3 className="chart-card__title">{metric}</h3>
        </div>
      </div>
      <div className="chart-card__body">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows}>
            <XAxis dataKey="ts" tickFormatter={(value) => String(value).slice(11, 16)} minTickGap={32} />
            <YAxis width={72} />
            <Tooltip />
            {compare.islands.map((entry, index) => (
              <Line
                key={entry.island.code}
                dataKey={entry.island.code}
                name={entry.island.name}
                type="monotone"
                stroke={COLORS[index] ?? COLORS[0]}
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
