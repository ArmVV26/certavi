---
description: Close the current phase — run all checks, blind-tester and context-keeper, verify ports, and propose the commit plan.
---

Close the current phase of Certavi. Follow these steps in order and report each result.
Never run git commands that write (commit, push, merge, tag, branch): the user does that.

1. **Checks** — run, one after another, and stop to report if any fails:
   `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
2. **Blind tester** — launch the `blind-tester` agent with the acceptance criteria of the
   phase (from `context.md` §10 and `docs/spec/`). It runs `npm run e2e` (Chromium, 2 workers,
   5 min cap) under the e2e rules in `.claude/rules.md`: foreground only, no extra flags, no
   loops of re-runs (one run, plus one after fixing a test), no browser installs, no
   `show-report`. If a run takes more than 5 minutes or hangs, it stops, runs
   `npm run ports:kill`, checks ports and reports. Do not run e2e yourself in parallel.
   Summarize its report: passed / failed, and any failure with steps, expected vs actual.
   **On the last branch of a phase** (the one after which the PR `dev → main` opens), the
   blind-tester then runs `npm run e2e:all` once (Chromium + WebKit, 2 workers, 10 min cap,
   same rules: foreground, no extra flags, one run plus at most one after a fix). A WebKit-only
   failure is reported like any other; never skip it to get the PR through. This is the run CI
   repeats on the PR to `main` (incident of 2026-11-04: WebKit had never run before that PR).
3. **Context keeper** — launch the `context-keeper` agent with a short summary of what changed
   in this phase (files, decisions, test results). It updates `context.md`, `CHANGELOG.md`
   and, if needed, `CLAUDE.md`.
4. **Ports** — run `npm run ports:check` (5173, 4173, 8888, 8787, 9323). If any port is busy,
   or a Playwright browser (`ms-playwright`) is still running, find out why and stop it; do not
   finish while anything is left.
5. **Commit plan** — inspect `git status` and `git diff --stat`, then output the plan in
   exactly this format (Conventional Commits, English, small commits, one idea each, every
   commit must build):

```
Current branch: feature/xxx
Commits (in this order):
1. chore: add vitest config
   git add vitest.config.ts package.json
   git commit -m "chore: add vitest config"
2. ...
Then:
- git push -u origin feature/xxx → PR to dev ("feat: …"), merge (NO squash: merge commit to keep the commits)
- If this is the end of the phase: PR dev → main, version X.Y.Z in package.json (commit "chore(release): vX.Y.Z"),
  git tag -a vX.Y.Z -m "…", git push origin vX.Y.Z
```

6. **Suggestions** — list anything worth doing that was out of scope.
