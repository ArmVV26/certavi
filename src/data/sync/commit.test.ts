import { describe, expect, it } from 'vitest';
import type { StoredWireRecord, SyncResponse } from '../../domain';
import { makeSession, makeSet } from '../../domain/testing/builders';
import { openTestDatabase } from '../../test/render';
import { createRepositories } from '../repository';
import { commitResponse } from './commit';
import { readSince } from './queue';

const answer = (records: StoredWireRecord[], serverSeq = records.length): SyncResponse => ({
  serverSeq,
  records,
  rejected: [],
});

const stored = (record: object, serverSeq: number) =>
  ({ ...record, serverSeq }) as StoredWireRecord;

function setup() {
  const db = openTestDatabase();
  const repos = createRepositories(db, { now: () => 1000 });
  return { db, repos };
}

describe('commitResponse', () => {
  it('dequeues what was sent and ignores the echo without writing', async () => {
    const { db, repos } = setup();
    const local = await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    const sent = await db.pending.toArray();
    let writes = 0;
    db.sessions.hook('updating', () => {
      writes += 1;
    });

    const result = await commitResponse(db, sent, answer([stored(local, 1)]));

    expect(result).toEqual({ dequeued: 1, applied: 0, changes: [], invalid: 0 });
    expect(await db.pending.count()).toBe(0);
    expect(writes).toBe(0);
    expect(await db.sessions.get('a')).toEqual(local);
    expect(await readSince(db)).toBe(1);
  });

  it('keeps a record in the queue if it was edited again during the request', async () => {
    const { db, repos } = setup();
    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    const sent = await db.pending.toArray();
    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02', note: 'again' }));

    const result = await commitResponse(db, sent, answer([]));

    expect(result.dequeued).toBe(0);
    expect(await db.pending.get('a')).toMatchObject({ updatedAt: 1001 });
  });

  it('applies newer records without serverSeq and moves the clock past them', async () => {
    const { db, repos } = setup();
    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    const remote = makeSession({ id: 'a', date: '2026-11-02', note: 'remote', updatedAt: 9000 });

    const result = await commitResponse(db, [], answer([stored(remote, 3)], 5));

    expect(result.applied).toBe(1);
    expect(await db.sessions.get('a')).toEqual(remote);
    expect(await readSince(db)).toBe(5);
    // The pending local edit lost: it leaves the queue.
    expect(await db.pending.count()).toBe(0);
    const next = await repos.session.put(makeSession({ id: 'b', date: '2026-11-02' }));
    expect(next.updatedAt).toBe(9001);
  });

  it('keeps a pending local edit that is newer than what arrives', async () => {
    const { db, repos } = setup();
    const local = await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    const older = makeSession({ id: 'a', date: '2026-11-02', note: 'old', updatedAt: 500 });

    const result = await commitResponse(db, [], answer([stored(older, 1)]));

    expect(result.applied).toBe(0);
    expect(await db.sessions.get('a')).toEqual(local);
    expect(await db.pending.get('a')).toBeDefined();
  });

  it('applies tombstones as envelopes and skips records that are not valid', async () => {
    const { db, repos } = setup();
    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    await db.pending.clear();
    const records = [
      stored({ id: 'a', type: 'session', updatedAt: 2000, deleted: true, note: 'gone' }, 1),
      stored({ id: 'x', type: 'session', updatedAt: 2000 }, 2), // no date
      stored({ id: 'y', type: 'future-type', updatedAt: 2000 }, 3),
    ];

    const result = await commitResponse(db, [], answer(records));

    expect(result).toEqual({
      dequeued: 0,
      applied: 1,
      changes: [{ type: 'session', id: 'a' }],
      invalid: 2,
    });
    expect(await db.sessions.get('a')).toEqual({
      id: 'a',
      type: 'session',
      updatedAt: 2000,
      deleted: true,
    });
    expect(await db.sessions.get('x')).toBeUndefined();
  });

  it('keeps the newest version when an answer repeats an id', async () => {
    const { db } = setup();
    const v1 = makeSession({ id: 'a', date: '2026-11-02', note: 'v1', updatedAt: 10 });
    const v2 = makeSession({ id: 'a', date: '2026-11-02', note: 'v2', updatedAt: 20 });
    const v0 = makeSession({ id: 'a', date: '2026-11-02', note: 'v0', updatedAt: 5 });

    await commitResponse(db, [], answer([stored(v1, 1), stored(v2, 2), stored(v0, 3)]));

    expect(await db.sessions.get('a')).toEqual(v2);
  });

  it('reports what it wrote, with the session of sets and notes (also for deletions)', async () => {
    const { db, repos } = setup();
    const set = await repos.set.put(makeSet({ sessionId: 's1', exerciseId: 'e', slot: 0 }));
    await db.pending.clear();
    const incoming = [
      stored(
        makeSet({ id: 'set-new', sessionId: 's1', exerciseId: 'e', slot: 1, updatedAt: 5000 }),
        1,
      ),
      // A deletion carries no session: it is found through the local copy.
      stored({ id: set.id, type: 'set', updatedAt: 6000, deleted: true }, 2),
      stored(makeSession({ id: 's2', date: '2026-11-02', updatedAt: 7000 }), 3),
    ];

    const result = await commitResponse(db, [], answer(incoming));

    expect(result.applied).toBe(3);
    expect(result.changes).toEqual(
      expect.arrayContaining([
        { type: 'set', id: 'set-new', sessionId: 's1' },
        { type: 'set', id: set.id, sessionId: 's1' },
        { type: 'session', id: 's2' },
      ]),
    );
    expect(result.changes).toHaveLength(3);
  });

  it('does not report records that were not newer', async () => {
    const { db, repos } = setup();
    const local = await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    const result = await commitResponse(db, [], answer([stored({ ...local, updatedAt: 1 }, 1)]));
    expect(result.changes).toEqual([]);
  });

  it('never moves since back', async () => {
    const { db } = setup();
    await commitResponse(db, [], answer([], 10));
    await commitResponse(db, [], answer([], 3));
    expect(await readSince(db)).toBe(10);
  });
});
