import cors from 'cors';
import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getIslandMetrics, getTopIslandBasics, searchIslands } from './lib/fortnite.js';
import { buildPerplexityPrompts, fetchResearch } from './lib/research.js';
import { getCompare, getDashboard, getIslandOverview, getWindowSummaries } from './lib/service.js';
import type { SummarySortKey, TimeWindow } from './lib/types.js';

const app = express();
app.use(cors());

function parseWindow(value: unknown): TimeWindow {
  if (value === '1h' || value === '24h') {
    return value;
  }
  return '10m';
}

function parseSort(value: unknown): SummarySortKey {
  if (
    value === 'uniquePlayers' ||
    value === 'peakCcu' ||
    value === 'minutesPerPlayer' ||
    value === 'retentionD1' ||
    value === 'recommends' ||
    value === 'favorites' ||
    value === 'latestChange'
  ) {
    return value;
  }
  return 'hype';
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(entry => String(entry).split(',')).map(entry => entry.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(entry => entry.trim()).filter(Boolean);
  }
  return [];
}

function parseCodes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(entry => String(entry).split(',')).map(entry => entry.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(entry => entry.trim()).filter(Boolean);
  }
  return [];
}

function sendCachedJson(res: express.Response, payload: unknown, maxAge = 300, sMaxAge = 600) {
  res.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${sMaxAge}`);
  res.json(payload);
}

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ ok: true });
});

app.get(['/islands', '/api/islands'], async (req, res) => {
  try {
    const window = parseWindow(req.query.window);
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'hype';
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const islands = await searchIslands({ window, query, sort, limit });
    sendCachedJson(res, islands);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get(['/dashboard', '/api/dashboard'], async (req, res) => {
  try {
    const window = parseWindow(req.query.window);
    const sort = parseSort(req.query.sort);
    const tags = parseTags(req.query.tags);
    const creator = typeof req.query.creator === 'string' ? req.query.creator : '';
    const dashboard = await getDashboard({ window, sort, tags, creator });
    sendCachedJson(res, dashboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get(['/islands/:code/metrics', '/api/islands/:code/metrics'], async (req, res) => {
  try {
    const window = parseWindow(req.query.window);
    const series = await getIslandMetrics(req.params.code, window);
    sendCachedJson(res, series);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get(['/islands/:code/overview', '/api/islands/:code/overview'], async (req, res) => {
  try {
    const window = parseWindow(req.query.window);
    const overview = await getIslandOverview({
      code: req.params.code,
      window,
      researchConfigured: Boolean(process.env.PERPLEXITY_API_KEY)
    });
    sendCachedJson(res, overview);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get(['/compare', '/api/compare'], async (req, res) => {
  try {
    const window = parseWindow(req.query.window);
    const codes = parseCodes(req.query.codes);
    if (codes.length < 2) {
      return res.status(400).json({ error: 'At least 2 island codes are required' });
    }

    const compare = await getCompare({ codes, window });
    sendCachedJson(res, compare);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get(['/top-islands', '/api/top-islands'], async (req, res) => {
  try {
    const window = parseWindow(req.query.window);
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    const islands = await getTopIslandBasics(window, limit, query);
    sendCachedJson(res, islands);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get(['/islands/:code/research', '/api/islands/:code/research'], async (req, res) => {
  try {
    const data = await fetchResearch({
      code: req.params.code,
      name: typeof req.query.name === 'string' ? req.query.name : '',
      lang: typeof req.query.lang === 'string' ? req.query.lang : 'ja'
    });
    sendCachedJson(res, data);
  } catch (error: any) {
    const message = error.message || String(error);
    const status = message.includes('PERPLEXITY_API_KEY') ? 501 : 500;
    res.status(status).json({ error: message });
  }
});

export const api = onRequest({ region: 'us-central1' }, app);

export const warmTopIslands = onSchedule({ region: 'us-central1', schedule: 'every 10 minutes' }, async () => {
  const windows: TimeWindow[] = ['10m', '1h', '24h'];
  for (const window of windows) {
    try {
      await Promise.all([getTopIslandBasics(window, 100), getWindowSummaries(window)]);
    } catch {
      // Keep scheduler best-effort only.
    }
  }
});

export { buildPerplexityPrompts };
