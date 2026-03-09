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

export function RankingCards({
  items,
  windowValue,
  compareCodes,
  watchlistCodes,
  onToggleCompare,
  onToggleWatchlist,
  onCopyCode
}: Props) {
  return (
    <div className="ranking-card-list">
      {items.map((item, index) => (
        <article key={item.code} className="ranking-card">
          <div className="ranking-card__header">
            <div>
              <p className="ranking-card__rank">#{item.rank ?? index + 1}</p>
              <h3 className="ranking-card__title">
                <Link to={`/island/${item.code}?name=${encodeURIComponent(item.name)}&window=${windowValue}`}>{item.name}</Link>
              </h3>
            </div>
            <div className="ranking-card__score">
              <span>HypeScore</span>
              <strong>{formatCompact(item.hypeScore)}</strong>
            </div>
          </div>

          <p className="ranking-card__meta">
            <span>{item.creator}</span>
            <span>{item.code}</span>
          </p>

          <dl className="ranking-card__stats">
            <div>
              <dt>Unique</dt>
              <dd>{formatCompact(item.metrics.uniquePlayers)}</dd>
            </div>
            <div>
              <dt>Peak</dt>
              <dd>{formatCompact(item.metrics.peakCcu)}</dd>
            </div>
            <div>
              <dt>D1</dt>
              <dd>{formatCompact(item.metrics.retentionD1)}</dd>
            </div>
            <div>
              <dt>Change</dt>
              <dd>{formatChange(item.deltas.latestChange ?? null)}</dd>
            </div>
          </dl>

          <div className="ranking-card__tags">
            {item.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="tag-pill tag-pill--read-only">
                {tag}
              </span>
            ))}
          </div>

          <IslandActions
            code={item.code}
            compact
            isInCompare={compareCodes.includes(item.code)}
            isWatchlisted={watchlistCodes.includes(item.code)}
            onToggleCompare={() => onToggleCompare(item)}
            onToggleWatchlist={() => onToggleWatchlist(item)}
            onCopyCode={() => onCopyCode(item.code)}
          />
        </article>
      ))}
    </div>
  );
}
