import fetch from 'node-fetch';
import { globalCache } from '../cache.js';

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

export async function fetchResearch(params: {
  code: string;
  name?: string;
  lang?: string;
}): Promise<{ summary: string; highlights: string[]; sources: Array<{ url: string; title?: string }>; updatedAt: string }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const name = params.name ?? '';
  const lang = params.lang ?? 'ja';
  const cacheKey = `research:v1:${params.code}:${lang}:${name}`;
  const cached = globalCache.get<Awaited<ReturnType<typeof fetchResearch>>>(cacheKey);
  if (cached) {
    return cached;
  }

  const titlePart = name ? `${name} (${params.code})` : params.code;
  const { system, user } = buildPerplexityPrompts(lang, titlePart);
  const preferred = (process.env.PERPLEXITY_MODEL || '').trim();
  const candidates = [
    preferred,
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
  let lastError = 'unknown error';

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

    let body: any = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const errorType = body?.error?.type || 'error';
      const errorMessage = body?.error?.message || `HTTP ${response.status}`;
      lastError = `${model}: ${errorType}: ${errorMessage}`;
      if (errorType === 'invalid_model') {
        continue;
      }
      break;
    }

    content = body?.choices?.[0]?.message?.content || '';
    if (content) {
      lastError = '';
      break;
    }
    lastError = `${model}: empty content`;
  }

  if (!content) {
    throw new Error(`Perplexity API failed (model resolution): ${lastError}`);
  }

  const lines = String(content).split(/\r?\n/);
  const highlights = lines
    .filter(line => /^-\s/.test(line))
    .map(line => line.replace(/^-\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 6);

  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const sources = Array.from(new Set((content.match(urlRegex) || []).map(url => url.trim()))).map(url => ({ url }));
  const result = {
    summary: content,
    highlights,
    sources,
    updatedAt: new Date().toISOString()
  };

  globalCache.set(cacheKey, result, 600);
  return result;
}
