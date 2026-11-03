// Asks the browser not to evict IndexedDB under storage pressure (Safari does otherwise).

/** The part of `navigator.storage` we use; missing in old browsers and in jsdom. */
export type StorageLike = Partial<Pick<StorageManager, 'persist' | 'persisted'>>;

export type StorageStatus = 'persisted' | 'not-persisted' | 'unsupported';

/** Current status, without asking for anything. */
export async function getStorageStatus(storage: StorageLike | undefined): Promise<StorageStatus> {
  if (!storage?.persisted) return 'unsupported';
  try {
    return (await storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

/** Asks for persistent storage if not granted yet; returns the resulting status. */
export async function requestPersistentStorage(
  storage: StorageLike | undefined,
): Promise<StorageStatus> {
  const status = await getStorageStatus(storage);
  if (status !== 'not-persisted' || !storage?.persist) return status;
  try {
    return (await storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'not-persisted';
  }
}
