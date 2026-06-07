import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for Fire Santa Run.
 *
 * Runs against the Vite dev client in DEV mode (auth bypassed, localStorage
 * storage adapter, mock data seeded) so the critical journeys can be exercised
 * end-to-end without Azure or Entra. Mobile is the primary device, so a mobile
 * project runs first, with a desktop project for parity.
 */

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Fail the build on CI if test.only is left in the source.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Dev mode bypasses auth and uses the localStorage adapter + mock data.
    command: 'npm run dev:client',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_DEV_MODE: 'true',
      VITE_MAPBOX_TOKEN: process.env.VITE_MAPBOX_TOKEN || 'test-token',
    },
  },
});
