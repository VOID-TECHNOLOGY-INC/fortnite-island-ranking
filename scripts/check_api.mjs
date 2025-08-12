#!/usr/bin/env node
/*
  API疎通テストスクリプト
  使い方:
    node scripts/check_api.mjs --base https://fortnite-island-ranking.web.app
    # 省略時は上記URLが既定
*/

import https from 'https';
import { URL } from 'url';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { base: 'https://fortnite-island-ranking.web.app' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--base' && args[i + 1]) { out.base = args[++i]; }
  }
  return out;
}

function getJson(urlStr) {
  const url = new URL(urlStr);
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url.href}: ${e.message}\nBody: ${body.slice(0, 400)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function sumMetrics(m) {
  const keys = ['uniquePlayers','peakCCU','minutesPerPlayer','retentionD1','retentionD7','recommends','favorites'];
  return keys.reduce((s,k)=> s + (Number(m?.[k]) || 0), 0);
}

async function main() {
  const { base } = parseArgs();
  let ok = true;
  console.log(`[check] BASE = ${base}`);

  const health = await getJson(new URL('/api/health', base));
  console.log('[health]', health);
  if (health?.ok !== true) { console.error('health.ok != true'); ok = false; }

  const islands = await getJson(new URL('/api/islands?window=10m&limit=5', base));
  if (!Array.isArray(islands) || islands.length === 0) {
    console.error('islands empty'); ok = false;
  } else {
    const nonZero = islands.filter(i => sumMetrics(i.metrics) > 0).length;
    console.log(`[islands] total=${islands.length}, nonZeroMetrics=${nonZero}`);
    if (nonZero === 0) {
      console.warn('all zero metrics. If this is production, ensure metrics enrichment is deployed or enable USE_MOCK=1');
    }
    const first = islands[0];
    if (first?.code) {
      const series = await getJson(new URL(`/api/islands/${encodeURIComponent(first.code)}/metrics?window=10m`, base));
      const seriesCount = Array.isArray(series) ? series.length : 0;
      const anyPoints = Array.isArray(series) && series.some(s => Array.isArray(s.points) && s.points.length > 0);
      console.log(`[metrics] code=${first.code}, series=${seriesCount}, anyPoints=${anyPoints}`);
      if (!anyPoints) {
        console.warn('no metric points for first island');
      }
    }
  }

  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



