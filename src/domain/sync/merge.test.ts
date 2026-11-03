import { describe, expect, it } from 'vitest';
import { syncRequestSchema, wireRecordSchema } from './contract';
import { changesSince, emptyDocument, mergeRecords, type SyncDocument } from './merge';

const rec = (id: string, updatedAt: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'set',
  updatedAt,
  ...extra,
});

function documentWith(...records: ReturnType<typeof rec>[]): SyncDocument {
  return mergeRecords(emptyDocument(), records).document;
}

describe('mergeRecords', () => {
  it('stores new records with increasing serverSeq', () => {
    const { document, changed, rejected } = mergeRecords(emptyDocument(), [
      rec('a', 10),
      rec('b', 5),
    ]);
    expect(changed).toBe(true);
    expect(rejected).toEqual([]);
    expect(document.serverSeq).toBe(2);
    expect(document.records.get('a')).toEqual({ ...rec('a', 10), serverSeq: 1 });
    expect(document.records.get('b')?.serverSeq).toBe(2);
  });

  it('replaces a stored record only when the incoming one is strictly newer', () => {
    const start = documentWith(rec('a', 10, { reps: 8 }));
    const newer = mergeRecords(start, [rec('a', 11, { reps: 9 })]);
    expect(newer.changed).toBe(true);
    expect(newer.document.records.get('a')).toMatchObject({ reps: 9, serverSeq: 2 });

    const tie = mergeRecords(start, [rec('a', 10, { reps: 1 })]);
    expect(tie.changed).toBe(false);
    expect(tie.document.records.get('a')).toMatchObject({ reps: 8, serverSeq: 1 });

    const older = mergeRecords(start, [rec('a', 9, { reps: 2 })]);
    expect(older.changed).toBe(false);
    expect(older.document.serverSeq).toBe(1);
  });

  it('stores soft deletes like any other change', () => {
    const start = documentWith(rec('a', 10, { reps: 8 }));
    const { document } = mergeRecords(start, [
      { id: 'a', type: 'set', updatedAt: 20, deleted: true },
    ]);
    expect(document.records.get('a')).toEqual({
      id: 'a',
      type: 'set',
      updatedAt: 20,
      deleted: true,
      serverSeq: 2,
    });
  });

  it('ignores a serverSeq sent by the client', () => {
    const { document } = mergeRecords(emptyDocument(), [rec('a', 10, { serverSeq: 999 })]);
    expect(document.records.get('a')?.serverSeq).toBe(1);
    expect(document.serverSeq).toBe(1);
  });

  it('rejects invalid records and reports their id when it is readable', () => {
    const { document, rejected, changed } = mergeRecords(emptyDocument(), [
      { id: 'no-type', updatedAt: 1 },
      { id: 'bad-time', type: 'set', updatedAt: -1 },
      { id: 'nan-time', type: 'set', updatedAt: Number.NaN },
      { id: 'x'.repeat(121), type: 'set', updatedAt: 1 },
      { id: '', type: 'set', updatedAt: 1 },
      { id: 42, type: 'set', updatedAt: 1 },
      'not an object',
      null,
      rec('ok', 1),
    ]);
    expect(rejected).toEqual(['no-type', 'bad-time', 'nan-time', 'x'.repeat(121)]);
    expect(changed).toBe(true);
    expect([...document.records.keys()]).toEqual(['ok']);
  });

  it('keeps the payload opaque, including unknown types and nested fields', () => {
    const odd = { id: 'z', type: 'future-type', updatedAt: 3, nested: { a: [1, 2] } };
    const { document } = mergeRecords(emptyDocument(), [odd]);
    expect(document.records.get('z')).toEqual({ ...odd, serverSeq: 1 });
  });

  it('treats ids like "__proto__" as plain keys', () => {
    const { document } = mergeRecords(emptyDocument(), [
      rec('__proto__', 1),
      rec('constructor', 1),
    ]);
    expect(document.records.size).toBe(2);
    expect(document.records.get('__proto__')?.serverSeq).toBe(1);
  });

  it('applies duplicates in one request in order', () => {
    const { document } = mergeRecords(emptyDocument(), [
      rec('a', 5, { v: 1 }),
      rec('a', 7, { v: 2 }),
      rec('a', 6, { v: 3 }),
    ]);
    expect(document.records.get('a')).toMatchObject({ v: 2, serverSeq: 2 });
    expect(document.serverSeq).toBe(2);
  });

  it('does not change the input document', () => {
    const start = documentWith(rec('a', 1));
    mergeRecords(start, [rec('a', 2), rec('b', 1)]);
    expect(start.serverSeq).toBe(1);
    expect(start.records.size).toBe(1);
    expect(start.records.get('a')?.updatedAt).toBe(1);
  });

  it('reports no change for an empty push', () => {
    const start = documentWith(rec('a', 1));
    expect(mergeRecords(start, []).changed).toBe(false);
  });
});

describe('changesSince', () => {
  it('returns records after the cursor, oldest change first', () => {
    let document = documentWith(rec('a', 1), rec('b', 1), rec('c', 1));
    document = mergeRecords(document, [rec('a', 2)]).document; // a → serverSeq 4
    expect(changesSince(document, 0).map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(changesSince(document, 2).map((r) => r.id)).toEqual(['c', 'a']);
    expect(changesSince(document, 4)).toEqual([]);
  });
});

describe('contract schemas', () => {
  it('accepts a flat payload next to the envelope', () => {
    expect(wireRecordSchema.parse(rec('a', 1, { weight: 80 }))).toEqual(
      rec('a', 1, { weight: 80 }),
    );
  });

  it('limits a client batch to 300 records', () => {
    const records = Array.from({ length: 301 }, (_, i) => rec(`r${String(i)}`, 1));
    expect(syncRequestSchema.safeParse({ since: 0, records }).success).toBe(false);
    expect(syncRequestSchema.safeParse({ since: 0, records: records.slice(1) }).success).toBe(true);
  });
});
