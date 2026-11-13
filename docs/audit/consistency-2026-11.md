# Consistency audit — November 2026 (Phase 10, branch `docs/consistency`)

Read-only audit of the documents against each other and against the real repo (`package.json`,
`playwright.config.ts`, `vite.config.ts`, `.github/**`, `netlify.toml`, `.claude/**`, `docs/adr`,
`tests/fixtures`, git tags in `.git/packed-refs`, `git log main`).

- **Type `fact`**: the repo is the truth; the document is fixed without asking.
- **Type `decision`**: more than one reasonable truth; the user decides (see the last section).
- Status of every item: see «Resolution» at the end (all `fixed` or `moved` on 2026-11-13, branch
  `docs/consistency`).

Coverage: the CHANGELOG was checked for 0.9.0–0.10.1 only; `docs/history.md` for §8, §10 (Phase 9)
and §12 headings; `context.md` §1–§3, §7, §10 (Phases 0–10 headers) and §11–§12 in full. Spec files
were checked through the index in `docs/spec/README.md` and the e2e specs that exist.

## Findings

| ID   | A says                                                                                                                                     | B says                                                                                                                                               | Truth and reason                                                                                                                                                        | Type     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| C-01 | `CLAUDE.md:148`: `e2e:all` has a "20 min cap"                                                                                              | `package.json:22` and `playwright.config.ts:26`: `--global-timeout=1600000` (~27 min; "20 min until Phase 9"); `e2e.md:38` agrees                    | ~27 min (1 600 000 ms). CLAUDE.md kept the old value.                                                                                                                   | fact     |
| C-02 | `e2e.md:93`: a full `e2e:all` takes "10-15 min"                                                                                            | `e2e.md:34` and `playwright.config.ts:27`: WebKit alone is ~19 min with one worker                                                                   | Local run with 2 workers is shorter than CI's one worker; the text should say which is which, not give one number.                                                      | fact     |
| C-03 | `.claude/rules/git.md:19`: `v0.10.0` = Phase 9                                                                                             | `package.json:4`, tag `v0.10.1`, `context.md:582`                                                                                                    | Phase 9 closed with `v0.10.1`. Tag `v0.10.0` also exists (an earlier cut), so there is no `v0.10.0` = Phase 9 any more.                                                 | fact     |
| C-04 | `docs/history.md:753`, `:834`: Phase 9 is `v0.10.0` ⏳, closing "PR `dev → main` and tag `v0.10.0`"                                        | `context.md:720`, `:905`: Phase 9 ✅ `v0.10.1`                                                                                                       | Closed with `v0.10.1`. The history text is the original plan; mark it as such and point to the real result.                                                             | fact     |
| C-05 | `CHANGELOG.md:10`, `:26`, `:48`: `[0.10.1]`, `[0.10.0]`, `[0.9.0]` are "Unreleased"                                                        | Tags `v0.9.0`, `v0.10.0`, `v0.10.1` exist; `context.md:6`                                                                                            | They are released. Cause: `context-keeper.md:33` says "Unreleased until the user tags" and nothing turns it into a dated release afterwards. Older entries not checked. | decision |
| C-06 | `CHANGELOG.md:41`: CI e2e split into "Chromium and WebKit, two shards each"                                                                | `.github/workflows/e2e.yml:60-74`, `e2e.md:28-29`: Chromium 2 shards, WebKit 3 shards, 25 min per job                                                | 2 + 3 shards. The entry was written before the third WebKit shard.                                                                                                      | fact     |
| C-07 | `CLAUDE.md` §6: `test:coverage` "fails if `src/domain` or `src/data` < 90 %"                                                               | `CLAUDE.md` §5 and `vite.config.ts:123-125`: `server/**` too                                                                                         | Three globs: domain, data and server.                                                                                                                                   | fact     |
| C-08 | `CLAUDE.md` §6 lists the npm scripts                                                                                                       | `package.json:23`: `e2e:timings` exists and `e2e.md:100` tells to run it                                                                             | Add `e2e:timings` to CLAUDE.md §6 (and `scripts/e2e-timings.mjs`, `scripts/build-selector.mjs` to the §4 layout).                                                       | fact     |
| C-09 | `CLAUDE.md` §6 note: "as first drafted in `context.md` §8.5"                                                                               | `context.md:603-605`: §8 is now only a link to `docs/history.md`                                                                                     | The pointer should be `docs/history.md` §8.5 (or the note dropped: it explains a draft nobody reads).                                                                   | fact     |
| C-10 | `CLAUDE.md` §2 and `.claude/rules/dependencies.md:7-8`: minor/patch grouped (dev and runtime apart), every major alone                     | `.github/dependabot.yml:27-45`: also an `i18n` group that includes majors, a 3-day `cooldown`, and a monthly `github-actions` ecosystem (`ci(deps)`) | The file is the truth. Both documents describe an older version of it.                                                                                                  | fact     |
| C-11 | `.claude/settings.json` allow list has `npm run e2e *` and `npm run e2e:all`                                                               | `e2e.md:100`: "Claude (or the user): `npm run e2e:timings`"                                                                                          | `npm run e2e:timings` is not allowed, so Claude would be asked every time (`e2e *` needs a space). Either allow it or say the user runs it.                             | decision |
| C-12 | `context.md:6`, `:905`: phases 5–9 are "sin publicar"                                                                                      | `docs/deploy-netlify.md:81`: merging into `main` deploys production; `git log main` has PR #54 (`dev → main`, v0.10.1)                               | Unknown from the repo whether Netlify really deployed those merges. Only the user knows which version is in production.                                                 | decision |
| C-13 | `context.md:700`: Phase 7 "✅ implementada (release pendiente)"                                                                            | tag `v0.8.0`; `context.md:905`: 7 ✅ (`v0.8.0`)                                                                                                      | Released (the tag exists). Same heading style as the other phases.                                                                                                      | fact     |
| C-14 | `context.md:72`: "dos subagentes: context-keeper y blind-tester"; `:269-271`: two agents in the tree                                       | `.claude/agents/`: blind-tester, code-reviewer, context-keeper, security-reviewer                                                                    | Four agents.                                                                                                                                                            | fact     |
| C-15 | `context.md:252`: fonts with `@fontsource/*`                                                                                               | `package.json:33`: `@fontsource-variable/archivo`; `CLAUDE.md` §2                                                                                    | `@fontsource-variable/archivo`.                                                                                                                                         | fact     |
| C-16 | `context.md:259`: CI = lint, typecheck, test:coverage, build; `:275`: `.github/workflows/ci.yml`                                           | `ci.yml:35-55`: also `knip` and `npm audit`; `.github/workflows/e2e.yml` is a second workflow                                                        | CI has two workflows; `ci.yml` has six steps.                                                                                                                           | fact     |
| C-17 | `context.md:279`: ADRs 0001…0004                                                                                                           | `docs/adr/`: 0001…0006                                                                                                                               | Six ADRs.                                                                                                                                                               | fact     |
| C-18 | `context.md:286`: `scripts/` holds only `ports-check.mjs`; `:297`: fixtures are `gym-app-sample.json`, `not-a-backup.txt`                  | `scripts/`: also `e2e-timings.mjs`, `build-selector.mjs`, `hooks/`, `lib/`; `tests/fixtures/certavi-backup-sample.json` (used by e2e, `e2e.md:50`)   | Update the tree (or cut the tree from `context.md`; it duplicates CLAUDE.md §4).                                                                                        | fact     |
| C-19 | `context.md:157` cites `.claude/commands/close-phase.md`, `.claude/rules.md` and `CLAUDE.md` §9; `docs/history.md:7,153` too               | Now `.claude/skills/close-phase/SKILL.md`, `.claude/rules/*.md`; CLAUDE.md has no §9                                                                 | Superseded paths. Keep them only inside `docs/history.md` as history; in `context.md` point to the current files.                                                       | fact     |
| C-20 | `context.md:605`: "§8 Claude Code: reglas, agentes y comandos" links to `docs/history.md#seccion8`                                         | That section describes `.claude/rules.md`, `.claude/commands/` and two agents, all replaced                                                          | A reader following the link gets the superseded setup. Rename the link ("historical, replaced by `.claude/`") or point to `.claude/` and `CLAUDE.md` §7.                | fact     |
| C-21 | `context.md:82`: Node 22 because "jsdom 30 exige `>=22.22.2`"                                                                              | `package.json:71`: jsdom 31.0.0                                                                                                                      | The reason is still true for jsdom 31 as far as `engines` goes, but the number is stale. Reword without the version.                                                    | fact     |
| C-22 | `context.md:911-912`: open questions "does CI e2e drop from 5 min / real CI time after branch 5, measure in the first PR to main"          | `e2e.yml:53-56` and `e2e.md:33-34`: the first PR to `main` (2026-11-11) was measured: 15 min hit, three WebKit shards, 25 min limit                  | Answered. What is left (are the shards fast enough, should `@all-engines` shrink) is the Phase 10 proposal and `context.md:896`.                                        | fact     |
| C-23 | `context.md:920-921`, `:910`: struck-through "done" items kept in "Pendiente" lists                                                        | `docs/backlog.md` is to be the only list of pending items                                                                                            | Done items go to `docs/history.md` or disappear; open ones go to the backlog.                                                                                           | fact     |
| C-24 | `docs/spec/README.md:15`: `rules.md` "covered by unit tests (no screens yet)"                                                              | Phases 5–7 render the rules on screens (today, progress, blocks specs cite them)                                                                     | Reword: unit tests, and the screens that show them.                                                                                                                     | fact     |
| C-25 | `docs/spec/README.md:19`: session tools e2e "pending"; `:21`: routines e2e "(pending)"; `:27`: states "component tests"                    | `tests/e2e/session-tools.spec.ts`, `routines.spec.ts` and `states.spec.ts` exist                                                                     | The e2e specs exist: drop "pending", add `states.spec.ts` to the states row.                                                                                            | fact     |
| C-26 | `README.md:9`: "Phase 0"; `:17`: screenshots "coming in Phase 5/7"; `:173`: deployment "set up in Phase 4"; `:206-215`: versions to v0.9.0 | Phases 0–9 closed (`v0.10.1`); Phases 10–13 planned in `context.md` §10                                                                              | README is stale. But Phase 13 already plans a bilingual README with banner and screenshots (`context.md:847`).                                                          | decision |
| C-27 | `context.md` §12 line 909 (and Phase 5 note): IndexedDB speed on the real iPhone "sin medir"; `:913`: lock-screen sound "pendiente manual" | Not a contradiction: both are still open                                                                                                             | Stay open; they are exactly what the Diagnostics card and `docs/device-checklist.md` close in this phase. Move to the backlog as manual checks until then.              | fact     |

## Decisions (answered by the user on 2026-11-13)

- **C-12** → everything merged into `main` is deployed: `context.md` says "desplegada" up to `v0.10.1`.
- **C-05** → the `chore(release)` commit dates the CHANGELOG; `/close-phase final` proposes it. The three
  past entries (0.9.0, 0.10.0, 0.10.1) get a date now.
- **C-26** → minimal README fix now (status, version table up to v0.13); full rewrite stays in Phase 13.
- **C-11** → add `npm run e2e:timings` to `allow` in `.claude/settings.json`.

Options that were offered, for the record:

1. **C-12 — which version is in production?** Options: (a) none of 0.6–0.10 deployed, keep "sin
   publicar" (recommended only if you paused Netlify deploys); (b) all merges to `main` deployed, so
   say "desplegada" up to `v0.10.1`; (c) other (tell me which).
2. **C-05 — who dates the CHANGELOG?** Options: (a) the `chore(release)` commit changes
   `Unreleased` into `## [X.Y.Z] - YYYY-MM-DD` and `/close-phase final` proposes it (recommended);
   (b) context-keeper does it at the end of the phase; (c) leave "Unreleased" until v1.0.0.
3. **C-26 — README now or in Phase 13?** Options: (a) a minimal fix now (status, roadmap table up to
   v0.13) and the full rewrite in Phase 13 (recommended); (b) leave it all for Phase 13;
   (c) full rewrite now.
4. **C-11 — `npm run e2e:timings` permission.** Options: (a) add it to `allow` in
   `.claude/settings.json` (it only reads a JSON; recommended); (b) say in `e2e.md` that the user
   runs it.

## Reorganisation proposal (to approve before applying)

- **`context.md`**: keep §1 (what it is), a one-screen "current state", the decisions still in force
  (§2 table, one line each; Phase 2.x subsections that are superseded move to history), §10 only for
  the open phases (10–13) with their prompts, §11 v2 roadmap condensed. Remove §3.3 (the tree
  duplicates CLAUDE.md §4), the struck-through items, the "Pendiente" lists and §12 open questions
  (they go to the backlog). Target: well under half of today's size.
- **`docs/history.md`**: receives every closed-phase section, superseded decisions (2.1–2.10 that
  no longer apply) and the old §8 setup, with a short banner saying which parts are superseded.
- **`docs/backlog.md`** (new, the only list of suggestions, ideas and pending work): sections _Technical
  debt_, _Manual checks_, _v1.x improvements_, _v2 product_; each item one line with date added and
  source; nothing done, nothing duplicated.
- **`CLAUDE.md`**: add the rule "a phase closes when its exit criteria are met; everything new goes to
  `docs/backlog.md`" and the fixes of C-01, C-07, C-08, C-09, C-10.
- **Other fixes (fact items)**: `git.md` (C-03), `dependencies.md` (C-10), `e2e.md` (C-02),
  `CHANGELOG.md` (C-06, plus C-05 per your answer), `docs/spec/README.md` (C-24, C-25).
- `/start-phase` and `/close-phase` read `context.md` by index and by phase; their text keeps
  working with the shorter file (to re-check after the move).

## Resolution (applied 2026-11-13)

| Items                        | Where fixed or moved                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-01, C-07, C-08, C-09, C-10 | `CLAUDE.md` (§2 deps row, §4 layout, §6 commands and note)                                                                                                                                 |
| C-02                         | `.claude/rules/e2e.md` (times with 2 workers against 1 worker; pointer to `docs/history.md`)                                                                                               |
| C-03                         | `.claude/rules/git.md` (`v0.10.1` = Phase 9, `v1.0.0` = Phase 13; also fixed: it said `v1.0.0` = Phase 10, which was not in this report)                                                   |
| C-04                         | `docs/history.md`: Phase 9 plan marked as the original plan, closed with `v0.10.1`; banner on the superseded §8                                                                            |
| C-05                         | `CHANGELOG.md` dated 0.8.0 (2026-11-07), 0.9.0 (2026-11-08), 0.10.0 (2026-11-11), 0.10.1 (2026-11-13) from the tag dates; rule in `git.md`, `context-keeper.md` and `close-phase/SKILL.md` |
| C-06                         | `CHANGELOG.md` (two Chromium shards, three WebKit shards)                                                                                                                                  |
| C-10                         | also `.claude/rules/dependencies.md`                                                                                                                                                       |
| C-11                         | `.claude/settings.json` (`npm run e2e:timings` allowed for Bash and PowerShell)                                                                                                            |
| C-12, C-13, C-14             | `context.md` (header, status table, «Decisiones vigentes»: deployed up to `v0.10.1`, Phase 7 released, four agents)                                                                        |
| C-15 to C-21                 | `context.md`: §3 and the tree replaced by a pointer to `CLAUDE.md`; the old text, with its stale paths, is archived in `docs/history.md` under a «historical» banner; §8 is a pointer      |
| C-22, C-23                   | `context.md` §12: open questions and «Pendiente» lists archived in `docs/history.md`; what is still open is in `docs/backlog.md`                                                           |
| C-24, C-25                   | `docs/spec/README.md`                                                                                                                                                                      |
| C-26                         | `README.md` minimal fix (status, screenshots note, deployment text, version table to v0.13, pointer to the backlog)                                                                        |
| C-27                         | `docs/backlog.md` §1 (manual checks)                                                                                                                                                       |

Reorganisation: `context.md` went from 934 to about 450 lines; `docs/history.md` gained the archived
decisions 2.1–2.10, sections 3, 5, 6, 7 and the old open questions; `docs/backlog.md` is new.
`/start-phase` now reads «Decisiones vigentes» and the backlog; `/close-phase final` dates the CHANGELOG.
