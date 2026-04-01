import { describe, expect, it } from 'vitest';
import { getApiCacheControl } from './http.js';

describe('getApiCacheControl', () => {
  it('returns shared cache headers for standard API responses', () => {
    expect(getApiCacheControl()).toBe('public, max-age=300, s-maxage=600');
  });

  it('disables caching for explicit refresh requests', () => {
    expect(getApiCacheControl({ bypassCache: true })).toBe('private, no-store, max-age=0');
  });
});
