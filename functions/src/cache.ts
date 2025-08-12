type CacheEntry<T> = { value: T; expiresAt: number };

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return e.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }
}

export const globalCache = new MemoryCache();


