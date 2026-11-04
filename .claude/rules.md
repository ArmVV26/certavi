# Working rules for Claude Code in Certavi

## Git — the user owns history

- NEVER run `git commit`, `git push`, `git merge`, `git rebase`, `git tag`, `git reset --hard`,
  `git checkout -b`/`git switch -c` or create/delete branches. The user does all of that.
- You MAY run read-only git: `git status`, `git diff`, `git log`, `git branch`.
- At the end of every phase or task, output a commit plan: branch to use, list of commits
  (Conventional Commits, English), the exact files for each commit, and the PR/tag steps.

## Dependencies

- Do NOT install, update or remove packages on your own. When a package is needed, stop and tell
  the user: package name, version, dev or runtime, why it is needed, and the exact command.
  Continue only after the user confirms they ran it.
- Never use global installs.

## Processes and ports (Windows)

- Never leave a server running. If you start one (`vite`, `vite preview`, `netlify dev`,
  the mock sync server, Playwright web server), stop it before finishing the task and
  verify the port is free (`npm run ports:check`). Ports used: 5173, 4173, 8888, 8787, 9323.
- Prefer one-shot commands: `vitest run` (not watch), `playwright test` with its own webServer.
- If a port is busy at start, report it instead of picking another one silently.

## End-to-end tests (Playwright)

An e2e run once saturated the user's PC (2026-11-02: 8 parallel browsers, three runs in a row).
These rules keep it from happening again.

- Run e2e **only** with `npm run e2e` (Chromium, 2 workers, 5 min cap, stops after 3 failures).
  `npm run e2e:all` (Chromium + WebKit) only when the user asks for it, or in the `/close-phase`
  step for the last branch of a phase (before the PR `dev → main`; CI runs it again there).
- **No real-time waits in e2e** (incident of 2026-11-04): no `waitForTimeout`, no waiting for a
  debounce or a backoff to pass. App timers move with `page.clock`; state is awaited with
  `toHaveText` / `expect.poll`; before injecting a failure, confirm with the fake server that the
  previous request was answered. Details in `.claude/agents/blind-tester.md`.
- Never call `npx playwright test` directly and never add flags (`--workers`, `--project`,
  `--reporter`, `--repeat-each`…) to the npm scripts.
- Run it in the foreground. Never move it to the background and poll it with `sleep` / `ping`
  loops. Run nothing heavy (`lint`, `tsc`, `build`, another test run) while it runs.
- **If it takes more than 5 minutes or hangs:** stop it, run `npm run ports:kill`, make sure no
  Playwright browser is left (processes under `ms-playwright`), check `npm run ports:check`, and
  report to the user.
- **Never retry in a loop.** At most one run, plus one more only after fixing a test; then report.
  Never re-run to "see if it passes".
- **Never install browsers** (`npx playwright install`): the user does it. Never open the HTML
  report (`npx playwright show-report`).

## Data and secrets

- Never read, copy or commit real user data (exported JSON from the old app) or `.env*`.
- Never print or hardcode `CLAVE_SYNC` or any secret. Tests use synthetic data only.

## Code

- TypeScript strict. No `any` without a comment explaining why.
- Domain logic lives in `src/domain` (pure, no React/Dexie) and must have tests.
- UI text always through i18n keys (es + en). No hardcoded user-facing strings.
- Use design tokens; no hardcoded colors or font sizes in components.
- No `window.confirm/alert/prompt`: use the `Dialog` component.
- Keep the sync contract in `docs/api/sync-v1.md` and `src/domain/sync/contract.ts` in sync.

## Before saying a task is done

- `npm run lint && npm run typecheck && npm run test` pass.
- `npm run build` passes when the task touches build/PWA/functions.
- No server left running. Updated docs if behaviour changed.
- Ask the context-keeper agent to update context.md at the end of a phase.

## Scope

- Do only what the current phase/task asks. If you see something else worth doing,
  list it under "Suggestions" in your final message instead of doing it.
- Do not delete or rewrite tests to make them pass without explaining why.
