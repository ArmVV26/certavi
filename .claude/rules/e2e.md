---
paths:
  - 'tests/e2e/**'
  - 'tests/mocks/**'
  - 'playwright.config.ts'
---

# End-to-end tests (Playwright)

Single source of truth for e2e. CLAUDE.md, the `blind-tester` agent and the `close-phase` skill
only point here.

An e2e run once saturated the user's PC (2026-11-02: 8 parallel browsers, three runs in a row).
These rules keep it from happening again.

## Setup and limits

- Playwright (390×844) builds the app, starts `vite preview` on **4173** and stops it itself
  (`reuseExistingServer: false`, `strictPort`, webServer timeout 60 s). A busy port fails the
  run on purpose.
- **E2E limits** (after the 2026-11-02 resource-starvation incident, see `context.md` §2.2 and
  §12): `npm run e2e` runs **Chromium only** (every test); `npm run e2e:all` (and CI, on PRs to
  `main`) runs Chromium (every test) + WebKit, where the `webkit` project only runs tests tagged
  **`@all-engines`** (`grep` in `playwright.config.ts`). Tag (`{ tag: '@all-engines' }`, on a
  test or a `describe`) what depends on the engine: IndexedDB / local data, sync, import and
  export, downloads, Today and the session, the 390 px layout. Engine-independent UI logic
  (theme, language, navigation, components) stays Chromium-only. In CI a `build-e2e` job builds `dist-e2e` once and shares it as an artifact; then
  the `e2e` job runs as a matrix of four jobs **in parallel** (`fail-fast: false`): `chromium 1/2`,
  `chromium 2/2`, `webkit 1/2`, `webkit 2/2` (`--project` / `--shard` are used in the workflow
  only, never locally). They set `E2E_PREBUILT=1`, so `playwright.config.ts` only serves the
  downloaded bundle (never set it locally: a stale `dist-e2e` would hide changes). Each job
  installs and caches its own browser and uploads its own report; `timeout-minutes` is 10 for
  `build-e2e` and 15 for each e2e job (they only catch a hang). Locally **2 workers**, no retries,
  `maxFailures` 3; CI uses default workers (1 on a 2-vCPU runner, the size of private repos) +
  **1 retry**: a test that needs two is flaky, fix it.
  30 s per test (60 s in WebKit: the project's `timeout` in `playwright.config.ts`; no
  `test.slow` for WebKit) and 5 s per assertion (15 s in WebKit: the project's `expect.timeout`); global timeout 5 min (`npm run e2e`) / `--global-timeout=1600000` ms (`npm run e2e:all`). Reporters:
  locally `dot` + `html` + `json`, in CI `list` + `html` + `json` (`open: 'never'`, report port
  9323; the JSON goes to `e2e-timings/last-run.json`, git-ignored). Chromium `deviceScaleFactor`
  2; never `channel: 'chrome'`.
- Tagging for WebKit: do not tag engine-independent UI logic (theme, language, navigation,
  components): WebKit in CI has one worker and is the scarce resource. Keep the tagged set small:
  a new spec file gets a tag on its `describe` only if all of it qualifies.
- When a browser genuinely behaves differently (e.g. WebKit does not Tab to links), skip that
  check in that browser with `test.skip(condition, 'reason')` and keep it in the others.
- Do not add `test.slow` because WebKit is slow; if a test gets close to 60 s in WebKit, split it
  or cut steps. `reportSlowTests` (`playwright.config.ts`) flags the slowest files of a run
  (over 20 s).
- **Test data comes from a Certavi backup, never from a gym_app file**: load it with
  `tests/fixtures/certavi-backup-sample.json` through "Importar copia de Certavi" (29 records,
  synthetic). Only `import-export.spec.ts` still touches the gym_app importer, because it is the
  feature under test.
- Give every wait in one helper the same timeout; do not leave one step on the 5 s default
  while the next one waits 10 s.
- `tests/mocks/sync-server.ts` is the fake `/api/v1/**` for e2e: the real `server/sync` handler
  with a memory store, attached via Playwright `context.route` (no process, no port).

## What e2e tests are for

- E2E tests cover **user flows and acceptance criteria**, not exhaustive combinations. Every
  input variant, format or edge of a rule belongs to the unit tests (written by the main agent).
  Prefer one test that walks a flow over many tests that each check one value.
- Run **axe once per screen and theme** (light / dark), in Chromium only — not per language or
  per browser.
- Target: `npm run e2e` takes **under 2 minutes**. Keep the suite small enough for that.

## How to run them (mandatory — an e2e run once froze the user's PC)

- Run e2e **only** with `npm run e2e` (Chromium, 2 workers, 5 min cap, stops after 3 failures),
  optionally followed by spec paths: `npm run e2e -- tests/e2e/today.spec.ts` — and nothing else.
  When an agent runs it, pass just the specs of the current branch that the main agent gave it.
- `npm run e2e:all` (Chromium + WebKit) only when the user asks for it (for an agent: only if the
  main agent says the user asked for it), or in `/close-phase final` on the last branch of a
  phase (before the PR `dev → main`; CI runs it again there). WebKit was never run before the
  Phase 4 PR and CI caught it (2026-11-04).
- Never call `npx playwright test` directly. The only thing allowed after `--` is spec paths:
  no `--project`, `--workers`, `--retries`, `--headed`, `--ui`, `--reporter`, `--repeat-each`…
  and no flags added to the npm scripts. Never create temporary probe specs to run.
- Run it in the foreground. Never move it to the background and poll it with `sleep` / `ping`
  loops. Run nothing heavy (`lint`, `tsc`, `build`, another test run) while it runs.
- **If it takes more than 5 minutes or hangs:** stop it, run `npm run ports:kill`, make sure no
  Playwright browser is left (processes under `ms-playwright`), check `npm run ports:check`, and
  report to the user.
- **Never retry in a loop.** At most one run, plus one more only after fixing a test; then
  report, even if something still fails. Never re-run to "see if it passes".
- **Never install browsers** (`npx playwright install`): the user does it. Never open the HTML
  report (`npx playwright show-report`).
- When you finish, `npm run ports:check` must show every port free.

## Measuring the time of every test (phase 9, branch 6)

A full `npm run e2e:all` (Chromium + WebKit) takes 10-15 min: longer than Claude's shell allows
(10 min) and the rule above forbids background runs. That is why the slow tests could not be
measured or split in `chore/e2e-speed`: `reportSlowTests` names slow files only, and `dot` prints
no times. So the **user** runs it, in their own terminal, and Claude only reads the result:

1. User: `npm run e2e:all` (add `-- --workers=1` for times close to CI's, which has one worker).
   It writes `e2e-timings/last-run.json`. No hand-made flags are needed for Claude's runs.
2. Claude (or the user): `npm run e2e:timings` lists, per project, the slowest tests, marking
   **slow** (half the time limit: 15 s Chromium, 30 s WebKit) and **NEAR** (three quarters: 22 s
   and 45 s) and the tests that needed a retry. It reads nothing but that JSON.
3. CI uploads the JSON of every job as `e2e-timings-<project>-<shard>` (14 days). Download the
   four artifacts and run `npm run e2e:timings -- chromium-1.json chromium-2.json …` to see the
   real CI times, which are what decide whether a WebKit test goes over 60 s.
4. Split each test marked slow in WebKit **by acceptance criterion** (one `test` per AC, the
   shared setup in a helper) or cut steps that belong to unit tests.

## Time and waits (mandatory — real-time waits broke CI in WebKit on 2026-11-04)

- **No real-time waits.** Never `page.waitForTimeout(...)`, and never wait for an app timer
  (a debounce, a retry backoff, a toast that goes away) to pass on its own. Move the app's
  timers with **`page.clock`**: `await page.clock.install()` **before** the first `goto`
  (after `install()` time still flows; `pauseAt(...)` stops it), then
  `await page.clock.runFor(ms)` to jump past the timer (pattern: AC-DIALOG-05 in
  `components.spec.ts`). Check the state _before_ advancing a paused clock: while it is still,
  nothing scheduled can happen behind the test's back.
- "Nothing happens" checks (no request, no retry) are `runFor(ms)` past the moment it would
  happen, then the assertion, not a sleep.
- Wait for **visible state** with web-first assertions (`toHaveText`, `toBeVisible`,
  `toHaveAccessibleName`) or `expect.poll(...)`. Never assume a step is done because time passed.
- **A visible text is not proof the server answered.** Before you inject a failure with the
  fake server (`failNext`) or rely on data having reached it, wait for the server itself:
  `await expect.poll(() => server.requestCount()).toBeGreaterThan(before)` or
  `expect.poll(() => server.records())`. WebKit can be seconds slower than Chromium on
  IndexedDB; a failure injected too early lands on the wrong request.
