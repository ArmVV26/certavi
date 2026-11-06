# ADR-0004 — Client sync engine

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Armando Vaquero Vargas

## Context

ADR-0002 fixes the sync model (last-write-wins, soft deletes, pending queue, `serverSeq`
cursor) and `docs/api/sync-v1.md` the contract, including the client obligations of §8.
ADR-0003 fixes how records, the queue and the clock live in Dexie. Phase 4 has to decide how
the client runs sync: when it starts, how failures are handled, where the attempt log lives,
what a new key does and how a server backup is restored, while keeping the backend
replaceable and the UI unaware of the transport.

## Decision

1. **Layers.** `src/data/sync/` holds everything:
   - `transport.ts` — the `SyncTransport` interface (`sync`, `listBackups`, `getBackup`) and
     `SyncError` with a `kind`: `fatal` (401, 500 `server-misconfigured`: stop until the key
     changes or the user asks), `retryable` (network, timeout, 409, 5xx, an answer that is not
     the API) and `bug` (400, 405, 413 with one record: logged, no automatic retry).
   - `httpTransport.ts` — the only implementation: `fetch` to `/api/v1/*` with
     `Authorization: Bearer`, every answer validated with the zod schemas of
     `src/domain/sync/contract.ts`, 15 s timeout (30 s for the exit flush, sent with
     `keepalive`). Any backend that honours sync v1 works with it; a different protocol
     (e.g. Firebase) would be another `SyncTransport`.
   - `commit.ts` — what to do with an answer, in **one Dexie transaction**: dequeue the sent
     records whose queue `updatedAt` did not change during the request; apply incoming records
     only when strictly newer than the local copy (dropping their `serverSeq`, removing a
     pending entry they beat); move the monotonic clock past them; store
     `since = max(local, serverSeq)` in `meta`. Ids the server `rejected` are dequeued too
     (they could never be accepted). When nothing is newer, no record table is written, so
     the echo of a push never re-renders a screen.
   - `engine.ts` — `createSyncEngine`, a small state machine with injected clock, timers,
     transport factory, key store and online check; `browserTriggers.ts` wires it to the
     page events. React reads it through `SyncProvider` / `useSync()`
     (`useSyncExternalStore`).
2. **One attempt = a loop of requests.** Batches of at most 300 queue entries until the queue
   is empty or a round dequeues nothing; always at least one request (the pull). A 413 halves
   the batch and retries in the same attempt. Only one attempt runs at a time; a trigger during
   an attempt runs another one right after.
3. **Triggers:** start-up, `online`, `focus`, `pageshow`, `visibilitychange` → visible, a
   2 s debounce after the queue grows (observed with Dexie `liveQuery`), every 45 s while the
   queue is not empty, and "Sync now". `online` and "visible" reset the backoff. Offline
   (`navigator.onLine === false`) makes no request.
4. **Retries:** 4, 8, 15, 30, 60 s, then 60 s, only for `retryable` errors. A queue growth
   during a backoff does not cut it short.
5. **Exit flush:** on `visibilitychange` → hidden and `pagehide`, the pending records that fit
   in ~55 KB of JSON are sent with `keepalive`. If the page survives the answer is committed
   like any other; if not, the queue is intact and the next start sends them again.
6. **Attempt log** in a new Dexie table `syncLog` added by **`db.version(2)`** (version 1 is
   untouched; new table, no data migration; tested by opening a version-1 database with data).
   One row per attempt: time, ok or error code, records sent and received, duration, trigger.
   The 40 most recent are kept. The last successful attempt gives "Last sync".
7. **The key** is a device-only setting in `localStorage` (`certavi.syncKey`), never synced,
   logged or shown again after saving. Saving a **different** key resets `since` to 0 and puts
   every record with `updatedAt > 0` in the queue (tombstones included) in one transaction:
   built-in records never edited (`updatedAt: 0`) exist on every device and are not sent.
   Forgetting the key stops the engine and keeps the data.
8. **Restore** is client-side (contract §6), in one transaction: every difference between the
   device and the backup becomes a new local edit with a fresh timestamp, queued like any
   other, so every device converges after syncing. Records missing from the backup are
   soft-deleted, **except built-in ones**, which go back to their seed version (a backup only
   holds what was ever synced, and the built-in catalog was never sent unless edited). The
   comparison ignores `updatedAt` and `serverSeq` and key order.
9. **Downloading a server backup** produces a regular Certavi full backup
   (`certavi-server-backup-<date>.json`: live records, no `serverSeq`), so it can be imported
   back with "Import Certavi backup".
10. **Reporting what came from the server.** `commitResponse` returns, besides the counts,
    `changes: AppliedChange[]` (`type`, `id` and, for sets and notes, the `sessionId`): the
    records that were really written because they were strictly newer. The `sessionId` of a
    deletion is read from the local copy, since a tombstone carries no fields. The engine hands
    them to the listeners of `subscribeRemote(listener)` after each commit, so the echo of this
    device's own push (nothing is written) never notifies. It is a separate channel from
    `subscribe`/`getState`, which stay about the state of the attempt. The session screen uses
    it to show "There are changes from another device in this session" (it never rewrites what
    the user is typing: unsaved values live in the drafts, not in the records).

## Consequences

**Positive**

- The engine is tested without a browser or a network: fake transport, fake timers, fake
  online flag, real Dexie on `fake-indexeddb`.
- The e2e fake server (`tests/mocks/sync-server.ts`) runs the real server handler, so the
  client is tested end to end against the same code that runs on Netlify.
- Switching backend means a new `SyncTransport` (or none, if it speaks sync v1).
- Features can react to remote changes (`subscribeRemote`) without polling the database or
  knowing about the transport.

**Negative / accepted risks**

- A restore rewrites many records at once and every device downloads them; fine for a single
  user's data.
- The key sits in `localStorage` in clear. It is a single-user secret on the user's own
  phone; anyone with the unlocked phone already has the data.
- `keepalive` requests are limited by the browser (~64 KB); larger queues wait for the next
  start.

## Alternatives considered

- **Background Sync API / service worker sync:** not supported by Safari on iOS, the main
  target.
- **Attempt log in `localStorage`:** simpler, but it is device data like the rest and Dexie
  already has versioned migrations; one table keeps it observable with `liveQuery`.
- **Restoring on the server:** would need an endpoint and break "dumb backend"; client-side
  restore converges through the normal sync.
