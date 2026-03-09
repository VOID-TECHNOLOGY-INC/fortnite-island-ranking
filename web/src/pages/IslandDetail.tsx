import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useSWR from 'swr';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { fetchIslandOverview, fetchIslandResearch } from '../lib/api';
import {
  clearCompareDraft,
  pushRecentView,
  readCompareDraft,
  readWatchlist,
  removeWatchlist,
  upsertWatchlist,
  writeCompareDraft
} from '../lib/storage';
import type { MetricDelta, RankedIslandSummary } from '../lib/types';
import { useDetailWindowState } from '../lib/urlState';
import { IslandActions } from '../components/IslandActions';
import { KpiCards } from '../components/KpiCards';
import { MetricsChart } from '../components/MetricsChart';
import { RelatedIslandList } from '../components/RelatedIslandList';
import { EmptyState, ErrorState, LiveRegion, LoadingState } from '../components/StatusStates';

function formatCompact(value: number | null | undefined) {
  if (value == null) {
    return 'No data';
  }

  return Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(value);
}

function formatDelta(delta: MetricDelta | undefined) {
  if (!delta || delta.delta == null) {
    return 'No change data';
  }
  return `${delta.delta > 0 ? '+' : ''}${Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(delta.delta)}`;
}

export default function IslandDetail() {
  const { code } = useParams();
  const [queryState, setQueryState] = useDetailWindowState();
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['uniquePlayers']);
  const [compareCodes, setCompareCodes] = useState<string[]>(() => readCompareDraft()?.codes ?? []);
  const [watchlistCodes, setWatchlistCodes] = useState<string[]>(() => readWatchlist().map((entry) => entry.code));
  const [liveMessage, setLiveMessage] = useState('');

  const islandNameFromUrl = useMemo(() => new URLSearchParams(window.location.search).get('name') || undefined, []);

  const overviewQuery = useSWR(
    code ? ['overview', code, queryState.window] : null,
    () => fetchIslandOverview(code!, queryState.window)
  );

  const researchQuery = useSWR(
    code && overviewQuery.data?.researchStatus.available
      ? ['research', code, islandNameFromUrl, overviewQuery.data.updatedAt]
      : null,
    () => fetchIslandResearch(code!, islandNameFromUrl)
  );

  useEffect(() => {
    if (!overviewQuery.data) {
      return;
    }

    pushRecentView({
      code: overviewQuery.data.island.code,
      name: overviewQuery.data.island.name,
      creator: overviewQuery.data.island.creator,
      window: queryState.window
    });
  }, [overviewQuery.data, queryState.window]);

  useEffect(() => {
    if (!overviewQuery.data || selectedMetrics.length > 0) {
      return;
    }

    const firstMetric = overviewQuery.data.series.find((entry) => entry.points.length > 0)?.metric;
    if (firstMetric) {
      setSelectedMetrics([firstMetric]);
    }
  }, [overviewQuery.data, selectedMetrics.length]);

  useEffect(() => {
    if (!liveMessage) {
      return;
    }

    const timer = window.setTimeout(() => setLiveMessage(''), 1600);
    return () => window.clearTimeout(timer);
  }, [liveMessage]);

  const handleToggleCompare = () => {
    if (!overviewQuery.data) {
      return;
    }

    const island = overviewQuery.data.island;
    const exists = compareCodes.includes(island.code);
    const nextCodes = exists
      ? compareCodes.filter((item) => item !== island.code)
      : [...compareCodes, island.code].slice(0, 4);

    setCompareCodes(nextCodes);
    if (nextCodes.length === 0) {
      clearCompareDraft();
    } else {
      writeCompareDraft(nextCodes);
    }
    setLiveMessage(exists ? `${island.name} removed from compare` : `${island.name} added to compare`);
  };

  const handleToggleWatchlist = (item: RankedIslandSummary) => {
    const exists = watchlistCodes.includes(item.code);
    const nextWatchlist = exists
      ? removeWatchlist(item.code)
      : upsertWatchlist({
          code: item.code,
          name: item.name,
          creator: item.creator,
          tags: item.tags
        });

    setWatchlistCodes(nextWatchlist.map((entry) => entry.code));
    setLiveMessage(exists ? `${item.name} removed from watchlist` : `${item.name} saved to watchlist`);
  };

  const handleCopyCode = async () => {
    if (!overviewQuery.data) {
      return;
    }
    await navigator.clipboard?.writeText(overviewQuery.data.island.code);
    setLiveMessage(`${overviewQuery.data.island.code} copied`);
  };

  const handleShare = async () => {
    if (!overviewQuery.data) {
      return;
    }

    const url = new URL(`/island/${overviewQuery.data.island.code}`, window.location.origin);
    url.searchParams.set('window', queryState.window);
    url.searchParams.set('name', overviewQuery.data.island.name);
    await navigator.clipboard?.writeText(url.toString());
    setLiveMessage('Share URL copied');
  };

  const heroIsland = overviewQuery.data?.island;
  const overview = overviewQuery.data;
  const uniquePlayers24hDelta = overview?.deltas.uniquePlayers?.delta24h ?? null;
  const renderedResearch = researchQuery.data?.summary
    ? DOMPurify.sanitize(marked.parse(researchQuery.data.summary, { async: false }) as string)
    : null;

  return (
    <div className="page-shell">
      <LiveRegion message={liveMessage} />

      <div className="page-backlink">
        <Link to={`/?window=${queryState.window}`}>Back to dashboard</Link>
      </div>

      {!overviewQuery.data && overviewQuery.isLoading ? (
        <LoadingState title="Loading island overview" detail="Bringing KPI snapshots, trend lines, and related islands into one view." />
      ) : null}

      {overviewQuery.error ? (
        <ErrorState
          title="Island overview could not be loaded"
          detail={String(overviewQuery.error.message || overviewQuery.error)}
          actionLabel="Retry"
          onAction={() => overviewQuery.mutate()}
        />
      ) : null}

      {heroIsland && overview ? (
        <>
          <section className="hero-panel hero-panel--detail">
            <div>
              <p className="hero-panel__eyebrow">Island overview</p>
              <h1 className="hero-panel__title">{heroIsland.name}</h1>
              <p className="hero-panel__detail">
                {heroIsland.creator} · {heroIsland.code}
              </p>
              <div className="hero-panel__tags">
                {heroIsland.tags.map((tag) => (
                  <span key={tag} className="tag-pill tag-pill--read-only">
                    {tag}
                  </span>
                ))}
              </div>
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
              <IslandActions
                code={heroIsland.code}
                isInCompare={compareCodes.includes(heroIsland.code)}
                isWatchlisted={watchlistCodes.includes(heroIsland.code)}
                onToggleCompare={handleToggleCompare}
                onToggleWatchlist={() => handleToggleWatchlist(heroIsland as RankedIslandSummary)}
                onCopyCode={handleCopyCode}
                onShare={handleShare}
              />
              {compareCodes.length >= 2 ? (
                <Link to={`/compare?codes=${compareCodes.join(',')}&window=${queryState.window}`} className="btn btn--primary">
                  Open Compare
                </Link>
              ) : null}
            </div>
          </section>

          <section className="detail-grid">
            <div className="detail-grid__main">
              <KpiCards metrics={overview.kpis} deltas={overview.deltas} formatNumber={formatCompact} />

              <section className="detail-summary-card">
                <div>
                  <p className="detail-summary-card__eyebrow">Change summary</p>
                  <h2 className="detail-summary-card__title">Recent movement</h2>
                </div>
                {uniquePlayers24hDelta != null ? (
                  <span className={uniquePlayers24hDelta > 0 ? 'status-badge status-badge--positive' : 'status-badge'}>
                    {uniquePlayers24hDelta > 0 ? 'Surging in the last 24h' : 'Cooling off in the last 24h'}
                  </span>
                ) : null}
                <dl className="detail-summary-card__stats">
                  <div>
                    <dt>Unique players</dt>
                    <dd>{formatDelta(overview.deltas.uniquePlayers)}</dd>
                  </div>
                  <div>
                    <dt>24h change</dt>
                    <dd>{formatCompact(overview.deltas.uniquePlayers?.delta24h ?? null)}</dd>
                  </div>
                  <div>
                    <dt>Peak CCU</dt>
                    <dd>{formatDelta(overview.deltas.peakCcu)}</dd>
                  </div>
                  <div>
                    <dt>HypeScore</dt>
                    <dd>{formatCompact(overview.hypeScore.score)}</dd>
                  </div>
                </dl>
              </section>

              <MetricsChart
                series={overview.series}
                selectedMetrics={selectedMetrics}
                onSelectedMetricsChange={(metrics) => setSelectedMetrics(metrics.length > 0 ? metrics : selectedMetrics)}
              />

              <section className="detail-summary-card">
                <div>
                  <p className="detail-summary-card__eyebrow">Related</p>
                  <h2 className="detail-summary-card__title">Keep exploring</h2>
                </div>
                {overview.related.length > 0 ? (
                  <RelatedIslandList
                    items={overview.related}
                    windowValue={queryState.window}
                    compareCodes={compareCodes}
                    watchlistCodes={watchlistCodes}
                    onToggleCompare={(item) => {
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
                    }}
                    onToggleWatchlist={handleToggleWatchlist}
                    onCopyCode={async (value) => {
                      await navigator.clipboard?.writeText(value);
                      setLiveMessage(`${value} copied`);
                    }}
                  />
                ) : (
                  <EmptyState title="No related islands yet" detail="Related islands appear when similar tags or creators are available in the current window." />
                )}
              </section>
            </div>

            <aside className="detail-grid__side">
              <section className="sidecar-card">
                <div className="sidecar-card__header">
                  <div>
                    <p className="sidecar-card__eyebrow">Data</p>
                    <h2 className="sidecar-card__title">Snapshot info</h2>
                  </div>
                </div>
                <ul className="sidecar-list">
                  <li>
                    <strong>Window</strong>
                    <span>{queryState.window}</span>
                  </li>
                  <li>
                    <strong>Updated</strong>
                    <span>{new Date(overview.updatedAt).toLocaleString()}</span>
                  </li>
                  <li>
                    <strong>Research</strong>
                    <span>{overview.researchStatus.available ? 'Available' : 'Unavailable'}</span>
                  </li>
                  <li>
                    <strong>Data quality</strong>
                    <span>{overview.degraded ? 'Partial' : 'Healthy'}</span>
                  </li>
                </ul>
              </section>

              <section className="sidecar-card">
                <div className="sidecar-card__header">
                  <div>
                    <p className="sidecar-card__eyebrow">AI research</p>
                    <h2 className="sidecar-card__title">Reference notes</h2>
                  </div>
                </div>
                {researchQuery.isLoading ? (
                  <LoadingState title="Loading research notes" detail="AI research stays below KPI data and is treated as supporting information." />
                ) : renderedResearch ? (
                  <>
                    <div className="prose detail-research" dangerouslySetInnerHTML={{ __html: renderedResearch }} />
                    <p className="sidecar-card__empty">Updated {new Date(researchQuery.data!.updatedAt).toLocaleString()}</p>
                  </>
                ) : (
                  <p className="sidecar-card__empty">Research notes are unavailable for this island right now.</p>
                )}
              </section>
            </aside>
          </section>
        </>
      ) : null}
    </div>
  );
}
