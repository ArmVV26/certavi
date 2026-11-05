// What the app does with the local database before the first screen needs it.
import type { CertaviDb } from './db';
import { requestPersistentStorage, type StorageLike, type StorageStatus } from './persistence';
import { ensureSeed } from './seed';
import { normalizeLegacySessions } from './sessionLog';

/**
 * Writes the seed, brings sessions imported before Phase 5 to the current row numbering and asks
 * for persistent storage.
 */
export async function startDatabase(
  db: CertaviDb,
  storage: StorageLike | undefined,
): Promise<StorageStatus> {
  const [, status] = await Promise.all([
    ensureSeed(db).then(() => normalizeLegacySessions(db)),
    requestPersistentStorage(storage),
  ]);
  return status;
}
