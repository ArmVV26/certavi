// Read-only queries over several tables (counts for Settings).
import { RECORD_TYPES, type RecordType } from '../domain';
import { isLive, recordTables, tableOf, type CertaviDb } from './db';

export type RecordCounts = Record<RecordType, number>;

/** Live (not deleted) records per type, read in one consistent transaction. */
export function countLiveRecords(db: CertaviDb): Promise<RecordCounts> {
  return db.transaction('r', recordTables(db), async () => {
    const entries = await Promise.all(
      RECORD_TYPES.map(
        async (type) =>
          [
            type,
            await tableOf(db, type)
              .filter((row) => isLive(row))
              .count(),
          ] as const,
      ),
    );
    return Object.fromEntries(entries) as RecordCounts;
  });
}

/** Records waiting to be pushed to the server. */
export function countPending(db: CertaviDb): Promise<number> {
  return db.pending.count();
}
