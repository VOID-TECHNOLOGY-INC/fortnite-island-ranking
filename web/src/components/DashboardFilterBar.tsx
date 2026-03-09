import type { DashboardSort, DashboardTab, DashboardView, TimeWindow } from '../lib/types';

type Option = {
  label: string;
  value: string;
};

type Props = {
  windowValue: TimeWindow;
  tabValue: DashboardTab;
  sortValue: DashboardSort;
  queryValue: string;
  selectedTags: string[];
  creatorValue: string;
  viewValue: DashboardView;
  tagOptions: Option[];
  creatorOptions: Option[];
  searchHint?: string;
  onWindowChange: (value: TimeWindow) => void;
  onTabChange: (value: DashboardTab) => void;
  onSortChange: (value: DashboardSort) => void;
  onQueryChange: (value: string) => void;
  onTagToggle: (value: string) => void;
  onCreatorChange: (value: string) => void;
  onViewChange: (value: DashboardView) => void;
  onReset: () => void;
};

const WINDOWS: TimeWindow[] = ['10m', '1h', '24h'];
const TABS: DashboardTab[] = ['top', 'rising', 'watchlist'];
const VIEWS: DashboardView[] = ['table', 'cards'];

const WINDOW_LABELS: Record<TimeWindow, string> = {
  '10m': '10m',
  '1h': '1h',
  '24h': '24h'
};

const TAB_LABELS: Record<DashboardTab, string> = {
  top: 'Top',
  rising: 'Rising',
  watchlist: 'Watchlist'
};

const VIEW_LABELS: Record<DashboardView, string> = {
  table: 'Table',
  cards: 'Cards'
};

export function DashboardFilterBar({
  windowValue,
  tabValue,
  sortValue,
  queryValue,
  selectedTags,
  creatorValue,
  viewValue,
  tagOptions,
  creatorOptions,
  searchHint,
  onWindowChange,
  onTabChange,
  onSortChange,
  onQueryChange,
  onTagToggle,
  onCreatorChange,
  onViewChange,
  onReset
}: Props) {
  return (
    <section className="filter-shell">
      <div className="filter-shell__row">
        <div className="segmented-control" role="tablist" aria-label="Dashboard tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={tabValue === tab}
              className={tabValue === tab ? 'segmented-control__button is-active' : 'segmented-control__button'}
              onClick={() => onTabChange(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="segmented-control" aria-label="Window">
          {WINDOWS.map((window) => (
            <button
              key={window}
              type="button"
              className={windowValue === window ? 'segmented-control__button is-active' : 'segmented-control__button'}
              onClick={() => onWindowChange(window)}
            >
              {WINDOW_LABELS[window]}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-shell__row filter-shell__row--dense">
        <label className="field">
          <span className="field__label">Search</span>
          <input
            type="search"
            value={queryValue}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Island name or code"
          />
        </label>

        <label className="field field--compact">
          <span className="field__label">Sort</span>
          <select value={sortValue} onChange={(event) => onSortChange(event.target.value as DashboardSort)}>
            <option value="hype">HypeScore</option>
            <option value="uniquePlayers">Unique Players</option>
            <option value="peakCcu">Peak CCU</option>
            <option value="minutesPerPlayer">Minutes / Player</option>
            <option value="retentionD1">D1 Retention</option>
            <option value="recommends">Recommends</option>
            <option value="favorites">Favorites</option>
            <option value="latestChange">Latest Change</option>
          </select>
        </label>

        <label className="field field--compact">
          <span className="field__label">Creator</span>
          <select value={creatorValue} onChange={(event) => onCreatorChange(event.target.value)}>
            <option value="">All creators</option>
            {creatorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="segmented-control" aria-label="View">
          {VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              className={viewValue === view ? 'segmented-control__button is-active' : 'segmented-control__button'}
              onClick={() => onViewChange(view)}
            >
              {VIEW_LABELS[view]}
            </button>
          ))}
        </div>

        <button type="button" className="btn btn--ghost filter-shell__reset" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="filter-shell__tags" aria-label="Tags">
        {tagOptions.map((option) => {
          const active = selectedTags.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={active ? 'tag-pill is-active' : 'tag-pill'}
              onClick={() => onTagToggle(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {searchHint ? <p className="filter-shell__hint">{searchHint}</p> : null}
    </section>
  );
}
