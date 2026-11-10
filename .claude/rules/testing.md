---
paths:
  - 'src/**/*.test.ts'
  - 'src/**/*.test.tsx'
  - 'src/test/**'
  - 'server/**/*.test.ts'
  - 'netlify/**/*.test.ts'
  - 'vite.config.ts'
---

# Unit and component testing

End-to-end tests have their own rules: `.claude/rules/e2e.md`.

- Query by role, label and visible text (`getByRole`, `getByLabelText`), as a user would.
- Component tests that need the app providers use `renderWithProviders` from
  `src/test/render.tsx` (theme, i18n with a `locale` option defaulting to `es`, toasts, and a
  fresh empty database per render — no seed — overridable with the `db` option;
  `openTestDatabase()` opens one directly); tests of whole screens use `renderApp(path)` from
  `src/test/renderApp.tsx` (real routes, memory router).
- `src/test/setup.ts` is the Vitest setup (jest-dom matchers, cleanup, fake-indexeddb/auto).
- Vitest runs three projects (`vite.config.ts`): **`domain`** — `src/domain/**/*.test.ts` in a
  **Node** environment, so any DOM use fails (guarded by `src/domain/environment.test.ts`) —
  **`server`** — `server/**` and `netlify/**` tests, in Node — and **`ui`** — everything else,
  in jsdom with the RTL setup.
- Timeouts: RTL `asyncUtilTimeout` is **5 s** (`src/test/setup.ts`) and the `ui` project's
  `testTimeout` is **15 s** (`vite.config.ts`). Under `test:coverage` (v8, all workers busy) a
  write → live query → re-render can take over 1 s, which made component tests fail at random
  (2026-11-04).
- Sync tests: `src/data/sync/testing.ts` provides `createTestEngine` and `createFakeServer`
  (fake server over the domain merge rule, manual scheduler); `renderWithProviders` accepts a
  `sync` option (default: a test engine without key, not started). The contract is checked by
  `server/sync/contract.test.ts` (against `docs/api/sync-v1.md`) and
  `server/sync/httpTransport.test.ts` (client transport against the real handler). E2E sync
  tests use `tests/mocks/sync-server.ts`.
- Vitest prints the `dot` reporter (`test`, `test:coverage`) and coverage uses `text-summary` +
  `html`; thresholds are unchanged and still exit with code 1.
- IndexedDB tests use `fake-indexeddb` (loaded by `src/test/setup.ts`); use
  `openTestDatabase()` for a fresh database. Local storage layout: ADR-0003.
