import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${String(PORT)}`;
const isCI = !!process.env.CI;

// iPhone-sized viewport used by every project (see context.md: tests run at 390×844).
const IPHONE_VIEWPORT = { width: 390, height: 844 };

// Limits that keep a local run from saturating the PC (incident of 2026-11-02, see context.md):
// - `npm run e2e`     → Chromium only, 2 workers, stops after 3 failures, 5 min cap (below).
// - `npm run e2e:all` → Chromium + WebKit, 10 min cap (passed with --global-timeout).
// - CI                → Chromium + WebKit with Playwright's default workers and 2 retries.
// Never set `channel: 'chrome'`: tests run on Playwright's own browsers, never the user's Chrome.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  workers: isCI ? undefined : 2,
  retries: isCI ? 2 : 0,
  maxFailures: isCI ? undefined : 3,
  timeout: 30_000,
  globalTimeout: 5 * 60_000,
  // The HTML report is written to playwright-report/ but never opened or served.
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
        deviceScaleFactor: 2,
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
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
