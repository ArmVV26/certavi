import { expect, test } from '@playwright/test';

test.describe('smoke', () => {
  test('the app loads, opens on Today and fits an iPhone-sized screen', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Certavi/);
    await expect(page.getByRole('heading', { level: 1, name: 'Hoy' })).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(clientWidth).toBe(390);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
