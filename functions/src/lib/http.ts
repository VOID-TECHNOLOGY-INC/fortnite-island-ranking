export function getApiCacheControl(options?: { bypassCache?: boolean }) {
  if (options?.bypassCache) {
    return 'private, no-store, max-age=0';
  }

  return 'public, max-age=300, s-maxage=600';
}
