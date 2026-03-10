import { expect, type Page } from '@playwright/test';

type DashboardIsland = {
  code: string;
  name: string;
};

type DashboardResponse = {
  ranking?: DashboardIsland[];
  rising?: DashboardIsland[];
};

type DashboardSection = keyof Pick<DashboardResponse, 'ranking' | 'rising'>;

export async function installClipboardStub(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => undefined
      }
    });
  });
}

export async function fetchSmokeSelection(
  page: Page,
  options: {
    count?: number;
    source?: DashboardSection;
  } = {}
): Promise<DashboardIsland[]> {
  const { count = 2, source = 'ranking' } = options;
  const response = await page.request.get('/api/dashboard?window=24h');
  expect(response.ok()).toBeTruthy();

  const data = (await response.json()) as DashboardResponse;
  const seen = new Set<string>();
  const islands = (data[source] ?? []).filter((item): item is DashboardIsland => {
    if (!item?.code || !item?.name || seen.has(item.code)) {
      return false;
    }
    seen.add(item.code);
    return true;
  });

  expect(islands.length).toBeGreaterThanOrEqual(count);
  return islands.slice(0, count);
}

export function desktopRow(page: Page, code: string) {
  return page.locator('.islands-table tbody tr', { hasText: code }).first();
}

export function mobileCard(page: Page, code: string) {
  return page.locator('.ranking-card', { hasText: code }).first();
}
