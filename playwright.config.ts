import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${String(PORT)}`;
const isCI = !!process.env.CI;
// CI builds `dist-e2e` once in its own job and downloads it into every e2e job (E2E_PREBUILT=1),
// so the web server only serves it. Never set it locally: a stale `dist-e2e` would hide changes.
const prebuilt = process.env.E2E_PREBUILT === '1';

// iPhone-sized viewport used by every project (see context.md: tests run at 390×844).
const IPHONE_VIEWPORT = { width: 390, height: 844 };

// WebKit on a CI runner (2 vCPU, 1 worker) is seconds slower on local storage, and the long
// sync / Today flows went over 30 s (AC-SYNC-14 English, AC-TODAY-10 / 11 on 2026-11-05). Nothing
// is waited for by time; this is only the budget. Chromium keeps the default 30 s.
const WEBKIT_TIMEOUT = 60_000;

// The same engine is also slow on the first read of IndexedDB (the "Datos" card with two tabs
// open was still "Cargando…" after the default 5 s on 2026-11-05). Web-first assertions return as
// soon as they pass, so this is only a budget. Chromium keeps the default 5 s.
const WEBKIT_EXPECT_TIMEOUT = 15_000;

// Limits that keep a local run from saturating the PC (incident of 2026-11-02, see context.md):
// - `npm run e2e`     → Chromium only (every test), 2 workers, stops after 3 failures, 5 min cap.
// - `npm run e2e:all` → Chromium (every test) + WebKit (only tests tagged `@all-engines`),
//                       cap of 1 600 000 ms (~27 min, passed with --global-timeout in package.json).
//                       It was 10 min until Phase 5 and 20 min until Phase 9: with one worker (as in
//                       CI) the WebKit tests alone take ~19 min, and the cap hit whichever test was
//                       running. In CI each job runs a shard, so the cap does not apply there.
// - CI                → a `build-e2e` job builds `dist-e2e` once and shares it as an artifact; then
//                       a matrix of four jobs runs in parallel (chromium shard 1/2 and 2/2, webkit
//                       shard 1/2 and 2/2), each with Playwright's default workers (1 on a 2-vCPU
//                       runner) and 1 retry (a test that needs two is flaky: fix it).
// WebKit only runs the tests whose behaviour depends on the engine (IndexedDB, sync, import /
// export, downloads, Today, 390 px layout). UI logic that is engine-independent (theme,
// language, navigation, components) runs in Chromium only. Tag a test or a `describe` with
// `{ tag: '@all-engines' }` to run it in WebKit too.
// `reportSlowTests` lists the 20 slowest tests of a run that took over 20 s, so a test drifting
// towards the WebKit cap (60 s) shows up before it fails. Split it by acceptance criterion then.
// Each test has 30 s (60 s in WebKit, see WEBKIT_TIMEOUT) and each assertion 5 s (15 s in WebKit,
// see WEBKIT_EXPECT_TIMEOUT); do not add `test.slow` for WebKit.
// Never set `channel: 'chrome'`: tests run on Playwright's own browsers, never the user's Chrome.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  workers: isCI ? undefined : 2,
  retries: isCI ? 1 : 0,
  maxFailures: isCI ? undefined : 3,
  timeout: 30_000,
  globalTimeout: 5 * 60_000,
  reportSlowTests: { max: 20, threshold: 20_000 },
  // The HTML report is written to playwright-report/ but never opened or served.
  // Locally the console reporter is terse (`dot`) to save output; CI keeps `list`.
  // The JSON report holds the time of every test: `npm run e2e:timings` reads it (it is the only
  // way to see which tests drift towards the time limit; `dot` prints no times).
  reporter: [
    isCI ? ['list'] : ['dot'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'e2e-timings/last-run.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The service worker would cache the app between tests and hide failures; only
    // tests/e2e/pwa.spec.ts turns it on with `test.use({ serviceWorkers: 'allow' })`.
    serviceWorkers: 'block',
    // The app fades sections in (src/app/Layout.module.css). With reduced motion the durations
    // are 0 ms, so a test (or an axe scan) never sees a half-faded page.
    reducedMotion: 'reduce',
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
      timeout: WEBKIT_TIMEOUT,
      expect: { timeout: WEBKIT_EXPECT_TIMEOUT },
      grep: /@all-engines/,
    },
  ],
  // Playwright builds the app, starts `vite preview` and stops it when the run ends.
  // reuseExistingServer is false on purpose: a busy port must fail the run, not be reused.
  webServer: {
    // `--mode e2e` keeps the component catalog (/dev/ui, src/app/devUi.ts) that some specs use;
    // the production build (`npm run build`) does not have it. It goes to its own folder so a
    // later `npm run preview` never serves the catalog.
    command: `${prebuilt ? '' : 'npx vite build --mode e2e --outDir dist-e2e && '}npx vite preview --outDir dist-e2e --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
