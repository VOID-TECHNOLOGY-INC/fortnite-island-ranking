import { Link } from 'react-router-dom';
import type { RankedIslandSummary, TimeWindow } from '../lib/types';
import { IslandActions } from './IslandActions';

type Props = {
  items: RankedIslandSummary[];
  windowValue: TimeWindow;
  compareCodes: string[];
  watchlistCodes: string[];
  onToggleCompare: (item: RankedIslandSummary) => void;
  onToggleWatchlist: (item: RankedIslandSummary) => void;
  onCopyCode: (code: string) => void;
};

function formatCompact(value: number | null) {
  if (value == null) {
    return 'No data';
  }

  return Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(value);
}

function formatChange(value: number | null | undefined) {
  if (value == null) {
    return 'No change data';
  }
  return `${value > 0 ? '+' : ''}${Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}`;
}

export function RankingTable({
  items,
  windowValue,
  compareCodes,
  watchlistCodes,
  onToggleCompare,
  onToggleWatchlist,
  onCopyCode
}: Props) {
  if (items.length === 0) return <p>No data</p>;

  return (
    <table className="table islands-table">
      <colgroup>
        <col style={{ width: 48 }} />
        <col style={{ width: '26%' }} />
        <col style={{ width: 132 }} />
        <col style={{ width: 132 }} />
        <col style={{ width: 132 }} />
        <col style={{ width: 148 }} />
        <col style={{ width: 240 }} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Island</th>
          <th scope="col">HypeScore</th>
          <th scope="col">Unique</th>
          <th scope="col">Peak CCU</th>
          <th scope="col">Latest Change</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr key={item.code}>
            <td className="table-rank">{item.rank ?? index + 1}</td>
            <td className="island-cell">
              <Link to={`/island/${item.code}?name=${encodeURIComponent(item.name)}&window=${windowValue}`} className="table-link">
                <strong className="island-name">{item.name}</strong>
                <span className="island-meta">
                  {item.creator} · {item.code}
                </span>
              </Link>
              <div className="table-tag-row">
                {item.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="tag-pill tag-pill--read-only">
                    {tag}
                  </span>
                ))}
              </div>
            </td>
            <td>{formatCompact(item.hypeScore)}</td>
            <td>{formatCompact(item.metrics.uniquePlayers)}</td>
            <td>{formatCompact(item.metrics.peakCcu)}</td>
            <td>{formatChange(item.deltas.latestChange ?? null)}</td>
            <td>
              <IslandActions
                compact
                code={item.code}
                isInCompare={compareCodes.includes(item.code)}
                isWatchlisted={watchlistCodes.includes(item.code)}
                onToggleCompare={() => onToggleCompare(item)}
                onToggleWatchlist={() => onToggleWatchlist(item)}
                onCopyCode={() => onCopyCode(item.code)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
