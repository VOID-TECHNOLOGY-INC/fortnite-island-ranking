import { expect, test } from '@playwright/test';
import { desktopRow, fetchSmokeSelection, installClipboardStub, mobileCard } from './support';

test.beforeEach(async ({ page }) => {
  await installClipboardStub(page);
});

test('desktop smoke keeps home, compare, and detail usable with live data', async ({ page }) => {
  const [first, second] = await fetchSmokeSelection(page);

  await page.goto('/?window=24h&view=table');

  await expect(page.getByRole('heading', { name: /See what is strong/i })).toBeVisible();
  await expect(page.locator('.islands-table')).toBeVisible();

  const firstRow = desktopRow(page, first.code);
  const secondRow = desktopRow(page, second.code);

  await expect(firstRow).toBeVisible();
  await expect(secondRow).toBeVisible();

  await firstRow.getByRole('button', { name: 'Add Compare' }).click();
  await secondRow.getByRole('button', { name: 'Add Compare' }).click();
  await expect(page.getByRole('link', { name: 'Open Compare' })).toBeVisible();

  await page.getByRole('link', { name: 'Open Compare' }).click();
  await expect(page).toHaveURL(/\/compare\?codes=/);

  const matrixTable = page.locator('.compare-table').first();
  await expect(matrixTable.getByRole('columnheader', { name: first.name })).toBeVisible();
  await expect(matrixTable.getByRole('columnheader', { name: second.name })).toBeVisible();

  await page.goto(`/island/${first.code}?name=${encodeURIComponent(first.name)}&window=24h`);

  await expect(page.locator('h1')).toHaveText(first.name);
  await expect(page.getByText('Island overview')).toBeVisible();
  await expect(page.locator('.kpi-grid .kpi-card').first()).toBeVisible();
  await expect(page.locator('.chart-card')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Keep exploring' })).toBeVisible();
});

test.describe('mobile smoke', () => {
  test.use({
    viewport: { width: 390, height: 844 }
  });

  test('mobile cards, detail, and compare stay usable with live data', async ({ page }) => {
    const [first, second] = await fetchSmokeSelection(page);

    await page.goto('/?window=24h');

    await expect(page.getByRole('heading', { name: /See what is strong/i })).toBeVisible();
    await expect(page.locator('.ranking-card').first()).toBeVisible();
    await expect(page.locator('.islands-table')).toHaveCount(0);

    const firstCard = mobileCard(page, first.code);
    const secondCard = mobileCard(page, second.code);

    await expect(firstCard).toBeVisible();
    await expect(secondCard).toBeVisible();

    await firstCard.getByRole('button', { name: 'Watchlist' }).click();
    await expect(page.getByRole('status')).toContainText('saved to watchlist');

    await firstCard.getByRole('button', { name: 'Add Compare' }).click();
    await secondCard.getByRole('button', { name: 'Add Compare' }).click();
    await expect(page.getByRole('link', { name: 'Open Compare' })).toBeVisible();

    await firstCard.getByRole('link', { name: first.name }).click();
    await expect(page).toHaveURL(new RegExp(`/island/${first.code}`));
    await expect(page.locator('.hero-panel--detail .action-row').first()).toBeVisible();
    await expect(page.locator('.chart-card')).toBeVisible();

    await page.goBack();
    await page.getByRole('link', { name: 'Open Compare' }).click();
    await expect(page).toHaveURL(/\/compare\?codes=/);

    const matrixTable = page.locator('.compare-table').first();
    await expect(matrixTable.getByRole('columnheader', { name: first.name })).toBeVisible();
    await expect(matrixTable.getByRole('columnheader', { name: second.name })).toBeVisible();
  });
});
