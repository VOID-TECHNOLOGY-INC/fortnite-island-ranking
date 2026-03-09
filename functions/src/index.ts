import cors from 'cors';
import express from 'express';
import fetch from 'node-fetch';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { buildCompareResponse, buildDashboardResponse, buildIslandOverviewResponse, buildSearchResponse } from './lib/dashboard.js';
import { DASHBOARD_SORTS, TIME_WINDOWS, type DashboardSort, type DeltaValue, type HypeBreakdownComponent, type IslandSummary, type MetricKey, type MetricSnapshot, type TimeWindow } from './lib/contracts.js';
import { fetchIslandSeries } from './lib/fortnite.js';
import { buildPerplexityPrompts } from './lib/research.js';

export const app = express();
app.use(cors());

function parseWindow(value: string | undefined): TimeWindow {
  return TIME_WINDOWS.includes(value as TimeWindow) ? (value as TimeWindow) : '10m';
}

function parseSort(value: string | undefined): DashboardSort {
  return DASHBOARD_SORTS.includes(value as DashboardSort) ? (value as DashboardSort) : 'hype';
}

function parseTags(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => parseTags(item));
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecoverableUpstreamError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || error || '');
  return /\b(400|404|422|429)\b/.test(message);
}

function setApiCacheHeaders(res: express.Response) {
  res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
}

const SUMMARY_METRICS: MetricKey[] = [
  'uniquePlayers',
  'peakCcu',
  'minutesPerPlayer',
  'retentionD1',
  'retentionD7',
  'recommends',
  'favorites'
];

function toSummaryMetricMap(metrics: IslandSummary['metrics']) {
  return {
    uniquePlayers: metrics.uniquePlayers ?? null,
    peakCcu: metrics.peakCcu ?? null,
    minutesPerPlayer: metrics.minutesPerPlayer ?? null,
    retentionD1: metrics.retentionD1 ?? null,
    retentionD7: metrics.retentionD7 ?? null,
    recommends: metrics.recommends ?? null,
    favorites: metrics.favorites ?? null
  };
}

function toMetricDelta(delta: DeltaValue | undefined, latest: number | null, delta24h: number | null = null) {
  return {
    latest,
    previous: delta?.previous ?? null,
    delta: delta?.absolute ?? null,
    deltaPct: delta?.percent ?? null,
    delta24h,
    direction: delta?.direction ?? 'unknown'
  };
}

function toBreakdown(components: HypeBreakdownComponent[]) {
  return components.map((component) => ({
    metric: component.metric,
    label: component.label,
    weight: component.weight,
    appliedWeight: component.effectiveWeight,
    normalizedValue: component.normalized,
    contribution: component.contribution
  }));
}

function toRankedIslandSummary(summary: IslandSummary, rank?: number) {
  const deltas = Object.fromEntries(
    SUMMARY_METRICS.map((metric) => [metric, toMetricDelta(summary.deltas[metric], summary.metrics[metric] ?? null)])
  );

  return {
    code: summary.code,
    name: summary.name,
    creator: summary.creator,
    tags: summary.tags,
    rank,
    hypeScore: summary.hypeScore,
    updatedAt: summary.updatedAt,
    metrics: toSummaryMetricMap(summary.metrics),
    deltas: {
      ...deltas,
      latestChange: summary.trendValue
    },
    breakdown: toBreakdown(summary.hypeScoreBreakdown)
  };
}

function toRankedList(items: IslandSummary[]) {
  return items.map((item, index) => toRankedIslandSummary(item, index + 1));
}

function normalizeCompareScores(items: IslandSummary[]) {
  return items.map((item): readonly [string, Record<string, { raw: number | null; normalized: number | null }>] => {
    const scores = Object.fromEntries(SUMMARY_METRICS.map((metric) => {
      const raw = item.metrics[metric] ?? null;
      const max = items.reduce((best, current) => Math.max(best, current.metrics[metric] ?? 0), 0);
      return [
        metric,
        {
          raw,
          normalized: raw === null || max <= 0 ? null : Math.round((raw / max) * 1000) / 10
        }
      ] as const;
    }));

    return [item.code, scores];
  });
}

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ ok: true });
});

app.get(['/dashboard', '/api/dashboard'], async (req, res) => {
  const window = parseWindow(req.query.window as string | undefined);
  const sort = parseSort(req.query.sort as string | undefined);
  const tags = parseTags(req.query.tags as string | string[] | undefined);
  const creator = ((req.query.creator as string) || '').trim() || undefined;

  try {
    const dashboard = await buildDashboardResponse({
      window,
      sort,
      tags,
      creator
    });
    setApiCacheHeaders(res);
    res.json({
      window: dashboard.window,
      ranking: toRankedList(dashboard.ranking),
      rising: toRankedList(dashboard.rising),
      highRetention: toRankedList(dashboard.highRetention),
      highRecommend: toRankedList(dashboard.highRecommend),
      facets: dashboard.facets,
      updatedAt: dashboard.updatedAt,
      degraded: dashboard.degraded,
      partialFailures: dashboard.partialFailures > 0 ? [`Partial data in ${dashboard.partialFailures} candidates`] : []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to build dashboard' });
  }
});

app.get(['/islands', '/api/islands'], async (req, res) => {
  const window = parseWindow(req.query.window as string | undefined);
  const sort = parseSort(req.query.sort as string | undefined);
  const query = ((req.query.query as string) || '').trim();
  const limit = Math.max(1, Math.min(Number(req.query.limit || 24), 50));

  try {
    if (query.length >= 2) {
      const result = await buildSearchResponse({
        window,
        sort,
        query,
        limit
      });
      setApiCacheHeaders(res);
      res.json(toRankedList(result.summaries.slice(0, limit)));
      return;
    }

    const dashboard = await buildDashboardResponse({
      window,
      sort
    });
    setApiCacheHeaders(res);
    res.json(toRankedList(dashboard.ranking.slice(0, limit)));
  } catch (error: any) {
    if (query.length >= 2 && isRecoverableUpstreamError(error)) {
      setApiCacheHeaders(res);
      res.json([]);
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to list islands' });
  }
});

app.get(['/top-islands', '/api/top-islands'], async (req, res) => {
  const window = parseWindow(req.query.window as string | undefined);
  const limit = Math.max(1, Math.min(Number(req.query.limit || 24), 100));

  try {
    const dashboard = await buildDashboardResponse({
      window,
      sort: 'uniquePlayers'
    });
    setApiCacheHeaders(res);
    res.json(toRankedList(dashboard.ranking.slice(0, limit)));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list top islands' });
  }
});

app.get(['/islands/:code/metrics', '/api/islands/:code/metrics'], async (req, res) => {
  const window = parseWindow(req.query.window as string | undefined);
  const { code } = req.params;

  try {
    const metrics = await fetchIslandSeries(code, window);
    setApiCacheHeaders(res);
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch metrics' });
  }
});

app.get(['/islands/:code/overview', '/api/islands/:code/overview'], async (req, res) => {
  const window = parseWindow(req.query.window as string | undefined);
  const { code } = req.params;

  try {
    const overview = await buildIslandOverviewResponse(code, window);
    if (!overview) {
      res.status(404).json({ error: 'Island not found' });
      return;
    }
    setApiCacheHeaders(res);
    res.json({
      window: overview.window,
      island: {
        code: overview.island.code,
        name: overview.island.name,
        creator: overview.island.creator,
        tags: overview.island.tags
      },
      kpis: Object.fromEntries(overview.kpis.map((snapshot) => [snapshot.metric, snapshot.latest ?? null])),
      deltas: Object.fromEntries(overview.kpis.map((snapshot) => [
        snapshot.metric,
        toMetricDelta(snapshot.previousDelta, snapshot.latest, snapshot.delta24h.absolute)
      ])),
      hypeScore: {
        score: overview.island.hypeScore,
        breakdown: toBreakdown(overview.island.hypeScoreBreakdown)
      },
      related: toRankedList(overview.related),
      series: overview.kpis.map((snapshot: MetricSnapshot) => ({
        metric: snapshot.metric,
        points: snapshot.points
      })),
      researchStatus: {
        available: overview.researchStatus.available,
        updatedAt: null
      },
      updatedAt: overview.updatedAt,
      degraded: overview.degraded
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to build overview' });
  }
});

app.get(['/compare', '/api/compare'], async (req, res) => {
  const window = parseWindow(req.query.window as string | undefined);
  const rawCodes = ((req.query.codes as string) || '').trim();
  const codes = rawCodes
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  try {
    const compare = await buildCompareResponse(codes, window);
    const seriesByCode = new Map<string, Array<{ metric: string; points: { ts: string; value: number }[] }>>();
    for (const metric of compare.metrics) {
      for (const island of metric.islands) {
        const list = seriesByCode.get(island.code) || [];
        list.push({
          metric: metric.metric,
          points: island.points
        });
        seriesByCode.set(island.code, list);
      }
    }

    const normalizedScores = new Map(normalizeCompareScores(compare.islands));
    setApiCacheHeaders(res);
    res.json({
      window: compare.window,
      islands: compare.islands.map((island, index) => ({
        island: toRankedIslandSummary(island, index + 1),
        series: seriesByCode.get(island.code) || [],
        normalizedScores: normalizedScores.get(island.code) || {}
      })),
      updatedAt: compare.updatedAt,
      degraded: compare.degraded,
      selectionLimit: compare.selectionLimit
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to build compare view' });
  }
});

app.get(['/islands/:code/research', '/api/islands/:code/research'], async (req, res) => {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: 'PERPLEXITY_API_KEY not configured' });
    return;
  }

  const { code } = req.params;
  const name = (req.query.name as string) || '';
  const lang = (req.query.lang as string) || 'ja';
  const titlePart = name ? `${name} (${code})` : code;
  const { system, user } = buildPerplexityPrompts(lang, titlePart);

  try {
    const preferred = (process.env.PERPLEXITY_MODEL || '').trim();
    const candidates = [
      preferred,
      'sonar-pro',
      'pplx-70b-online',
      'pplx-7b-online',
      'sonar-large-online',
      'sonar-medium-online',
      'sonar-small-online',
      'pplx-70b',
      'pplx-7b',
      'sonar-large-chat',
      'sonar-medium-chat',
      'sonar-small-chat'
    ].filter(Boolean);

    let content = '';
    let lastError: string | null = null;

    for (const model of candidates) {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          temperature: 0.2,
          top_p: 0.9
        })
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const errorType = payload?.error?.type || '';
        const errorMessage = payload?.error?.message || `HTTP ${response.status}`;
        lastError = `${model}: ${errorType || 'error'}: ${errorMessage}`;
        if (errorType === 'invalid_model') continue;
        break;
      }

      content = payload?.choices?.[0]?.message?.content || '';
      if (content) {
        lastError = null;
        break;
      }

      lastError = `${model}: empty content`;
    }

    if (!content) {
      throw new Error(`Perplexity API failed (model resolution): ${lastError || 'unknown error'}`);
    }

    const lines = String(content).split(/\r?\n/);
    const highlights: string[] = [];
    const sources: { title?: string; url: string }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^[-•・]/.test(trimmed)) highlights.push(trimmed.replace(/^[-•・]\s?/, ''));
      const urls = trimmed.match(/https?:\/\/\S+/g);
      if (urls) urls.forEach((url) => sources.push({ url }));
    }

    setApiCacheHeaders(res);
    res.json({
      summary: content,
      highlights,
      sources,
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch research' });
  }
});

export const api = onRequest({ region: 'us-central1' }, app);

export const warmTopIslands = onSchedule({ region: 'us-central1', schedule: 'every 10 minutes' }, async () => {
  for (const window of TIME_WINDOWS) {
    try {
      await buildDashboardResponse({
        window,
        sort: 'hype'
      });
    } catch {
      // ignore scheduler errors
    }
  }
});
