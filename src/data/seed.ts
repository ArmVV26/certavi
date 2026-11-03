// Writes the built-in data (catalog, routines, blocks, default settings) on start-up.
import {
  SEED_BLOCKS,
  SEED_EXERCISES,
  SEED_ROUTINES,
  SEED_SETTINGS,
  SEED_UPDATED_AT,
  type RecordOf,
  type RecordType,
} from '../domain';
import { tableOf, type CertaviDb } from './db';

/**
 * Inserts missing seed records and refreshes the ones never edited (`updatedAt` still 0), so a
 * new app version can fix the catalog without touching user edits or deletions. Seed writes do
 * not join the pending queue (ADR-0003 §6). Idempotent; returns how many records it wrote.
 */
export function ensureSeed(db: CertaviDb): Promise<number> {
  return db.transaction('rw', [db.exercises, db.routines, db.blocks, db.settings], async () => {
    const written = await Promise.all([
      seedTable(db, 'exercise', SEED_EXERCISES),
      seedTable(db, 'routine', SEED_ROUTINES),
      seedTable(db, 'block', SEED_BLOCKS),
      seedTable(db, 'settings', [SEED_SETTINGS]),
    ]);
    return written.reduce((sum, n) => sum + n, 0);
  });
}

async function seedTable<K extends RecordType>(
  db: CertaviDb,
  type: K,
  records: readonly RecordOf<K>[],
): Promise<number> {
  const table = tableOf(db, type);
  const current = await table.bulkGet(records.map((r) => r.id));
  const stale = records.filter((record, i) => {
    const row = current[i];
    if (row === undefined) return true;
    return row.updatedAt === SEED_UPDATED_AT && JSON.stringify(row) !== JSON.stringify(record);
  });
  if (stale.length > 0) await table.bulkPut(stale);
  return stale.length;
}
