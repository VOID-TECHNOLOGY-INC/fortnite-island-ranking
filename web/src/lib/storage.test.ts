import { describe, expect, it } from 'vitest';
import {
  clearCompareDraft,
  isWatchlisted,
  pushRecentSearch,
  pushRecentView,
  readCompareDraft,
  readRecentSearches,
  readRecentViews,
  readWatchlist,
  removeWatchlist,
  upsertWatchlist,
  writeCompareDraft
} from './storage';

describe('storage', () => {
  it('persists compare draft with deduped codes', () => {
    writeCompareDraft(['1111', '2222', '2222', '3333', '4444', '5555']);

    expect(readCompareDraft()).toMatchObject({
      codes: ['1111', '2222', '3333', '4444']
    });

    clearCompareDraft();
    expect(readCompareDraft()).toBeNull();
  });

  it('keeps watchlist in reverse chronological order and removes items', () => {
    upsertWatchlist({ code: '1111', name: 'Alpha', creator: 'Studio A' });
    upsertWatchlist({ code: '2222', name: 'Beta', creator: 'Studio B' });

    expect(readWatchlist().map((entry) => entry.code)).toEqual(['2222', '1111']);
    expect(isWatchlisted('1111')).toBe(true);

    removeWatchlist('1111');
    expect(readWatchlist().map((entry) => entry.code)).toEqual(['2222']);
    expect(isWatchlisted('1111')).toBe(false);
  });

  it('dedupes and caps recent searches', () => {
    pushRecentSearch('box');
    pushRecentSearch('zone');
    pushRecentSearch('box');

    expect(readRecentSearches().map((entry) => entry.query)).toEqual(['box', 'zone']);
  });

  it('dedupes recent views by code and keeps the most recent first', () => {
    pushRecentView({ code: '1111', name: 'Alpha', creator: 'Studio A', window: '10m' });
    pushRecentView({ code: '2222', name: 'Beta', creator: 'Studio B', window: '1h' });
    pushRecentView({ code: '1111', name: 'Alpha', creator: 'Studio A', window: '24h' });

    expect(readRecentViews()).toEqual([
      expect.objectContaining({ code: '1111', window: '24h' }),
      expect.objectContaining({ code: '2222', window: '1h' })
    ]);
  });
});
