// The small slice of a blob store the sync server needs. Netlify Blobs implements it in
// netlifyStore.ts; memoryStore.ts implements it for tests and the e2e fake server.

export type BlobMetadata = Record<string, unknown>;

/** Conditional write: replace only this version, or create only if nothing is there. */
export type WriteCondition = { onlyIfMatch: string } | { onlyIfNew: true };

export interface SyncStore {
  /** The JSON stored under `key` and its etag, or null if there is nothing. */
  read(key: string): Promise<{ data: unknown; etag: string } | null>;
  /**
   * Writes `data` as JSON. With a condition, returns false (and writes nothing) when the
   * condition does not hold; without one, always writes.
   */
  write(
    key: string,
    data: unknown,
    options?: { condition?: WriteCondition; metadata?: BlobMetadata },
  ): Promise<boolean>;
  /** The metadata of `key`, or null if there is nothing under it. */
  readMetadata(key: string): Promise<BlobMetadata | null>;
  /** Every key that starts with `prefix`. */
  listKeys(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}

/**
 * Netlify Blobs store for a deploy context. Named stores are shared by every deploy of the
 * site, so only production uses `certavi`; the `dev` branch deploy (`branch-deploy`) and local
 * runs get their own store and never touch the real data.
 */
export function storeNameFor(deployContext: string | undefined): string {
  if (deployContext === 'production') return 'certavi';
  const suffix = (deployContext ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return `certavi-${suffix || 'unknown'}`;
}

/** Key of the document with every record (implementation detail, sync-v1 §9). */
export const RECORDS_KEY = 'records';
/** Prefix of the daily backups: `backup/YYYY-MM-DD`. */
export const BACKUP_PREFIX = 'backup/';
