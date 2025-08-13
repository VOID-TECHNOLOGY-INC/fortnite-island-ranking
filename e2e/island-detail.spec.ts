import { test, expect } from '@playwright/test';

const BASE = 'https://fortnite-island-ranking.web.app';

test('Island Detail renders header and Perplexity note', async ({ page }) => {
  const name = '1v1 Build Fights! [Disodiumz]';
  await page.goto(`${BASE}/island/0720-2388-2805?name=${encodeURIComponent(name)}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Auto research powered by Perplexity')).toBeVisible();
});


