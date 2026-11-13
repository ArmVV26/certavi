// What the app does with the local database before the first screen needs it.
import type { CertaviDb } from './db';
import { startMeasure } from './diagnostics';
import { requestPersistentStorage, type StorageLike, type StorageStatus } from './persistence';
import { ensureSeed } from './seed';
import { normalizeLegacySessions } from './sessionLog';

/**
 * Opens the database (timed for Settings → Diagnostics), writes the seed, brings sessions
 * imported before Phase 5 to the current row numbering and asks for persistent storage.
 */
export async function startDatabase(
  db: CertaviDb,
  storage: StorageLike | undefined,
): Promise<StorageStatus> {
  const stopTimer = startMeasure('dbOpen');
  const [, status] = await Promise.all([
    db
      .open()
      .then(() => {
        stopTimer();
      })
      .then(() => ensureSeed(db))
      .then(() => normalizeLegacySessions(db)),
    requestPersistentStorage(storage),
  ]);
  return status;
}
