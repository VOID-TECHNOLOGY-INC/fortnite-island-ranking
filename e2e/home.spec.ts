import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => undefined
      }
    });
  });
});

test('home keeps URL state, supports debounce, tab switching, empty states, and copy feedback', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /See what is strong/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Watchlist' })).toBeVisible();
  await expect(page.getByText('Data range and source')).toBeVisible();
  const alphaRow = page.locator('tr', { hasText: 'Battle Box Alpha' }).first();
  await expect(alphaRow).toBeVisible();
  await page.getByRole('button', { name: 'Copy island code 1234-5678-9012' }).click();
  await expect(page.getByRole('status')).toContainText('1234-5678-9012 copied');

  const search = page.getByPlaceholder('Island name or code');
  await search.fill('P');
  await page.waitForTimeout(400);
  await expect(page.getByText(/Use at least 2 characters/)).toBeVisible();
  await expect(alphaRow).toBeVisible();
  await expect(page).toHaveURL(/query=P/);

  await search.fill('Park');
  await expect(page).toHaveURL(/query=Park/);
  await expect(page.getByText('Parkour Rush').first()).toBeVisible();

  await search.fill('');
  await page.waitForTimeout(400);
  await page.getByRole('tab', { name: 'Rising' }).click();
  await expect(page).toHaveURL(/tab=rising/);
  await expect(page.locator('tr', { hasText: 'Parkour Rush' }).first()).toBeVisible();

  await search.fill('nomatch');
  await page.waitForTimeout(400);
  await expect(page.getByText('No islands matched this query')).toBeVisible();
});
