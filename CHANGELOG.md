# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Planned release: **0.1.0** — project foundation (Phase 0).

### Added

- Vite 8 + React 19 + TypeScript 6.0 (strict) application skeleton with the folder layout for
  app, domain, data, features, ui, i18n and theme.
- TypeScript project references: `tsconfig.app.json` (`src`), `tsconfig.node.json` (tool
  configs) and `tsconfig.e2e.json` (type-checking of the Playwright tests); `typecheck` runs
  `tsc -b`.
- ESLint 9 (flat config, type-checked `strictTypeChecked` typescript-eslint, React, hooks,
  refresh, jsx-a11y, Prettier compatibility) and Prettier, with `format` and `format:check`
  scripts.
- Vitest + React Testing Library + jsdom with an example component test.
- Playwright (Chromium and WebKit at 390×844) with a self-managed build + preview server on
  port 4173 (strict port, never reused) and a smoke test: the app loads with its title and
  heading, and the page has no horizontal scroll at 390 px.
- husky `commit-msg` hook + commitlint (Conventional Commits with the project scopes plus
  `release` and `deps`).
- `ports:check` and `ports:kill` scripts for the dev ports 5173, 4173, 8888 and 8787.
- Repository config: `.gitattributes` (LF), `.editorconfig`, `.nvmrc` (Node 22), `.gitignore`;
  exact version pinning, `engines` Node `>=22.22.2`.
- GitHub Actions CI: lint, typecheck, test and build on pull requests to `dev` and `main`.
- Claude Code setup: working rules, permissions for both the Bash and PowerShell tools (git
  write commands and global installs denied, package installs ask first), `context-keeper` and
  `blind-tester` agents, `/start-phase` and `/close-phase` commands.
- Documentation: `CLAUDE.md`, `README.md`, sync API v1 contract (draft), ADR-0001 (Netlify
  Functions + Blobs backend), ADR-0002 (offline-first with last-write-wins sync), migration
  guide from gym_app, functional spec index and design docs index.
- License: all rights reserved (MIT planned when the repository becomes public).
