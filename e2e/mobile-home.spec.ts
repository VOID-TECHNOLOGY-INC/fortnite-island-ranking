import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 }
});

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

test('mobile home defaults to cards and restores watchlist tab state', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /See what is strong/i })).toBeVisible();
  await expect(page.locator('.ranking-card').first()).toBeVisible();

  const alphaCard = page.locator('.ranking-card', { hasText: 'Battle Box Alpha' }).first();
  await alphaCard.getByRole('button', { name: 'Watchlist' }).click();
  await expect(page.getByRole('status')).toContainText('Battle Box Alpha saved to watchlist');

  await page.getByRole('tab', { name: 'Watchlist' }).click();
  await expect(page).toHaveURL(/tab=watchlist/);
  await expect(page.locator('.ranking-card', { hasText: 'Battle Box Alpha' }).first()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/tab=watchlist/);
  await expect(page.locator('.ranking-card', { hasText: 'Battle Box Alpha' }).first()).toBeVisible();
});
