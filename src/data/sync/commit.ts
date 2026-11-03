// What the client does with a sync answer (docs/api/sync-v1.md §8), in one transaction.
import {
  parseRecord,
  RECORD_TYPES,
  type DomainRecord,
  type SyncResponse,
  type Tombstone,
} from '../../domain';
import { advanceClock } from '../clock';
import { recordTables, TABLES, type CertaviDb, type PendingEntry } from '../db';
import { advanceSince } from './queue';

export interface CommitResult {
  /** Sent records removed from the queue (not edited again during the request). */
  dequeued: number;
  /** Incoming records written because they were newer than this device's copy. */
  applied: number;
  /** Incoming records that are not valid Certavi records (ignored). */
  invalid: number;
}

type Incoming = DomainRecord | Tombstone;

/** Validates an incoming record and drops its `serverSeq`. Null if it is not valid. */
function readIncoming(raw: unknown): Incoming | null {
  const result = parseRecord(raw);
  if (!result.ok) return null;
  const record = { ...result.record };
  delete record.serverSeq;
  return record;
}

/** Removes sent entries whose `updatedAt` did not change while the request was in flight. */
async function dequeue(db: CertaviDb, sent: readonly PendingEntry[]): Promise<number> {
  const current = await db.pending.bulkGet(sent.map((entry) => entry.id));
  const done = sent.filter((entry, i) => current[i]?.updatedAt === entry.updatedAt);
  await db.pending.bulkDelete(done.map((entry) => entry.id));
  return done.length;
}

/** Writes incoming records that are strictly newer; returns how many were written. */
async function apply(db: CertaviDb, incoming: readonly Incoming[]): Promise<number> {
  let applied = 0;
  for (const type of RECORD_TYPES) {
    // The server holds one version per id, but keep the newest if an answer ever repeats one.
    const newest = new Map<string, Incoming>();
    for (const record of incoming) {
      if (record.type !== type) continue;
      const seen = newest.get(record.id);
      if (seen === undefined || record.updatedAt > seen.updatedAt) newest.set(record.id, record);
    }
    if (newest.size === 0) continue;

    // Untyped table: every incoming record was validated by parseRecord for this type.
    const table = db.table<Incoming, string>(TABLES[type]);
    const candidates = [...newest.values()];
    const local = await table.bulkGet(candidates.map((r) => r.id));
    const toWrite = candidates.filter((record, i) => {
      const current = local[i];
      return current === undefined || record.updatedAt > current.updatedAt;
    });
    if (toWrite.length === 0) continue; // the echo: nothing written, nothing re-renders

    await table.bulkPut(toWrite);
    const queued = await db.pending.bulkGet(toWrite.map((r) => r.id));
    const beaten = toWrite.filter((record, i) => {
      const entry = queued[i];
      return entry !== undefined && entry.updatedAt <= record.updatedAt;
    });
    await db.pending.bulkDelete(beaten.map((r) => r.id));
    applied += toWrite.length;
  }
  return applied;
}

/**
 * Commits one answer: dequeues what was sent, applies what is newer, moves the clock past every
 * incoming record and stores the new cursor. All or nothing.
 */
export function commitResponse(
  db: CertaviDb,
  sent: readonly PendingEntry[],
  response: SyncResponse,
): Promise<CommitResult> {
  return db.transaction('rw', [...recordTables(db), db.pending, db.meta], async () => {
    const dequeued = await dequeue(db, sent);
    const incoming = response.records.map(readIncoming);
    const valid = incoming.filter((record): record is Incoming => record !== null);
    const applied = await apply(db, valid);
    await advanceClock(db, Math.max(0, ...valid.map((r) => r.updatedAt)));
    await advanceSince(db, response.serverSeq);
    return { dequeued, applied, invalid: incoming.length - valid.length };
  });
}
