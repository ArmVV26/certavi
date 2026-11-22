# Functional specification

What Certavi does, described from the **user's point of view**.

> This folder is the **only** source the `armando-base:qa-tester` agent reads (together with the README
> and the e2e tests). It must be enough to test a feature without seeing the code: describe
> screens, visible texts, user actions and expected results — not components or functions.

## Index

| Spec                                                                                                                                                                                                        | Status                                                                                                                                         | Phase            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Smoke: the app loads, its tab title says "Certavi" and it opens on Today                                                                                                                                    | ✅ covered by `tests/e2e/smoke.spec.ts`                                                                                                        | 0 (updated in 1) |
| [theme-language-navigation.md](theme-language-navigation.md) — theme (system/light/dark), language (es/en), navigation shell, base components (`/dev/ui`)                                                   | ✅ covered by `tests/e2e/{navigation,theme,language,components}.spec.ts`                                                                       | 1                |
| [rules.md](rules.md) — training rules: 1RM, progression, weekly sets, records, deload, short week, seed catalog                                                                                             | ✅ written; covered by unit tests and by the screens that show these rules                                                                     | 2                |
| [data-import-export.md](data-import-export.md) — data on the device ("Datos" card); import from gym_app, JSON/CSV export and import                                                                         | ✅ written; Part A covered by `tests/e2e/data.spec.ts`                                                                                         | 3                |
| [sync.md](sync.md) — sync key, header indicator, attempt log, server backups (list, download, restore)                                                                                                      | ✅ written; e2e in `tests/e2e/sync.spec.ts`                                                                                                    | 4                |
| [today.md](today.md) — Today: session of the day, week switches, another session or day, activity, weight, blocks of the day                                                                                | ✅ written; e2e in `tests/e2e/today.spec.ts`                                                                                                   | 5                |
| [session.md](session.md) — active session: log sets, last-time reference, warm-ups, extra sets, notes, readiness, finish, delete; session tools (rest timer, exercises, details, JSON, undo, remote banner) | ✅ written; e2e in `tests/e2e/session.spec.ts` and `session-tools.spec.ts`                                                                     | 5                |
| [exercises.md](exercises.md) — catalog, filters, custom exercises, exercise detail                                                                                                                          | ✅ written; e2e in `tests/e2e/exercises.spec.ts`                                                                                               | 6                |
| [routines.md](routines.md) — routine list, viewer and editor, restore original                                                                                                                              | ✅ written; e2e in `tests/e2e/routines.spec.ts`                                                                                                | 6                |
| [calendar.md](calendar.md) — calendar, day and week panels, log on a past day, weight of any week, week JSON, week closing                                                                                  | ✅ written; e2e in `tests/e2e/calendar.spec.ts`                                                                                                | 7                |
| [progress.md](progress.md) — progress screens and charts, cycle review, exercise evolution                                                                                                                  | ✅ written; e2e in `tests/e2e/progress.spec.ts`                                                                                                | 7                |
| [blocks.md](blocks.md) — optional blocks: 0–10 scale on one row, list and editor, tracking charts with the 3/10 limit, weekly wall test, calf rule during rehab                                             | ✅ written; e2e in `tests/e2e/blocks.spec.ts`                                                                                                  | 7                |
| [training-stats.md](training-stats.md) — weekly streak, weight lifted, exercises and sets per week or month                                                                                                 | ✅ written; e2e in `tests/e2e/training-stats.spec.ts`                                                                                          | 7                |
| [pwa.md](pwa.md) — installable app, manifest and icons, offline start, "new version" prompt                                                                                                                 | ✅ written; e2e in `tests/e2e/pwa.spec.ts` (AC-PWA-01…05; the prompt by component tests)                                                       | 8                |
| [states.md](states.md) — empty and error states: a screen that fails, local data that cannot be opened, lists with nothing in them, a write that fails                                                      | ✅ written; e2e in `tests/e2e/states.spec.ts` and component tests (`src/app/RouteError.test.tsx`, `DatabaseGate.test.tsx`)                     | 8                |
| [diagnostics.md](diagnostics.md) — Settings → Diagnóstico: switch, four performance timers (database, Today, ✓ to set shown, Progress), last 20 measurements, copy                                          | ✅ written; component tests (`DiagnosticsCard.test.tsx`, `diagnosticsMeasures.test.tsx`); checked on the phone with `docs/device-checklist.md` | 10               |

## Smoke acceptance criteria (Phase 0, updated in Phase 1)

- **Given** the app is opened at `/` on an iPhone-sized screen (390×844)
- **Then** the browser tab title contains "Certavi"
- **And** the page shows the main heading "Hoy" (Today).

> Updated in Phase 1: the main heading is now the title of the current page (it was the
> placeholder "Certavi" in Phase 0). "Certavi" stays in the tab title.

## How to write a spec

One file per feature area. Each file contains:

1. **Purpose** — one paragraph.
2. **Screens and elements** — what the user sees, with the visible texts in Spanish and
   English (or the i18n key when the text is not final).
3. **Acceptance criteria** — numbered, in _Given / When / Then_ form, each one testable:

   ```
   AC-SESSION-03 · Remove a planned set
   Given an active session with 3 planned working sets for "Remo en T"
   When I remove the second set and confirm in the dialog
   Then the exercise shows 2 working sets
   And "Undo" is offered for a few seconds
   ```

4. **Edge cases** — offline, reload in the middle, 0 kg, empty input, undo, dark mode,
   English, small screens.
5. **Out of scope** — what this spec does not cover.

Write the spec **before** implementing the feature.

> Flows that save data on the device, sync, import / export or lay out Today are also tested in
> Safari's engine (WebKit); theme, language, navigation and base components only in Chromium.
