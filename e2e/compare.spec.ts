import { expect, test } from '@playwright/test';

test('Compare flow persists from home selection to compare URL', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /See what is strong/i })).toBeVisible();

  const alphaRow = page.locator('tr', { hasText: 'Battle Box Alpha' }).first();
  const parkourRow = page.locator('tr', { hasText: 'Parkour Rush' }).first();
  await expect(alphaRow).toBeVisible();
  await expect(parkourRow).toBeVisible();
  await alphaRow.getByRole('button', { name: 'Add Compare' }).click();
  await parkourRow.getByRole('button', { name: 'Add Compare' }).click();
  await expect(page.getByRole('status')).toContainText('Parkour Rush added to compare');
  await expect(page.getByRole('link', { name: 'Open Compare' })).toBeVisible();

  await page.getByRole('link', { name: 'Open Compare' }).click();

  await expect(page).toHaveURL(/\/compare\?codes=/);
  await expect(page.getByRole('heading', { name: /Compare up to four islands/i })).toBeVisible();
  await expect(page.getByText('Comparison matrix')).toBeVisible();
  await expect(page.getByText('Score breakdown')).toBeVisible();
  const matrixTable = page.locator('.compare-table').first();
  await expect(matrixTable.getByRole('columnheader', { name: 'Battle Box Alpha' })).toBeVisible();
  await expect(matrixTable.getByRole('columnheader', { name: 'Parkour Rush' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Comparison matrix')).toBeVisible();
});
