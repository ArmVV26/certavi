# CLAUDE.md — Certavi

Guidance for Claude Code working in this repository.

- **Working rules (mandatory):** @.claude/rules.md
- **Project status, decisions, roadmap and phase prompts:** `context.md` (Spanish). It is the
  single source of truth for _what is done and what comes next_. At the start of a phase read
  only its index and the phase section (Grep + ranges, never the whole file). Closed phases and
  the progress log live in `docs/history.md`. This file describes _how the project is built_.

---

## 1. What Certavi is

Certavi is a personal **offline-first PWA** for logging strength training: routines, workout
sessions, sets (weight, reps, RIR), progress, body weight, and optional mobility / stretching /
rehab blocks. It is used on an iPhone in the gym, **often without coverage**, so every write
goes to the device first and syncs later.

It is a from-scratch rewrite of `gym_app` (v1.5.1, untyped JS, no tests). `gym_app` remains the
daily-use app until Certavi reaches **v1.0.0** (feature parity).

### Goals

1. An excellent daily tool: fast, works offline, **never loses data**.
2. A portfolio-grade project: clean architecture, tests, CI, docs, tidy commit history.
3. A **replaceable backend**: Netlify today; Java, Python or Firebase tomorrow, without touching
   the UI — only the sync contract has to be honoured.

### Non-goals (for now)

Native App Store app, multi-user, social features.

---

## 2. Stack

| Layer      | Tool                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| Build      | Vite                                                                                          |
| UI         | React 19, React Router 8 (`RouterProvider` from `react-router/dom`)                           |
| State      | Dexie as source of truth (`useLiveQuery` from `dexie-react-hooks`) + local UI state. No Redux |
| Validation | zod — schemas shared by client and function (sync contract, importer)                         |
| Styles     | Design tokens as CSS custom properties + CSS Modules. Light/dark via `data-theme`             |
| Fonts      | Self-hosted with `@fontsource-variable/archivo` (nothing loaded from third parties)           |
| i18n       | `i18next` + `react-i18next` (`es` default, `en` optional)                                     |
| PWA        | `vite-plugin-pwa` (Workbox): precache, "new version" prompt                                   |
| Charts     | Hand-written SVG (no chart library)                                                           |
| Backend    | Netlify Functions (TypeScript) + `@netlify/blobs`                                             |
| Tests      | Vitest + RTL + jsdom; Playwright (Chromium locally; Chromium + WebKit in `e2e:all` and CI)    |
| Quality    | ESLint (flat, type-checked) + Prettier + `tsc`; husky + commitlint                            |
| CI         | GitHub Actions: lint, typecheck, test:coverage, build on PRs to dev/main; e2e on PRs to main  |

Installed so far: Phase 0 tooling, Phase 1 (`react-router`, `i18next`, `react-i18next`,
`@fontsource-variable/archivo`, `@axe-core/playwright`), Phase 2 (`zod`,
`@vitest/coverage-v8`), Phase 3 (`dexie`, `dexie-react-hooks`, `fake-indexeddb`) and Phase 4
(`@netlify/blobs` runtime, `@netlify/functions` dev), Phase 8 (`vite-plugin-pwa`, `workbox-window`,
`@vite-pwa/assets-generator`, `knip`); the rest arrives in the phase that needs it.

**Version constraints (pinned exact in `package.json`):** TypeScript stays on **6.0.x**
(typescript-eslint supports `<6.1`) and ESLint on **9.x** (eslint-plugin-react and jsx-a11y do
not support ESLint 10 yet). Node **≥ 22.22.2** (`.nvmrc`: `22`).

---

## 3. Architecture

```
React UI ─► hooks ─► Domain (pure TS) ─► Repositories ─► Dexie (IndexedDB)
                        │                     │
                        ▼                     ▼
                 Rules (1RM, progression,   SyncEngine (pending queue, retries, LWW)
                 weekly set counts…)          │
                                              ▼
                                       SyncTransport (interface)
                                              │ HTTPS · POST /api/v1/sync
                                              ▼
                                Netlify Function (TS) ─► Netlify Blobs
```

**Layer rules**

- `src/domain` — pure TypeScript: entities, zod schemas, rules, seed catalog and routines.
  **No React, no Dexie, no `fetch`.** Everything here is unit-tested.
- `src/data` — Dexie database, repositories, `SyncEngine`, `SyncTransport` implementations,
  legacy importer, exporters. Depends on `domain`, never on `features` or `ui`. Ids of
  records created on the device come from `newId(prefix)` (`src/data/ids.ts`: `ses_`, `act_`,
  `set_` + base36 time + 10 random characters).
- `src/features/*` — screens and their hooks (`today`, `session`, `calendar`, `routines`,
  `exercises`, `progress`, `blocks`, `settings`). May use `domain`, `data`, `ui`, `i18n`.
- `src/ui` — generic, presentational components (Button, Dialog, Sheet, NumberField…).
  No domain knowledge, no data access.
- `src/app` — routes, layout, providers, service worker registration.
- `src/data/sync` — client sync: `engine.ts` (`createSyncEngine`), `transport.ts`
  (`SyncTransport`, `SyncError`), `httpTransport.ts` (generic for any sync-v1 backend),
  `queue.ts`, `commit.ts` (applies a response in one transaction), `restore.ts` (server
  backups), `syncKey.ts` (device-only key), `attemptLog.ts`, `browserTriggers.ts`,
  `SyncProvider.tsx` (`useSyncEngine`, `useSyncState`). Decisions in ADR-0004.
- `server/sync` — the sync server as a plain `Request → Response` handler
  (`createSyncHandler`) over a `SyncStore` (memory or Netlify Blobs). It is shared by the
  Netlify Function (`netlify/functions/sync.ts`, a thin adapter), the unit tests and the e2e
  fake server. Its production code imports only `src/domain` (contract + merge rule); only
  `server/sync/httpTransport.test.ts` reaches into `src/data` (client transport vs real handler).
- **The backend is as dumb as possible**: it stores and returns records, applies
  last-write-wins and keeps daily backups. All business logic lives in the client.

**Sync model** (details in `docs/api/sync-v1.md`, decisions in `docs/adr/`):
every write updates `updatedAt` and adds the record to the pending queue **in the same Dexie
transaction**; deletions are soft (`deleted: true`); the server assigns a monotonic
`serverSeq`; clients pull with `since`; retries back off 4, 8, 15, 30, 60 s; a `keepalive`
flush runs when the app is hidden.

---

## 4. Repository layout

```
.claude/            rules.md, settings.json (permissions), agents/, commands/
.github/workflows/  ci.yml
docs/
  spec/             functional spec (incl. pwa.md and states.md, Phase 8) — the ONLY thing
                    the blind-tester reads
  api/sync-v1.md    backend contract
  adr/              architecture decision records (0001, 0002, …; 0005 service worker updates)
  design/           palette, typography, tokens (Phase 1)
  deploy-netlify.md Netlify deploy guide (Phase 4)
  migration.md      mapping from gym_app
  history.md        closed phases, progress log, Claude Code setup of the first phases
netlify/functions/  sync.ts — thin adapter over server/sync (Phase 4)
public/             icons, robots.txt, manifest (generated; icon.svg is the source, `npm run icons`
                    builds the PNGs from pwa-assets.config.ts)
knip.json           knip config (unused files, exports and dependencies; `npm run knip`)
scripts/            ports-check.mjs; lib/ports.mjs (shared port probing); hooks/ (Claude Code
                    hooks: format-file.mjs after Edit|Write, ports-warn.mjs on Stop)
server/sync/        sync v1 server: handler, stores (memory, Netlify Blobs), auth, backups,
                    contract test (Phase 4)
src/
  app/              App shell (routes, layout, providers); pwa/ (update adapter and the
                    "new version" banner, Phase 8)
  domain/           model/ (zod schemas + types), rules/, seed/ (catalog, routines, blocks,
                    legacy aliases), sync/ (contract schemas, merge rule), testing/ (test
                    data builders), dates.ts
  data/             Dexie, repositories, importer, exporters, sync/ (client sync engine)
  features/  ui/  i18n/  theme/
  test/setup.ts     Vitest setup (jest-dom matchers, cleanup, fake-indexeddb/auto)
  test/render.tsx   renderWithProviders + openTestDatabase helpers for component tests
  test/renderApp.tsx renderApp: the whole app with an in-memory router
tests/
  e2e/              Playwright specs (written by the blind-tester)
  fixtures/         synthetic input files (gym_app sample export, invalid file) for unit and e2e
  mocks/            sync-server.ts: fake /api/v1/** for e2e — the real server/sync handler with
                    a memory store, attached via Playwright `context.route` (no process, no port)
context.md  CHANGELOG.md  README.md  LICENSE  netlify.toml (build, SPA redirect, headers/CSP)
tsconfig.json       references only: tsconfig.app / .node / .e2e / .server.json
```

Empty folders hold a `.gitkeep` until they get real files.

---

## 5. Domain model (summary)

Full table in `context.md` §4. Records are stored and synced as **plain JSON**; behaviour lives
in pure rule modules (`src/domain/rules`), with classes only where they help.

```ts
interface SyncEnvelope {
  id: string; // stable; gym_app exercise ids are preserved
  type: RecordType; // 'exercise' | 'routine' | 'session' | 'set' | ...
  updatedAt: number; // ms epoch; the highest wins
  deleted?: true; // soft delete, travels to other devices
  serverSeq?: number; // set by the server; the client never sends it
}
```

Entities: `Exercise`, `MuscleGroup`, `SetScheme`, `Routine`, `WeekPlan`, `WorkoutSession`
(`routineId: null` = free session; its `items` keep one scheme per exercise whose rows are the
sets the user sees), `SetEntry` (`kind`: warmup · approach · top · backoff · straight · bilbo ·
dropset · extra; `slot` = position of its row in the exercise), `ExerciseNote`, `Activity`, `BodyWeight`, `OptionalBlock`,
`BlockLog`, `WeeklyMetric`, `Settings` (device-only fields such as theme and sync key are
never synced).

Rules (all tested): estimated 1RM (Epley on best set, ignoring warm-up/approach), progression
(top set, increments +2.5 kg upper / +5 kg lower unless overridden, back-off ≈ −10 %, isolation),
"does not count" sessions, effective sets per muscle group per week vs plan, records (excluding
deload weeks), deload, short week, hiking week (`weekRoutines`), day plan (`dayPlan.ts`), new
sessions (`session.ts`), Today helpers (`today.ts`), blocks of the day (`blocks.ts`), weekly
streak and training volume per week or month (`trainingStats.ts`).

---

## 6. Code conventions

- **TypeScript strict** (+ `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly`: no enums or namespaces — use union types and `as const` objects).
  No `any` without a comment explaining why.
- **Named exports** for components and modules (no default exports, except where a tool
  requires one, e.g. config files).
- **Files:** components `PascalCase.tsx`, everything else `camelCase.ts`; tests next to the
  code as `*.test.ts(x)`; CSS Modules as `Component.module.css`.
- **Imports:** use `import type` for types (enforced by `verbatimModuleSyntax`).
- **No browser dialogs:** `window.alert/confirm/prompt` are banned (ESLint `no-alert`);
  use the `Dialog` component.
- **Accessibility:** semantic HTML first; `jsx-a11y` rules are on. Every interactive element
  must be reachable and labelled.
- **Formatting:** Prettier (single quotes, 100 columns, trailing commas, LF). Line endings are
  LF everywhere (`.gitattributes`, `.editorconfig`).
- Code, comments, commits and docs are in **English**. The app UI is Spanish by default.

## 7. i18n

- `i18next` + `react-i18next`, resources in `src/i18n/es.json` and `src/i18n/en.json`.
- **Every user-facing string goes through a key**, in both languages. Keys are namespaced by
  feature: `session.addSet`, `settings.sync.keyLabel`… Keys are typed (`src/i18n/i18next.d.ts`).
  `src/ui` may use `react-i18next` only for its own generic labels (`ui.*`).
- Dates and numbers use `Intl` with the active locale: `es-ES` (decimal comma) / `en-GB`.
- The chosen language is a device-only setting (`src/data/deviceStorage.ts`), like the theme.
- Exercise names from the seed catalog are i18n keys; user-created exercises store raw text.
- The warm-up symbol is localized: **C** (es) / **W** (en).

## 8. Design tokens

- Defined in `src/theme/tokens.css` as CSS custom properties, chosen in Phase 1
  (see `docs/design/`).
- Semantic colour tokens (`--bg`, `--surface`, `--text`, `--accent`, `--success`, `--warning`,
  `--danger`, `--warmup`…) for light and dark; typography, spacing, radii and shadows.
- Theme: `system | light | dark`, applied through `data-theme` on `<html>`; `system` follows
  `prefers-color-scheme` live.
- **Components never hardcode colours or font sizes** — always tokens. Contrast must meet AA.

---

## 9. Testing

| Kind                            | Tool                                   | Where                 | Who writes it |
| ------------------------------- | -------------------------------------- | --------------------- | ------------- |
| Unit (domain rules, data, sync) | Vitest                                 | `src/**/*.test.ts`    | main agent    |
| Component                       | Vitest + RTL + jsdom                   | `src/**/*.test.tsx`   | main agent    |
| End-to-end                      | Playwright (390×844; see limits below) | `tests/e2e/*.spec.ts` | blind-tester  |

- Query by role, label and visible text (`getByRole`, `getByLabelText`), as a user would.
- Component tests that need the app providers use `renderWithProviders` from
  `src/test/render.tsx` (theme, i18n with a `locale` option defaulting to `es`, toasts, and a
  fresh empty database per render — no seed — overridable with the `db` option;
  `openTestDatabase()` opens one directly); tests of whole screens use `renderApp(path)` from
  `src/test/renderApp.tsx` (real routes, memory router).
- Vitest runs three projects (`vite.config.ts`): **`domain`** — `src/domain/**/*.test.ts` in a
  **Node** environment, so any DOM use fails (guarded by `src/domain/environment.test.ts`) —
  **`server`** — `server/**` and `netlify/**` tests, in Node — and **`ui`** — everything else,
  in jsdom with the RTL setup.
- Timeouts: RTL `asyncUtilTimeout` is **5 s** (`src/test/setup.ts`) and the `ui` project's
  `testTimeout` is **15 s** (`vite.config.ts`). Under `test:coverage` (v8, all workers busy) a
  write → live query → re-render can take over 1 s, which made component tests fail at random
  (2026-11-04).
- Domain, data and server code need thorough tests: v8 coverage of `src/domain/**`,
  `src/data/**` and `server/**` must each stay **≥ 90 %** (lines, functions, branches,
  statements; per-glob thresholds in `vite.config.ts`; `src/data/**/testing.ts` and
  `server/**/testing.ts` are excluded). Enforced by `npm run test:coverage`, which CI runs
  instead of `npm run test`.
- Sync tests: `src/data/sync/testing.ts` provides `createTestEngine` and `createFakeServer`
  (fake server over the domain merge rule, manual scheduler); `renderWithProviders` accepts a
  `sync` option (default: a test engine without key, not started). The contract is checked by
  `server/sync/contract.test.ts` (against `docs/api/sync-v1.md`) and
  `server/sync/httpTransport.test.ts` (client transport against the real handler). E2E sync
  tests use `tests/mocks/sync-server.ts`.
- Tests use **synthetic data only** — never real exports from gym_app.
- Playwright builds the app, starts `vite preview` on **4173** and stops it itself
  (`reuseExistingServer: false`, `strictPort`, webServer timeout 60 s). A busy port fails the
  run on purpose.
- **E2E limits** (after the 2026-11-02 resource-starvation incident, see `context.md` §2.2 and
  §12): `npm run e2e` runs **Chromium only** (every test); `npm run e2e:all` (and CI, on PRs to
  `main`) runs Chromium (every test) + WebKit, where the `webkit` project only runs tests tagged
  **`@all-engines`** (`grep` in `playwright.config.ts`). Tag (`{ tag: '@all-engines' }`, on a
  test or a `describe`) what depends on the engine: IndexedDB / local data, sync, import and
  export, downloads, Today and the session, the 390 px layout. Engine-independent UI logic
  (theme, language, navigation, components) stays Chromium-only. CI runs the `e2e` job as a
  matrix with `fail-fast: false` and `max-parallel: 1` (one job after another, in this order):
  `chromium`, `webkit 1/2`, `webkit 2/2` (`--project` /
  `--shard` are used in the workflow only, never locally); each job installs and caches its
  own browser and uploads its own report. Locally **2 workers**, no retries, `maxFailures` 3;
  CI uses default workers (1 on a 2-vCPU runner) + 2 retries.
  30 s per test (60 s in WebKit: the project's `timeout` in `playwright.config.ts`; no
  `test.slow` for WebKit) and 5 s per assertion (15 s in WebKit: the project's `expect.timeout`); global timeout 5 min (`npm run e2e`) / 20 min (`npm run e2e:all`). Reporters:
  locally `dot` + `html`, in CI `list` + `html` (`open: 'never'`, report port 9323). Chromium
  `deviceScaleFactor` 2; never `channel: 'chrome'`.
- Vitest prints the `dot` reporter (`test`, `test:coverage`) and coverage uses `text-summary` +
  `html`; thresholds are unchanged and still exit with code 1.
- How to run e2e: only through `npm run e2e` (or `e2e:all`), optionally with spec paths —
  `npm run e2e -- tests/e2e/today.spec.ts` — and no other flag after `--` (no `--project`,
  `--workers`, `--retries`, `--headed`, `--ui`, `--reporter`), in the foreground, no background
  polling, nothing heavy in parallel. If it exceeds 5 min or hangs: stop
  it, `npm run ports:kill`, check ports, report. Never retry in a loop (one run + one after a
  fix); never install browsers. E2E covers user flows and acceptance criteria — exhaustive
  combinations belong in unit tests; axe runs once per screen and theme (light/dark), in
  Chromium only. Target: `npm run e2e` under 2 min.
- `npm run e2e:all` runs locally only when the user asks, or in `/close-phase final` on the last
  branch of a phase, before the PR `dev → main` (WebKit was never run before the Phase 4 PR and
  CI caught it, 2026-11-04).
- **No real-time waits in e2e:** no `waitForTimeout`, no waiting for a debounce or backoff to
  pass. App timers move with `page.clock` (`install()` before `goto`, then `runFor(ms)`); state
  is awaited with web-first assertions or `expect.poll`; before injecting a failure into the fake
  sync server, wait until the server answered the previous request (`requestCount`). WebKit can
  be seconds slower than Chromium on IndexedDB.
- IndexedDB tests use `fake-indexeddb` (loaded by `src/test/setup.ts`); use
  `openTestDatabase()` for a fresh database. Local storage layout: ADR-0003.

## 10. Commands

| Command                           | What it does                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server on 5173 (strict port)                                                                       |
| `npm run build`                   | `tsc -b` + `vite build`                                                                                     |
| `npm run preview`                 | Serve the build on 4173                                                                                     |
| `npm run lint`                    | ESLint (type-checked)                                                                                       |
| `npm run typecheck`               | `tsc -b`                                                                                                    |
| `npm run test`                    | Vitest, single run                                                                                          |
| `npm run test:watch`              | Vitest in watch mode (user only — never leave it running)                                                   |
| `npm run test:coverage`           | Vitest single run with v8 coverage; fails if `src/domain` or `src/data` < 90 % (CI)                         |
| `npm run e2e`                     | Playwright, **Chromium only** (builds with `--mode e2e --outDir dist-e2e`, serves, tests, stops the server) |
| `npm run knip`                    | knip: unused files, exports, dependencies and i18n keys; CI step                                            |
| `npm run icons`                   | Regenerates the PWA PNG icons from `public/icon.svg` (`pwa-assets.config.ts`)                               |
| `npm run e2e:all`                 | Playwright, Chromium + WebKit (`@all-engines` only); 20 min cap; CI runs it on PRs to main                  |
| `npm run format` / `format:check` | Prettier write / check                                                                                      |
| `npm run ports:check`             | Lists which of 5173 / 4173 / 8888 / 8787 / 9323 are busy and by whom; exit 1 if any                         |
| `npm run ports:kill`              | Frees those ports                                                                                           |

Note: `typecheck` is `tsc -b`, not `tsc --noEmit -p .` as first drafted in `context.md` §8.5.
The root `tsconfig.json` only holds project references (`tsconfig.app.json` for `src`,
`tsconfig.node.json` for tool configs, `tsconfig.e2e.json` for `tests/` with Node + DOM types
so `page.evaluate` callbacks type-check, `tsconfig.server.json` for `server/` and `netlify/`),
so `-p .` would check no files at all.

Before saying a task is done: `npm run lint && npm run typecheck && npm run test`
(+ `npm run build` when build/PWA/functions changed), and `npm run ports:check` is clean.

---

## 11. Git workflow

- **Branches:** `main` (production, Netlify deploys) · `dev` (integration) ·
  `feature/*`, `fix/*`, `chore/*`, `docs/*` branch off `dev` and return to `dev` via PR
  (merge commit, no squash). Release: PR `dev → main` + annotated tag `vX.Y.Z` on `main`.
- **Conventional Commits**, English, imperative, lower case:
  `type(scope): description`. Types: `feat fix refactor test docs style chore ci build perf`.
  Scopes: `domain data sync api session today calendar routines exercises progress blocks
settings ui theme i18n pwa claude release deps` (optional). Breaking: `feat!:` or a
  `BREAKING CHANGE:` footer. commitlint (husky `commit-msg` hook) rejects anything else.
- **Versions:** SemVer. `0.x` per phase (`v0.1.0` = Phase 0 … `v0.9.0` = Phase 8),
  **`v1.0.0`** at parity with gym_app. `package.json` version is bumped in the
  `chore(release): vX.Y.Z` commit. `CHANGELOG.md` follows Keep a Changelog.

## 12. Who does what

| Who                      | Does                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**                 | Creates branches, reviews code, tests on the phone, **makes every commit**, opens and merges PRs, creates tags, deploys, installs packages                        |
| **Claude Code**          | Writes code, tests and docs; runs lint, typecheck, tests and build; at the end of each phase proposes the commits (files + messages), branch, PR, version and tag |
| **context-keeper** agent | Updates `context.md`, `CHANGELOG.md` and (if structure changed) this file                                                                                         |
| **blind-tester** agent   | Tests the app as a user from `docs/spec/` with Playwright. **Never reads `src/`**                                                                                 |

Git write commands and global installs are **denied** in `.claude/settings.json`;
`npm install` asks first. Verify with `/permissions`.

## 13. Using the agents and commands

- **`/start-phase N`** — reads only the index and phase section of `context.md` and the
  relevant spec, then presents a plan in Spanish (goals, deliverables, acceptance criteria,
  packages, branch, split into short sessions); the plan replaces a separate confirmation.
- **`/close-phase`** (every branch) — lint, typecheck, `test:coverage`, build only if build/PWA/
  functions changed; **blind-tester** (max 8 new tests, one pass, one fix) running only the
  branch's specs with `npm run e2e -- <specs>`; **security-reviewer** if the diff touches
  `server/`, `src/data/sync/`, `package.json` or `netlify.toml`; the main agent writes a status of
  at most 10 lines in the phase section of `context.md` (no context-keeper); ports check; commit
  plan.
- **`/close-phase final`** (last branch of a phase) — everything above plus `npm run e2e:all`
  once, **code-reviewer**, **security-reviewer**, **context-keeper** and the release plan
  (PR `dev → main`, `chore(release)`, tag).
- **code-reviewer / security-reviewer:** read-only (Read, Grep, Glob, Bash), they review
  `git diff dev...HEAD` (security-reviewer also runs `npm audit --audit-level=high`) and report in
  at most 30 lines: blocking / should / suggestion, with `file:line`. They fix nothing.
- **blind-tester:** give it the phase's acceptance criteria. It writes and runs
  `tests/e2e/*.spec.ts` and reports failures with steps, expected vs actual and screenshots.
  It does not fix app code. Write the spec in `docs/spec/` **before** implementing a feature
  so the tester has something to test against.
- **context-keeper:** give it a factual summary of what changed and the test results. It never
  marks something done unless tests passed. Max 10 lines per update; no test counts, coverage
  or durations; the log row goes to `docs/history.md`.
- **Hooks** (`.claude/settings.json`): `PostToolUse` on `Edit|Write` formats the file with
  Prettier (`scripts/hooks/format-file.mjs`); `Stop` warns the user of busy ports other than
  5173 (`scripts/hooks/ports-warn.mjs`, exit 0 always).
