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
  verify the port is free (`npm run ports:check`). Ports used: 5173, 4173, 8888, 8787.
- Prefer one-shot commands: `vitest run` (not watch), `playwright test` with its own webServer.
- If a port is busy at start, report it instead of picking another one silently.

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
