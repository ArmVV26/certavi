// Restoring a server backup (docs/api/sync-v1.md §6, ADR-0004 §8): every difference becomes a
// new local edit, queued like any other, so every device converges on its next sync.
import {
  parseRecord,
  RECORD_TYPES,
  type BackupFile,
  type DomainRecord,
  type RecordType,
  type Tombstone,
} from '../../domain';
import { reserveTimestamps } from '../clock';
import { recordTables, TABLES, tableOf, type CertaviDb } from '../db';
import { seedRecordsOf } from '../seed';

/** What a record should look like after restoring, without its timestamp. */
type Desired = Omit<DomainRecord, 'updatedAt'> | Omit<Tombstone, 'updatedAt'>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** JSON with object keys sorted, so two versions compare equal whatever their key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    isPlainObject(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : inner,
  );
}

/** The content of a record, without the fields that say when or where it was written. */
function contentOf(record: object): Desired {
  const copy = { ...record } as Record<string, unknown>;
  delete copy.updatedAt;
  delete copy.serverSeq;
  return copy as Desired;
}

/** The backup's valid records by type and id (unknown types and invalid records are skipped). */
function readBackupRecords(backup: BackupFile): Map<RecordType, Map<string, Desired>> {
  const byType = new Map<RecordType, Map<string, Desired>>();
  for (const raw of backup.records) {
    const result = parseRecord(raw);
    if (!result.ok) continue;
    const { record } = result;
    let group = byType.get(record.type);
    if (!group) {
      group = new Map();
      byType.set(record.type, group);
    }
    group.set(record.id, contentOf(record));
  }
  return byType;
}

/**
 * Makes this device match `backup`. Records missing from it are soft-deleted, except built-in
 * ones, which go back to their seed version. Returns how many records changed.
 */
export function restoreBackup(
  db: CertaviDb,
  backup: BackupFile,
  now: number = Date.now(),
): Promise<number> {
  const wanted = readBackupRecords(backup);
  return db.transaction('rw', [...recordTables(db), db.pending, db.meta], async () => {
    const changes: { type: RecordType; desired: Desired }[] = [];
    for (const type of RECORD_TYPES) {
      const inBackup = wanted.get(type) ?? new Map<string, Desired>();
      const seed = new Map(seedRecordsOf(type).map((r) => [r.id, contentOf(r)] as const));
      const local = new Map((await tableOf(db, type).toArray()).map((r) => [r.id, r] as const));
      const ids = new Set([...local.keys(), ...inBackup.keys()]);
      for (const id of ids) {
        const desired = inBackup.get(id) ?? seed.get(id) ?? { id, type, deleted: true };
        const current = local.get(id);
        if (current === undefined && 'deleted' in desired) continue;
        if (current !== undefined && canonical(contentOf(current)) === canonical(desired)) continue;
        changes.push({ type, desired });
      }
    }
    if (changes.length === 0) return 0;

    const first = await reserveTimestamps(db, changes.length, now);
    const written = changes.map(({ type, desired }, i) => ({
      type,
      record: { ...desired, updatedAt: first + i },
    }));
    for (const type of RECORD_TYPES) {
      const rows = written.filter((w) => w.type === type).map((w) => w.record);
      // Each row was validated by parseRecord, or is a seed record or tombstone of this type.
      if (rows.length > 0) await db.table<object, string>(TABLES[type]).bulkPut(rows);
    }
    await db.pending.bulkPut(
      written.map(({ type, record }) => ({ id: record.id, type, updatedAt: record.updatedAt })),
    );
    return written.length;
  });
}
