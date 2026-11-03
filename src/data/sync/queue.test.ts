import { describe, expect, it } from 'vitest';
import { SEED_SETTINGS } from '../../domain';
import { makeSession } from '../../domain/testing/builders';
import { openTestDatabase } from '../../test/render';
import { createRepositories } from '../repository';
import { ensureSeed } from '../seed';
import { advanceSince, keepaliveBatch, nextBatch, queueEverything, readSince } from './queue';

async function withSessions(count: number) {
  const db = openTestDatabase();
  const repos = createRepositories(db, { now: () => 1000 });
  await repos.session.putMany(
    Array.from({ length: count }, (_, i) =>
      makeSession({
        id: `s${String(i).padStart(3, '0')}`,
        date: '2026-11-02',
        note: 'x'.repeat(50),
      }),
    ),
  );
  return { db, repos };
}

describe('sync cursor', () => {
  it('starts at 0 and never goes back', async () => {
    const db = openTestDatabase();
    expect(await readSince(db)).toBe(0);
    await db.transaction('rw', db.meta, () => advanceSince(db, 10));
    await db.transaction('rw', db.meta, () => advanceSince(db, 4));
    expect(await readSince(db)).toBe(10);
  });
});

describe('nextBatch', () => {
  it('reads queue entries with their stored records, without serverSeq', async () => {
    const { db } = await withSessions(3);
    await db.sessions.update('s001', { serverSeq: 7 });

    const batch = await nextBatch(db, 2);

    expect(batch.entries.map((e) => e.id)).toEqual(['s000', 's001']);
    expect(batch.records.map((r) => r.id)).toEqual(['s000', 's001']);
    expect(batch.records[1]).not.toHaveProperty('serverSeq');
    expect(batch.records[0]).toMatchObject({
      type: 'session',
      updatedAt: 1000,
      note: 'x'.repeat(50),
    });
  });

  it('sends tombstones as they are stored', async () => {
    const { db, repos } = await withSessions(1);
    await repos.session.remove('s000');

    const batch = await nextBatch(db, 10);

    expect(batch.records).toEqual([
      { id: 's000', type: 'session', updatedAt: 1001, deleted: true },
    ]);
  });

  it('drops queue entries whose record is gone', async () => {
    const { db } = await withSessions(2);
    await db.sessions.delete('s000');

    const batch = await nextBatch(db, 10);

    expect(batch.records.map((r) => r.id)).toEqual(['s001']);
    expect(await db.pending.get('s000')).toBeUndefined();
  });
});

describe('keepaliveBatch', () => {
  it('takes only what fits in the byte budget', async () => {
    const { db } = await withSessions(10);
    const one = JSON.stringify((await nextBatch(db, 1)).records[0]).length;
    const base = JSON.stringify({ since: 0, records: [] }).length;

    const batch = await keepaliveBatch(db, 0, base + 3 * one + 2);

    expect(batch.records).toHaveLength(3);
    expect(JSON.stringify({ since: 0, records: batch.records }).length).toBeLessThanOrEqual(
      base + 3 * one + 2,
    );
  });

  it('is empty when not even one record fits', async () => {
    const { db } = await withSessions(1);
    expect((await keepaliveBatch(db, 0, 10)).records).toEqual([]);
  });
});

describe('queueEverything', () => {
  it('queues every record written on this device, not the untouched seed, and resets since', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    const repos = createRepositories(db, { now: () => 5000 });
    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    await repos.settings.put({ ...SEED_SETTINGS, planStart: '2026-11-02' });
    await repos.session.put(makeSession({ id: 'b', date: '2026-11-03' }));
    await repos.session.remove('b');
    await db.pending.clear();
    await db.transaction('rw', db.meta, () => advanceSince(db, 99));

    const queued = await queueEverything(db);

    expect(queued).toBe(3);
    expect((await db.pending.toArray()).map((e) => e.id).sort()).toEqual(['a', 'b', 'settings']);
    expect(await readSince(db)).toBe(0);
  });
});
