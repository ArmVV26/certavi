import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${String(PORT)}`;

// iPhone-sized viewport used by every project (see context.md: tests run at 390×844).
const IPHONE_VIEWPORT = { width: 390, height: 844 };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: IPHONE_VIEWPORT,
        deviceScaleFactor: 3,
        hasTouch: true,
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['iPhone 13'],
        viewport: IPHONE_VIEWPORT,
      },
    },
  ],
  // Playwright builds the app, starts `vite preview` and stops it when the run ends.
  // reuseExistingServer is false on purpose: a busy port must fail the run, not be reused.
  webServer: {
    command: `npx vite build && npx vite preview --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
