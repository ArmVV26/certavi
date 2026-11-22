# CLAUDE.md — Certavi

Guidance for Claude Code working in this repository.

- **Working rules (mandatory):** `.claude/rules/*.md`. Rules without `paths:` (git-workflow,
  dependencies, processes-windows, context-economy, data-and-secrets, quality-and-scope) always
  load; the rest load when you work on matching files: `e2e-discipline`, `testing`, `code-style`,
  `i18n`, `design-tokens`, `domain`, `sync`. Git workflow, commit plan, branches, commits and
  versions: `rules/git-workflow.md`.
- **Project status, decisions, roadmap and phase prompts:** `context.md` (Spanish). It is the
  single source of truth for _what is done and what comes next_. At the start of a phase read
  only its index, the phase section and the items of `docs/backlog.md` for that phase (Grep +
  ranges, never the whole file). Closed phases,
  superseded decisions and the progress log live in `docs/history.md`. This file describes _how
  the project is built_.
- **Ideas, suggestions and pending work live only in `docs/backlog.md`.** A phase is closed when
  its exit criteria (in `context.md` §10) are met; anything new that comes up goes to the backlog,
  not into the phase, and no other document keeps a list of pending items.
- **Names in docs:** living docs (`CLAUDE.md`, `context.md`, `docs/spec/`, `docs/backlog.md`,
  code comments, lint messages) use the current names of agents, skills and rules
  (`armando-base:qa-tester`, `/armando-base:close-phase`, `rules/e2e-discipline.md`…). When the
  plugin renames something, update them in the same branch as the upgrade. Historical records
  (`docs/history.md`, `CHANGELOG.md`, `docs/audit/`) keep the names of their time and are not
  rewritten; `context.md` §8 maps old names to new ones.
- **Design source:** `docs/design/README.md` (palette and fonts in `decision.md`, tokens in
  `tokens.md`). Visual source of truth: read the section that applies before touching the UI.

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

| Layer      | Tool                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| Build      | Vite                                                                                                                 |
| UI         | React 19, React Router 8 (`RouterProvider` from `react-router/dom`)                                                  |
| State      | Dexie as source of truth (`useLiveQuery` from `dexie-react-hooks`) + local UI state. No Redux                        |
| Validation | zod — schemas shared by client and function (sync contract, importer)                                                |
| Styles     | Design tokens as CSS custom properties + CSS Modules. Light/dark via `data-theme`                                    |
| Fonts      | Self-hosted with `@fontsource-variable/archivo` (nothing loaded from third parties)                                  |
| i18n       | `i18next` + `react-i18next` (`es` default, `en` optional)                                                            |
| PWA        | `vite-plugin-pwa` (Workbox): precache, "new version" prompt                                                          |
| Charts     | Hand-written SVG (no chart library)                                                                                  |
| Backend    | Netlify Functions (TypeScript) + `@netlify/blobs`                                                                    |
| Tests      | Vitest + RTL + jsdom; Playwright (Chromium locally; Chromium + WebKit in `e2e:all` and CI)                           |
| Quality    | ESLint (flat, type-checked) + Prettier + `tsc`; husky + commitlint                                                   |
| CI         | GitHub Actions: lint, typecheck, knip, audit, test:coverage, build on PRs to dev/main; e2e on PRs to main            |
| Deps       | Dependabot (`.github/dependabot.yml`): weekly npm PRs to `dev` (monthly for GitHub Actions); `rules/dependencies.md` |

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

- `src/domain` — pure TypeScript: entities, zod schemas, rules, seed catalog and routines
  (details in `rules/domain.md`).
- `src/data` — Dexie database, repositories, `SyncEngine`, `SyncTransport` implementations,
  legacy importer, exporters. Depends on `domain`, never on `features` or `ui`. Ids of
  records created on the device come from `newId(prefix)` (`src/data/ids.ts`: `ses_`, `act_`,
  `set_` + base36 time + 10 random characters).
- `src/features/*` — screens and their hooks (`today`, `session`, `calendar`, `routines`,
  `exercises`, `progress`, `blocks`, `settings`). May use `domain`, `data`, `ui`, `i18n`.
- `src/ui` — generic, presentational components (Button, Dialog, Sheet, NumberField…).
  No domain knowledge, no data access.
- `src/app` — routes, layout, providers, service worker registration.
- Client sync (`src/data/sync`), sync server (`server/sync`) and the sync model: `rules/sync.md`.

---

## 4. Repository layout

```
.claude/            rules/, settings.json (permissions, armando-base plugin), BASE_VERSION
.github/            workflows/ci.yml + e2e.yml, dependabot.yml
docs/               spec/ (functional spec — the ONLY thing the qa-tester reads), api/sync-v1.md,
                    adr/, design/, audit/ (consistency and audit reports), deploy-netlify.md,
                    migration.md, device-checklist.md (manual checks on the iPhone), backlog.md
                    (the only list of pending work), history.md
netlify/functions/  sync.ts — thin adapter over server/sync
public/             icons, robots.txt, manifest (icon.svg is the source; `npm run icons`)
scripts/            ports-check.mjs, lib/ports.mjs, e2e-timings.mjs, build-selector.mjs (design
                    selector), hooks/ (format-file.mjs, ports-warn.mjs)
server/sync/        sync v1 server: handler, stores (memory, Netlify Blobs), auth, backups
src/                app/ (shell, routes, pwa/) · domain/ · data/ · features/ · ui/ · i18n/ · theme/ · test/
tests/              e2e/ (Playwright specs) · fixtures/ (synthetic inputs) · mocks/
context.md  CHANGELOG.md  README.md  LICENSE  netlify.toml  knip.json
tsconfig.json       references only: tsconfig.app / .node / .e2e / .server.json
```

Empty folders hold a `.gitkeep` until they get real files.

---

## 5. Commands

Single source: skills and agents read the commands from this table. All scripts are in
`package.json`.

| Role      | Command                                                                       | Notes                                                       |
| --------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| install   | `npm install`                                                                 | needs user approval (`rules/dependencies.md`)               |
| dev       | `npm run dev`                                                                 | long-running: user only                                     |
| lint      | `npm run lint`                                                                |                                                             |
| typecheck | `npm run typecheck`                                                           |                                                             |
| test      | `npm run test`                                                                | single run, never watch mode                                |
| test-full | `npm run test:coverage`                                                       | **gate** in `/armando-base:close-phase` and CI              |
| build     | `npm run build`                                                               |                                                             |
| e2e       | `npm run e2e`                                                                 | Chromium only; read `.claude/rules/e2e-discipline.md` first |
| e2e-all   | `npm run e2e:all`                                                             | all engines; only when that rule allows it                  |
| format    | `npm run format`                                                              |                                                             |
| audit     | `npm audit --audit-level=high`                                                | dependency vulnerability check                              |
| **check** | `npm run lint` → `npm run typecheck` → `npm run test` → `npm run ports:check` | sequence that must pass before "done"                       |

- **Build-affecting files** (run `build` when a branch touches them): `vite.config.ts`,
  `package.json`, `netlify.toml`, `netlify/`, `server/`.
- **Security-sensitive paths** (trigger the security review): `server/`, `src/data/sync/`,
  `package.json`, `netlify.toml`. There, check that the sync key stays device-only and is never
  logged, that boundary input (legacy importer, sync handler, `JSON.parse`, request bodies) is
  validated with zod, that the key is compared in constant time, and that no CSP or header in
  `netlify.toml` is loosened.

All are `npm run <name>`:

- `dev` — Vite dev server on 5173 (strict port) · `preview` — serve the build on 4173 ·
  `build` — `tsc -b` + `vite build` · `icons` — regenerates the PWA PNG icons from
  `public/icon.svg` (`pwa-assets.config.ts`)
- `lint` — ESLint (type-checked) · `typecheck` — `tsc -b` · `knip` — unused files, exports,
  dependencies and i18n keys; CI step · `format` / `format:check` — Prettier write / check
- `test` — Vitest, single run · `test:watch` — Vitest in watch mode (user only — never leave it
  running) · `test:coverage` — Vitest single run with v8 coverage; fails if `src/domain`,
  `src/data` or `server` < 90 % (CI)
- `e2e` — Playwright, **Chromium only** (builds with `--mode e2e --outDir dist-e2e`, serves,
  tests, stops the server) · `e2e:all` — Chromium + WebKit (`@all-engines` only); ~27 min cap
  (`--global-timeout=1600000`); CI runs it on PRs to main, in shards · `e2e:timings` — reads
  `e2e-timings/last-run.json` and lists the slowest tests (`rules/e2e-discipline.md`)
- `ports:check` — lists which of 5173 / 4173 / 8888 / 8787 / 9323 are busy and by whom; exit 1
  if any · `ports:kill` — frees those ports

**Before running `npm run e2e` or `npm run e2e:all` (yourself or through an agent), read
`.claude/rules/e2e-discipline.md`.**

Note: `typecheck` is `tsc -b`, not `tsc --noEmit -p .` as first drafted (`docs/history.md` §8.5).
The root `tsconfig.json` only holds project references (`tsconfig.app.json` for `src`,
`tsconfig.node.json` for tool configs, `tsconfig.e2e.json` for `tests/` with Node + DOM types
so `page.evaluate` callbacks type-check, `tsconfig.server.json` for `server/` and `netlify/`),
so `-p .` would check no files at all.

## 6. Conventions (language, code and tests)

- Code, comments, commits and docs are in **English**. The app UI is Spanish by default. Chat,
  plans and agent reports addressed to the user: Spanish.
- Conventions: `rules/code-style.md` · i18n: `rules/i18n.md` · tokens: `rules/design-tokens.md`.

| Kind                            | Tool                                                      | Where                 | Who writes it |
| ------------------------------- | --------------------------------------------------------- | --------------------- | ------------- |
| Unit (domain rules, data, sync) | Vitest                                                    | `src/**/*.test.ts`    | main agent    |
| Component                       | Vitest + RTL + jsdom                                      | `src/**/*.test.tsx`   | main agent    |
| End-to-end                      | Playwright (390×844; limits in `rules/e2e-discipline.md`) | `tests/e2e/*.spec.ts` | qa-tester     |

- Domain, data and server code need thorough tests: v8 coverage of `src/domain/**`,
  `src/data/**` and `server/**` must each stay **≥ 90 %** (lines, functions, branches,
  statements; per-glob thresholds in `vite.config.ts`; `src/data/**/testing.ts` and
  `server/**/testing.ts` are excluded). Enforced by `npm run test:coverage`, which CI runs
  instead of `npm run test`.
- Unit and component testing: `rules/testing.md`. End-to-end: `rules/e2e-discipline.md`.

---

## 7. Git

- **Base branch:** `dev`. Work branches: `feature/*`, `fix/*`, `chore/*`, `docs/*`, off `dev` and
  back to `dev`. Release: `dev → main` + annotated tag `vX.Y.Z` on `main`.
- **Integración:** `pr` — CI on GitHub Actions; merge through a pull request (merge commit, no
  squash).
- **Commits:** Conventional Commits, English, small, one idea each; types, scopes and versions in
  `.claude/rules/git-workflow.md`.
- The user makes every commit, PR and tag. Claude only proposes the commit plan, in the format
  of `.claude/rules/git-workflow.md`.

## 8. Who does what

The `armando-base` plugin installs every agent, but this project uses **only the ones listed
here**: skills and agents read this table to know which to launch.

| Who                                    | Does                                                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**                               | Creates branches, reviews code, tests on the phone, **makes every commit**, opens and merges PRs, creates tags, deploys, installs packages                        |
| **Claude Code**                        | Writes code, tests and docs; runs lint, typecheck, tests and build; at the end of each phase proposes the commits (files + messages), branch, PR, version and tag |
| `armando-base:code-reviewer` agent     | Read-only review of the branch diff                                                                                                                               |
| `armando-base:security-reviewer` agent | Read-only security review + `npm audit`                                                                                                                           |
| `armando-base:context-keeper` agent    | Updates `context.md`, `docs/history.md`, `CHANGELOG.md` and (if structure changed) this file                                                                      |
| `armando-base:qa-tester` agent         | Tests the app as a user from `docs/spec/` with Playwright. **Never reads `src/`**                                                                                 |

Skills (user-invoked): `/armando-base:start-phase <n>`, `/armando-base:close-phase [final]`,
`/armando-base:upgrade-base`.

Git write commands and global installs are **denied** in `.claude/settings.json`, and the
plugin's `git-guard` hook blocks any git or gh command that writes; `npm install` asks first.
Verify with `/permissions`.

- **Agents:** each one holds its own limits and output format. code-reviewer and
  security-reviewer are read-only and fix nothing.
- **Review priority:** `src/domain` (purity) → `src/data` (`updatedAt` and enqueue in the same
  transaction, soft deletes) → new features in `src/features`. Reviewers read the rules whose
  `paths:` match the changed files.
- **qa-tester:** give it the phase's acceptance criteria. It writes and runs
  `tests/e2e/*.spec.ts` under `.claude/rules/e2e-discipline.md` and reports failures with steps,
  expected vs actual and screenshots. It does not fix app code. Write the spec in `docs/spec/`
  **before** implementing a feature so the tester has something to test against.
- **context-keeper:** give it a factual summary of what changed and the test results. It never
  marks something done unless tests passed. Pending work goes to `docs/backlog.md`; it removes
  from there what the phase finished.
- **Hooks** (`.claude/settings.json`): `PostToolUse` on `Edit|Write` formats the file with
  Prettier (`scripts/hooks/format-file.mjs`); `Stop` warns the user of busy ports other than
  5173 (`scripts/hooks/ports-warn.mjs`, exit 0 always).
