# ADR-0003 — Local storage layout in Dexie

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Armando Vaquero Vargas

## Context

ADR-0002 makes the device the source of truth: every write goes to IndexedDB first and joins
the pending queue in the same transaction. Phase 3 has to decide how records are laid out in
IndexedDB (through Dexie), how the built-in catalog gets there, how timestamps are produced
and how the schema evolves without losing data on the user's phone.

## Decision

1. **One table per record type** (`exercises`, `routines`, `weekPlans`, `sessions`, `sets`,
   `notes`, `activities`, `bodyWeights`, `blocks`, `blockLogs`, `weeklyMetrics`, `settings`),
   keyed by the record `id`, with indexes only where screens query (`sessions.date`,
   `sets.sessionId`, `sets.exerciseId`, `[exerciseId+completedAt]`, `notes.sessionId`,
   `activities.date`, `blockLogs.date`/`blockId`, `weeklyMetrics.week`). The map
   type → table lives in `src/data/db.ts` and is checked against `RECORD_TYPES`.
2. **Tombstones stay in the same table.** A soft delete replaces the row with the envelope only
   (`{ id, type, updatedAt, deleted: true }`), the same shape that arrives from the server.
   Every read goes through the repositories, which skip tombstones.
3. **Pending queue** = table `pending` with one row per record id (`{ id, type, updatedAt }`).
   Writing a record again overwrites its row, so the queue never holds duplicates. The record
   and its queue row are written in **one Dexie transaction**; if either fails, neither is
   saved.
4. **Monotonic clock** in table `meta` (`clock`): `updatedAt = max(Date.now(), last + 1)`,
   read and written inside the same transaction as the record. It survives reloads.
5. **Validation on write:** repositories parse every record with its zod schema
   (`RECORD_SCHEMAS`) before saving. Invalid data never reaches the database.
6. **Seed in the database, not in memory.** On start-up `ensureSeed` writes the built-in
   exercises, routines, blocks and default synced settings. It inserts missing records and
   refreshes records whose `updatedAt` is still `0` (never edited), so a new app version can
   fix the catalog without touching anything the user changed. Seed writes **do not** join the
   pending queue: every device seeds itself and any real edit wins over `updatedAt: 0`.
7. **Schema versions:** `db.version(1)` is the first released schema. A released version is
   never edited: changes add `db.version(n + 1).stores(...)` with an `.upgrade()` that migrates
   data in place, and each upgrade has a test that opens a database at version `n` with data
   and checks it after upgrading.
8. **Persistent storage:** on start-up the app calls `navigator.storage.persist()` so the
   browser (Safari in particular) does not evict the data under storage pressure. Settings
   shows the result.

## Consequences

**Positive**

- Typed tables and simple indexed queries for the screens; the sync engine iterates over the
  same type → table map.
- No orphan writes: a record is never saved without its queue entry.
- Catalog fixes reach existing installs without a migration, and never overwrite user edits.

**Negative / accepted risks**

- Counting live records filters tombstones in memory; fine for a single user's data (a few
  thousand sets). An index on `deleted` can be added in a later version if needed.
- Tombstones are kept forever (small); compaction can come later.
- `persist()` is a request: the browser may refuse. The UI says so instead of hiding it.

## Update — Phase 5 (active session)

- **Rows of an exercise.** A session's copy of an exercise's scheme (`WorkoutSession.items`) is
  the list of rows the user sees: the routine's planned sets plus the warm-up, dropset and extra
  rows added that day. A logged `SetEntry` belongs to the row at its `slot` (0-based position),
  and its `kind` is the type of the row, which the user can change without the row moving. Rows
  and sets change together in one transaction (`src/data/sessionLog.ts`). The routine never
  changes.
- **gym_app numbering.** Imported sets used `w<n>`, `p<n>` and `x<n>` slots. After every
  import and at start-up, `normalizeLegacySessions` rewrites such sessions to the row list
  (idempotent; an exercise is legacy when it has warm-up or extra sets and its scheme has no
  matching rows).
- **Drafts.** What is typed in a row but not saved is kept in localStorage under
  `certavi.draft.<sessionId>` (device-only, never synced, zod-validated on read) and dropped when
  the session is finished or deleted.
- **Session tools.** Adding, moving and removing exercises, changing the routine and editing the
  date and hours rewrite `WorkoutSession.items` / `routineId` / `date` / `startedAt` / `endedAt`
  in one transaction (`src/data/sessionTools.ts`). `PlanItem.added` (optional, `true`) marks an
  exercise that is not in the session's routine (added by hand, or kept when the routine was
  changed); it only exists in session plans. Older clients ignore the field.
- **Undo.** Every removal (row, exercise, session) returns a plain-data snapshot of what it took
  out (`UndoRow`, `UndoExercise`, `UndoSession`). "Undo" writes it back with new `updatedAt`
  values and the same ids, so the tombstone is overwritten and the restore syncs like any other
  write. Nothing is kept on disk: the snapshot lives in memory while the notification is shown.
  A restore that no longer makes sense (session gone, exercise added again) throws
  `UndoConflictError` and writes nothing.
- **Rest settings.** The rest times are the synced `settings` record (`src/data/restSettings.ts`);
  sound and vibration are device-only (`certavi.restSound`, `certavi.restVibration`).

## Alternatives considered

- **A single `records` table** (as in gym_app) with an index on `type` — simpler sync, but
  every screen query would need compound indexes on `[type+field]` and lose typing.
- **Seed kept in memory and merged on read** — no writes at start-up, but every query would
  have to merge two sources, and edits of seed records would need special cases.
