import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetchDashboard, fetchIslands } from '../lib/api';
import {
  clearCompareDraft,
  pushRecentSearch,
  readCompareDraft,
  readRecentSearches,
  readRecentViews,
  readWatchlist,
  removeWatchlist,
  upsertWatchlist,
  writeCompareDraft
} from '../lib/storage';
import type {
  DashboardResponse,
  Island,
  RankedIslandSummary,
  RecentSearchEntry,
  RecentViewEntry,
  WatchlistEntry
} from '../lib/types';
import { DEFAULT_HOME_QUERY_STATE, toDashboardRequest, useHomeQueryState } from '../lib/urlState';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import { RankingCards } from '../components/RankingCards';
import { RankingTable } from '../components/RankingTable';
import { EmptyState, ErrorState, LiveRegion, LoadingState } from '../components/StatusStates';
import { SummaryCards } from '../components/SummaryCards';

function formatCompact(value: number | null | undefined) {
  if (value == null) {
    return 'No data';
  }

  return Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(value);
}

function toWatchlistSummary(entry: WatchlistEntry): RankedIslandSummary {
  return {
    code: entry.code,
    name: entry.name,
    creator: entry.creator,
    tags: entry.tags ?? [],
    hypeScore: 0,
    metrics: {
      uniquePlayers: null,
      peakCcu: null,
      minutesPerPlayer: null,
      retentionD1: null,
      retentionD7: null,
      recommends: null,
      favorites: null
    },
    deltas: {
      latestChange: null
    },
    breakdown: []
  };
}

function toSearchSummary(island: Island): RankedIslandSummary {
  return {
    code: island.code,
    name: island.name,
    creator: island.creator,
    tags: island.tags,
    hypeScore: 0,
    metrics: {
      uniquePlayers: null,
      peakCcu: null,
      minutesPerPlayer: null,
      retentionD1: null,
      retentionD7: null,
      recommends: null,
      favorites: null
    },
    deltas: {
      latestChange: null
    },
    breakdown: []
  };
}

function facetToOption(input: string | { value: string; count?: number }) {
  if (typeof input === 'string') {
    return { value: input, label: input };
  }

  return {
    value: input.value,
    label: input.count != null ? `${input.value} (${input.count})` : input.value
  };
}

export function Home() {
  const [queryState, setQueryState] = useHomeQueryState();
  const [searchInput, setSearchInput] = useState(queryState.query);
  const deferredSearchInput = useDeferredValue(searchInput);
  const [compareCodes, setCompareCodes] = useState<string[]>(() => readCompareDraft()?.codes ?? []);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(() => readWatchlist());
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>(() => readRecentSearches());
  const [recentViews, setRecentViews] = useState<RecentViewEntry[]>(() => readRecentViews());
  const [liveMessage, setLiveMessage] = useState('');

  const { data: dashboard, error, isLoading, mutate } = useSWR<DashboardResponse>(
    ['dashboard', queryState.window, queryState.sort, queryState.tags.join(','), queryState.creator],
    () => fetchDashboard(toDashboardRequest(queryState))
  );

  const searchEnabled = queryState.query.trim().length >= 2;
  const { data: searchResults } = useSWR<Island[]>(
    searchEnabled ? ['search', queryState.window, queryState.query] : null,
    () => fetchIslands({ window: queryState.window, query: queryState.query, limit: 16 })
  );

  useEffect(() => {
    setSearchInput(queryState.query);
  }, [queryState.query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = deferredSearchInput.trim();
      if (normalized === queryState.query) {
        return;
      }

      startTransition(() => {
        setQueryState({ query: normalized }, { replace: true });
      });

      if (normalized.length >= 2) {
        setRecentSearches(pushRecentSearch(normalized));
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [deferredSearchInput, queryState.query, setQueryState]);

  useEffect(() => {
    setCompareCodes(readCompareDraft()?.codes ?? []);
  }, []);

  useEffect(() => {
    if (!liveMessage) {
      return;
    }

    const timer = window.setTimeout(() => setLiveMessage(''), 1600);
    return () => window.clearTimeout(timer);
  }, [liveMessage]);

  const tagOptions = useMemo(
    () => (dashboard?.facets.tags ?? []).map((entry) => facetToOption(entry as never)),
    [dashboard?.facets.tags]
  );
  const creatorOptions = useMemo(
    () => (dashboard?.facets.creators ?? []).map((entry) => facetToOption(entry as never)),
    [dashboard?.facets.creators]
  );

  const dashboardLookup = useMemo(() => {
    const lookup = new Map<string, RankedIslandSummary>();
    for (const item of [
      ...(dashboard?.ranking ?? []),
      ...(dashboard?.rising ?? []),
      ...(dashboard?.highRetention ?? []),
      ...(dashboard?.highRecommend ?? [])
    ]) {
      lookup.set(item.code, item);
    }
    return lookup;
  }, [dashboard]);

  const compareLookup = useMemo(
    () => compareCodes.map((code) => dashboardLookup.get(code)).filter(Boolean) as RankedIslandSummary[],
    [compareCodes, dashboardLookup]
  );

  const watchlistItems = useMemo(
    () => watchlist.map((entry) => dashboardLookup.get(entry.code) ?? toWatchlistSummary(entry)),
    [dashboardLookup, watchlist]
  );

  const displayedItems = useMemo(() => {
    if (searchEnabled) {
      return (searchResults ?? []).map(toSearchSummary);
    }
    if (queryState.tab === 'rising') {
      return dashboard?.rising ?? [];
    }
    if (queryState.tab === 'watchlist') {
      return watchlistItems;
    }
    return dashboard?.ranking ?? [];
  }, [dashboard?.ranking, dashboard?.rising, queryState.tab, searchEnabled, searchResults, watchlistItems]);

  const summaryItems = useMemo(
    () => [
      {
        label: 'Top Islands',
        value: dashboard?.ranking[0]?.name ?? 'No data',
        helper: dashboard?.ranking[0] ? `${formatCompact(dashboard.ranking[0].metrics.uniquePlayers)} unique players` : 'Waiting for data',
        tone: 'accent' as const
      },
      {
        label: 'Rising Now',
        value: dashboard?.rising[0]?.name ?? 'No data',
        helper:
          dashboard?.rising[0]?.deltas.uniquePlayers?.delta != null
            ? `${formatCompact(dashboard.rising[0].deltas.uniquePlayers?.delta)} latest change`
            : 'Waiting for data',
        tone: 'positive' as const
      },
      {
        label: 'Most Retained',
        value: dashboard?.highRetention[0]?.name ?? 'No data',
        helper: dashboard?.highRetention[0] ? `D1 ${formatCompact(dashboard.highRetention[0].metrics.retentionD1)}` : 'Waiting for data'
      },
      {
        label: 'Most Recommended',
        value: dashboard?.highRecommend[0]?.name ?? 'No data',
        helper: dashboard?.highRecommend[0] ? `${formatCompact(dashboard.highRecommend[0].metrics.recommends)} recommends` : 'Waiting for data'
      }
    ],
    [dashboard]
  );

  const searchHint = useMemo(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length === 1) {
      return 'Use at least 2 characters to switch into search mode. Rankings stay visible until then.';
    }
    if (searchEnabled) {
      return `${displayedItems.length} results for "${queryState.query}".`;
    }
    return undefined;
  }, [displayedItems.length, queryState.query, searchEnabled, searchInput]);

  const prefersCards =
    queryState.view === 'cards' ||
    (typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 820px)').matches &&
      !new URLSearchParams(window.location.search).get('view'));

  const handleToggleCompare = (item: RankedIslandSummary) => {
    const exists = compareCodes.includes(item.code);
    const nextCodes = exists
      ? compareCodes.filter((code) => code !== item.code)
      : [...compareCodes, item.code].slice(0, 4);

    setCompareCodes(nextCodes);
    if (nextCodes.length === 0) {
      clearCompareDraft();
    } else {
      writeCompareDraft(nextCodes);
    }
    setLiveMessage(exists ? `${item.name} removed from compare` : `${item.name} added to compare`);
  };

  const handleToggleWatchlist = (item: RankedIslandSummary) => {
    const exists = watchlist.some((entry) => entry.code === item.code);
    const nextWatchlist = exists
      ? removeWatchlist(item.code)
      : upsertWatchlist({
          code: item.code,
          name: item.name,
          creator: item.creator,
          tags: item.tags
        });

    setWatchlist(nextWatchlist);
    setLiveMessage(exists ? `${item.name} removed from watchlist` : `${item.name} saved to watchlist`);
  };

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard?.writeText(code);
    setLiveMessage(`${code} copied`);
  };

  const resetFilters = () => {
    setSearchInput('');
    setQueryState({
      ...DEFAULT_HOME_QUERY_STATE,
      view: prefersCards ? 'cards' : 'table'
    });
  };

  return (
    <div className="page-shell">
      <LiveRegion message={liveMessage} />

      <section className="hero-panel">
        <div>
          <p className="hero-panel__eyebrow">Fortnite Island Dashboard v2</p>
          <h1 className="hero-panel__title">See what is strong, what is rising, and why it matters.</h1>
          <p className="hero-panel__detail">
            Dashboard rankings stay filterable by window, tags, and creator. Search switches into direct island lookup once the query has two or more characters.
          </p>
        </div>
        <div className="hero-panel__meta">
          <p>Updated {dashboard?.updatedAt ? new Date(dashboard.updatedAt).toLocaleString() : 'waiting'}</p>
          <p>{dashboard?.degraded ? 'Partial upstream data detected.' : 'All sections sourced from the dashboard snapshot.'}</p>
        </div>
      </section>

      <DashboardFilterBar
        windowValue={queryState.window}
        tabValue={queryState.tab}
        sortValue={queryState.sort}
        queryValue={searchInput}
        selectedTags={queryState.tags}
        creatorValue={queryState.creator}
        viewValue={prefersCards ? 'cards' : queryState.view}
        tagOptions={tagOptions}
        creatorOptions={creatorOptions}
        searchHint={searchHint}
        onWindowChange={(value) => setQueryState({ window: value })}
        onTabChange={(value) => setQueryState({ tab: value })}
        onSortChange={(value) => setQueryState({ sort: value })}
        onQueryChange={setSearchInput}
        onTagToggle={(value) =>
          setQueryState((current) => ({
            tags: current.tags.includes(value)
              ? current.tags.filter((tag) => tag !== value)
              : [...current.tags, value]
          }))
        }
        onCreatorChange={(value) => setQueryState({ creator: value })}
        onViewChange={(value) => setQueryState({ view: value })}
        onReset={resetFilters}
      />

      {!dashboard && isLoading ? (
        <LoadingState title="Building the dashboard snapshot" detail="Fetching ranking, rising, retention, and recommendation slices." />
      ) : null}

      {error ? (
        <ErrorState
          title="Dashboard data could not be loaded"
          detail={String(error.message || error)}
          actionLabel="Retry"
          onAction={() => mutate()}
        />
      ) : null}

      {dashboard ? <SummaryCards items={summaryItems} /> : null}

      {!isLoading && !error && displayedItems.length === 0 ? (
        <EmptyState
          title={searchEnabled ? 'No islands matched this query' : 'No islands matched the current filters'}
          detail={searchEnabled ? 'Try a different island code, title fragment, or clear the search.' : 'Reset tags and creator filters to widen the candidate set.'}
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : null}

      {!isLoading && !error && displayedItems.length > 0 ? (
        prefersCards ? (
          <RankingCards
            items={displayedItems}
            windowValue={queryState.window}
            compareCodes={compareCodes}
            watchlistCodes={watchlist.map((entry) => entry.code)}
            onToggleCompare={handleToggleCompare}
            onToggleWatchlist={handleToggleWatchlist}
            onCopyCode={handleCopyCode}
          />
        ) : (
          <RankingTable
            items={displayedItems}
            windowValue={queryState.window}
            compareCodes={compareCodes}
            watchlistCodes={watchlist.map((entry) => entry.code)}
            onToggleCompare={handleToggleCompare}
            onToggleWatchlist={handleToggleWatchlist}
            onCopyCode={handleCopyCode}
          />
        )
      ) : null}

      <section className="dashboard-sidecar">
        <article className="sidecar-card">
          <div className="sidecar-card__header">
            <div>
              <p className="sidecar-card__eyebrow">Snapshot</p>
              <h2 className="sidecar-card__title">Data range and source</h2>
            </div>
          </div>
          <ul className="sidecar-list">
            <li>
              <strong>Window</strong>
              <span>{queryState.window} dashboard snapshot</span>
            </li>
            <li>
              <strong>Updated</strong>
              <span>{dashboard?.updatedAt ? new Date(dashboard.updatedAt).toLocaleString() : 'Waiting for snapshot'}</span>
            </li>
            <li>
              <strong>Source</strong>
              <span>Fortnite Data API via cached dashboard endpoints</span>
            </li>
            <li>
              <strong>Search mode</strong>
              <span>2+ characters switch to direct lookup while filters stay URL-synced.</span>
            </li>
          </ul>
        </article>

        <article className="sidecar-card">
          <div className="sidecar-card__header">
            <div>
              <p className="sidecar-card__eyebrow">Compare</p>
              <h2 className="sidecar-card__title">Compare basket</h2>
            </div>
            {compareCodes.length >= 2 ? (
              <Link to={`/compare?codes=${compareCodes.join(',')}&window=${queryState.window}`} className="btn btn--primary">
                Open Compare
              </Link>
            ) : null}
          </div>
          {compareLookup.length > 0 ? (
            <ul className="sidecar-list">
              {compareLookup.map((item) => (
                <li key={item.code}>
                  <strong>{item.name}</strong>
                  <span>{item.code}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sidecar-card__empty">Add 2 to 4 islands from the ranking to compare them.</p>
          )}
        </article>

        <article className="sidecar-card">
          <div className="sidecar-card__header">
            <div>
              <p className="sidecar-card__eyebrow">History</p>
              <h2 className="sidecar-card__title">Recently viewed</h2>
            </div>
          </div>
          {recentViews.length > 0 ? (
            <ul className="sidecar-list">
              {recentViews.map((item) => (
                <li key={item.code}>
                  <Link to={`/island/${item.code}?name=${encodeURIComponent(item.name)}&window=${item.window}`}>{item.name}</Link>
                  <span>{item.window}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sidecar-card__empty">Island detail visits will appear here.</p>
          )}
        </article>

        <article className="sidecar-card">
          <div className="sidecar-card__header">
            <div>
              <p className="sidecar-card__eyebrow">History</p>
              <h2 className="sidecar-card__title">Recent searches</h2>
            </div>
          </div>
          {recentSearches.length > 0 ? (
            <div className="sidecar-chip-list">
              {recentSearches.map((entry) => (
                <button
                  key={entry.query}
                  type="button"
                  className="tag-pill"
                  onClick={() => {
                    setSearchInput(entry.query);
                    setRecentSearches(readRecentSearches());
                  }}
                >
                  {entry.query}
                </button>
              ))}
            </div>
          ) : (
            <p className="sidecar-card__empty">Search history appears after the first debounced search.</p>
          )}
        </article>

        <article className="sidecar-card">
          <div className="sidecar-card__header">
            <div>
              <p className="sidecar-card__eyebrow">Saved</p>
              <h2 className="sidecar-card__title">Watchlist</h2>
            </div>
          </div>
          {watchlistItems.length > 0 ? (
            <ul className="sidecar-list">
              {watchlistItems.map((item) => (
                <li key={item.code}>
                  <Link to={`/island/${item.code}?name=${encodeURIComponent(item.name)}&window=${queryState.window}`}>{item.name}</Link>
                  <button type="button" className="link-button" onClick={() => handleToggleWatchlist(item)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sidecar-card__empty">Save islands to keep a lightweight watchlist on the dashboard.</p>
          )}
        </article>
      </section>
    </div>
  );
}
