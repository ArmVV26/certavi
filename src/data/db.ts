// The local database (IndexedDB through Dexie): one table per record type, the pending queue
// and a small key-value table. Layout and migration policy: docs/adr/0003-local-storage-dexie.md.
import { Dexie, type Table } from 'dexie';
import type { RecordOf, RecordType, Tombstone } from '../domain';

/** A soft-deleted record as stored: only the envelope, as it also arrives from the server. */
export type TombstoneOf<K extends RecordType> = Tombstone & { type: K };

/** What a table row can be: the live record or its tombstone. */
export type StoredRecord<K extends RecordType> = RecordOf<K> | TombstoneOf<K>;

/** A record waiting to be pushed to the server (one row per record id). */
export interface PendingEntry {
  id: string;
  type: RecordType;
  updatedAt: number;
}

/** Small key-value rows: the monotonic clock now; the sync cursor in Phase 4. */
export interface MetaEntry {
  key: string;
  value: number;
}

export const TABLES = {
  exercise: 'exercises',
  routine: 'routines',
  weekPlan: 'weekPlans',
  session: 'sessions',
  set: 'sets',
  note: 'notes',
  activity: 'activities',
  bodyWeight: 'bodyWeights',
  block: 'blocks',
  blockLog: 'blockLogs',
  weeklyMetric: 'weeklyMetrics',
  settings: 'settings',
} as const satisfies Record<RecordType, string>;

type RecordTables = {
  [K in RecordType as (typeof TABLES)[K]]: Table<StoredRecord<K>, string>;
};

export type CertaviDb = Dexie &
  RecordTables & {
    pending: Table<PendingEntry, string>;
    meta: Table<MetaEntry, string>;
  };

/**
 * Version 1 — the first released schema. Never edit it once released: add a new version with an
 * `.upgrade()` instead (ADR-0003 §7). Only indexed fields are listed; rows hold the full record.
 */
const SCHEMA_V1: Record<(typeof TABLES)[RecordType] | 'pending' | 'meta', string> = {
  exercises: 'id',
  routines: 'id',
  weekPlans: 'id',
  sessions: 'id, date',
  sets: 'id, sessionId, exerciseId, [exerciseId+completedAt]',
  notes: 'id, sessionId',
  activities: 'id, date',
  bodyWeights: 'id',
  blocks: 'id',
  blockLogs: 'id, date, blockId',
  weeklyMetrics: 'id, week',
  settings: 'id',
  pending: 'id, type',
  meta: 'key',
};

export const DEFAULT_DATABASE_NAME = 'certavi';

/** Creates the database handle. Dexie opens it lazily on the first query. */
export function openDatabase(name: string = DEFAULT_DATABASE_NAME): CertaviDb {
  const db = new Dexie(name) as CertaviDb;
  db.version(1).stores(SCHEMA_V1);
  return db;
}

/** The table of one record type, typed by that type. */
export function tableOf<K extends RecordType>(
  db: CertaviDb,
  type: K,
): Table<StoredRecord<K>, string> {
  return db.table<StoredRecord<K>, string>(TABLES[type]);
}

/** Every record table, for transactions that span all of them. */
export function recordTables(db: CertaviDb): Table[] {
  return Object.values(TABLES).map((name) => db.table(name));
}

export function isLive<K extends RecordType>(row: StoredRecord<K>): row is RecordOf<K> {
  return row.deleted !== true;
}
