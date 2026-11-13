# Backlog

The **only** list of suggestions, ideas and pending work for Certavi. Other documents point here; they
do not keep lists of their own (rule in `CLAUDE.md`). A phase closes when its exit criteria are met
(`context.md` §10); anything new that comes up goes here, not into the phase.

Format: one line per item, `(date added · source)`. Remove an item when it is done (the history
lives in `docs/history.md` and `CHANGELOG.md`); do not add what is already done or planned in a phase.
Items marked **verify** were written down in a past phase and no record says they were closed: check
the code before acting on them.

The «Out of scope» sections of `docs/spec/*.md` are deliberate limits of each spec, not pending work.

## 1. Manual checks (on the iPhone or in production)

Phase 10 ran `docs/device-checklist.md` on the iPhone (2026-11-13): IndexedDB speed, the offline
flow, leaving the session screen and the sync key indicator are answered there (results table in
that file). What failed is in §5.

- Lighthouse on mobile, on the deployed site, for the README badges. (2026-11-08 · Phase 8)
- Check with `curl -I` how the deployed site answers a missing `/assets/*` (now `index.html` with an
  immutable cache header). (2026-11-08 · Phase 8)

## 2. Technical debt

- **Explicit states (ADR-0006), still missing**: forms with error and saving states (BlockForm,
  ExerciseForm, SetupEditor, BodyWeight, ActivityCard); the «draft against external value» pattern
  (6 places); the swipe gesture in SetRow; RoutineEditorPage; a union for the session overlays.
  (2026-11-12 · Phase 9)
- Show in the UI that the sync engine stopped after a fatal error. (2026-11-12 · Phase 9)
- SyncCard: its mode after forgetting the key, and the list of server backups after replacing it.
  (2026-11-12 · Phase 9)
- `netlify.toml`: answer a missing `/assets/*` with a 404 instead of `index.html`. (2026-11-08 · Phase 8)
- A visible fallback for the first lazy screen (`HydrateFallback` is blank); **verify** against the
  «Opening the screen» bar of 0.10.0. (2026-11-08 · Phase 8)
- Document the knip convention (`ignoreExportsUsedInFile`, `@public`). (2026-11-08 · Phase 8)
- With a `Dialog` open the page behind stays in the accessibility tree (only `aria-modal`): consider
  `inert` on the background (touches the shared `Dialog`). (2026-11-03 · Phase 2)
- Add `TextField`/`TextArea`, `Checkbox`, `ScalePicker` and `Notice` to `/dev/ui`; **verify**.
  (2026-11-04 · Phase 5)
- Review items of Phase 5 not applied, **verify**: unsaved drafts lost when an exercise is removed,
  `saveDetails` in two transactions, `ISO_DATE` accepting 2026-02-31, a toast hidden behind the rest
  bar, duplicated rest constants. (2026-11-06 · Phase 5)
- If counting is slow on the iPhone (see §1), use indexes or `getAll` instead of cursors with
  `filter()` in `countLiveRecords` and `queueEverything`. Conditional on the measurements.
  (2026-11-04 · Phase 5)
- Accessible names of the day links in Today («Monday 2: …» against «Mon»). (2026-11-07 · Phase 7)
- e2e: specs that reload after an import should fix the date with `page.clock`. (2026-11-07 · Phase 7)
- e2e: AC-SYNC-03 must finish within the 2 s the fake server holds the response (`setDelay(2000)`);
  it may turn flaky on a slow machine. (2026-11-04 · Phase 4)
- e2e: trim `components.spec.ts`. The `@all-engines` tags were reviewed in Phase 10 (111 → 48 tests
  in WebKit); measure the new WebKit time with the next `npm run e2e:all` and check the 25 min limit
  of the CI shards. (2026-11-11 · Phase 9)
- If `test:coverage` again reports 57/58 files with no visible failure, save the full output and find
  the file that does not finish; it happened once in Phase 4 and was never reproduced. (2026-11-03 · Phase 4)
- iOS keyboard: readjust the layout after the keyboard closes, only if that is confirmed as the cause
  of the «cannot leave the session» report. (2026-11-11 · Phase 9)
- Renovate instead of Dependabot, with automerge of patches when CI is green, if the grouped
  Dependabot PRs are not enough. (2026-11-10 · Phase 9)

## 3. Improvements for v1.x

- Reorder exercises by dragging in the routine editor (reuse the numbered chips row). (2026-11-10)
- Basic mode: shrink each screen to the essentials (fewer sections, cards and data) to train with
  fewer distractions. Built on the «no colour» switch: same place in Settings > Appearance and same kind
  of device-only setting. To define: what is «essential» in Today, session, Progress, Calendar and
  Routines. (2026-11-11 · idea of the user)
- Readable summaries inside the session and week JSON exports; **verify**. (2026-11-03 · Phases 5/7)
- Export the gym_app recovery CSV; **verify** (the gym_app importer disappears in Phase 13). (2026-11-03 · Phase 7)
- Weight lifted per routine. (2026-11-07 · Phase 7)
- More features: cycle templates with start and end dates; an automatic cycle-closing summary
  exportable as `.md`; comparison between cycles; supersets.
- Import from other apps (Hevy, Strong…): their CSV with a step that maps each exercise to the Certavi
  catalog (or creates it as a custom one), because ids differ; a «source app» menu would replace the
  gym_app importer. Link apps through an API only if an official one exists. (2026-11-06)
- Create and delete routines (today only the six seed routines are edited). (2026-11-06 · Phase 6)
- First run: start empty or from templates; personal blocks (such as the ankle rehab) off by default.
  Overlaps with the multi-user work in §4. (2026-11-06)

## 4. Product v2

Order by dependencies (added 2026-11-13). Details to be decided in ADRs before any code.

1. **Definition of v2 (ADRs only)**: backend, hosting, authentication, multi-user model, sync v2
   contract and privacy. Weight, body metrics and food are health data under the GDPR: consent, a
   privacy policy and account deletion.
2. **Backend v2**: Java + Spring Boot, DDD and vertical slices, Postgres; login with email
   verification through an identity provider; web on Cloudflare (check where the Java API runs).
   Replaces `server/` and `netlify/`.
3. **Multi-user client**: sign-up and sign-in, an introduction with body metrics, create and delete
   routines, progress per user.
4. **Closed beta** with friends.
5. **Common catalog with images** (own photos or licensed ones).
6. **Food log.**
7. **Stores**: Android first; iOS later (a Mac or cloud builds, a paid account and something native).
   An earlier idea was Capacitor if a Mac and a developer account ever exist.

Also: machine photos taken with the phone, compressed on the client and stored in Netlify Blobs, with
a thumbnail in the exercise sheet and in the session; shown next to the «machine settings» of Phase 9
(2026-11-10). The sync contract of v2 needs an ADR and a security review.

## 5. Findings to review (iPhone run, 2026-11-13)

Found by the manual run of `docs/device-checklist.md` on a real iPhone (Safari 26.6.1, the home-screen
app, app 0.10.1). They did not block Phase 10 (the user decided so). **Whoever analyses the project
next: read these two, check the code and leave each one as a suggestion** (a `fix/*` branch with its
own spec and test). Not confirmed in the code yet; the places to look are only a starting point.

- **The rest timer never sounds on the iPhone** (checks D-5.1 to D-5.4). With the app open in the
  foreground, ringer switch on and volume up, the rest bar counts down and ends, but nothing plays. On
  desktop the same sound plays. Not a Vibration API issue: vibration does not work on iOS Safari and the
  app already says so (D-5.5). So the screen-locked, other-app and ringer-off cases (D-5.2 to D-5.4)
  could not be judged either. To look at: `src/features/session/restAlerts.ts` (how the sound is made
  and when it is unlocked), `unlockAudio()` called from `markDone` in
  `src/features/session/useSessionActions.ts` (it must run inside the tap that starts the audio
  context), and whether the audio context stays `suspended` on iOS. Needs the phone connected to
  Safari's Web Inspector to confirm. (2026-11-13 · Phase 10)
- **The rest counter disappears when changing section** (check D-3.4). With the rest timer running, tapping
  another tab of the bottom bar leaves the session screen as it should, but the counter is gone. What
  the user expects: when the user comes back to the session, the rest bar is there again and keeps counting
  the time that passed, and it does not vanish for good. Probably the timer state lives in the
  session screen and is lost when it unmounts. To look at: `src/features/session/useRestTimer.ts`,
  `RestTimerBar.tsx` and `SessionPage.tsx`. Keep AC-SESSION-40 (leaving with the rest bar open) green:
  every tab must still open. (2026-11-13 · Phase 10)
