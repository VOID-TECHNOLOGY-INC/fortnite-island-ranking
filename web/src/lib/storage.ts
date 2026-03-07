import type {
  CompareDraft,
  RecentSearchEntry,
  RecentViewEntry,
  TimeWindow,
  WatchlistEntry
} from './types';

const STORAGE_KEYS = {
  compareDraft: 'fortnite.compareDraft',
  watchlist: 'fortnite.watchlist',
  recentSearches: 'fortnite.recentSearches',
  recentViews: 'fortnite.recentViews'
} as const;

const WATCHLIST_LIMIT = 30;
const RECENT_SEARCH_LIMIT = 8;
const RECENT_VIEW_LIMIT = 8;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function sanitizeCodes(codes: string[]) {
  return [...new Set(codes.map((code) => code.trim()).filter(Boolean))].slice(0, 4);
}

export function readCompareDraft(): CompareDraft | null {
  const stored = readJson<CompareDraft | null>(STORAGE_KEYS.compareDraft, null);
  if (!stored) return null;

  return {
    codes: sanitizeCodes(stored.codes ?? []),
    updatedAt: stored.updatedAt ?? new Date(0).toISOString()
  };
}

export function writeCompareDraft(codes: string[]) {
  const draft: CompareDraft = {
    codes: sanitizeCodes(codes),
    updatedAt: new Date().toISOString()
  };
  writeJson(STORAGE_KEYS.compareDraft, draft);
  return draft;
}

export function clearCompareDraft() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEYS.compareDraft);
}

export function readWatchlist(): WatchlistEntry[] {
  return readJson<WatchlistEntry[]>(STORAGE_KEYS.watchlist, []).filter((entry) => Boolean(entry.code));
}

export function saveWatchlist(entries: WatchlistEntry[]) {
  const deduped = new Map<string, WatchlistEntry>();
  for (const entry of entries) {
    if (!entry.code) continue;
    deduped.set(entry.code, { ...entry, savedAt: entry.savedAt ?? new Date().toISOString() });
  }
  const ordered = [...deduped.values()]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(0, WATCHLIST_LIMIT);

  writeJson(STORAGE_KEYS.watchlist, ordered);
  return ordered;
}

export function upsertWatchlist(entry: Omit<WatchlistEntry, 'savedAt'>) {
  const existing = readWatchlist().filter((item) => item.code !== entry.code);
  return saveWatchlist([{ ...entry, savedAt: new Date().toISOString() }, ...existing]);
}

export function removeWatchlist(code: string) {
  return saveWatchlist(readWatchlist().filter((entry) => entry.code !== code));
}

export function isWatchlisted(code: string) {
  return readWatchlist().some((entry) => entry.code === code);
}

export function readRecentSearches(): RecentSearchEntry[] {
  return readJson<RecentSearchEntry[]>(STORAGE_KEYS.recentSearches, []).filter((entry) => Boolean(entry.query));
}

export function pushRecentSearch(query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return readRecentSearches();

  const entries = [
    { query: normalizedQuery, usedAt: new Date().toISOString() },
    ...readRecentSearches().filter((entry) => entry.query !== normalizedQuery)
  ].slice(0, RECENT_SEARCH_LIMIT);

  writeJson(STORAGE_KEYS.recentSearches, entries);
  return entries;
}

export function clearRecentSearches() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEYS.recentSearches);
}

export function readRecentViews(): RecentViewEntry[] {
  return readJson<RecentViewEntry[]>(STORAGE_KEYS.recentViews, []).filter((entry) => Boolean(entry.code));
}

export function pushRecentView(entry: Omit<RecentViewEntry, 'viewedAt'> & { window?: TimeWindow }) {
  const normalized: RecentViewEntry = {
    ...entry,
    window: entry.window ?? '10m',
    viewedAt: new Date().toISOString()
  };

  const entries = [
    normalized,
    ...readRecentViews().filter((item) => item.code !== normalized.code)
  ].slice(0, RECENT_VIEW_LIMIT);

  writeJson(STORAGE_KEYS.recentViews, entries);
  return entries;
}

export function clearRecentViews() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEYS.recentViews);
}

export const storageKeys = STORAGE_KEYS;
