---
description: Close the current phase — run all checks, blind-tester and context-keeper, verify ports, and propose the commit plan.
---

Close the current phase of Certavi. Follow these steps in order and report each result.
Never run git commands that write (commit, push, merge, tag, branch): the user does that.

1. **Checks** — run, one after another, and stop to report if any fails:
   `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
2. **Blind tester** — launch the `blind-tester` agent with the acceptance criteria of the
   phase (from `context.md` §10 and `docs/spec/`). It runs `npm run e2e` and reports.
   Summarize its report: passed / failed, and any failure with steps, expected vs actual.
3. **Context keeper** — launch the `context-keeper` agent with a short summary of what changed
   in this phase (files, decisions, test results). It updates `context.md`, `CHANGELOG.md`
   and, if needed, `CLAUDE.md`.
4. **Ports** — run `npm run ports:check`. If any port is busy, find out why and stop that
   process; do not finish while a port is busy.
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
