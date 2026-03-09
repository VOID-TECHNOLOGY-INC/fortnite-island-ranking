type Props = {
  code: string;
  isInCompare: boolean;
  isWatchlisted: boolean;
  onToggleCompare: () => void;
  onToggleWatchlist: () => void;
  onCopyCode: () => void;
  onShare?: () => void;
  compact?: boolean;
};

export function IslandActions({
  code,
  isInCompare,
  isWatchlisted,
  onToggleCompare,
  onToggleWatchlist,
  onCopyCode,
  onShare,
  compact = false
}: Props) {
  return (
    <div className={`action-row${compact ? ' action-row--compact' : ''}`}>
      <button type="button" className="btn btn--ghost" onClick={onToggleCompare}>
        {isInCompare ? 'Remove Compare' : 'Add Compare'}
      </button>
      <button type="button" className="btn btn--ghost" onClick={onToggleWatchlist}>
        {isWatchlisted ? 'Saved' : 'Watchlist'}
      </button>
      <button type="button" className="btn btn--ghost" onClick={onCopyCode} aria-label={`Copy island code ${code}`}>
        Copy Code
      </button>
      {onShare ? (
        <button type="button" className="btn btn--ghost" onClick={onShare}>
          Share
        </button>
      ) : null}
    </div>
  );
}
