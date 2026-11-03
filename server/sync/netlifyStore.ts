// SyncStore on top of a Netlify Blobs store (`getStore({ name, consistency: 'strong' })`).
import type { Store } from '@netlify/blobs';
import type { SyncStore } from './store';

/** The Store methods this adapter uses (a narrow type, so tests can pass a fake). */
export type BlobsStore = Pick<
  Store,
  'getWithMetadata' | 'setJSON' | 'getMetadata' | 'list' | 'delete'
>;

export function fromNetlifyStore(store: BlobsStore): SyncStore {
  return {
    async read(key) {
      const entry = await store.getWithMetadata(key, { type: 'json' });
      if (entry === null) return null;
      // Netlify always returns an etag for an existing blob; without one, writes can't be
      // conditional, so fail loudly instead of risking a lost update.
      if (entry.etag === undefined) throw new Error(`Blob "${key}" has no etag`);
      return { data: entry.data as unknown, etag: entry.etag };
    },

    async write(key, data, { condition, metadata } = {}) {
      const result = await store.setJSON(key, data, { ...condition, metadata });
      return result.modified;
    },

    async readMetadata(key) {
      const entry = await store.getMetadata(key);
      return entry === null ? null : entry.metadata;
    },

    async listKeys(prefix) {
      const { blobs } = await store.list({ prefix });
      return blobs.map((blob) => blob.key);
    },

    delete(key) {
      return store.delete(key);
    },
  };
}
