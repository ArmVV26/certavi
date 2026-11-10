# Dependencies

- Do NOT install, update or remove packages on your own. When a package is needed, stop and tell
  the user: package name, version, dev or runtime, why it is needed, and the exact command.
  Continue only after the user confirms they ran it.
- Never use global installs.

## Dependabot (`.github/dependabot.yml`)

- Weekly PRs target `dev`: minor and patch updates grouped (dev and runtime apart), every major
  alone. CI (`checks`, including `npm audit --audit-level=high --omit=dev`) must be green.
- The user reviews and merges them. A major update that needs code changes goes on its own
  `chore/*` branch: do not push fixes onto the Dependabot branch.
- Keep the ignores in sync with CLAUDE.md §2: `typescript` < 6.1, `eslint` and `@eslint/js` < 10,
  `@types/node` on major 22. Change them there and in the file together, with the user's say-so.
- Versions stay pinned exact in `package.json` (Dependabot keeps the pin).
