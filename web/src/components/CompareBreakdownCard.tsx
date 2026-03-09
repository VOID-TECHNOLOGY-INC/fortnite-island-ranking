import type { CompareResponse, HypeScoreComponent } from '../lib/types';

type Props = {
  compare: CompareResponse;
};

type BreakdownRow = {
  metric: HypeScoreComponent['metric'];
  label: string;
  weight: number;
};

function buildRows(compare: CompareResponse): BreakdownRow[] {
  const rows = new Map<BreakdownRow['metric'], BreakdownRow>();

  for (const entry of compare.islands) {
    for (const component of entry.island.breakdown) {
      if (rows.has(component.metric)) {
        continue;
      }

      rows.set(component.metric, {
        metric: component.metric,
        label: component.label,
        weight: component.weight
      });
    }
  }

  return [...rows.values()];
}

function formatNumber(value: number | null | undefined, suffix = '') {
  if (value == null) {
    return 'No data';
  }

  return `${Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1
  }).format(value)}${suffix}`;
}

function findComponent(compare: CompareResponse, islandCode: string, metric: BreakdownRow['metric']) {
  return compare.islands
    .find((entry) => entry.island.code === islandCode)
    ?.island.breakdown.find((component) => component.metric === metric);
}

export function CompareBreakdownCard({ compare }: Props) {
  const rows = buildRows(compare);

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="detail-summary-card">
      <div>
        <p className="detail-summary-card__eyebrow">HypeScore beta</p>
        <h2 className="detail-summary-card__title">Score breakdown</h2>
      </div>

      <div className="compare-breakdown-table-wrapper">
        <table className="table compare-breakdown-table">
          <thead>
            <tr>
              <th scope="col">Component</th>
              {compare.islands.map((entry) => (
                <th key={entry.island.code} scope="col">
                  {entry.island.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric}>
                <th scope="row">
                  <div className="compare-breakdown-table__metric">
                    <strong>{row.label}</strong>
                    <span>Weight {formatNumber(row.weight * 100, '%')}</span>
                  </div>
                </th>
                {compare.islands.map((entry) => {
                  const component = findComponent(compare, entry.island.code, row.metric);

                  return (
                    <td key={`${entry.island.code}-${row.metric}`}>
                      <div className="compare-breakdown-table__cell">
                        <strong>{formatNumber(component?.contribution)}</strong>
                        <span>
                          {component?.normalizedValue != null
                            ? `${formatNumber(component.normalizedValue)} normalized`
                            : 'Missing in current window'}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row">
                <div className="compare-breakdown-table__metric">
                  <strong>Total HypeScore</strong>
                  <span>Weighted total</span>
                </div>
              </th>
              {compare.islands.map((entry) => (
                <td key={`${entry.island.code}-total`}>
                  <div className="compare-breakdown-table__cell">
                    <strong>{formatNumber(entry.island.hypeScore)}</strong>
                    <span>{entry.island.code}</span>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
