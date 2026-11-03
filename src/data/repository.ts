// Repositories: the only way the app writes records. Every write validates the record, stamps
// `updatedAt` and adds it to the pending queue in the same transaction (ADR-0002, ADR-0003).
import type { z } from 'zod';
import { RECORD_SCHEMAS, type RecordOf, type RecordType } from '../domain';
import { reserveTimestamps } from './clock';
import { isLive, tableOf, type CertaviDb, type TombstoneOf } from './db';

/** What callers pass in: the record without the fields the repository manages. */
export type RecordInput<K extends RecordType> = Omit<
  RecordOf<K>,
  'type' | 'updatedAt' | 'deleted' | 'serverSeq'
>;

export interface Repository<K extends RecordType> {
  readonly type: K;
  /** The live record, or undefined if it does not exist or was deleted. */
  get(id: string): Promise<RecordOf<K> | undefined>;
  /** Every live record of this type. */
  list(): Promise<RecordOf<K>[]>;
  /** Creates or replaces a record. Throws (and saves nothing) if it is not valid. */
  put(input: RecordInput<K>): Promise<RecordOf<K>>;
  /** Like `put` for many records, all or nothing. */
  putMany(inputs: readonly RecordInput<K>[]): Promise<RecordOf<K>[]>;
  /** Soft delete: leaves a tombstone that will sync. Returns false if there was nothing to delete. */
  remove(id: string): Promise<boolean>;
}

export interface RepositoryOptions {
  /** Clock source, injectable for tests. */
  now?: () => number;
}

/** Drops the envelope fields a caller may carry over from a stored record. */
function payloadOf(input: object): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...input };
  delete payload.type;
  delete payload.updatedAt;
  delete payload.deleted;
  delete payload.serverSeq;
  return payload;
}

export function createRepository<K extends RecordType>(
  db: CertaviDb,
  type: K,
  { now = Date.now }: RepositoryOptions = {},
): Repository<K> {
  const table = tableOf(db, type);
  // RECORD_SCHEMAS[type] is the schema of K, but TypeScript widens it to the union of all
  // schemas when indexed by a generic key; this cast restores the link.
  const schema = RECORD_SCHEMAS[type] as unknown as z.ZodType<RecordOf<K>>;

  const write = (inputs: readonly RecordInput<K>[]) =>
    db.transaction('rw', [table, db.pending, db.meta], async () => {
      const first = await reserveTimestamps(db, inputs.length, now());
      const records = inputs.map((input, i) =>
        schema.parse({ ...payloadOf(input), type, updatedAt: first + i }),
      );
      await table.bulkPut(records);
      await db.pending.bulkPut(records.map((r) => ({ id: r.id, type, updatedAt: r.updatedAt })));
      return records;
    });

  return {
    type,

    async get(id) {
      const row = await table.get(id);
      return row && isLive(row) ? row : undefined;
    },

    async list() {
      const rows = await table.toArray();
      return rows.filter((row) => isLive(row));
    },

    async put(input) {
      const [record] = await write([input]);
      if (!record) throw new Error('put wrote no record');
      return record;
    },

    putMany: write,

    remove(id) {
      return db.transaction('rw', [table, db.pending, db.meta], async () => {
        const row = await table.get(id);
        if (!row || !isLive(row)) return false;
        const updatedAt = await reserveTimestamps(db, 1, now());
        const tombstone: TombstoneOf<K> = { id, type, updatedAt, deleted: true };
        await table.put(tombstone);
        await db.pending.put({ id, type, updatedAt });
        return true;
      });
    },
  };
}

export type Repositories = { readonly [K in RecordType]: Repository<K> };

export function createRepositories(db: CertaviDb, options: RepositoryOptions = {}): Repositories {
  return {
    exercise: createRepository(db, 'exercise', options),
    routine: createRepository(db, 'routine', options),
    weekPlan: createRepository(db, 'weekPlan', options),
    session: createRepository(db, 'session', options),
    set: createRepository(db, 'set', options),
    note: createRepository(db, 'note', options),
    activity: createRepository(db, 'activity', options),
    bodyWeight: createRepository(db, 'bodyWeight', options),
    block: createRepository(db, 'block', options),
    blockLog: createRepository(db, 'blockLog', options),
    weeklyMetric: createRepository(db, 'weeklyMetric', options),
    settings: createRepository(db, 'settings', options),
  };
}
