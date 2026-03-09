import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

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

test('mobile viewport keeps home cards, detail actions, and compare flow usable', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /See what is strong/i })).toBeVisible();
  await expect(page.locator('.ranking-card').first()).toBeVisible();
  await expect(page.locator('.islands-table')).toHaveCount(0);

  const alphaCard = page.locator('.ranking-card', { hasText: 'Battle Box Alpha' }).first();
  const parkourCard = page.locator('.ranking-card', { hasText: 'Parkour Rush' }).first();

  await alphaCard.getByRole('button', { name: 'Add Compare' }).click();
  await parkourCard.getByRole('button', { name: 'Add Compare' }).click();
  await expect(page.getByRole('link', { name: 'Open Compare' })).toBeVisible();

  await alphaCard.getByRole('link', { name: 'Battle Box Alpha' }).click();
  await expect(page.getByRole('heading', { name: 'Battle Box Alpha' })).toBeVisible();
  await expect(page.locator('.hero-panel--detail .action-row').first()).toBeVisible();
  await expect(page.locator('.chart-card svg')).toBeVisible();

  await page.goto('/compare');
  await expect(page.getByRole('heading', { name: /Compare up to four islands/i })).toBeVisible();
  const matrixTable = page.locator('.compare-table').first();
  await expect(matrixTable.getByRole('columnheader', { name: 'Battle Box Alpha' })).toBeVisible();
  await expect(matrixTable.getByRole('columnheader', { name: 'Parkour Rush' })).toBeVisible();
});
