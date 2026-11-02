# ADR-0002 — Offline-first storage with last-write-wins sync

- **Status:** Accepted
- **Date:** 2026-11-02
- **Deciders:** Armando Vaquero Vargas

## Context

The app is used during workouts, frequently in places with poor or no coverage. Losing a
logged set is the worst possible failure. The same person may use more than one device
(phone and desktop), but rarely edits the same record on two devices at the same time.

`gym_app` used a simple model — local-first records with timestamps, a pending queue,
retries and last-write-wins — and it held up in daily use.

## Decision

1. **The device is the source of truth.** Every write goes to IndexedDB (Dexie) first; the UI
   reads from IndexedDB (`useLiveQuery`), never from the network.
2. **Same-transaction queue.** A write and its pending-queue entry are committed in one
   transaction, so no saved record can be left unsynced.
3. **Uniform envelope** for every syncable record: `id`, `type`, `updatedAt`, optional
   `deleted`, server-assigned `serverSeq`.
4. **Last-write-wins per record** on `updatedAt` (strictly greater wins; ties keep the stored
   version). Clients use a monotonic clock.
5. **Soft deletes** (`deleted: true`) so deletions propagate.
6. **Incremental pull** with `since = last serverSeq`, in the same request as the push.
7. **Resilient delivery:** retries with backoff (4, 8, 15, 30, 60 s), sync on focus /
   visibility / reconnect, every 45 s while pending, and a `keepalive` flush when the app is
   hidden.
8. **Echo suppression:** incoming records that are not newer than local data change nothing
   and do not re-render the screen (unsaved input survives).
9. **Daily server backups** (14 kept) as the safety net against bad merges or mistakes.

The full rules are in the [sync v1 contract](../api/sync-v1.md).

## Consequences

**Positive**

- The app works fully offline; sync is invisible when it works and harmless when it fails.
- Simple to reason about and to test (pure merge function, deterministic queue).
- Backend-agnostic: any server that applies the same merge rule is compatible.

**Negative / accepted risks**

- **Concurrent edits of the same record** on two devices: the later `updatedAt` wins and the
  other edit is lost. Mitigated by fine-grained records (one record per set, per note…) and
  by the "changes from another device" notice in the active session.
- **Clock skew** between devices can make an older edit win. Accepted for a single user;
  device clocks are normally synced.
- Soft-deleted records are kept forever (small; could be compacted later).

## Alternatives considered

- **CRDTs (Automerge, Yjs)** — merge concurrent edits without loss, but add size, complexity
  and a data format that is harder to inspect, export and port to another backend.
- **Server as source of truth with an offline cache** — simpler client, but writes would fail
  or need a separate queue anyway when offline.
- **Field-level LWW** — fewer lost edits on the same record, but more metadata and a more
  complex contract for little benefit with one user.
