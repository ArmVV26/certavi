# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.10.1] - Unreleased

### Changed

- Import: the dialog stays open while a file is being read or imported, and picking a second file no longer replaces the preview.
- Session: the set details sheet cannot save twice on a double tap; Save and Cancel are disabled while saving.
- Session: finishing or reopening a session writes only when its state actually changes, and the rest bar closes when the session is no longer in progress.
- Internal: lifecycles in memory and in the UI are modelled as explicit states with exhaustive switches (ADR-0006). Stored and synced data shapes are unchanged.

### Fixed

- Import: an unreadable file shows an error instead of failing silently.
- Session: a confirmation branch that fell through could delete the session; every case is now explicit.
- Sync: the backups list reloads when a sync key is added or forgotten.
- Updates: a second tap on «Update» is ignored.

## [0.10.0] - Unreleased

### Added

- Monochrome mode («0 dopamine»): a device-only switch in Settings > Appearance that removes all color (grey tokens in both themes, AA contrast kept). Applied before the first paint through `public/theme-init.js`.
- Session: «Quitar serie» in the set-type sheet, so sets can be removed without swiping (disabled with a reason on the last row).
- Progress: «Series por grupo muscular» on mobile shows two lines per group («8 / 12 · faltan 4» or «✓») and one cell per set across the full width.
- Screens are preloaded two seconds after load, and a thin «Opening the screen» bar shows while a navigation is pending.
- `npm run e2e:timings` reads the per-test timings written by the Playwright JSON reporter; CI uploads them as artifacts.

### Changed

- Session: the rest timer ticks in its own bar, so the session screen no longer re-renders four times per second. This is a preventive change for the report that the screen was hard to leave on iPhone; the cause of that report is not confirmed.
- E2E: the CI e2e jobs upload a per-test timing report on every run (retained 14 days). The `e2e:all` global timeout is 1600000 ms.
- E2E: test data is loaded from a synthetic Certavi backup fixture instead of the gym_app importer (sync and PWA specs). The sync conflict test runs fewer attempts.
- CI: the e2e job is split into parallel jobs (Chromium and WebKit, two shards each) that share one prebuilt bundle; Playwright retries once.

### Fixed

- Session: marking a set ✓ emptied its values for 1-2 seconds before the row turned green. The just-saved set now stays visible until the local query catches up.
- Session: sets could not be removed on iPhone (the only way was a swipe over a full row). Use «Quitar serie» instead.

## [0.9.0] - Unreleased

PWA polish, accessibility and performance (Phase 8).

### Added

- Installable PWA: manifest, icons (`public/icon.svg`, generated PNGs with `npm run icons`), iOS
  metadata, and a service worker that only precaches; API and Netlify paths are never cached
  (ADR-0005; spec `docs/spec/pwa.md`).
- "New version" banner under the header; the update is applied only when the user accepts it.
- Error and empty states: route errors, a message when the local database cannot open, an empty
  blocks list and a notice when the rest time cannot be saved (spec `docs/spec/states.md`).
- Sync sends pending changes when the page is hidden or closed, with `keepalive` (AC-SYNC-15).
- `npm run knip` (unused files, exports and dependencies) as a CI step.

### Changed

- Every screen except Today and the active session loads on demand; the main bundle drops from
  890 kB to 372 kB.
- Texts reviewed in Spanish and English (plurals, clearer error messages).
- Animations respect `prefers-reduced-motion`.
- `/dev/ui` (component catalog) is only available in development and in the e2e build.

### Removed

- Unused files, exports, dependencies and i18n keys found by knip.

## [0.8.0] - Unreleased

Calendar, progress, optional blocks and training statistics (Phase 7).

### Added

- Calendar (`/calendar`): month view, a day panel to log past days, and a week panel (body
  weight of any week, week JSON). Finished weeks close automatically on startup; closed weeks are
  read-only (`feature/calendar`).
- Progress (`/progress`): per-group, per-week, per-exercise and cycle-review charts (own SVG
  charts with an accessible "View data" table), records and body weight. The exercise detail
  (`/exercises/:id`) gets an evolution chart (`feature/progress`; spec `docs/spec/progress.md`).
- Optional blocks: configurable mobility, stretching and rehab blocks, a daily checklist, 0-10
  metrics with a 3/10 reference line, and a weekly wall test. Blocks are deactivated, never
  deleted (`feature/optional-blocks`; spec `docs/spec/blocks.md`).
- Rehab rule for the calf: the progression keeps the weight while stairs hurt (`rehab-gate`).
- Training statistics (`feature/training-stats`; spec `docs/spec/training-stats.md`): weekly
  streak, and weight lifted, exercises and sets per week or month, with a "Training" card in
  Progress and the streak in Today's week card.

### Changed

- The 0-10 scale picker fits in one row at 390 px.

## [0.7.0] - 2026-11-06

Exercise catalog, own exercises and routine editor (Phase 6).

### Added

- Exercise catalog inside the Routines tab (`/exercises`, selector "Routines | Exercises"; the
  Routines tab stays active there): combinable filters (text, muscle group, equipment, type,
  straps, mine, in a routine) shared with the "Add exercise" sheet, equipment and straps tags,
  and "Show archived" (`feature/exercise-catalog`; spec `docs/spec/exercises.md`).
- Exercise detail (`/exercises/:id`): data, estimated 1RM, max weight, best volume, rep records,
  history with a link to each session, and an editable own increment. Deload weeks give no
  records.
- Own exercises: create, edit, archive and unarchive from the catalog and from the session's
  add sheet, with ids `exe_`. Seed exercises only allow editing the increment. Nothing is
  deleted, only archived.
- Routine list (`/routines`): the six seed routines in weekday order, with exercise and set
  counts and an "Edited" tag (`feature/routine-editor`; spec `docs/spec/routines.md`,
  AC-ROUTINES-01..21).
- Routine viewer (`/routines/:id`, read-only; it never starts a session): scheme text, note,
  optional tag, link to each exercise, and "Restore original" (with a confirmation dialog, only
  when the routine was edited).
- Routine editor (`/routines/:id/edit`): add exercises, remove them with Undo, move up and down,
  add and remove sets per exercise (up to 20), change kind, reps, RIR, note and the optional
  flag. Nothing is saved until "Save"; validation with focus on the first invalid field; a
  warning and a discard dialog when leaving with unsaved changes.
- Domain rule `src/domain/rules/routineEdit.ts`; repository helpers `saveRoutine` and
  `restoreSeedRoutine` (`src/data/routines.ts`).
- End-to-end specs `tests/e2e/exercises.spec.ts` and `tests/e2e/routines.spec.ts`.

### Changed

- Only the six seed routines are editable; their name and weekday are not (the day plan depends
  on them). Creating and deleting routines moves to the v2 backlog.
- Routine edits apply to new sessions only; sessions keep their own copy of the plan.
- The exercise evolution chart moves from Phase 6 to Phase 7.
- Route `/routines` no longer shows "coming soon"; the `pages.routines.*` i18n keys are removed.

## [0.6.0] - 2026-11-06

Today screen and active session (Phase 5).

### Added

- Active session (`feature/active-session`; spec `docs/spec/session.md`, AC-SESSION-01..24):
  each exercise is a list of rows (warm-up, effective, dropset, extra) with the warm-up symbol
  C/W; "previous" reference; ✓ validation; a row is removed by swiping or with a keyboard
  "Remove" button; drafts survive reloads on the device; finish and delete session; new set type
  `dropset`; gym_app sessions are converted on import.
- Session tools (`feature/session-tools`): session details sheet (date, start and end time,
  routine; confirmation when the routine changes); add, move and remove exercises with a filter,
  with undo; download one session as JSON; rest timer after each saved set (180, 120 or 60 s by
  row kind, +30 s after a top set, −15 s / +15 s, sound and vibration when it ends); notice
  "changes from another device" that refreshes saved data and never touches typed values.
- Rest settings card (`src/features/settings/RestCard.tsx`): rest times 15–900 s (synced) and
  sound and vibration (this device only); `src/data/restSettings.ts`.
- Sync: `SyncEngine.subscribeRemote` and `CommitResult.changes` (ADR-0004, decision 10).
- Functional spec `docs/spec/today.md` (AC-TODAY-01..19).
- Day plan rule (`src/domain/rules/dayPlan.ts`: `weekSchedule`, `dayPlan`, `routineDays`):
  routines keep their weekday; Thursday is "active rest" (quick activities swimming and
  mobility), Saturday is "football" (football and swimming), other free days are rest. A week
  of 4 drops Upper (Friday becomes rest); a week of 3 is Push, Pull, Lower Full (Lower Full
  takes Wednesday).
- New session rule (`src/domain/rules/session.ts`, `newSession`): a session for today starts
  now and is in progress; one for another date is finished, 18:00–19:15; a free session has no
  exercises; in a deload week the routine is copied reduced. No future dates.
- Today rules (`src/domain/rules/today.ts`): deload reminder after 6 weeks in a row without a
  deload (`needsDeloadReminder`), plan week number, body weight valid from 20 to 300 kg; blocks
  of the day and block log patches (`src/domain/rules/blocks.ts`).
- Data: `readToday`, `updateWeek`, `saveActivity`, `saveBodyWeight` and `updateBlockLog`
  (`src/data/today.ts`); `startSession` and `readSession` in one transaction
  (`src/data/sessions.ts`; starting a routine that already has a session on that date opens
  it); device-created ids `newId(prefix)` (`src/data/ids.ts`: `ses_`, `act_`, `set_` + base36
  time + 10 random characters).
- Today screen (`src/features/today/`): "Today's session" hero; "This week" with a 7-day strip,
  effective sets vs plan, sessions, week size 5/4/3 and hiking and deload switches; "Another
  session or another day"; "Activity"; "Average body weight of the week"; notices for a missing
  sync key and for a due deload. Activities are listed in save order.
- Blocks-of-the-day card (`src/features/blocks/DayBlockCard.tsx`): checklist, 0–10 metrics and
  a note of the day, saved as a `BlockLog`.
- Minimal session screen at `/session/:sessionId` (`src/features/session/SessionPage.tsx`,
  plan only, "Coming soon").
- Generic UI components `TextField`/`TextArea`, `Checkbox`, `ScalePicker` and `Notice`
  (`src/ui`); `formatDateRange` (`src/i18n/format.ts`); i18n keys `today.*`, `plan.*`,
  `blocksDay.*` and `session.*` in Spanish and English; route title `session.title`.
- End-to-end spec `tests/e2e/today.spec.ts` (8 flow tests covering AC-TODAY-01..19).

### Changed

- E2E in CI: the `e2e` job is a matrix (chromium, webkit 1/2, webkit 2/2) run one after another;
  the WebKit project only runs tests tagged `@all-engines` (`playwright.config.ts`, `ci.yml`).
- `downloadFile` moved from `src/features/settings/download.ts` to the shared layer
  `src/ui/download.ts`.
- Hiking week works as in gym_app: Sunday is hiking, Lower A is dropped and Lower B becomes
  Lower Full (`weekRoutines` in `src/domain/rules/weekPlan.ts`; `livePlan` and
  `weekPlanSummary` take `hiking`). A normal hiking week plans 86 sets in 4 sessions; a week of
  4 with hiking, 63 sets in 3 sessions; a week of 3 is unchanged (`docs/spec/rules.md`).
- Today is no longer a placeholder page (`docs/spec/theme-language-navigation.md`,
  `tests/e2e/helpers.ts`, AC-LANG-01 in `tests/e2e/language.spec.ts`); the `pages.today` i18n
  key is removed.
- Tests: RTL `asyncUtilTimeout` raised to 5 s (`src/test/setup.ts`) and the `ui` Vitest
  project's `testTimeout` to 15 s (`vite.config.ts`), because under `test:coverage` component
  tests failed at random when a write → live query → re-render took over 1 s.

### Fixed

- Settings: a value typed right after a previous save could be overwritten when that save was
  read back late (slow WebKit); covered by a unit test.
- Today: activities are listed in save order, and the activity label shows the activity
  instead of the planned routine.

## [0.5.0] - 2026-11-04

Sync and backend (Phase 4).

### Added

- Sync v1 contract in the domain: zod schemas and constants (`src/domain/sync/contract.ts`,
  `ERROR_STATUS`) and the server merge rule (`src/domain/sync/merge.ts`: `mergeRecords`,
  `changesSince`, `SyncDocument` backed by a `Map`, safe against `"__proto__"` ids).
- Sync server in `server/sync/` as a plain `Request → Response` handler (`createSyncHandler`)
  shared by the Netlify Function, the unit tests and the e2e fake server: SHA-256 +
  `timingSafeEqual` key check with a 400 ms delay on a wrong key, `500 server-misconfigured`
  when `CLAVE_SYNC` is shorter than 32 characters, 404/405 with `Allow`, 413 above 8 MiB,
  etag read–merge–write with 5 attempts (then 409), daily backup in Europe/Madrid time keeping
  the last 14 (a failed backup is only logged); `SyncStore` interface with memory and Netlify
  Blobs stores.
- Netlify Function `netlify/functions/sync.ts` (thin adapter, strong-consistency store, the
  three `/api/v1` routes); the blob store name depends on the deploy context (`certavi` in
  production, `certavi-branch-deploy` for the `dev` branch deploy).
- `netlify.toml` (build, SPA redirect, security headers and CSP, cache headers),
  `public/robots.txt` and the Netlify deploy guide `docs/deploy-netlify.md`.
- Contract test (`server/sync/contract.test.ts`) that checks the examples, error table and
  constants of `docs/api/sync-v1.md` against the schemas and the handler, plus
  `server/sync/httpTransport.test.ts`, which runs the client transport against the real
  handler.
- Client sync engine in `src/data/sync/` (ADR-0004, `docs/adr/0004-client-sync-engine.md`):
  batches of 300 until the queue is empty, a 413 halves the batch, one attempt at a time,
  backoff 4/8/15/30/60 s, 2 s debounce after the queue grows, every 45 s while records are
  pending, fatal errors stop until the key changes or "Sync now", no requests while offline,
  `keepalive` flush (≤ 55 KB) when the app is hidden or closed; triggers on online, offline,
  focus, pageshow, visibilitychange and pagehide.
- Responses are committed in one transaction: an entry leaves the queue only if its record did
  not change meanwhile, only strictly newer incoming records are applied, and the echo of an
  upload writes no record table.
- `SyncTransport` interface and a generic HTTP transport for any sync-v1 backend
  (`createHttpTransport`: Bearer key, zod-validated answers, 15 s timeout).
- Device-only sync key (localStorage, at least 32 characters); changing it starts from
  `since` 0 and queues every record with `updatedAt` > 0.
- Attempt log (last 40 attempts) in a new Dexie table `syncLog` (`db.version(2)`, with a
  v1 → v2 migration test).
- Server backups: list, download as an importable Certavi full backup
  (`certavi-server-backup-<date>.json`) and restore (differences become new queued edits;
  records missing from the backup are soft-deleted, except built-in ones, which go back to
  their seed version).
- Sync status indicator in the header (links to Settings; announces offline and errors).
- Settings → "Sync" card (status, last sync, pending records, error reason, key form with
  show/hide, save/change/forget with confirmation, "Sync now") and a `/settings/sync` page with
  the attempt log and the server backups.
- Icons `cloud`, `cloudOff`, `refresh`, `warning`, `download` and `eye`; i18n keys
  `settings.sync.*` and `sync.*` in Spanish and English.
- Functional spec `docs/spec/sync.md` (AC-SYNC-01..14) and end-to-end spec
  `tests/e2e/sync.spec.ts` (16 tests) with a fake sync server (`tests/mocks/sync-server.ts`:
  the real handler with a memory store, attached through Playwright routing, no process or
  port).
- Test helpers: `createTestEngine` and the fake server in `src/data/sync/testing.ts`; a `sync`
  option in `renderWithProviders`.
- Dependencies: `@netlify/blobs` 11.1.7 (runtime) and `@netlify/functions` 6.0.3 (dev).

### Changed

- Sync API contract: status "Implemented", new `500 internal-error` code, valid JSON in the
  backup-file example, a pointer to the client and a note that untouched seed records may stay
  out when a new key is set.
- The app starts the sync engine after opening the database; `Providers` takes a `sync` prop.
- The "Sync" card is now the first card in Settings (then Appearance, Data, Development).
- Vitest runs a third project, `server` (Node), and `npm run test:coverage` also enforces 90 %
  on `server/**`; `tsconfig.server.json` joins the TypeScript project references; ESLint knows
  the Node globals in `server/` and `netlify/`.
- CI `e2e` job: Playwright browsers cached per Playwright version (`~/.cache/ms-playwright`;
  full install with system dependencies on a miss, system dependencies only on a hit), the HTML
  report and `test-results/` (traces) uploaded on failure, and a 12 min job timeout (was 20).
- Claude Code rules, blind-tester agent and `CLAUDE.md`: no real-time waits in e2e (app timers
  move with `page.clock`, state is awaited with web-first assertions or `expect.poll`, and the
  fake sync server must have answered before a failure is injected); `/close-phase` runs
  `npm run e2e:all` once on the last branch of a phase, before the PR `dev → main`.

### Fixed

- Sync status showed "Synced" right after saving a key, and when the app opened with a key,
  before the server had answered; it now shows "Syncing…" until the first attempt ends and
  "Synced" only after a successful one (`docs/spec/sync.md` §2.1 and AC-SYNC-03 updated). If
  re-queueing records fails while setting a key, the sync attempt still runs.
- Sync end-to-end tests no longer depend on real-time waits (`page.clock` instead of
  `waitForTimeout`, waiting for the fake server before injecting failures, consistent 15 s
  timeouts). AC-SYNC-06 and AC-SYNC-09, which failed on WebKit in CI, now pass on WebKit
  locally (`npm run e2e:all`: 133 passed, 5 intentionally skipped, 0 failed).

## [0.4.0] - 2026-11-03

Local data, importer and exports (Phase 3)

### Added

- Local database with Dexie (ADR-0003, `docs/adr/0003-local-storage-dexie.md`): one table per
  record type plus `pending` (one row per record id) and `meta` (persisted monotonic clock);
  soft deletes stored as envelope-only tombstones in the same table (`src/data/db.ts`,
  `clock.ts`).
- Repositories (`createRepository`, `createRepositories`: get, list, put, putMany, remove) that
  validate with zod, stamp `updatedAt` from the monotonic clock and add the record to the
  pending queue in the same transaction (`src/data/repository.ts`).
- Seed written to the database on start-up (`ensureSeed`: inserts missing records, refreshes
  only those still at `updatedAt` 0, never queued); persistent storage requested with
  `navigator.storage.persist()`; start-up in `startDatabase`; `DatabaseProvider` and
  `useDatabase`; live count queries (`countLiveRecords`, `countPending`).
- Settings → "Data" card with live counts per record type, records pending sync and storage
  status (`settings.data.*` keys in Spanish and English).
- Seed settings record `SEED_SETTINGS` (id `settings`, default rest, no plan start,
  `updatedAt` 0); `max-pain` metric ("max pain during the exercises", 0-10, threshold 3) in the
  ankle rehab block; optional `startDate` and `reviewDate` on optional blocks; `RecordOf<K>`
  type.
- Functional spec `docs/spec/data-import-export.md` (part A: local data; part B: import and
  export, AC-IMPORT-01..06 and AC-EXPORT-01..02) and end-to-end spec `tests/e2e/data.spec.ts`
  (7 tests).
- Test helper `openTestDatabase()` and a `db` option in `renderWithProviders` (fresh, empty
  database per render); `fake-indexeddb` loaded in the test setup.
- Dependencies: `dexie` 4.4.7 and `dexie-react-hooks` 4.4.0 (runtime) and `fake-indexeddb`
  6.2.7 (dev).
- gym_app importer (`src/data/legacy/gymApp.ts`, `readGymAppExport`): tolerant zod schemas of
  the real gym_app record shapes (`session`, `set`, `note`, `act`, `bw`, `week`, `tpl`,
  `excfg`, `rec`, `wall`, `cfg`, `mig`), converted and validated with `parseRecord`; accepts
  `{ app: 'winter-arc', records }` or a bare array. Deleted records, `cfg_exp_brazos`, `mig_*`,
  unknown types, templates and exercises are ignored; malformed records are reported as
  invalid; when two records map to the same Certavi id the newest wins (`dedupeNewest`,
  `src/data/importFile.ts`). `abdomen` maps to `crunch-maquina` everywhere.
- Import planning and saving (`src/data/importRecords.ts`): `planImport` (read-only preview)
  and `applyImport` (one transaction, last-write-wins: a record is written only if it is new or
  strictly newer than the local copy, ties keep the local one; written records join the pending
  queue; `serverSeq` is dropped; the clock moves past the newest record with `advanceClock`).
- Certavi backups (`src/data/backup.ts`): `{ app: 'certavi', format: 1, kind, exportedAt,
records }` without tombstones or `serverSeq`; `exportAll`, `exportSession` and `exportWeek`
  (no UI yet for session and week) and `readBackup`.
- CSV exports (`src/data/csv.ts`): sets and activity + body weight, always in Excel-for-Spanish
  format (BOM, `;`, decimal comma, CRLF, quoting) with gym_app's columns; headers through i18n;
  empty e1RM for warm-up and approach sets.
- Settings → "Data" card: import (from gym_app or a Certavi backup) and export (full backup
  JSON, sets CSV, activity and weight CSV) buttons; import preview dialog with rows per type
  plus unchanged / ignored / invalid; success and error toasts (`ImportExport.tsx`,
  `download.ts`, `recordTypes.ts`).
- `resolveText` helper for `TextRef` (`src/i18n/text.ts`); i18n keys `settings.data.*` (import,
  export, preview, errors, CSV headers), `sets.kinds.*`, `activities.kinds.*`,
  `routines.free`.
- Synthetic fixtures `tests/fixtures/gym-app-sample.json` (every gym_app record type) and
  `tests/fixtures/not-a-backup.txt`; end-to-end spec `tests/e2e/import-export.spec.ts`
  (8 tests).

### Changed

- The app opens the local database before rendering; `Providers` takes a `db` prop.
- `npm run test:coverage` also enforces 90 % on `src/data` (per-glob thresholds for
  `src/domain/**` and `src/data/**`).
- Functional spec index lists the data spec as covered; the rules spec mentions the third pain
  metric.
- Migration guide: real gym_app `t` values, record shapes and the full mapping to Certavi.

## [0.3.0] - 2026-11-03

Domain model and catalog (Phase 2).

### Added

- Domain model in `src/domain/model` (pure TypeScript, no React, Dexie or `fetch`): zod schemas
  and types for every entity with the sync envelope (`exercise`, `routine`, `weekPlan`,
  `session`, `set`, `note`, `activity`, `bodyWeight`, `block`, `blockLog`, `weeklyMetric`,
  `settings`), tombstone schema, `TextRef` (`{ key }` for seed i18n keys, `{ text }` for user
  text), `as const` enums, `RECORD_SCHEMAS` and `parseRecord` (validates by type; soft-deleted
  records only need the envelope). Derived ids for week plans, body weight, notes, block logs
  and weekly metrics; settings use the id `settings`.
- Local ISO date helpers (`src/domain/dates.ts`), weeks starting on Monday.
- Domain rules in `src/domain/rules`: Epley estimated 1RM (ignores warm-up and approach sets),
  effective sets (approach counts, warm-up and 0-rep sets do not), back-off suggestion (−10 %
  rounded to the increment, at least one step below the top set), progression advice, "last
  time" reference (skips "does not count" and deload sessions), weekly sets per muscle group vs
  plan, week plan (live vs frozen when closed), deload, short week and records (max weight,
  best e1RM, best volume, rep records, record events).
- Seed data in `src/domain/seed`: 45 exercises (gym_app ids preserved, `abdomen` merged into
  `crunch-maquina` through a legacy alias, new `hack-banda`), the 6 current routines, the
  "ankle rehab" block (8 items, 0-10 pain metrics with a threshold of 3, weekly wall test) and
  an empty, inactive "stretching" block. Seed records use `updatedAt: 0`.
- Spanish and English translations for seed exercises, muscle groups, equipment, routines,
  routine notes and blocks, with a test that every seed key exists in both languages.
- Test data builders in `src/domain/testing`.
- Functional spec of the rules from the user's point of view (`docs/spec/rules.md`).
- `npm run test:coverage` script: v8 coverage of `src/domain` with 90 % thresholds (lines,
  functions, branches, statements).
- Dependencies: `zod` 4.6.7 (runtime) and `@vitest/coverage-v8` 5.1.0 (dev).

### Changed

- Vitest runs two projects: `domain` in a Node environment (DOM use fails, guarded by a test)
  and `ui` in jsdom with the RTL setup; the suite runs about twice as fast.
- CI runs `npm run test:coverage` instead of `npm run test`, so it fails if domain coverage
  drops below 90 %.
- Functional spec index links the rules spec and marks the theme, language and navigation spec
  as covered by end-to-end tests.
- Migration guide: Phase 2 seed ids (exercise alias, exercises outside routines, routine ids)
  and the mapping of set kinds and slots from gym_app.

## [0.2.0] - 2026-11-02

Design, theme, i18n and navigation (Phase 1).

### Added

- Design selector `docs/design/selector.html` (generated by `scripts/build-selector.mjs`) and
  the design decision: "Hierro" palette and "Archivo" font (`docs/design/decision.md`).
- Design tokens as CSS custom properties for light and dark (`src/theme/tokens.css`,
  documented in `docs/design/tokens.md`); tints via `color-mix` at 12 %.
- Self-hosted Archivo variable font (`@fontsource-variable/archivo`).
- Theme engine: `system | light | dark`, saved on the device, follows system changes live and
  updates `theme-color`; theme button in the header.
- i18n with `i18next` + `react-i18next`: Spanish (default) and English, typed keys, `Intl`
  date and number formatting (`es-ES` / `en-GB`), language saved on the device.
- Device-only settings storage (`src/data/deviceStorage.ts`).
- App shell with `react-router` 8: routes, layout with page title and theme button, bottom tab
  bar on phones and top bar from 768 px, skip link, focus moved to the page title on
  navigation, 404 page.
- Empty pages for Today (with the localized date), Calendar, Routines and Progress; Settings
  with theme and language.
- Base UI components in `src/ui`: Button, IconButton, Chip, Tag, Card, Dialog, ConfirmDialog,
  Sheet, Toast, NumberField, Segmented, Switch, EmptyState and Icon; internal catalog at
  `/dev/ui`.
- Functional spec `docs/spec/theme-language-navigation.md` and end-to-end specs for
  navigation, theme, language, components and smoke: 38 tests per browser, focused on user
  flows and acceptance criteria (exhaustive combinations live in unit tests). Accessibility
  checks via `@axe-core/playwright` run once per screen and theme (light/dark), in Chromium
  only. Tab to the skip link (AC-NAV-09) is a documented WebKit exception; focus and Enter on
  the skip link are checked in both engines.
- Test helpers `renderWithProviders` (`src/test/render.tsx`) and `renderApp(path)`
  (`src/test/renderApp.tsx`, whole app with an in-memory router).
- `npm run e2e:all` script: Playwright on Chromium + WebKit (10 min global timeout).
- CI `e2e` job (Chromium + WebKit, `npm run e2e:all`) on pull requests to `main`, after the
  checks job; uploads the Playwright report on failure.
- Port 9323 (Playwright report) in `ports:check` and `ports:kill`.

### Changed

- The main heading on `/` is now "Hoy" (Today); "Certavi" stays in the document title.
- `npm run e2e` runs Chromium only, with 2 workers locally, no retries, `maxFailures` 3,
  30 s per test and a 5 min global timeout; CI keeps the default workers with 2 retries.
  Chromium uses `deviceScaleFactor` 2 (was 3); the HTML report never opens automatically.
- Claude Code rules, blind-tester agent and `/close-phase`: e2e runs in the foreground through
  the npm scripts only, without extra flags or parallel heavy work, at most one run plus one
  after a fix, and never installing browsers; `npx playwright install` and
  `npx playwright show-report` are denied.

## [0.1.0] - 2026-11-02

Project foundation (Phase 0).

### Added

- Vite 8 + React 19 + TypeScript 6.0 (strict) application skeleton with the folder layout for
  app, domain, data, features, ui, i18n and theme.
- TypeScript project references: `tsconfig.app.json` (`src`), `tsconfig.node.json` (tool
  configs) and `tsconfig.e2e.json` (type-checking of the Playwright tests); `typecheck` runs
  `tsc -b`.
- ESLint 9 (flat config, type-checked `strictTypeChecked` typescript-eslint, React, hooks,
  refresh, jsx-a11y, Prettier compatibility) and Prettier, with `format` and `format:check`
  scripts.
- Vitest + React Testing Library + jsdom with an example component test.
- Playwright (Chromium and WebKit at 390×844) with a self-managed build + preview server on
  port 4173 (strict port, never reused) and a smoke test: the app loads with its title and
  heading, and the page has no horizontal scroll at 390 px.
- husky `commit-msg` hook + commitlint (Conventional Commits with the project scopes plus
  `release` and `deps`).
- `ports:check` and `ports:kill` scripts for the dev ports 5173, 4173, 8888 and 8787.
- Repository config: `.gitattributes` (LF), `.editorconfig`, `.nvmrc` (Node 22), `.gitignore`;
  exact version pinning, `engines` Node `>=22.22.2`.
- GitHub Actions CI: lint, typecheck, test and build on pull requests to `dev` and `main`.
- Claude Code setup: working rules, permissions for both the Bash and PowerShell tools (git
  write commands and global installs denied, package installs ask first), `context-keeper` and
  `blind-tester` agents, `/start-phase` and `/close-phase` commands.
- Documentation: `CLAUDE.md`, `README.md`, sync API v1 contract (draft), ADR-0001 (Netlify
  Functions + Blobs backend), ADR-0002 (offline-first with last-write-wins sync), migration
  guide from gym_app, functional spec index and design docs index.
- License: all rights reserved (MIT planned when the repository becomes public).

[Unreleased]: https://github.com/ArmVV26/certavi/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/ArmVV26/certavi/releases/tag/v0.7.0
[0.6.0]: https://github.com/ArmVV26/certavi/releases/tag/v0.6.0
[0.5.0]: https://github.com/ArmVV26/certavi/releases/tag/v0.5.0
[0.4.0]: https://github.com/ArmVV26/certavi/releases/tag/v0.4.0
[0.3.0]: https://github.com/ArmVV26/certavi/releases/tag/v0.3.0
[0.2.0]: https://github.com/ArmVV26/certavi/releases/tag/v0.2.0
[0.1.0]: https://github.com/ArmVV26/certavi/releases/tag/v0.1.0
