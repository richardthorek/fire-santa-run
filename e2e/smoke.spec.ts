import { test, expect } from '@playwright/test';

/**
 * Core app smoke: in dev mode the mock user is auto-authenticated, so the
 * dashboard is reachable and seeded mock routes render. Verifies the SPA
 * boots, code-split chunks load, and the primary authenticated surface works.
 */
test.describe('App smoke', () => {
  test('dashboard loads with seeded routes in dev mode', async ({ page }) => {
    await page.goto('/dashboard');

    // Dashboard heading (mock user auto-authenticated in dev mode)
    await expect(
      page.getByRole('heading', { name: /Santa Run Routes/i }),
    ).toBeVisible();

    // Seeded mock route from utils/mockData.ts
    await expect(page.getByText('Christmas Eve 2024 - South Route')).toBeVisible();
  });

  test('dev-mode banner is present', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/Development Mode/i)).toBeVisible();
  });
});
