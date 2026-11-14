---
name: close-phase
description: Close the current branch (default) or the last branch of a phase ("final") — checks, branch e2e, reviewers, status in context.md and commit plan.
argument-hint: [final]
disable-model-invocation: true
---

Close the current branch of Certavi. Argument: `$ARGUMENTS` — empty means a **regular branch
close**; `final` means the **last branch of the phase** (the one after which the PR
`dev → main` opens). Follow the steps in order and report each result briefly.
Never run git commands that write (commit, push, merge, tag, branch): the user does that.

## Every branch (regular and final)

1. **Checks** — one after another; stop and report if any fails: `npm run lint`,
   `npm run typecheck`, `npm run test:coverage`. Run `npm run build` only if the branch
   touched build, PWA or functions (`vite.config.ts`, `package.json`, `netlify.toml`,
   `netlify/`, `server/`).
2. **Branch e2e** — find the specs of this branch: `git status --porcelain tests/e2e` plus
   `git diff --name-only dev...HEAD -- tests/e2e` (branches are often uncommitted at this point).
   Launch the `blind-tester` agent with the acceptance criteria of the branch (from
   `docs/spec/`); it writes **at most 8 new tests**. It runs only
   `npm run e2e -- <those spec files>` under `.claude/rules/e2e.md`. **One pass and a single fix**
   if something fails; then report. If the branch touched no e2e spec, skip e2e and say so. Do not
   run e2e yourself in parallel.
3. **Security review** — if the diff touches `server/`, `src/data/sync/`, `package.json` or
   `netlify.toml`, launch the `security-reviewer` agent (it is read-only). Summarise its output.
4. **Status in `context.md`** — **no context-keeper on regular branches.** You add, in the
   phase's section of `context.md` (find it with Grep, edit by range), a status of **at most 10
   lines**: _hecho / falta / siguiente_. No test counts, coverage figures or durations.
5. **Ports** — `npm run ports:check`. If a port is busy or a Playwright browser
   (`ms-playwright`) is still running, find out why and stop it; do not finish with anything
   left running.
6. **Commit plan** — inspect `git status` and `git diff --stat`, then output the plan in
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
```

## Only with `final`

After step 3 and before step 4, also:

- **e2e:all** — the blind-tester runs `npm run e2e:all` **once** (Chromium: every test; WebKit:
  only `@all-engines` tests). A WebKit-only failure is reported like any other; never skip it to
  get the PR through (CI repeats this run on the PR to `main`; incident of 2026-11-04).
- **Reviews** — launch `code-reviewer` and `security-reviewer` (always, regardless of the diff).
- **Context keeper** — launch the `context-keeper` agent with a short factual summary of the
  phase (files, decisions, tests passed). It updates `context.md`, `docs/history.md`,
  `CHANGELOG.md` and, if needed, `CLAUDE.md`. Skip step 4 (it replaces it).
- **Release plan** — append to the commit plan: PR `dev → main`, version X.Y.Z in
  `package.json` and the `## [X.Y.Z] - YYYY-MM-DD` heading of `CHANGELOG.md` (both in the commit
  `chore(release): vX.Y.Z`), `git tag -a vX.Y.Z -m "…"`,
  `git push origin vX.Y.Z`.

## Last

**Suggestions** — list anything worth doing that was out of scope.
