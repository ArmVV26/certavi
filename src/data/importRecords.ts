// Saves imported records with last-write-wins: a record is written only if this device has no
// newer (or equal) version of it. Written records join the pending queue, like any local edit.
import type { DomainRecord, RecordType } from '../domain';
import { advanceClock } from './clock';
import { recordTables, tableOf, type CertaviDb } from './db';
import { normalizeLegacySessions } from './sessionLog';

export interface ImportPlan {
  /** Records that will be (or were) written: new on this device or newer than its copy. */
  toWrite: DomainRecord[];
  /** How many of `toWrite` there are per type. */
  byType: Partial<Record<RecordType, number>>;
  /** Records this device already has in the same or a newer version. */
  unchanged: number;
}

function groupByType(records: readonly DomainRecord[]): Map<RecordType, DomainRecord[]> {
  const groups = new Map<RecordType, DomainRecord[]>();
  for (const record of records) {
    const group = groups.get(record.type);
    if (group) group.push(record);
    else groups.set(record.type, [record]);
  }
  return groups;
}

async function compare(db: CertaviDb, records: readonly DomainRecord[]): Promise<ImportPlan> {
  const toWrite: DomainRecord[] = [];
  const byType: Partial<Record<RecordType, number>> = {};
  for (const [type, group] of groupByType(records)) {
    const stored = await tableOf(db, type).bulkGet(group.map((r) => r.id));
    group.forEach((record, i) => {
      const current = stored[i];
      if (current === undefined || record.updatedAt > current.updatedAt) {
        toWrite.push(record);
        byType[type] = (byType[type] ?? 0) + 1;
      }
    });
  }
  return { toWrite, byType, unchanged: records.length - toWrite.length };
}

/** What an import would do, without writing anything (for the preview). */
export function planImport(db: CertaviDb, records: readonly DomainRecord[]): Promise<ImportPlan> {
  return db.transaction('r', recordTables(db), () => compare(db, records));
}

/** The server sequence belongs to the copy the file came from, not to this device. */
function withoutServerSeq(record: DomainRecord): DomainRecord {
  if (record.serverSeq === undefined) return record;
  const copy = { ...record };
  delete copy.serverSeq;
  return copy;
}

/**
 * Writes the records that are new or newer, all in one transaction with their queue entries,
 * and moves the clock past the newest one. Returns what was written.
 */
export function applyImport(db: CertaviDb, records: readonly DomainRecord[]): Promise<ImportPlan> {
  return db.transaction('rw', [...recordTables(db), db.pending, db.meta], async () => {
    const plan = await compare(db, records);
    for (const [type, group] of groupByType(plan.toWrite)) {
      await tableOf(db, type).bulkPut(group.map(withoutServerSeq));
    }
    await db.pending.bulkPut(
      plan.toWrite.map(({ id, type, updatedAt }) => ({ id, type, updatedAt })),
    );
    const newest = Math.max(0, ...plan.toWrite.map((r) => r.updatedAt));
    await advanceClock(db, newest);
    // gym_app numbers warm-ups and extra sets apart from the planned ones.
    await normalizeLegacySessions(db);
    return plan;
  });
}
