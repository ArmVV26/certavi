// The attempt log of Settings (docs/api/sync-v1.md §8): the last 40 sync attempts.
import { ATTEMPT_LOG_SIZE } from '../../domain';
import type { CertaviDb, NewSyncLogEntry, SyncLogEntry } from '../db';

/** Adds an attempt and drops the oldest ones beyond the limit. */
export function addAttempt(db: CertaviDb, entry: NewSyncLogEntry): Promise<void> {
  return db.transaction('rw', db.syncLog, async () => {
    await db.syncLog.add(entry);
    const extra = (await db.syncLog.count()) - ATTEMPT_LOG_SIZE;
    if (extra > 0) {
      await db.syncLog.bulkDelete(await db.syncLog.orderBy(':id').limit(extra).primaryKeys());
    }
  });
}

/** Newest first. */
export function readAttempts(db: CertaviDb): Promise<SyncLogEntry[]> {
  return (
    db.syncLog
      .orderBy(':id')
      .reverse()
      .toArray()
      // Rows written by an older version may lack the code of a failure: show them as internal.
      .then((rows) =>
        rows.map((row) => (row.ok ? row : { ...row, error: row.error || 'client-error' })),
      )
  );
}

/** Time of the last attempt that worked, or null. */
export async function lastSuccessAt(db: CertaviDb): Promise<number | null> {
  const entry = await db.syncLog
    .orderBy(':id')
    .reverse()
    .filter((e) => e.ok)
    .first();
  return entry?.at ?? null;
}
