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

export function RelatedIslandList({
  items,
  windowValue,
  compareCodes,
  watchlistCodes,
  onToggleCompare,
  onToggleWatchlist,
  onCopyCode
}: Props) {
  return (
    <section className="card-stack">
      {items.map((item) => (
        <article key={item.code} className="related-card">
          <div className="related-card__main">
            <p className="related-card__eyebrow">{item.creator}</p>
            <h3 className="related-card__title">
              <Link to={`/island/${item.code}?name=${encodeURIComponent(item.name)}&window=${windowValue}`}>{item.name}</Link>
            </h3>
            <p className="related-card__meta">{item.tags.join(' · ') || 'No tags'}</p>
          </div>
          <IslandActions
            compact
            code={item.code}
            isInCompare={compareCodes.includes(item.code)}
            isWatchlisted={watchlistCodes.includes(item.code)}
            onToggleCompare={() => onToggleCompare(item)}
            onToggleWatchlist={() => onToggleWatchlist(item)}
            onCopyCode={() => onCopyCode(item.code)}
          />
        </article>
      ))}
    </section>
  );
}
