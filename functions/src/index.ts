import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import fetch from 'node-fetch';
import { globalCache } from './cache.js';

const app = express();
app.use(cors());

const USE_MOCK = process.env.USE_MOCK === '1';
const FORTNITE_API_BASE = 'https://api.fortnite.com';

type Bucket = 'TEN_MINUTE' | 'HOUR' | 'DAY';

function toBucket(window: string): Bucket {
  if (window === '10m') return 'TEN_MINUTE';
  if (window === '1h') return 'HOUR';
  return 'DAY';
}

function toBucketSlug(bucket: Bucket): 'ten-minute' | 'hour' | 'day' {
  if (bucket === 'TEN_MINUTE') return 'ten-minute';
  if (bucket === 'HOUR') return 'hour';
  return 'day';
}

function toMetricSlug(metric: string): string {
  const map: Record<string, string> = {
    uniquePlayers: 'unique-players',
    peakCcu: 'peak-ccu',
    minutesPerPlayer: 'minutes-per-player',
    retentionD1: 'retention-d1',
    retentionD7: 'retention-d7',
    recommends: 'recommends',
    favorites: 'favorites',
    plays: 'plays',
    minutesPlayed: 'minutes-played'
  };
  return map[metric] || metric.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

async function runLimited<T>(inputs: T[], limit: number, worker: (input: T) => Promise<void>): Promise<void> {
  const size = Math.max(1, Math.min(limit, inputs.length));
  let cursor = 0;
  const workers = Array.from({ length: size }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= inputs.length) break;
      await worker(inputs[index]);
    }
  });
  await Promise.all(workers);
}

function ttlForWindow(window: string) {
  if (window === '10m') return 600;
  if (window === '1h') return 900;
  return 900;
}

app.get(['/health', '/api/health'], (_req, res) => res.json({ ok: true }));

app.get(['/islands', '/api/islands'], async (req, res) => {
  const window = (req.query.window as string) || '10m';
  const query = (req.query.query as string) || '';
  const sort = (req.query.sort as string) || 'hype';
  const limit = Number(req.query.limit || 50);
  const cacheKey = `islands:v5:${window}:${query}:${sort}:${limit}`;

  const cached = globalCache.get<any[]>(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.json(cached);
  }

  if (USE_MOCK) {
    const data = await import('../mocks/islands.json', { assert: { type: 'json' } });
    const items = (data.default || (data as any)).items as any[];
    const filtered = query ? items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()) || i.code.includes(query)) : items;
    const limited = filtered.slice(0, limit);
    globalCache.set(cacheKey, limited, ttlForWindow(window));
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.json(limited);
  }

  try {
    const listUrl = new URL('https://api.fortnite.com/ecosystem/v1/islands');
    if (query) listUrl.searchParams.set('search', query);
    listUrl.searchParams.set('limit', String(limit));

    const listRes = await fetch(listUrl.toString());
    if (!listRes.ok) throw new Error(`Upstream island list failed with ${listRes.status}`);
    const listJson = (await listRes.json()) as any;

    let islands = (listJson.items || listJson.data || [])
      .map((i: any) => ({
        code: i.code,
        name: i.title,
        creator: i.creatorCode || i.creator?.name || i.creator || 'Unknown',
        tags: i.tags || []
      }))
      .filter((i: any) => i.code && i.name);

    // 人気の高いIslandを優先取得：uniquePlayersの直近値で降順ソート
    if (islands.length > 0 && (sort === 'hype' || sort === 'popular')) {
      const bucket = toBucket(window);
      // パス形式のメトリクスAPIを使用（start/end は省略）

      const uniqueMap = new Map<string, number>();

      const runFetch = async (islandCode: string) => {
        try {
          const bucketSlug = toBucketSlug(bucket);
          const metricSlug = toMetricSlug('uniquePlayers');
          const url = new URL(`/ecosystem/v1/islands/${encodeURIComponent(islandCode)}/metrics/${bucketSlug}/${metricSlug}`, FORTNITE_API_BASE);
          const r = await fetch(url.toString());
          if (r.ok) {
            const j = (await r.json()) as any;
            const pointsRaw = j.series || j.data || j.points || j.intervals || [];
            const last = Array.isArray(pointsRaw) && pointsRaw.length > 0
              ? pointsRaw[pointsRaw.length - 1]
              : null;
            const value = last
              ? (last.value ?? last.v ?? (Array.isArray(last) ? last[1] : 0))
              : 0;
            uniqueMap.set(islandCode, Number(value) || 0);
          } else {
            uniqueMap.set(islandCode, 0);
          }
        } catch {
          uniqueMap.set(islandCode, 0);
        }
      };

      await runLimited(islands, 8, async (it) => runFetch((it as any).code));

      islands.sort((a: any, b: any) => (uniqueMap.get(b.code) || 0) - (uniqueMap.get(a.code) || 0));

      // 上位の島の詳細メトリクスを事前取得してキャッシュ（最大5件・並列3）
      const prefetchTargets = islands.slice(0, Math.min(5, islands.length));
      const metricsList = [
        'uniquePlayers',
        'peakCcu',
        'minutesPerPlayer',
        'retentionD1',
        'retentionD7',
        'recommends',
        'favorites'
      ];
      const prefetchOne = async (code: string) => {
        try {
          const series = await Promise.all(
            metricsList.map(async (metric) => {
              const bucketSlug = toBucketSlug(bucket);
              const metricSlug = toMetricSlug(metric);
              const u = new URL(`/ecosystem/v1/islands/${encodeURIComponent(code)}/metrics/${bucketSlug}/${metricSlug}`, FORTNITE_API_BASE);
              const r = await fetch(u.toString());
              if (r.ok) {
                const j = (await r.json()) as any;
                const pointsRaw = j.series || j.data || j.points || j.intervals || [];
                const points = Array.isArray(pointsRaw)
                  ? pointsRaw.map((p: any) => ({ ts: p.timestamp || p.ts || p.time || p[0], value: p.value ?? p.v ?? p[1] }))
                  : [];
                return { metric, points };
              }
              return { metric, points: [] };
            })
          );
          const cacheKeyM = `metrics:v2:${code}:${window}`;
          globalCache.set(cacheKeyM, series, ttlForWindow(window));
        } catch {
          // ignore prefetch errors
        }
      };
      await runLimited(prefetchTargets, 3, async (it) => prefetchOne((it as any).code));

      // uniquePlayers 簡易スコアを添付（前段の動作確認・監視用）
      islands = islands.map((it: any) => ({ ...it, metrics: { uniquePlayers: uniqueMap.get(it.code) || 0 } }));
    }

    globalCache.set(cacheKey, islands, ttlForWindow(window));
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.json(islands);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get(['/islands/:code/metrics', '/api/islands/:code/metrics'], async (req, res) => {
  const code = req.params.code;
  const window = (req.query.window as string) || '10m';
  const cacheKey = `metrics:v2:${code}:${window}`;
  const cached = globalCache.get<any[]>(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.json(cached);
  }

  if (USE_MOCK) {
    const all = await import('../mocks/metrics_by_code.json', { assert: { type: 'json' } }) as any;
    const series = (all.default || all)[code] || [];
    globalCache.set(cacheKey, series, ttlForWindow(window));
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.json(series);
  }

  try {
    const bucket = toBucket(window);
    // パス形式APIに合わせ、時間範囲はAPIサイドのデフォルトに委ねる
    const metrics = [
      'uniquePlayers',
      'peakCcu',
      'minutesPerPlayer',
      'retentionD1',
      'retentionD7',
      'recommends',
      'favorites',
      'plays',
      'minutesPlayed'
    ];

    const fetchMetric = async (metric: string) => {
      const bucketSlug = toBucketSlug(bucket);
      const metricSlug = toMetricSlug(metric);
      const url = new URL(`/ecosystem/v1/islands/${encodeURIComponent(code)}/metrics/${bucketSlug}/${metricSlug}`, FORTNITE_API_BASE);

      const r = await fetch(url.toString());
      if (r.ok) {
        const j = (await r.json()) as any;
        const pointsRaw = j.series || j.data || j.points || j.intervals || [];
        const points = Array.isArray(pointsRaw)
          ? pointsRaw.map((p: any) => ({ ts: p.timestamp || p.ts || p.time || p[0], value: p.value ?? p.v ?? p[1] }))
          : [];
        return { metric, points };
      }
      return { metric, points: [] };
    };

    const series = await Promise.all(metrics.map(fetchMetric));
    globalCache.set(cacheKey, series, ttlForWindow(window));
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.json(series);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export const api = onRequest({ region: 'us-central1' }, app);

// ----------------------
// Top islands (full crawl)
// ----------------------

type IslandBasic = { code: string; name: string; creator: string; tags?: string[] };

async function fetchIslandsPage(url: URL): Promise<{ items: any[]; nextUrl: URL | null }> {
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Upstream islands page failed: ${res.status}`);
  const j = (await res.json()) as any;
  const items = (j.items || j.data || []) as any[];
  let nextUrl: URL | null = null;
  const next = j.next || j.nextUrl || j.links?.next;
  if (typeof next === 'string') {
    try { nextUrl = new URL(next, FORTNITE_API_BASE); } catch { nextUrl = null; }
  }
  return { items, nextUrl };
}

async function crawlAllIslands(maxPages: number, pageSize: number, search: string | undefined): Promise<IslandBasic[]> {
  // 初回URL
  const first = new URL('/ecosystem/v1/islands', FORTNITE_API_BASE);
  first.searchParams.set('limit', String(pageSize));
  if (search) first.searchParams.set('search', search);
  let url: URL | null = first;
  const out: IslandBasic[] = [];
  let page = 0;
  while (url && page < maxPages) {
    // フォールバックとして page/pageNumber も試す
    url.searchParams.set('page', String(page + 1));
    const { items, nextUrl } = await fetchIslandsPage(url);
    for (const i of items) {
      const it: IslandBasic = {
        code: i.code,
        name: i.title,
        creator: i.creatorCode || i.creator?.name || i.creator || 'Unknown',
        tags: i.tags || []
      };
      if (it.code && it.name) out.push(it);
    }
    page++;
    if (nextUrl) {
      url = nextUrl;
    } else {
      if (items.length < pageSize) break; // 末尾
      // 次ページを推測
      const guess = new URL('/ecosystem/v1/islands', FORTNITE_API_BASE);
      guess.searchParams.set('limit', String(pageSize));
      guess.searchParams.set('page', String(page + 1));
      if (search) guess.searchParams.set('search', search);
      url = guess;
    }
  }
  return out;
}

async function computePopularIslands(window: string, limit: number, search?: string): Promise<IslandBasic[]> {
  const bucket = toBucket(window);
  // パス形式APIの既定の時間範囲を利用

  const all = await crawlAllIslands(20, 100, search); // 最大 ~2000 件想定（API制限に注意）

  const uniqueMap = new Map<string, number>();
  await runLimited(all, 10, async (it) => {
    try {
      const bucketSlug = toBucketSlug(bucket);
      const metricSlug = toMetricSlug('uniquePlayers');
      const u = new URL(`/ecosystem/v1/islands/${encodeURIComponent(it.code)}/metrics/${bucketSlug}/${metricSlug}`, FORTNITE_API_BASE);
      const r = await fetch(u.toString());
      if (r.ok) {
        const j = (await r.json()) as any;
        const pointsRaw = j.series || j.data || j.points || j.intervals || [];
        const last = Array.isArray(pointsRaw) && pointsRaw.length > 0 ? pointsRaw[pointsRaw.length - 1] : null;
        const value = last ? (last.value ?? last.v ?? (Array.isArray(last) ? last[1] : 0)) : 0;
        uniqueMap.set(it.code, Number(value) || 0);
      } else {
        uniqueMap.set(it.code, 0);
      }
    } catch {
      uniqueMap.set(it.code, 0);
    }
  });

  const sorted = [...all].sort((a, b) => (uniqueMap.get(b.code) || 0) - (uniqueMap.get(a.code) || 0));
  return sorted.slice(0, Math.min(limit, sorted.length));
}

app.get(['/top-islands', '/api/top-islands'], async (req, res) => {
  const window = (req.query.window as string) || '10m';
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const query = (req.query.query as string) || '';
  const cacheKey = `top:v1:${window}:${limit}:${query}`;
  const cached = globalCache.get<IslandBasic[]>(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.json(cached);
  }
  try {
    const top = await computePopularIslands(window, limit, query || undefined);
    globalCache.set(cacheKey, top, ttlForWindow(window));
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.json(top);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export const warmTopIslands = onSchedule({ region: 'us-central1', schedule: 'every 10 minutes' }, async () => {
  const windows = ['10m', '1h', '24h'];
  for (const w of windows) {
    try {
      const top = await computePopularIslands(w, 100);
      const cacheKey = `top:v1:${w}:100:`;
      globalCache.set(cacheKey, top, ttlForWindow(w));
    } catch {
      // ignore
    }
  }
});


// ---------------------------------
// Research endpoint (Perplexity API)
// ---------------------------------
export function buildPerplexityPrompts(lang: string, titlePart: string) {
  const system =
    lang === 'ja'
      ? 'あなたはFortniteの島について短く要点をまとめるリサーチアシスタントです。出力は厳密にMarkdownの見出しと箇条書きを守り、事実に基づき、必ずURL付きの出典を提示してください。YouTube、Reddit、Epic/公式ドキュメントを優先し、信頼性の低いソースは避けてください。'
      : 'You are a concise research assistant for Fortnite islands. Output must strictly follow the requested Markdown sections with bullet points, be factual, and include URL-cited sources. Prefer YouTube, Reddit, and Epic/official documentation; avoid low-quality sources.';

  const user =
    lang === 'ja'
      ? `次の島についてリサーチし、以下のMarkdownフォーマット（見出し名は必ずこの通り）で短く要約してください。島名とコード: ${titlePart}

## Island Status
### 状況
- （現在の状況・コミュニティでの注目点を簡潔に）
### 概要
- （島のタイプ/目的/プレイ要素など）
### 特徴
- （主要な特徴・差別化要因）
### 話題
- （最近の話題・アップデート・SNS/コミュニティ動向）

## 出典
- （URL）
- （URL）

厳守事項:
- 上記の見出し・順序・箇条書きを厳密に維持。
- 誤検出を避けるため、島コードと一致しない情報は除外。
- 出典はYouTube、Reddit、Epic/公式ドキュメントを優先。該当がない場合のみその他の信頼できるサイトを使用。`
      : `Research the island: ${titlePart}

Strictly output the following Markdown (use these exact headings):

## Island Status
### Status
- (current traction/community buzz, concise)
### Overview
- (type/purpose/core gameplay)
### Features
- (key differentiators)
### Discussion
- (recent updates/community threads/social mentions)

## Sources
- (URL)
- (URL)

Requirements:
- Keep the exact headings/order/bullets.
- Exclude mismatching info (must match the island code).
- Prefer sources from YouTube, Reddit, and Epic/official docs; use other reputable sites only if necessary.`;

  return { system, user };
}

app.get(['/islands/:code/research', '/api/islands/:code/research'], async (req, res) => {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return res.status(501).json({ error: 'PERPLEXITY_API_KEY not configured' });

  const code = req.params.code;
  const name = (req.query.name as string) || '';
  const lang = (req.query.lang as string) || 'ja';
  const cacheKey = `research:v1:${code}:${lang}:${name || ''}`;
  const cached = globalCache.get<any>(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.json(cached);
  }

  try {
    const titlePart = name ? `${name} (${code})` : code;
    const { system, user } = buildPerplexityPrompts(lang, titlePart);
    const preferred = (process.env.PERPLEXITY_MODEL || '').trim();
    const candidates = [
      preferred,
      // Online検索付き（プランにより利用可否あり）
      'pplx-70b-online',
      'pplx-7b-online',
      'sonar-large-online',
      'sonar-medium-online',
      'sonar-small-online',
      // Chat専用（オンライン無し）
      'pplx-70b',
      'pplx-7b',
      'sonar-large-chat',
      'sonar-medium-chat',
      'sonar-small-chat'
    ].filter(Boolean);

    let content = '';
    let lastErr: string | null = null;
    for (const model of candidates) {
      const body = {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
        top_p: 0.9
      } as any;

      const resp = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      let respJson: any = null;
      try { respJson = await resp.json(); } catch { respJson = null; }
      if (!resp.ok) {
        const errType = respJson?.error?.type || '';
        const errMsg = respJson?.error?.message || `HTTP ${resp.status}`;
        lastErr = `${model}: ${errType || 'error'}: ${errMsg}`;
        if (errType === 'invalid_model') {
          continue; // try next candidate
        }
        // other errors: break
        break;
      }
      content = respJson?.choices?.[0]?.message?.content || '';
      if (content) {
        lastErr = null;
        break;
      }
      lastErr = `${model}: empty content`;
    }
    if (!content) {
      throw new Error(`Perplexity API failed (model resolution): ${lastErr || 'unknown error'}`);
    }

    // 粗い抽出：ハイライトとURL
    const lines = String(content).split(/\r?\n/);
    const highlights: string[] = [];
    const sources: { title?: string; url: string }[] = [];
    for (const ln of lines) {
      const t = ln.trim();
      if (!t) continue;
      if (/^[-•・]/.test(t)) highlights.push(t.replace(/^[-•・]\s?/, ''));
      const m = t.match(/https?:\/\/\S+/g);
      if (m) m.forEach(u => sources.push({ url: u }));
    }

    const result = {
      summary: content,
      highlights,
      sources,
      updatedAt: new Date().toISOString()
    };

    globalCache.set(cacheKey, result, 600);
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

