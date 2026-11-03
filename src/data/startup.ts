// What the app does with the local database before the first screen needs it.
import type { CertaviDb } from './db';
import { requestPersistentStorage, type StorageLike, type StorageStatus } from './persistence';
import { ensureSeed } from './seed';

/** Writes the seed and asks for persistent storage, in parallel. */
export async function startDatabase(
  db: CertaviDb,
  storage: StorageLike | undefined,
): Promise<StorageStatus> {
  const [, status] = await Promise.all([ensureSeed(db), requestPersistentStorage(storage)]);
  return status;
}
