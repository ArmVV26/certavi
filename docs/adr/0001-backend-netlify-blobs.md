# ADR-0001 — Backend v1: Netlify Functions + Netlify Blobs

- **Status:** Accepted
- **Date:** 2026-11-02
- **Deciders:** Armando Vaquero Vargas

## Context

Certavi is a single-user, offline-first PWA. All business logic (progression, records, weekly
plans, set counts) runs on the client, so the backend only needs to:

- store and return records with last-write-wins,
- keep daily backups,
- protect access with a shared secret.

Constraints: **zero cost**, minimal operations, deploy together with the static site, and the
option to move to another backend later without touching the UI. The previous app (`gym_app`)
already ran this model on Netlify for months, in real gym conditions.

## Decision

Use **Netlify Functions written in TypeScript** with **Netlify Blobs** as storage (option A):

- One strongly consistent blob holds all records (`{ serverSeq, records }`), written with
  conditional etag writes and retries.
- One blob per daily backup, keeping the 14 most recent.
- The API is defined by a versioned, documented contract — [`sync-v1`](../api/sync-v1.md) —
  and the client talks to it through a `SyncTransport` interface (`NetlifyTransport` is one
  implementation).

## Consequences

**Positive**

- Free tier, no database to run, same deploy as the frontend.
- Proven model (ported from gym_app).
- TypeScript and zod schemas shared between client and function.
- Swapping backends means implementing one small contract and one transport.

**Negative**

- The whole dataset is read and rewritten as a single JSON document on each write: cost grows
  linearly with data size.
- No server-side queries; every computation happens on the client.
- Tied to Netlify's function and blob limits (request body size, execution time).
- Single shared secret: no per-device revocation.

## Alternatives considered

- **Firebase / Firestore** — real-time sync and offline cache, but a heavier SDK, vendor-specific
  data model and conflict semantics that differ from the proven LWW model.
- **Supabase / Neon (Postgres)** — server queries and multi-user ready, but more moving parts
  than a single-user app needs today.
- **Own service (Java/Spring or Python/FastAPI)** — good portfolio value, but hosting is not
  free and adds operations work. Kept as a future option behind the same contract.

## When to revisit

Move to another backend (keeping `sync-v1` or defining `v2`) if any of these becomes true:

- Sync requests get noticeably slow because of the single-document size (e.g. > 2–3 MB or
  sync latency regularly > 2 s).
- Server-side queries, reports or aggregation are needed.
- More than one user, or per-device keys and revocation, are needed.
- Netlify's free tier limits are reached.
