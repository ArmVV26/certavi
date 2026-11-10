---
paths:
  - 'src/data/**'
  - 'server/**'
  - 'netlify/**'
  - 'docs/api/**'
---

# Sync (client, server and contract)

- `src/data/sync` — client sync: `engine.ts` (`createSyncEngine`), `transport.ts`
  (`SyncTransport`, `SyncError`), `httpTransport.ts` (generic for any sync-v1 backend),
  `queue.ts`, `commit.ts` (applies a response in one transaction), `restore.ts` (server
  backups), `syncKey.ts` (device-only key), `attemptLog.ts`, `browserTriggers.ts`,
  `SyncProvider.tsx` (`useSyncEngine`, `useSyncState`). Decisions in ADR-0004.
- `server/sync` — the sync server as a plain `Request → Response` handler
  (`createSyncHandler`) over a `SyncStore` (memory or Netlify Blobs). It is shared by the
  Netlify Function (`netlify/functions/sync.ts`, a thin adapter), the unit tests and the e2e
  fake server. Its production code imports only `src/domain` (contract + merge rule); only
  `server/sync/httpTransport.test.ts` reaches into `src/data` (client transport vs real handler).
- **The backend is as dumb as possible**: it stores and returns records, applies
  last-write-wins and keeps daily backups. All business logic lives in the client.
- Keep the sync contract in `docs/api/sync-v1.md` and `src/domain/sync/contract.ts` in sync.

**Sync model** (details in `docs/api/sync-v1.md`, decisions in `docs/adr/`):
every write updates `updatedAt` and adds the record to the pending queue **in the same Dexie
transaction**; deletions are soft (`deleted: true`); the server assigns a monotonic
`serverSeq`; clients pull with `since`; retries back off 4, 8, 15, 30, 60 s; a `keepalive`
flush runs when the app is hidden.
