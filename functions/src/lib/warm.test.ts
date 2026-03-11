import { describe, expect, it, vi } from 'vitest';
import { buildWarmDashboardUrl, resolveWarmBaseUrl, warmDashboardCaches } from './warm.js';

describe('warm helpers', () => {
  it('builds public dashboard warm urls on the hosting domain', () => {
    expect(resolveWarmBaseUrl('demo-project')).toBe('https://demo-project.web.app');
    expect(buildWarmDashboardUrl('24h', 'https://demo-project.web.app')).toBe(
      'https://demo-project.web.app/api/dashboard?window=24h'
    );
  });

  it('warms every dashboard window through the public url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    });

    await warmDashboardCaches(fetchMock as never, 'https://demo-project.web.app');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'https://demo-project.web.app/api/dashboard?window=10m',
      'https://demo-project.web.app/api/dashboard?window=1h',
      'https://demo-project.web.app/api/dashboard?window=24h'
    ]);
  });
});
