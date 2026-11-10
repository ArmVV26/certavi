# Git — the user owns history

- NEVER run `git commit`, `git push`, `git merge`, `git rebase`, `git tag`, `git reset --hard`,
  `git checkout -b`/`git switch -c` or create/delete branches. The user does all of that.
- You MAY run read-only git: `git status`, `git diff`, `git log`, `git branch`.
- At the end of every phase or task, output a commit plan: branch to use, list of commits
  (Conventional Commits, English), the exact files for each commit, and the PR/tag steps.

## Git workflow

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
