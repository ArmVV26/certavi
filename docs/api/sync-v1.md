# Sync API v1 — contract

> **Status:** Implemented (Phase 4) · written in Phase 0 from the behaviour of `gym_app` 1.5.1
> (`netlify/functions/sync.mjs` + `public/js/store.js`), adapted to Certavi's naming.
> Server: `server/sync/handler.ts` (Netlify adapter `netlify/functions/sync.ts`).
> Client: `src/data/sync/` (engine, HTTP transport; decisions in
> [ADR-0004](../adr/0004-client-sync-engine.md)).
> Contract test: `server/sync/contract.test.ts` checks the examples, the error table and the
> numbers in this document against the schemas in `src/domain/sync/contract.ts` and the server.
>
> This document is the **only thing another backend has to honour** to replace the Netlify
> implementation (see [ADR-0001](../adr/0001-backend-netlify-blobs.md)). The zod schemas in
> `src/domain/sync/contract.ts` mirror it and must be kept in sync with it.

---

## 1. Principles

- The server is **dumb storage with last-write-wins**. It never interprets record payloads.
- Every record carries the same **envelope**; everything else in the record is opaque payload.
- The server assigns a monotonic **`serverSeq`**; clients pull "everything after the last
  `serverSeq` I saw".
- Deletions are **soft** (`deleted: true`) and sync like any other change.
- One shared secret per installation (single user). No accounts.

## 2. Transport

- HTTPS only. JSON bodies (`Content-Type: application/json`, UTF-8).
- Base path: **`/api/v1`**.
- Every response carries:
  `Content-Type: application/json`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`.

## 3. Authentication

- Header: `Authorization: Bearer <CLAVE_SYNC>`.
- The server reads the secret from the environment variable **`CLAVE_SYNC`**.
  - Missing or shorter than **32 characters** → `500 server-misconfigured`
    (gym_app accepted 16; Certavi requires 32).
- Comparison in **constant time**: hash both values with SHA-256 and compare the digests with
  a timing-safe equality function (`crypto.timingSafeEqual` in Node).
- Wrong or missing key → wait **400 ms**, then `401 unauthorized` (slows down blind guessing).
- Authentication is checked **before** anything else (method, body).

## 4. Record envelope

```ts
interface SyncEnvelope {
  id: string; // 1–120 chars, stable, unique across all types
  type: string; // 'exercise' | 'routine' | 'session' | 'set' | ... (opaque to the server)
  updatedAt: number; // ms since epoch, set by the client on every write; the highest wins
  deleted?: true; // soft delete
  serverSeq?: number; // assigned by the server; clients never send it (ignored if they do)
}

type SyncRecord = SyncEnvelope & Record<string, unknown>; // payload fields are top-level; values may be nested JSON
```

Validation on the server (per record): `id` is a non-empty string of at most 120 characters,
`type` is a non-empty string, `updatedAt` is a finite number ≥ 0. Records that fail are **not
stored** and their ids (when readable) are returned in `rejected`. A client-sent `serverSeq`
is stripped.

## 5. `POST /api/v1/sync` — push and pull in one call

### Request

```json
{
  "since": 1234,
  "records": [
    {
      "id": "set_m3k…",
      "type": "set",
      "updatedAt": 1762070400123,
      "sessionId": "…",
      "weight": 80,
      "reps": 8,
      "rir": 2
    },
    { "id": "note_x9…", "type": "note", "updatedAt": 1762070400456, "deleted": true }
  ]
}
```

| Field     | Type           | Notes                                                                                      |
| --------- | -------------- | ------------------------------------------------------------------------------------------ |
| `since`   | integer ≥ 0    | Highest `serverSeq` the client has applied. `0` = send me everything.                      |
| `records` | `SyncRecord[]` | Pending local changes. May be empty (pull only). Clients send at most **300** per request. |

### Merge rule (per incoming record)

```
existing = stored[record.id]
if existing is missing OR record.updatedAt > existing.updatedAt:
    serverSeq = serverSeq + 1
    stored[record.id] = { ...record, serverSeq }
else:
    keep existing                      // ties keep the stored version
```

The whole read–merge–write runs under **optimistic concurrency**: read the document with its
etag, write only if the etag still matches (or only-if-new when nothing exists yet). On a
mismatch, re-read and retry, up to **5 attempts**; then `409 conflict`.

### Response `200`

```json
{
  "serverSeq": 1240,
  "records": [
    { "id": "set_m3k…", "type": "set", "updatedAt": 1762070400123, "serverSeq": 1239, "…": "…" }
  ],
  "rejected": []
}
```

| Field       | Type           | Notes                                                                                                                        |
| ----------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `serverSeq` | integer        | Current highest sequence on the server. The client stores `max(local, this)`.                                                |
| `records`   | `SyncRecord[]` | Every stored record with `serverSeq > since`, **including the ones just pushed** (the "echo"). Deleted records are included. |
| `rejected`  | `string[]`     | Ids of incoming records that failed validation (usually empty).                                                              |

## 6. Backups

The server keeps **one backup per day** (calendar day in **Europe/Madrid**) and the
**14 most recent** ones.

- Taken on the **first write of the day**, from the data **as it was before that write**.
- Skipped when there is nothing stored yet or when today's backup already exists.
- Pruned to 14 right after creating one.
- A backup failure is logged and **never blocks** the sync request.

### `GET /api/v1/backups`

`200`:

```json
{ "backups": [{ "date": "2026-11-02", "count": 1532, "createdAt": 1762041600000 }] }
```

Newest first. `count` (number of records) and `createdAt` may be `null` if unknown.

### `GET /api/v1/backups/{date}`

`date` is `YYYY-MM-DD`. `200` (the records as stored that day):

```json
{
  "date": "2026-11-02",
  "records": [
    { "id": "set_m3k…", "type": "set", "updatedAt": 1762070400123, "serverSeq": 1239, "…": "…" }
  ]
}
```

Errors: `400 invalid-date`, `404 not-found`.

### Restoring

Restore is **client-side**: the client downloads a backup and rewrites the differences as
**new edits** (`updatedAt = now`): records missing from the backup are soft-deleted, changed
ones go back to their backed-up content. Because they are ordinary edits, every other device
converges to the restored state on its next sync. The server has no restore endpoint.

## 7. Errors

Error responses have the body `{ "error": "<code>" }`. Codes are stable and machine-readable;
the client maps them to translated messages.

| Status | Code                   | When                                               | Client behaviour                          |
| ------ | ---------------------- | -------------------------------------------------- | ----------------------------------------- |
| 400    | `invalid-json`         | Body is not valid JSON                             | Bug — log, do not retry                   |
| 400    | `invalid-request`      | `since` / `records` have the wrong shape           | Bug — log, do not retry                   |
| 400    | `invalid-date`         | Backup date is not `YYYY-MM-DD`                    | Show error                                |
| 401    | `unauthorized`         | Missing or wrong key (after a 400 ms delay)        | **Fatal**: stop retrying, ask for the key |
| 404    | `not-found`            | Unknown backup date or route                       | Show error                                |
| 405    | `method-not-allowed`   | Wrong HTTP method (response has an `Allow` header) | Bug                                       |
| 409    | `conflict`             | Concurrency retries exhausted                      | Retry with backoff                        |
| 413    | `payload-too-large`    | Body larger than **8 MiB**                         | Send smaller batches                      |
| 500    | `server-misconfigured` | `CLAVE_SYNC` missing or too short                  | **Fatal**: stop retrying, show error      |
| 500    | `internal-error`       | Unexpected failure (storage down, corrupt data)    | Retry with backoff                        |
| 5xx    | —                      | Anything else (e.g. from the hosting platform)     | Retry with backoff                        |

## 8. Client obligations

Not enforced by the server, but required for the model to be safe. Inherited from gym_app.

- **Same-transaction queue:** a local write and its entry in the pending queue are persisted in
  the same IndexedDB transaction.
- **Monotonic clock:** `updatedAt = max(Date.now(), lastUpdatedAt + 1)`.
- **Batches** of at most 300 records; loop until the queue is empty (always at least one
  request, to pull).
- **Timeout** 15 s per request (`AbortController`).
- **Retries** after a non-fatal failure with backoff **4, 8, 15, 30, 60 s** (then 60 s);
  reset when the network comes back or the app becomes visible.
- **Triggers:** start-up, `online`, `focus`, `pageshow`, `visibilitychange` → visible, a
  debounced timer after local writes, and every **45 s** while there are pending records.
- **Flush on exit:** on `visibilitychange` → hidden and `pagehide`, send pending records with
  `fetch(..., { keepalive: true })`, at most **~55 KB** of payload (browser limit ~64 KB),
  30 s timeout. If it fails, the normal sync retries later.
- **Dequeue safely:** remove a record from the pending queue only if it was not edited again
  while the request was in flight (`updatedAt` unchanged).
- **Apply incoming** only when `incoming.updatedAt > local.updatedAt`, and never over a
  pending local edit that is newer. The **echo** of just-pushed records therefore changes
  nothing and **must not trigger a re-render**.
- **New key:** reset `since` to 0 and mark every local record as pending (built-in seed
  records never edited, `updatedAt: 0`, may stay out: every device already has them).
- **Attempt log:** keep the last 40 attempts (time, ok/error, sent, received, duration) for the
  Settings screen.

## 9. Changes from gym_app

| gym_app                                                                     | Certavi v1                                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `POST /api/sync`                                                            | `POST /api/v1/sync`                                                                                       |
| `{ action: 'backups' }` / `{ action: 'backup', date }` on the same endpoint | `GET /api/v1/backups`, `GET /api/v1/backups/{date}`                                                       |
| Fields `t`, `u`, `del`, `srv`                                               | `type`, `updatedAt`, `deleted`, `serverSeq`                                                               |
| Response `{ srv, records }`                                                 | `{ serverSeq, records, rejected }`                                                                        |
| Errors as Spanish sentences                                                 | Error codes (`{ error: "unauthorized" }`) translated by the client                                        |
| Secret ≥ 16 chars                                                           | Secret ≥ 32 chars                                                                                         |
| Blob store `gimnasio`, key `registro`, backups `copia/<date>`               | Store `certavi`, key `records`, backups `backup/<date>` (implementation detail, not part of the contract) |

Data exported from gym_app is converted by the legacy importer, not by the server
(see [migration.md](../migration.md)).

## 10. Netlify implementation notes (non-normative)

- Function `netlify/functions/sync.ts` with `config.path` covering the three routes.
- `@netlify/blobs` `getStore({ name, consistency: 'strong' })`; the document is
  `{ serverSeq: number, records: Record<id, SyncRecord> }`; conditional writes with
  `onlyIfMatch: etag` / `onlyIfNew: true`.
- Named stores are shared by every deploy of a site, so the store name depends on the deploy
  context: `certavi` in production, `certavi-<context>` elsewhere (`certavi-branch-deploy` for
  the `dev` branch deploy), so a test deploy never touches the real data.
- Backup blobs carry metadata `{ createdAt, count }` so the list does not have to read them.

## 11. Versioning

Breaking changes to this contract create **`/api/v2`**; v1 stays available until every client
has migrated. Additive changes (new optional response fields) do not bump the version.

Additive changes to the **record payloads** do not bump it either, because the server never
interprets them. Example: `exercise` records gained the optional field
`setup?: { label: string (1-24 chars), value: string (1-12 chars) }[]` (at most 4 items), the
machine settings of the exercise. A backend stores and returns it like any other payload field.
A client that does not know the field drops it when it rewrites the exercise (archiving it,
changing its step…). That rewrite carries a newer `updatedAt`, so under last-write-wins it also
replaces the settings on the server and on the other devices: the loss is permanent until the user
types them again. It is accepted because there is a single user who updates the app on every
device. The limits of `setup` (4 items, 24 and 12 characters) must never be narrowed: a client
rejects a record whose `setup` breaks its own limits, so a wider value written by a newer client
would make an older one discard the whole exercise.
