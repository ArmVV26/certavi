# CLAUDE.md — Certavi

Guidance for Claude Code working in this repository.

- **Working rules (mandatory):** @.claude/rules.md
- **Project status, decisions, roadmap and phase prompts:** `context.md` (Spanish). It is the
  single source of truth for _what is done and what comes next_. Read it at the start of every
  phase. This file describes _how the project is built_.

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
| UI         | React 19, React Router (Phase 1)                                                              |
| State      | Dexie as source of truth (`useLiveQuery` from `dexie-react-hooks`) + local UI state. No Redux |
| Validation | zod — schemas shared by client and function (sync contract, importer)                         |
| Styles     | Design tokens as CSS custom properties + CSS Modules. Light/dark via `data-theme`             |
| Fonts      | Self-hosted with `@fontsource/*` (nothing loaded from third parties)                          |
| i18n       | `i18next` + `react-i18next` (`es` default, `en` optional)                                     |
| PWA        | `vite-plugin-pwa` (Workbox): precache, "new version" prompt                                   |
| Charts     | Hand-written SVG (no chart library)                                                           |
| Backend    | Netlify Functions (TypeScript) + `@netlify/blobs`                                             |
| Tests      | Vitest + React Testing Library + jsdom; Playwright (Chromium + WebKit)                        |
| Quality    | ESLint (flat, type-checked) + Prettier + `tsc`; husky + commitlint                            |
| CI         | GitHub Actions: lint, typecheck, test, build on PRs to `dev` and `main`                       |

Only the Phase 0 tooling is installed so far; the rest arrives in the phase that needs it.

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
  legacy importer, exporters. Depends on `domain`, never on `features` or `ui`.
- `src/features/*` — screens and their hooks (`today`, `session`, `calendar`, `routines`,
  `exercises`, `progress`, `blocks`, `settings`). May use `domain`, `data`, `ui`, `i18n`.
- `src/ui` — generic, presentational components (Button, Dialog, Sheet, NumberField…).
  No domain knowledge, no data access.
- `src/app` — routes, layout, providers, service worker registration.
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
  spec/             functional spec — the ONLY thing the blind-tester reads
  api/sync-v1.md    backend contract
  adr/              architecture decision records (0001, 0002, …)
  design/           palette, typography, tokens (Phase 1)
  migration.md      mapping from gym_app
netlify/functions/  sync.ts (Phase 4)
public/             icons, robots.txt, manifest (generated)
scripts/            ports-check.mjs
src/
  app/              App shell (routes, layout, providers)
  domain/  data/  features/  ui/  i18n/  theme/
  test/setup.ts     Vitest setup (jest-dom matchers, cleanup)
tests/
  e2e/              Playwright specs (written by the blind-tester)
  mocks/            fake /api/v1/sync server for e2e (Phase 4)
context.md  CHANGELOG.md  README.md  LICENSE
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
(`routineId: null` = free session), `SetEntry` (`kind`: warmup · approach · top · backoff ·
straight · bilbo · extra), `ExerciseNote`, `Activity`, `BodyWeight`, `OptionalBlock`,
`BlockLog`, `WeeklyMetric`, `Settings` (device-only fields such as theme and sync key are
never synced).

Rules (all tested): estimated 1RM (Epley on best set, ignoring warm-up/approach), progression
(top set, increments +2.5 kg upper / +5 kg lower unless overridden, back-off ≈ −10 %, isolation),
"does not count" sessions, effective sets per muscle group per week vs plan, records (excluding
deload weeks), deload, short week.

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
  feature: `session.addSet`, `settings.sync.keyLabel`…
- Dates and numbers use `Intl` with the active locale (Spanish: decimal comma).
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

| Kind                            | Tool                                    | Where                 | Who writes it |
| ------------------------------- | --------------------------------------- | --------------------- | ------------- |
| Unit (domain rules, data, sync) | Vitest                                  | `src/**/*.test.ts`    | main agent    |
| Component                       | Vitest + RTL + jsdom                    | `src/**/*.test.tsx`   | main agent    |
| End-to-end                      | Playwright (Chromium + WebKit, 390×844) | `tests/e2e/*.spec.ts` | blind-tester  |

- Query by role, label and visible text (`getByRole`, `getByLabelText`), as a user would.
- Domain code needs thorough tests (Phase 2 target: ≥ 90 % coverage of `src/domain`).
- Tests use **synthetic data only** — never real exports from gym_app.
- Playwright builds the app, starts `vite preview` on **4173** and stops it itself
  (`reuseExistingServer: false`, `strictPort`). A busy port fails the run on purpose.
- IndexedDB tests (Phase 3) use `fake-indexeddb`.

## 10. Commands

| Command                           | What it does                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server on 5173 (strict port)                                                 |
| `npm run build`                   | `tsc -b` + `vite build`                                                               |
| `npm run preview`                 | Serve the build on 4173                                                               |
| `npm run lint`                    | ESLint (type-checked)                                                                 |
| `npm run typecheck`               | `tsc -b`                                                                              |
| `npm run test`                    | Vitest, single run                                                                    |
| `npm run test:watch`              | Vitest in watch mode (user only — never leave it running)                             |
| `npm run e2e`                     | Playwright (builds, serves, tests, stops the server)                                  |
| `npm run format` / `format:check` | Prettier write / check                                                                |
| `npm run ports:check`             | Lists which of 5173 / 4173 / 8888 / 8787 are busy and by which process; exit 1 if any |
| `npm run ports:kill`              | Frees those ports                                                                     |

Note: `typecheck` is `tsc -b`, not `tsc --noEmit -p .` as first drafted in `context.md` §8.5.
The root `tsconfig.json` only holds project references (`tsconfig.app.json` for `src`,
`tsconfig.node.json` for tool configs, `tsconfig.e2e.json` for `tests/` with Node + DOM types
so `page.evaluate` callbacks type-check), so `-p .` would check no files at all.

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

- **`/start-phase N`** — reads `context.md` and this file, summarizes goals, deliverables and
  acceptance criteria, lists needed packages and the branch to create, and waits for
  confirmation before writing code.
- **`/close-phase`** — runs lint, typecheck, test and build; launches the **blind-tester**
  (e2e from the spec) and the **context-keeper** (updates memory); checks no port is busy;
  outputs the commit plan.
- **blind-tester:** give it the phase's acceptance criteria. It writes and runs
  `tests/e2e/*.spec.ts` and reports failures with steps, expected vs actual and screenshots.
  It does not fix app code. Write the spec in `docs/spec/` **before** implementing a feature
  so the tester has something to test against.
- **context-keeper:** give it a factual summary of what changed and the test results. It never
  marks something done unless tests passed.
