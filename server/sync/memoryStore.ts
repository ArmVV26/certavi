// In-memory SyncStore with etags and conditional writes. Used by unit tests and by the fake
// sync server of the e2e tests, so both run the real handler without Netlify.
import type { BlobMetadata, SyncStore } from './store';

interface Entry {
  json: string;
  etag: string;
  metadata: BlobMetadata;
}

export interface MemoryStore extends SyncStore {
  /** Number of entries, for tests. */
  readonly size: number;
  /** Removes everything. */
  clear(): void;
}

export function createMemoryStore(): MemoryStore {
  const entries = new Map<string, Entry>();
  let version = 0;

  return {
    get size() {
      return entries.size;
    },

    clear() {
      entries.clear();
    },

    read(key) {
      const entry = entries.get(key);
      return Promise.resolve(
        entry ? { data: JSON.parse(entry.json) as unknown, etag: entry.etag } : null,
      );
    },

    write(key, data, { condition, metadata = {} } = {}) {
      const current = entries.get(key);
      if (condition) {
        const holds =
          'onlyIfNew' in condition
            ? current === undefined
            : current !== undefined && current.etag === condition.onlyIfMatch;
        if (!holds) return Promise.resolve(false);
      }
      version += 1;
      entries.set(key, {
        json: JSON.stringify(data),
        etag: `"${String(version)}"`,
        metadata: structuredClone(metadata),
      });
      return Promise.resolve(true);
    },

    readMetadata(key) {
      const entry = entries.get(key);
      return Promise.resolve(entry ? structuredClone(entry.metadata) : null);
    },

    listKeys(prefix) {
      return Promise.resolve([...entries.keys()].filter((key) => key.startsWith(prefix)));
    },

    delete(key) {
      entries.delete(key);
      return Promise.resolve();
    },
  };
}
