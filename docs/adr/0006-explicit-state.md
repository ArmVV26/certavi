# ADR-0006 — Explicit state: discriminated unions, derived views, stored records untouched

- **Status:** Accepted
- **Date:** 2026-11-12
- **Deciders:** Armando Vaquero Vargas

## Context

An audit of the app found about 30 state machines written implicitly: several booleans, nullable
fields or loose strings that must agree, with the agreement kept only by the order of the calls.
Three of them were real bugs:

1. **Import** (`ImportExport.tsx`): `preview` + `busy`. Escape closed the dialog while the records
   were being written, and a second file chosen meanwhile had its preview wiped by the first
   import's `finally`. Reading the file had no error handling.
2. **Session dialogs** (`useSessionActions.ts`): `confirm()` ended in an `else` that deleted the
   session, so a new dialog kind would have deleted it silently.
3. **Session details** (`SessionDetailsSheet.tsx`): no "saving" state, so a double tap saved twice.

Others allowed impossible states without failing today: `SyncState` could be
`{ status: 'disabled', hasKey: true }` or keep an old `error` while `syncing`; the rest timer's
phase was computed in two places and kept running on a session finished from another device; the
sync attempt log allowed `ok: true` with an `error`.

The stored records have the same shape of problem (a session is "in progress" when
`endedAt === null`; a week is closed when `plannedSetsByGroup` exists), but they cannot change:
they are validated by strict zod schemas on every device, kept in Dexie and in daily server
backups, and sync-v1 only allows **additive** payload changes (`docs/api/sync-v1.md`, last
section). Renaming or replacing `startedAt` / `endedAt` / `closedAt` / `archived` / `active` would
make older devices discard newer records.

## Decision

1. **In memory and in the UI, a lifecycle is one discriminated union** (`kind` or `status`),
   walked with a `switch` that lists every member and no catch-all. This is the style the code
   already had in `DialogState`, `BackupsState`, `Route` and the `{ ok }` results.
   `@typescript-eslint/switch-exhaustiveness-check` enforces it.
2. **Async actions have an in-progress state** that blocks sending them twice and ignores input
   that would race them (Escape, a second file, a second tap).
3. **Stored and synced records keep their shape.** Where the lifecycle is implicit in them, the
   domain exposes a **derived view** used everywhere instead of re-reading the fields:
   `isInProgress(session)`, `isWeekFrozen(week)`; the Today screen has `heroOf(...)`.
4. **Transitions that write are idempotent**: `finishSession` on a finished session and
   `reopenSession` on an open one write nothing, so they cannot win last-write-wins over a real
   change made on another device.
5. **No state-machine library.** The machines are small; `useState` with a union is enough and
   adds no dependency.
6. **No `.refine()` on the record schemas** to forbid impossible combinations (e.g.
   `endedAt < startedAt`): they would reject records that older versions or the legacy importer
   already wrote. Those rules stay in the rule modules that write (`sessionTimes`).

## Consequences

- `SyncState` is `SyncCounters & SyncPhase`; `hasKey` is gone and replaced by `hasSyncKey(state)`;
  `syncErrorOf(state)` gives the error of `error` / `offline`. The state carries no `error` while
  it syncs again. `SyncLogEntry` is `{ ok: true } | { ok: false; error }` in the type; the stored
  shape is unchanged.
- The rest timer is closed by the session screen whenever the session is not in progress, also
  when the change arrives through sync.
- A key change while a key is already saved is not visible to the backups list (the engine does
  not expose the key): the list reloads when a key is added or forgotten, and with "Refresh".
- Not covered, and left for later: forms that pair `errors` with `saving` (blocks, exercises,
  body weight), the "typed draft vs. outside value" pattern repeated in six components, the swipe
  gesture of a set row, the routine editor, and showing the "blocked after a fatal error" state of
  the sync engine in the UI.
