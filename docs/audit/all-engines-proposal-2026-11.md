# Proposal — which e2e tests keep `@all-engines` (Phase 10)

**Status: proposal. Nothing in `tests/e2e/` has been changed.** It needs the user's OK first
(`.claude/rules/e2e.md`: the tagged set is kept small because WebKit in CI has one worker).

## Why

- Playwright's WebKit is **not Safari on iOS**: it is the same rendering and JavaScript engine,
  without the phone's storage rules, lock screen, home-screen app, audio session or network
  switching (those are covered by `docs/device-checklist.md`). A WebKit run is worth its cost only
  where the **engine** can differ from Chromium.
- Engine-dependent areas in this app: IndexedDB and `localStorage` persistence across reloads,
  the storage API, file input and downloads (import / export), `fetch` failure and `keepalive`
  behaviour in the sync, `visibilitychange` / `pagehide`, focus and keyboard behaviour of fields,
  timers, date and time inputs, SVG rendering of the charts and the 390 px layout.
- Engine-independent: texts in English, dark mode, axe results, validation messages, and logic that
  is computed in TypeScript and shown as text. Chromium already runs all of it.

## Current state (local run of 2026-11-13, `e2e-timings/last-run.json`)

- **111** tests run in WebKit, about **1 340 s** of test time (22 min); Chromium runs all 177.
- The tag appears **29 times in 15 spec files**, but one is a comment in `pwa.spec.ts` saying the
  file is _not_ tagged: 28 real tags in 14 files.
- Most tags sit on a whole `describe`, so a file is either all in WebKit or not at all.

## Proposal

Tag **tests**, not whole `describe`s, and keep in WebKit the **49** below (about **630 s**, less
than half). Time is each test's WebKit time in that run.

| Spec                | Keep in WebKit                                                                                                                                                                                                       | Why                                                                                                | Drop from WebKit (still in Chromium)                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke`             | the only test (1 s)                                                                                                                                                                                                  | the app starts                                                                                     | —                                                                                                                                                                                                          |
| `navigation`        | AC-NAV-03 (8 s)                                                                                                                                                                                                      | every page fits 390 px                                                                             | —                                                                                                                                                                                                          |
| `today`             | AC-TODAY-03 hero flow (11 s) · 12/13/14/15 save and reload (18 s) · 18/16 offline reload (16 s) · 01/02/19 week fits 390 px (10 s)                                                                                   | IndexedDB persistence, layout                                                                      | 10/11 deload (15 s) · 03/04/05 another session (11 s) · 08/09 hiking and short weeks (10 s) · 06/07 dates (6 s) · 17 English / dark / axe (6 s)                                                            |
| `session`           | 09/10 swipe, keyboard, edit (17 s) · 13/14/15 reload (14 s) · 16 drafts reload (9 s) · 40 ×2 leaving with the rest bar (25 s) · 01…06 fields and 0 kg (9 s)                                                          | touch and keyboard, focus, drafts in `localStorage`                                                | 07/08/11/23 types (18 s) · 17/18/19 finish, reopen, delete (17 s) · 41 remove from the menu (11 s) · 22 English / dark (9 s) · 03/12 past day (9 s) · 37 routine note (6 s) · 42 (Chromium-only by design) |
| `session-tools`     | 32/33/34 rest timer (25 s) · REST-01/02 settings after reload (17 s) · 31 JSON download (7 s) · 29/30 date and time edit (13 s)                                                                                      | timers, `localStorage`, downloads, date and time inputs                                            | 34b · 35 remote notice (21 s) · 27/28 move and undo (19 s) · 24/25/26 add exercise (16 s) · §2.8 · 36 English / dark                                                                                       |
| `sync`              | 07 offline reload (21 s) · 05 offline and back (19 s) · 15 visibility and pagehide (33 s) · 06 cut and 500 (17 s) · 03 first push (17 s) · 08 second device (24 s) · 12 backup download (24 s) · 01 new device (2 s) | `fetch` failures, `keepalive`, page lifecycle, IndexedDB, downloads                                | 09 last write wins (29 s) · 13 restore (28 s) · 04 wrong key (19 s) · 11 attempt log (15 s) · 10 forget key (14 s) · 14 English (13 s) · 02 key field (7 s) · axe ×2                                       |
| `import-export`     | EXPORT-01 backup download (23 s) · IMPORT-03 and 03b wrong and empty files (37 s) · IMPORT-05 offline and reload (16 s) · EXPORT-02 CSV downloads (11 s) · IMPORT-01 preview (10 s)                                  | file input, downloads, IndexedDB                                                                   | IMPORT-06 English (12 s) · IMPORT-04 twice (12 s) · IMPORT-03b Escape / disabled (11 s) · IMPORT-02 dark (10 s)                                                                                            |
| `data`              | 02 reload counts (12 s) · edge two tabs (9 s) · 03 storage row (6 s) · 01 order (5 s)                                                                                                                                | IndexedDB, `navigator.storage`                                                                     | 04 English (9 s) · 05 axe light and dark (11 s)                                                                                                                                                            |
| `calendar`          | 03/04/06/08/09 past days (18 s) · 17 offline reload (13 s) · 390 px grid (5 s)                                                                                                                                       | persistence, layout                                                                                | 19 (14 s) · 14/15 (11 s) · 05/11/12/13 (10 s) · 18 (9 s) · 20 (9 s)                                                                                                                                        |
| `routines`          | 12/13/14 reload loses the unsaved change (13 s) · 15/16/17 saved edit offline (12 s) · 22 jump chips at 390 px (6 s)                                                                                                 | reload, focus and scroll                                                                           | 18/19 · 09/10 · 01/02/03/20 · 04…07 · 11 · 08 (54 s)                                                                                                                                                       |
| `blocks`            | 12 offline (17 s) · 09 wall test reload (14 s) · 01/02 scale on one row at 390 px (11 s)                                                                                                                             | persistence, layout                                                                                | 03/04 · 05/06 · 08 chart · 07 validation (53 s)                                                                                                                                                            |
| `exercises`         | 09/13 create, find, reload (6 s)                                                                                                                                                                                     | persistence                                                                                        | 16/17 · 18/19 · 14/15 · 06/07/08 · 10/11 (59 s)                                                                                                                                                            |
| `progress`          | 14 evolution charts (13 s) · 07/11 pick remembered after reload (10 s)                                                                                                                                               | SVG charts, `localStorage`                                                                         | 15 English / dark (11 s) · 02…13 (11 s) · 01 empty (11 s)                                                                                                                                                  |
| `training-stats`    | 04/07 12-week chart and table (8 s)                                                                                                                                                                                  | SVG chart                                                                                          | 08 · 06 · 01 ×2 · 02/03 · 05 (43 s)                                                                                                                                                                        |
| `diagnostics` (new) | nothing                                                                                                                                                                                                              | the switch and the numbers are tested in unit and component tests; the real phone is the checklist | —                                                                                                                                                                                                          |

Result: **111 → 49** tests in WebKit and about **1 340 s → 630 s**. A CI WebKit shard would go
from about 7 min of tests to about 3, which also leaves room in the 25 min job limit.

## Risks and how to read them

- A bug that only WebKit shows in a **dropped** test would now only show on the phone or in
  Chromium. The dropped tests are logic and text checks whose result does not depend on the
  engine; if one of them ever fails only in Safari, tag that test again.
- The kept set is an estimate from test titles and one run, not from reading every test body. Moving
  a tag from a `describe` to single tests is mechanical, but each spec should be skimmed when it is
  done (some tests may share setup with a dropped one).
- `AC-SESSION-42` simulates a slow device in Chromium only; it stays out of WebKit as it is today.

## If you agree

1. Say **go** (or edit the table); this is a separate small branch (`chore/e2e-engines`), not part of
   `feature/diagnostics`.
2. Move the tags, update `.claude/rules/e2e.md` (the list of what to tag stays the same; the
   numbers change) and the `docs/spec/README.md` note about WebKit.
3. Run `npm run e2e:all` once and compare with `e2e-timings/last-run.json`.
