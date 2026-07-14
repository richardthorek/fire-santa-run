import { test, expect } from '@playwright/test';

/**
 * Public brigade discovery (#148): the /brigades page is unauthenticated,
 * lists claimed brigades, and supports client-side search.
 */
test.describe('Brigade discovery', () => {
  test('lists brigades and supports search', async ({ page }) => {
    await page.goto('/brigades');

    await expect(
      page.getByRole('heading', { name: /Find Your Brigade/i }),
    ).toBeVisible();

    // Seeded claimed brigade card
    const card = page.getByRole('link', { name: /Riverside Fire Brigade/i });
    await expect(card).toBeVisible();

    // Search narrows results
    await page.getByPlaceholder(/Search by name or location/i).fill('nonexistent-xyz');
    await expect(page.getByText(/No brigades match your search/i)).toBeVisible();

    // Clearing the search restores the card
    await page.getByPlaceholder(/Search by name or location/i).fill("riverside");
    await expect(card).toBeVisible();
  });

  test('a brigade card links to its public profile', async ({ page }) => {
    await page.goto('/brigades');
    await page.getByRole('link', { name: /Riverside Fire Brigade/i }).click();
    await expect(page).toHaveURL(/\/brigade\/riverside-brigade$/);
    await expect(
      page.getByRole('heading', { name: /Riverside Fire Brigade/i }),
    ).toBeVisible();
  });
});
