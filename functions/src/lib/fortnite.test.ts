import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { globalCache } from '../cache.js';

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn()
}));

vi.mock('node-fetch', () => ({
  default: fetchMock
}));

import { computePopularIslands, fetchIslandSeries } from './fortnite.js';

function clearCache() {
  ((globalCache as unknown as { store: Map<string, unknown> }).store).clear();
}

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

function uniquePlayersSeries(value: number) {
  return response(200, {
    intervals: [
      {
        timestamp: '2025-01-01T00:00:00.000Z',
        value
      }
    ]
  });
}

describe('fortnite upstream fallbacks', () => {
  beforeEach(() => {
    clearCache();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCache();
  });

  it('retries a throttled islands page before ranking candidates', async () => {
    let firstPageAttempts = 0;

    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/ecosystem/v1/islands?size=24')) {
        firstPageAttempts += 1;
        if (firstPageAttempts === 1) {
          return response(429, { error: 'rate limited' });
        }
        return response(200, {
          items: [
            { code: 'A', title: 'Alpha', creator: 'Creator 1', tags: ['Arena'] },
            { code: 'B', title: 'Bravo', creator: 'Creator 2', tags: ['Arena'] }
          ],
          next: null
        });
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });

    const result = await computePopularIslands('24h', 2);

    expect(firstPageAttempts).toBe(2);
    expect(result.map((item) => item.code)).toEqual(['A', 'B']);
  });

  it('returns partial results when a later islands page keeps failing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let secondPageAttempts = 0;

    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/ecosystem/v1/islands?size=24&cursor=next')) {
        secondPageAttempts += 1;
        return response(429, { error: 'rate limited' });
      }

      if (url.includes('/ecosystem/v1/islands?size=24')) {
        return response(200, {
          items: [
            { code: 'A', title: 'Alpha', creator: 'Creator 1', tags: ['Arena'] }
          ],
          next: '/ecosystem/v1/islands?size=24&cursor=next'
        });
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });

    const result = await computePopularIslands('24h', 2);

    expect(secondPageAttempts).toBe(3);
    expect(result.map((item) => item.code)).toEqual(['A']);
    expect(warnSpy).toHaveBeenCalledWith(
      'collectCatalogCandidates page fetch failed',
      expect.objectContaining({
        page: 2,
        limit: 2
      })
    );
  });

  it('short-caches unexpected metric throttling to avoid immediate refetches', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/islands/A/metrics/day/unique-players')) {
        return response(429, { error: 'rate limited' });
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });

    const first = await fetchIslandSeries('A', '24h', ['uniquePlayers']);
    const second = await fetchIslandSeries('A', '24h', ['uniquePlayers']);

    expect(first).toEqual([{ metric: 'uniquePlayers', points: [] }]);
    expect(second).toEqual([{ metric: 'uniquePlayers', points: [] }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'fetchIslandSeries upstream failure',
      expect.objectContaining({
        code: 'A',
        window: '24h',
        metric: 'uniquePlayers',
        status: 429
      })
    );
  });
});
