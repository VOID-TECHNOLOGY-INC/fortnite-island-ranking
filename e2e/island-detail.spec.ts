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

test('detail shows KPI-first overview, chart, share feedback, and related islands', async ({ page }) => {
  await page.goto('/island/1234-5678-9012?name=Battle%20Box%20Alpha&window=24h');

  await expect(page.getByRole('heading', { name: 'Battle Box Alpha' })).toBeVisible();
  await expect(page.getByText('Island overview')).toBeVisible();
  await expect(page.locator('.kpi-grid .kpi-card').first()).toBeVisible();
  await expect(page.getByText(/in the last 24h/)).toBeVisible();
  await expect(page.locator('.chart-card svg')).toBeVisible();
  await expect(page.getByText('Zombie Survival Arena')).toBeVisible();

  const kpiBeforeResearch = await page.evaluate(() => {
    const kpiGrid = document.querySelector('.kpi-grid');
    const researchHeading = Array.from(document.querySelectorAll('h2, h3')).find((node) => node.textContent?.includes('Reference notes'));
    if (!kpiGrid || !researchHeading) return false;
    return Boolean(kpiGrid.compareDocumentPosition(researchHeading) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(kpiBeforeResearch).toBe(true);

  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('status')).toContainText('Share URL copied');
});

test('detail can seed compare state and open compare directly', async ({ page }) => {
  await page.goto('/island/1234-5678-9012?name=Battle%20Box%20Alpha&window=24h');

  const heroPanel = page.locator('.hero-panel--detail').first();

  await expect(page.getByRole('heading', { name: 'Battle Box Alpha' })).toBeVisible();
  await heroPanel.getByRole('button', { name: 'Add Compare' }).click();
  await expect(page.getByRole('status')).toContainText('Battle Box Alpha added to compare');

  const relatedCard = page.locator('.related-card', { hasText: 'Zombie Survival Arena' }).first();
  await expect(relatedCard).toBeVisible();
  await relatedCard.getByRole('button', { name: 'Add Compare' }).click();
  await expect(page.getByRole('status')).toContainText('Zombie Survival Arena added to compare');

  const compareHref = await heroPanel.getByRole('link', { name: 'Open Compare' }).getAttribute('href');
  expect(compareHref).toMatch(/\/compare\?codes=/);
  await page.goto(compareHref!);
  await expect(page).toHaveURL(/\/compare\?codes=/);
  const matrixTable = page.locator('.compare-table').first();
  await expect(matrixTable.getByRole('columnheader', { name: 'Battle Box Alpha' })).toBeVisible();
  await expect(matrixTable.getByRole('columnheader', { name: 'Zombie Survival Arena' })).toBeVisible();
});
