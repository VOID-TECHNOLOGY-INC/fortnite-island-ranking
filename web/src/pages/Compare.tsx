import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetchCompare } from '../lib/api';
import {
  clearCompareDraft,
  readCompareDraft,
  readRecentViews,
  readWatchlist,
  writeCompareDraft
} from '../lib/storage';
import type { CompareResponse, RecentViewEntry, WatchlistEntry } from '../lib/types';
import { useCompareQueryState } from '../lib/urlState';
import { CompareBreakdownCard } from '../components/CompareBreakdownCard';
import { CompareRadarCard } from '../components/CompareRadarCard';
import { CompareTrendChart } from '../components/CompareTrendChart';
import { EmptyState, ErrorState, LiveRegion, LoadingState } from '../components/StatusStates';
import { SummaryCards } from '../components/SummaryCards';

const METRIC_OPTIONS = ['uniquePlayers', 'peakCcu', 'minutesPerPlayer', 'retentionD1', 'recommends'];

function formatCompact(value: number | null | undefined) {
  if (value == null) {
    return 'No data';
  }

  return Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(value);
}

export default function Compare() {
  const [queryState, setQueryState] = useCompareQueryState();
  const [selectedMetric, setSelectedMetric] = useState('uniquePlayers');
  const [recentViews] = useState<RecentViewEntry[]>(() => readRecentViews());
  const [watchlist] = useState<WatchlistEntry[]>(() => readWatchlist());
  const [liveMessage, setLiveMessage] = useState('');

  const compareQuery = useSWR<CompareResponse>(
    queryState.codes.length >= 2 ? ['compare', queryState.window, queryState.codes.join(',')] : null,
    () => fetchCompare(queryState.codes, queryState.window)
  );

  useEffect(() => {
    if (queryState.codes.length > 0) {
      writeCompareDraft(queryState.codes);
      return;
    }

    const draft = readCompareDraft();
    if (draft?.codes.length) {
      setQueryState({ codes: draft.codes }, { replace: true });
    }
  }, [queryState.codes, setQueryState]);

  useEffect(() => {
    if (!liveMessage) {
      return;
    }

    const timer = window.setTimeout(() => setLiveMessage(''), 1600);
    return () => window.clearTimeout(timer);
  }, [liveMessage]);

  const summaryItems = useMemo(() => {
    if (!compareQuery.data) {
      return [];
    }

    const hypeLeader = [...compareQuery.data.islands].sort(
      (left, right) => (right.island.hypeScore ?? 0) - (left.island.hypeScore ?? 0)
    )[0];
    const retentionLeader = [...compareQuery.data.islands].sort(
      (left, right) => (right.island.metrics.retentionD1 ?? 0) - (left.island.metrics.retentionD1 ?? 0)
    )[0];

    return [
      {
        label: 'Compared islands',
        value: String(compareQuery.data.islands.length),
        helper: queryState.window
      },
      {
        label: 'Highest HypeScore',
        value: hypeLeader?.island.name ?? 'No data',
        helper: hypeLeader ? formatCompact(hypeLeader.island.hypeScore) : 'No data',
        tone: 'accent' as const
      },
      {
        label: 'Best D1 retention',
        value: retentionLeader?.island.name ?? 'No data',
        helper: retentionLeader ? formatCompact(retentionLeader.island.metrics.retentionD1) : 'No data',
        tone: 'positive' as const
      }
    ];
  }, [compareQuery.data, queryState.window]);

  const suggestionPool = useMemo(() => {
    const seen = new Set<string>();
    const items = [...watchlist, ...recentViews]
      .filter((entry) => {
        if (seen.has(entry.code)) {
          return false;
        }
        seen.add(entry.code);
        return true;
      })
      .slice(0, 12);

    return items;
  }, [recentViews, watchlist]);

  const toggleCode = (code: string) => {
    const exists = queryState.codes.includes(code);
    const nextCodes = exists
      ? queryState.codes.filter((item) => item !== code)
      : [...queryState.codes, code].slice(0, 4);

    setQueryState({ codes: nextCodes }, { replace: false });
    if (nextCodes.length === 0) {
      clearCompareDraft();
    } else {
      writeCompareDraft(nextCodes);
    }
    setLiveMessage(exists ? `${code} removed from compare` : `${code} added to compare`);
  };

  const handleCopyUrl = async () => {
    const url = new URL('/compare', window.location.origin);
    url.searchParams.set('window', queryState.window);
    url.searchParams.set('codes', queryState.codes.join(','));
    await navigator.clipboard?.writeText(url.toString());
    setLiveMessage('Compare URL copied');
  };

  const compare = compareQuery.data;

  return (
    <div className="page-shell">
      <LiveRegion message={liveMessage} />

      <section className="hero-panel hero-panel--detail">
        <div>
          <p className="hero-panel__eyebrow">Compare</p>
          <h1 className="hero-panel__title">Compare up to four islands side by side.</h1>
          <p className="hero-panel__detail">
            Compare state persists in both the URL and localStorage so the same basket can be reopened from Home or Detail.
          </p>
        </div>
        <div className="hero-panel__meta hero-panel__meta--actions">
          <div className="segmented-control" aria-label="Window">
            {(['10m', '1h', '24h'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={queryState.window === value ? 'segmented-control__button is-active' : 'segmented-control__button'}
                onClick={() => setQueryState({ window: value })}
              >
                {value}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--ghost" onClick={handleCopyUrl} disabled={queryState.codes.length < 2}>
            Copy Compare URL
          </button>
        </div>
      </section>

      <section className="compare-basket">
        {queryState.codes.length > 0 ? (
          queryState.codes.map((code) => (
            <button key={code} type="button" className="tag-pill is-active" onClick={() => toggleCode(code)}>
              {code} ×
            </button>
          ))
        ) : (
          <p className="sidecar-card__empty">No islands selected yet.</p>
        )}
      </section>

      {queryState.codes.length < 2 ? (
        <EmptyState
          title="Select at least two islands"
          detail="Add islands from the dashboard, detail page, watchlist, or recently viewed list to start comparing."
        />
      ) : null}

      {queryState.codes.length < 2 && suggestionPool.length > 0 ? (
        <section className="sidecar-card">
          <div className="sidecar-card__header">
            <div>
              <p className="sidecar-card__eyebrow">Suggestions</p>
              <h2 className="sidecar-card__title">Watchlist and recent views</h2>
            </div>
          </div>
          <div className="sidecar-chip-list">
            {suggestionPool.map((entry) => (
              <button key={entry.code} type="button" className="tag-pill" onClick={() => toggleCode(entry.code)}>
                {entry.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {!compareQuery.data && compareQuery.isLoading ? (
        <LoadingState title="Loading compare view" detail="Preparing KPI tables, trend lines, and normalized score shapes." />
      ) : null}

      {compareQuery.error ? (
        <ErrorState
          title="Compare data could not be loaded"
          detail={String(compareQuery.error.message || compareQuery.error)}
          actionLabel="Retry"
          onAction={() => compareQuery.mutate()}
        />
      ) : null}

      {compare ? (
        <>
          <SummaryCards items={summaryItems} />

          <section className="compare-layout">
            <section className="detail-summary-card">
              <div>
                <p className="detail-summary-card__eyebrow">Comparison matrix</p>
                <h2 className="detail-summary-card__title">KPI table</h2>
              </div>
              <div className="compare-table-wrapper">
                <table className="table compare-table">
                  <thead>
                    <tr>
                      <th scope="col">Metric</th>
                      {compare.islands.map((entry) => (
                        <th key={entry.island.code} scope="col">
                          {entry.island.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRIC_OPTIONS.map((metric) => (
                      <tr key={metric}>
                        <th scope="row">{metric}</th>
                        {compare.islands.map((entry) => (
                          <td key={`${entry.island.code}-${metric}`}>
                            {formatCompact(entry.island.metrics[metric as keyof typeof entry.island.metrics])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="chart-card__toggles">
              {METRIC_OPTIONS.map((metric) => (
                <button
                  key={metric}
                  type="button"
                  className={selectedMetric === metric ? 'tag-pill is-active' : 'tag-pill'}
                  onClick={() => setSelectedMetric(metric)}
                >
                  {metric}
                </button>
              ))}
            </div>

            <CompareTrendChart compare={compare} metric={selectedMetric} />
            <CompareRadarCard compare={compare} />
            <CompareBreakdownCard compare={compare} />
          </section>

          <section className="sidecar-card">
            <div className="sidecar-card__header">
              <div>
                <p className="sidecar-card__eyebrow">Linked</p>
                <h2 className="sidecar-card__title">Open an island detail</h2>
              </div>
            </div>
            <ul className="sidecar-list">
              {compare.islands.map((entry) => (
                <li key={entry.island.code}>
                  <Link to={`/island/${entry.island.code}?name=${encodeURIComponent(entry.island.name)}&window=${queryState.window}`}>
                    {entry.island.name}
                  </Link>
                  <button type="button" className="link-button" onClick={() => toggleCode(entry.island.code)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
