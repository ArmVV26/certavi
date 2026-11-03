// The server's merge rule (docs/api/sync-v1.md §5): per record, strictly newer `updatedAt` wins;
// ties keep the stored version. Pure, so any backend (or a fake one) can reuse it.
import { wireRecordSchema, type StoredWireRecord, type WireRecord } from './contract';

/** Everything the server stores. A Map, so ids such as "__proto__" are just keys. */
export interface SyncDocument {
  serverSeq: number;
  records: Map<string, StoredWireRecord>;
}

export interface MergeResult {
  document: SyncDocument;
  /** True if at least one record was stored (the document must be written back). */
  changed: boolean;
  /** Ids of incoming records that failed validation (when the id is readable). */
  rejected: string[];
}

export function emptyDocument(): SyncDocument {
  return { serverSeq: 0, records: new Map() };
}

/** The id of a value that failed validation, if it has a readable one. */
function readableId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('id' in value)) return undefined;
  return typeof value.id === 'string' && value.id.length > 0 ? value.id : undefined;
}

/** Clients never set `serverSeq`; whatever they send is dropped. */
function withoutServerSeq(record: WireRecord): WireRecord {
  const copy: WireRecord = { ...record };
  delete copy.serverSeq;
  return copy;
}

/** Applies `incoming` in order to a copy of `document`. The input document is not changed. */
export function mergeRecords(document: SyncDocument, incoming: readonly unknown[]): MergeResult {
  const records = new Map(document.records);
  let serverSeq = document.serverSeq;
  const rejected: string[] = [];

  for (const value of incoming) {
    const parsed = wireRecordSchema.safeParse(value);
    if (!parsed.success) {
      const id = readableId(value);
      if (id !== undefined) rejected.push(id);
      continue;
    }
    const record = withoutServerSeq(parsed.data);
    const existing = records.get(record.id);
    if (existing === undefined || record.updatedAt > existing.updatedAt) {
      serverSeq += 1;
      records.set(record.id, { ...record, serverSeq });
    }
  }

  return {
    document: { serverSeq, records },
    changed: serverSeq !== document.serverSeq,
    rejected,
  };
}

/** Every stored record with `serverSeq > since`, oldest change first. */
export function changesSince(document: SyncDocument, since: number): StoredWireRecord[] {
  return [...document.records.values()]
    .filter((record) => record.serverSeq > since)
    .sort((a, b) => a.serverSeq - b.serverSeq);
}
