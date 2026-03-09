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

test('compare and watchlist persist across navigation', async ({ page }) => {
  await page.goto('/');

  const alphaRow = page.locator('tr', { hasText: 'Battle Box Alpha' }).first();
  const parkourRow = page.locator('tr', { hasText: 'Parkour Rush' }).first();

  await expect(alphaRow).toBeVisible();
  await expect(parkourRow).toBeVisible();
  await alphaRow.getByRole('button', { name: 'Watchlist' }).click();
  await expect(page.getByRole('status')).toContainText('Battle Box Alpha saved to watchlist');

  await alphaRow.getByRole('button', { name: 'Add Compare' }).click();
  await parkourRow.getByRole('button', { name: 'Add Compare' }).click();
  await expect(page.getByRole('status')).toContainText('Parkour Rush added to compare');

  await page.getByRole('link', { name: 'Open Compare' }).click();
  await expect(page).toHaveURL(/\/compare\?/);
  const matrixTable = page.locator('.compare-table').first();
  await expect(matrixTable.getByRole('columnheader', { name: 'Battle Box Alpha' })).toBeVisible();
  await expect(matrixTable.getByRole('columnheader', { name: 'Parkour Rush' })).toBeVisible();

  await page.goto('/compare');
  await expect(matrixTable.getByRole('columnheader', { name: 'Battle Box Alpha' })).toBeVisible();
  await expect(matrixTable.getByRole('columnheader', { name: 'Parkour Rush' })).toBeVisible();

  await page.goto('/');
  await expect(page.locator('.sidecar-card', { hasText: 'Watchlist' }).getByText('Battle Box Alpha')).toBeVisible();
});
