import { describe, expect, it } from 'vitest';
import { RECORD_TYPES } from '../domain';
import { makeSession } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import { reserveTimestamps } from './clock';
import { DEFAULT_DATABASE_NAME, isLive, openDatabase, recordTables, TABLES, tableOf } from './db';

describe('database layout', () => {
  it('has one table per record type, plus the queue and meta tables', async () => {
    const db = openTestDatabase();
    await db.open();

    const names = db.tables.map((t) => t.name).sort();
    expect(names).toEqual([...Object.values(TABLES), 'meta', 'pending'].sort());
    expect(Object.keys(TABLES).sort()).toEqual([...RECORD_TYPES].sort());
    expect(recordTables(db)).toHaveLength(RECORD_TYPES.length);
    expect(tableOf(db, 'set').name).toBe('sets');
    expect(db.verno).toBe(1);
  });

  it('is called "certavi" by default', () => {
    expect(openDatabase().name).toBe(DEFAULT_DATABASE_NAME);
    expect(DEFAULT_DATABASE_NAME).toBe('certavi');
  });

  it('indexes sessions by date and sets by session', async () => {
    const db = openTestDatabase();
    await db.sessions.bulkPut([
      makeSession({ id: 'a', date: '2026-11-02' }),
      makeSession({ id: 'b', date: '2026-11-09' }),
    ]);
    const week = db.sessions.where('date').between('2026-11-02', '2026-11-08', true, true);
    expect((await week.toArray()).map((s) => s.id)).toEqual(['a']);
  });

  it('tells live records from tombstones', () => {
    expect(isLive(makeSession({ id: 'a', date: '2026-11-02' }))).toBe(true);
    expect(isLive({ id: 'a', type: 'session', updatedAt: 2, deleted: true })).toBe(false);
  });
});

describe('monotonic clock', () => {
  const inTx = <T>(db: ReturnType<typeof openTestDatabase>, fn: () => Promise<T>) =>
    db.transaction('rw', db.meta, fn);

  it('uses the current time, and never repeats or goes back', async () => {
    const db = openTestDatabase();
    expect(await inTx(db, () => reserveTimestamps(db, 1, 1000))).toBe(1000);
    expect(await inTx(db, () => reserveTimestamps(db, 1, 1000))).toBe(1001);
    expect(await inTx(db, () => reserveTimestamps(db, 3, 500))).toBe(1002);
    expect(await inTx(db, () => reserveTimestamps(db, 1, 500))).toBe(1005);
    expect(await inTx(db, () => reserveTimestamps(db, 1, 9000))).toBe(9000);
  });

  it('reserves nothing when asked for no timestamps', async () => {
    const db = openTestDatabase();
    await inTx(db, () => reserveTimestamps(db, 0, 1000));
    expect(await db.meta.count()).toBe(0);
  });

  it('defaults to Date.now', async () => {
    const db = openTestDatabase();
    const before = Date.now();
    expect(await inTx(db, () => reserveTimestamps(db, 1))).toBeGreaterThanOrEqual(before);
  });
});
