import { test, expect } from '@playwright/test';

/**
 * Public brigade page (#147) → tracking view journey. The brigade profile is
 * unauthenticated and lists upcoming runs that link to the public tracker.
 */
test.describe('Public brigade page', () => {
  test('shows brigade identity and an upcoming run linking to the tracker', async ({ page }) => {
    await page.goto('/brigade/griffith-rfs');

    await expect(
      page.getByRole('heading', { name: /Griffith Rural Fire Brigade/i }),
    ).toBeVisible();

    // The seeded published route appears under upcoming/live runs.
    const run = page.getByRole('link', { name: /Track Christmas Eve - South Route/i });
    await expect(run).toBeVisible();

    await run.click();
    // Lands on the public tracking view for the published route.
    await expect(page).toHaveURL(/\/track\/route_2$/);
  });

  test('unknown slug shows a not-found state', async ({ page }) => {
    await page.goto('/brigade/does-not-exist');
    await expect(page.getByRole('heading', { name: /Brigade not found/i })).toBeVisible();
  });
});
