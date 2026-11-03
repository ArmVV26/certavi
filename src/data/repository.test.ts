import { describe, expect, it, vi } from 'vitest';
import { RECORD_TYPES } from '../domain';
import { makeSession, makeSet } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import { openDatabase } from './db';
import { createRepositories, createRepository } from './repository';

const NOW = 1_800_000_000_000;

function setup() {
  const db = openTestDatabase();
  const repos = createRepositories(db, { now: () => NOW });
  return { db, repos };
}

describe('repository writes', () => {
  it('validates, stamps updatedAt and queues the record in the same write', async () => {
    const { db, repos } = setup();

    const saved = await repos.session.put(makeSession({ id: 's1', date: '2026-11-03' }));

    expect(saved).toMatchObject({ id: 's1', type: 'session', updatedAt: NOW });
    expect(await repos.session.get('s1')).toEqual(saved);
    expect(await db.pending.toArray()).toEqual([{ id: 's1', type: 'session', updatedAt: NOW }]);
  });

  it('keeps one queue entry per record, with the latest timestamp', async () => {
    const { db, repos } = setup();
    const session = makeSession({ id: 's1', date: '2026-11-03' });

    await repos.session.put(session);
    const again = await repos.session.put({ ...session, note: 'Buenas sensaciones' });

    expect(again.updatedAt).toBe(NOW + 1);
    expect(await db.pending.toArray()).toEqual([{ id: 's1', type: 'session', updatedAt: NOW + 1 }]);
  });

  it('never trusts the envelope a caller passes in', async () => {
    const { repos } = setup();
    const stored = { ...makeSession({ id: 's1', date: '2026-11-03' }), serverSeq: 9 };

    const saved = await repos.session.put({ ...stored, deleted: true } as typeof stored);

    expect(saved.updatedAt).toBe(NOW);
    expect(saved).not.toHaveProperty('serverSeq');
    expect(saved).not.toHaveProperty('deleted');
  });

  it('rejects an invalid record and saves nothing, not even in the queue', async () => {
    const { db, repos } = setup();
    const bad = makeSet({ sessionId: 's1', exerciseId: 'remo-t', reps: -1 });

    await expect(repos.set.put(bad)).rejects.toThrow();

    expect(await db.sets.count()).toBe(0);
    expect(await db.pending.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
  });

  it('saves neither the record nor the clock when the queue write fails', async () => {
    const { db, repos } = setup();
    vi.spyOn(db.pending, 'bulkPut').mockImplementation(() => {
      throw new Error('disk full');
    });

    await expect(repos.session.put(makeSession({ id: 's1', date: '2026-11-03' }))).rejects.toThrow(
      'disk full',
    );

    expect(await db.sessions.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
  });

  it('writes many records all or nothing, with increasing timestamps', async () => {
    const { db, repos } = setup();
    const sets = [1, 2, 3].map((slot) => makeSet({ sessionId: 's1', exerciseId: 'remo-t', slot }));

    const saved = await repos.set.putMany(sets);
    expect(saved.map((s) => s.updatedAt)).toEqual([NOW, NOW + 1, NOW + 2]);
    expect(await db.pending.count()).toBe(3);

    const withBad = [
      makeSet({ sessionId: 's2', exerciseId: 'remo-t' }),
      { ...sets[0], weight: -5 },
    ];
    await expect(repos.set.putMany(withBad as typeof sets)).rejects.toThrow();
    expect(await db.sets.count()).toBe(3);
    expect(await db.pending.count()).toBe(3);
  });

  it('stamps with the device clock even when the system clock goes back', async () => {
    const db = openTestDatabase();
    let now = NOW;
    const sessions = createRepository(db, 'session', { now: () => now });

    await sessions.put(makeSession({ id: 's1', date: '2026-11-03' }));
    now = NOW - 60_000;
    const later = await sessions.put(makeSession({ id: 's2', date: '2026-11-03' }));

    expect(later.updatedAt).toBe(NOW + 1);
  });

  it('uses Date.now by default', async () => {
    const sessions = createRepository(openTestDatabase(), 'session');
    const before = Date.now();
    const saved = await sessions.put(makeSession({ id: 's1', date: '2026-11-03' }));
    expect(saved.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('soft deletes', () => {
  it('leaves a tombstone that is queued and hidden from reads', async () => {
    const { db, repos } = setup();
    await repos.session.put(makeSession({ id: 's1', date: '2026-11-03' }));
    await repos.session.put(makeSession({ id: 's2', date: '2026-11-04' }));

    expect(await repos.session.remove('s1')).toBe(true);

    expect(await repos.session.get('s1')).toBeUndefined();
    expect((await repos.session.list()).map((s) => s.id)).toEqual(['s2']);
    expect(await db.sessions.get('s1')).toEqual({
      id: 's1',
      type: 'session',
      updatedAt: NOW + 2,
      deleted: true,
    });
    expect(await db.pending.get('s1')).toEqual({ id: 's1', type: 'session', updatedAt: NOW + 2 });
  });

  it('does nothing for a missing or already deleted record', async () => {
    const { db, repos } = setup();
    expect(await repos.session.remove('nope')).toBe(false);

    await repos.session.put(makeSession({ id: 's1', date: '2026-11-03' }));
    await repos.session.remove('s1');
    expect(await repos.session.remove('s1')).toBe(false);
    expect((await db.sessions.get('s1'))?.updatedAt).toBe(NOW + 1);
  });

  it('can bring a deleted record back with a new write', async () => {
    const { repos } = setup();
    const session = makeSession({ id: 's1', date: '2026-11-03' });
    await repos.session.put(session);
    await repos.session.remove('s1');

    await repos.session.put(session);

    expect(await repos.session.get('s1')).toMatchObject({ id: 's1', updatedAt: NOW + 2 });
  });
});

describe('persistence', () => {
  it('keeps records, queue and clock after closing and reopening the database', async () => {
    const db = openTestDatabase();
    await createRepositories(db, { now: () => NOW }).session.put(
      makeSession({ id: 's1', date: '2026-11-03' }),
    );
    db.close();

    const reopened = openDatabase(db.name);
    const repos = createRepositories(reopened, { now: () => NOW });

    expect(await repos.session.get('s1')).toMatchObject({ id: 's1', updatedAt: NOW });
    expect(await reopened.pending.count()).toBe(1);
    const next = await repos.session.put(makeSession({ id: 's2', date: '2026-11-03' }));
    expect(next.updatedAt).toBe(NOW + 1);
  });
});

describe('createRepositories', () => {
  it('has one repository per record type', () => {
    const { repos } = setup();
    expect(Object.keys(repos).sort()).toEqual([...RECORD_TYPES].sort());
    for (const type of RECORD_TYPES) expect(repos[type].type).toBe(type);
  });
});
