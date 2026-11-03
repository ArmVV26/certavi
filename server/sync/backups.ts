// Daily backups (docs/api/sync-v1.md §6): one per calendar day in Madrid, the 14 newest kept.
import {
  BACKUP_TIME_ZONE,
  BACKUPS_KEPT,
  type BackupFile,
  type BackupSummary,
} from '../../src/domain/sync/contract';
import type { SyncDocument } from '../../src/domain/sync/merge';
import { BACKUP_PREFIX, type SyncStore } from './store';

const madridFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: BACKUP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day in Madrid at `ms`, as 'YYYY-MM-DD'. */
export function madridDate(ms: number): string {
  const parts = Object.fromEntries(
    madridFormat.formatToParts(new Date(ms)).map((part) => [part.type, part.value]),
  );
  return `${String(parts.year)}-${String(parts.month)}-${String(parts.day)}`;
}

export const backupKey = (date: string) => `${BACKUP_PREFIX}${date}`;

const finiteOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Saves `document` (the data as it was before today's first write) as today's backup, unless
 * there is nothing stored yet or today's backup already exists, then prunes to the 14 newest.
 * Returns true if it created a backup.
 */
export async function ensureDailyBackup(
  store: SyncStore,
  document: SyncDocument,
  now: number,
): Promise<boolean> {
  if (document.records.size === 0) return false;
  const date = madridDate(now);
  const key = backupKey(date);
  if ((await store.readMetadata(key)) !== null) return false;

  const file: BackupFile = { date, records: [...document.records.values()] };
  const created = await store.write(key, file, {
    condition: { onlyIfNew: true },
    metadata: { createdAt: now, count: file.records.length },
  });
  if (created) await pruneBackups(store);
  return created;
}

/** Deletes every backup but the `BACKUPS_KEPT` newest. */
export async function pruneBackups(store: SyncStore): Promise<void> {
  const keys = (await store.listKeys(BACKUP_PREFIX)).sort().reverse();
  for (const key of keys.slice(BACKUPS_KEPT)) await store.delete(key);
}

/** Every backup, newest first, from the metadata only. */
export async function listBackups(store: SyncStore): Promise<BackupSummary[]> {
  const keys = (await store.listKeys(BACKUP_PREFIX)).sort().reverse();
  return Promise.all(
    keys.map(async (key) => {
      const metadata = await store.readMetadata(key);
      return {
        date: key.slice(BACKUP_PREFIX.length),
        count: finiteOrNull(metadata?.count),
        createdAt: finiteOrNull(metadata?.createdAt),
      };
    }),
  );
}
