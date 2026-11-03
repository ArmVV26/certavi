// Reads the pending queue into what a sync request carries, and the sync cursor.
import { RECORD_TYPES, type WireRecord } from '../../domain';
import { recordTables, tableOf, type CertaviDb, type PendingEntry } from '../db';

const SINCE_KEY = 'since';

/** Highest `serverSeq` this device has applied (0 = never synced with this key). */
export async function readSince(db: CertaviDb): Promise<number> {
  return (await db.meta.get(SINCE_KEY))?.value ?? 0;
}

/** Stores `since`, never moving it back. Must run inside a transaction that includes `meta`. */
export async function advanceSince(db: CertaviDb, serverSeq: number): Promise<void> {
  const current = await readSince(db);
  if (serverSeq > current) await db.meta.put({ key: SINCE_KEY, value: serverSeq });
}

export interface Batch {
  /** The queue entries as they were read: dequeued later only if they did not change. */
  entries: PendingEntry[];
  /** The records to send, as stored (live or tombstone). */
  records: WireRecord[];
}

/** A stored row as it travels: the server sequence belongs to the server. */
function toWire(row: object): WireRecord {
  const record = { ...row } as WireRecord;
  delete record.serverSeq;
  return record;
}

/**
 * Reads queue entries (oldest id order) and their records. Entries whose record is gone are
 * dropped from the queue: there is nothing left to send. Stops when `fits` refuses a record.
 */
async function readBatch(
  db: CertaviDb,
  limit: number | null,
  fits: (record: WireRecord) => boolean = () => true,
): Promise<Batch> {
  return db.transaction('rw', [...recordTables(db), db.pending], async () => {
    const queued = await (limit === null ? db.pending : db.pending.limit(limit)).toArray();
    const rows = new Map<string, object>();
    for (const type of RECORD_TYPES) {
      const ids = queued.filter((entry) => entry.type === type).map((entry) => entry.id);
      if (ids.length === 0) continue;
      const stored = await tableOf(db, type).bulkGet(ids);
      stored.forEach((row, i) => {
        const id = ids[i];
        if (row !== undefined && id !== undefined) rows.set(id, row);
      });
    }
    const entries: PendingEntry[] = [];
    const records: WireRecord[] = [];
    const orphans: string[] = [];
    for (const entry of queued) {
      const row = rows.get(entry.id);
      if (row === undefined) {
        orphans.push(entry.id);
        continue;
      }
      const record = toWire(row);
      if (!fits(record)) break;
      entries.push(entry);
      records.push(record);
    }
    if (orphans.length > 0) await db.pending.bulkDelete(orphans);
    return { entries, records };
  });
}

/** Up to `limit` pending records for a normal request. */
export function nextBatch(db: CertaviDb, limit: number): Promise<Batch> {
  return readBatch(db, limit);
}

const byteLength = (text: string) => new TextEncoder().encode(text).byteLength;

/** The pending records whose request body stays within `maxBytes` (exit flush, `keepalive`). */
export function keepaliveBatch(db: CertaviDb, since: number, maxBytes: number): Promise<Batch> {
  let size = byteLength(JSON.stringify({ since, records: [] }));
  let first = true;
  return readBatch(db, null, (record) => {
    const extra = byteLength(JSON.stringify(record)) + (first ? 0 : 1);
    if (size + extra > maxBytes) return false;
    size += extra;
    first = false;
    return true;
  });
}

/**
 * A new key: the server behind it may know nothing of this device. Resets the cursor and queues
 * every record ever written here (`updatedAt > 0`, tombstones included); untouched built-in
 * records exist on every device and stay out. Returns how many records were queued.
 */
export function queueEverything(db: CertaviDb): Promise<number> {
  return db.transaction('rw', [...recordTables(db), db.pending, db.meta], async () => {
    let queued = 0;
    for (const type of RECORD_TYPES) {
      const rows = await tableOf(db, type)
        .filter((row) => row.updatedAt > 0)
        .toArray();
      await db.pending.bulkPut(rows.map((row) => ({ id: row.id, type, updatedAt: row.updatedAt })));
      queued += rows.length;
    }
    await db.meta.delete(SINCE_KEY);
    return queued;
  });
}
