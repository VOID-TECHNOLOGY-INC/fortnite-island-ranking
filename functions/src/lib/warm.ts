import fetch from 'node-fetch';
import { TIME_WINDOWS, type TimeWindow } from './contracts.js';

type FetchLike = typeof fetch;

export function resolveWarmBaseUrl(projectId = process.env.GCLOUD_PROJECT || 'fortnite-island-ranking') {
  return `https://${projectId.trim()}.web.app`;
}

export function buildWarmDashboardUrl(window: TimeWindow, baseUrl = resolveWarmBaseUrl()) {
  const url = new URL('/api/dashboard', baseUrl);
  url.searchParams.set('window', window);
  return url.toString();
}

export async function warmDashboardCaches(fetchImpl: FetchLike = fetch, baseUrl = resolveWarmBaseUrl()) {
  for (const window of TIME_WINDOWS) {
    try {
      const response = await fetchImpl(buildWarmDashboardUrl(window, baseUrl), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'fortnite-island-ranking-warmer/1.0'
        }
      });

      if (!response.ok) {
        console.warn('warmDashboardCaches request failed', {
          window,
          status: response.status
        });
      }
    } catch (error) {
      console.warn('warmDashboardCaches request failed', {
        window,
        error: String(error)
      });
    }
  }
}
