# Git — the user owns history

## What you must not do

- NEVER run a git command that writes: `add`, `commit`, `push`, `pull`, `fetch`, `merge`, `rebase`,
  `tag`, `reset`, `restore`, `rm`, `mv`, `clean`, `stash`, `checkout`, `switch`, creating or
  deleting branches, `remote add`, `config` writes. The same goes for `gh` writes (`pr create`,
  `pr merge`, `release create`…). The user does all of that.
- `settings.json` denies some of these and the plugin's `git-guard` hook blocks everything that is
  not read-only, but neither is airtight: do not look for another spelling or another way to run a
  blocked command. Put it in the commit plan instead.
- You MAY run read-only git: `git status`, `git diff`, `git log`, `git show`, `git blame`,
  `git branch --show-current`, `git remote -v`, `git rev-parse`… and read-only `gh` (`pr list`,
  `pr view`…).
- NEVER add attribution: no `Co-Authored-By` and no "Generated with Claude Code", in the commit
  messages you propose or in a pull request text.
- Never rewrite or discard the user's uncommitted work (no `git checkout -- .`, `git restore .`,
  `git stash` without being asked).
- Commits are small, one idea each, and every commit must build. Message format: CLAUDE.md §7.

## The commit plan

Output it at the end of every task or phase (`/armando-base:close-phase` points here). This file is
the only place that defines its format: do not restate it elsewhere.

Before writing it, check (read-only): `git status`, `git branch --show-current` and `git remote -v`.
They give the branch, what changed and whether a remote exists. Take the base branch and the
integration mode (`Integración: local | pr`) from CLAUDE.md §7.

Write the plan in Spanish (the comments), in these blocks. Each block is one ```bash code block the
user can paste as is.

### Block 1 — commits

- A single block with every commit. Every line that is not a command starts with `#`; blank
  lines are fine.
- For each commit, in this order:
  1. a comment `# n/N <type>: <message>`;
  2. `git add <exact paths>` — never `git add .` or `-A`;
  3. `git diff --staged --stat`;
  4. `git commit -m "<type>: <message>"` (a body goes in a second `-m "…"`).
- It ends with `git status --short`.

### Block 2 — integration

A separate block, for when the user has reviewed the changes. It depends on the mode:

- **`local`** (personal project, no CI):
  1. `git switch <base>`
  2. `git merge --no-ff <branch> -m "Merge branch '<branch>' into <base>"`
  3. `git branch -d <branch>`
  4. if `git remote -v` shows a remote: `git push origin <base>` as a backup.
- **`pr`** (CI or more people):
  1. `git push -u origin <branch>`
  2. the pull request to the base branch: `gh pr create --base <base> --head <branch> --title "…" --body "…"`
     if `gh --version` works; otherwise a comment with the compare URL
     (`https://github.com/<owner>/<repo>/compare/<base>...<branch>?expand=1`, built from the remote).
  3. a comment: merge with a merge commit, no squash and no rebase, to keep the commits.

### Block 3 — release (only with `/armando-base:close-phase final`)

Same in both modes. The version bump is the last commit of block 1 and reaches `dev` with block 2.

1. `dev` → `main`: `local` merges with `git switch main` and
   `git merge --no-ff dev -m "Merge branch 'dev' into main"`; `pr` opens the pull request with
   `gh pr create --base main --head dev …` (or the compare URL) and, once it is merged, runs
   `git switch main` and `git pull origin main`.
2. `git tag -a vX.Y.Z -m "vX.Y.Z"` on `main`.
3. `git push --follow-tags origin main` pushes the tag.
4. in `local` mode with a remote: `git push origin dev`, then `git switch dev`.

In `pr` mode the second pull request can only be opened once the first one is merged, which is why
the release is its own block.

### Format rules

- One command per line: no `&&`, no heredoc, no `\` to continue a line.
- Double quotes. It must run the same in PowerShell and in Git Bash.
- No attribution lines, ever.

### Example (`local` mode, branch `feature/login`, base `dev`)

```bash
# 1/2 feat: add the login form
git add src/login.ts src/login.test.ts
git diff --staged --stat
git commit -m "feat: add the login form"

# 2/2 docs: document the login flow
git add docs/login.md
git diff --staged --stat
git commit -m "docs: document the login flow" -m "Explains the redirect after a failed login."

git status --short
```

```bash
# Integración (local): ejecútalo cuando hayas revisado los cambios
git switch dev
git merge --no-ff feature/login -m "Merge branch 'feature/login' into dev"
git branch -d feature/login
git push origin dev
```

<!-- To let Claude commit (e.g. a team project): delete this file, the `git` entries in
     settings.json "deny" and the commit-plan step in /armando-base:close-phase, and turn off the
     plugin's git-guard hook by adding this to the project's .claude/settings.json:
       "env": { "CLAUDE_BASE_GIT_GUARD": "off" }
     Then check that a harmless write (e.g. creating a throwaway branch) is no longer blocked: the
     docs say `env` reaches the session's subprocesses but do not say so for hooks explicitly.
     Keep the "attribution" entry if commits must carry no Claude credit. -->

## Certavi: branches, commits and versions

- **Branches:** `main` (production, Netlify deploys) · `dev` (integration) ·
  `feature/*`, `fix/*`, `chore/*`, `docs/*` branch off `dev` and return to `dev` via PR
  (merge commit, no squash). Release: PR `dev → main` + annotated tag `vX.Y.Z` on `main`.
- **Conventional Commits**, English, imperative, lower case:
  `type(scope): description`. Types: `feat fix refactor test docs style chore ci build perf`.
  Scopes: `domain data sync api session today calendar routines exercises progress blocks
settings ui theme i18n pwa claude release deps` (optional). Breaking: `feat!:` or a
  `BREAKING CHANGE:` footer. commitlint (husky `commit-msg` hook) rejects anything else.
- **Versions:** SemVer. `0.x` per phase (`v0.1.0` = Phase 0 … `v0.10.1` = Phase 9,
  `v0.11.0` = Phase 10 …), **`v1.0.0`** = Phase 13 at parity with gym_app (table in `context.md`
  §10). `package.json` version is bumped in the `chore(release): vX.Y.Z` commit, which also turns
  the `Unreleased` heading of `CHANGELOG.md` into `## [X.Y.Z] - YYYY-MM-DD` (Keep a Changelog).
