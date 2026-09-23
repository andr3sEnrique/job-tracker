import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;

/**
 * End-to-end tests against a production build in mock mode (in-memory API): they exercise
 * the real UI, routing, CSP and headers without a backend or a Google account.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
    url: `http://localhost:${PORT}/welcome`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_API_MODE: 'mock',
      // Separate build folder: never collides with a running `next dev`.
      NEXT_DIST_DIR: '.next-e2e',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
