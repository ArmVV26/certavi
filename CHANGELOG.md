# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Local data, importer and exports (Phase 3) — to be released as 0.4.0.

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

[Unreleased]: https://github.com/ArmVV26/certavi/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ArmVV26/certavi/releases/tag/v0.3.0
[0.2.0]: https://github.com/ArmVV26/certavi/releases/tag/v0.2.0
[0.1.0]: https://github.com/ArmVV26/certavi/releases/tag/v0.1.0
