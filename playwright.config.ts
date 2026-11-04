import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${String(PORT)}`;
const isCI = !!process.env.CI;

// iPhone-sized viewport used by every project (see context.md: tests run at 390×844).
const IPHONE_VIEWPORT = { width: 390, height: 844 };

// Limits that keep a local run from saturating the PC (incident of 2026-11-02, see context.md):
// - `npm run e2e`     → Chromium only (every test), 2 workers, stops after 3 failures, 5 min cap.
// - `npm run e2e:all` → Chromium (every test) + WebKit (only tests tagged `@all-engines`),
//                       10 min cap (passed with --global-timeout).
// - CI                → a matrix of jobs (chromium; webkit shard 1/2 and 2/2), each with
//                       Playwright's default workers (1 on a 2-vCPU runner) and 2 retries.
// WebKit only runs the tests whose behaviour depends on the engine (IndexedDB, sync, import /
// export, downloads, Today, 390 px layout). UI logic that is engine-independent (theme,
// language, navigation, components) runs in Chromium only. Tag a test or a `describe` with
// `{ tag: '@all-engines' }` to run it in WebKit too.
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
  // Locally the console reporter is terse (`dot`) to save output; CI keeps `list`.
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['dot'], ['html', { open: 'never' }]],
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
      grep: /@all-engines/,
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
