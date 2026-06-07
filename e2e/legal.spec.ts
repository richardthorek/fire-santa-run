import { test, expect } from '@playwright/test';

/**
 * Launch legal/help pages (#344): public, self-contained, correctly headed.
 */
const pages = [
  { path: '/privacy', heading: /Privacy Policy/i },
  { path: '/terms', heading: /Terms of Use/i },
  { path: '/help', heading: /How to Track Santa/i },
];

test.describe('Static launch pages', () => {
  for (const { path, heading } of pages) {
    test(`${path} renders with its h1`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    });
  }

  test('privacy and terms cross-link each other', async ({ page }) => {
    await page.goto('/terms');
    await page.getByRole('link', { name: /Privacy Policy/i }).click();
    await expect(page).toHaveURL(/\/privacy$/);
  });
});
