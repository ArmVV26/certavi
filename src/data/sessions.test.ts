import { describe, expect, it } from 'vitest';
import { countPlanSets, SEED_ROUTINES_BY_ID } from '../domain';
import { makeSession } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import { newId } from './ids';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';
import { RoutineNotFoundError, readSession, startSession } from './sessions';

const NOW = new Date(2026, 10, 4, 9, 30).getTime();
const now = () => NOW;

async function setup() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return { db, repos: createRepositories(db, { now }) };
}

const pushSets = countPlanSets(SEED_ROUTINES_BY_ID.get('push')?.items ?? []);

describe('startSession', () => {
  it('creates and queues a session for today with a copy of the routine', async () => {
    const { db } = await setup();
    const { session, existed } = await startSession(
      db,
      { date: '2026-11-04', routineId: 'push', today: '2026-11-04' },
      { now },
    );
    expect(existed).toBe(false);
    expect(session).toMatchObject({ routineId: 'push', startedAt: NOW, endedAt: null });
    expect(session.id).toMatch(/^ses_/);
    expect(countPlanSets(session.items)).toBe(pushSets);
    expect(await db.pending.get(session.id)).toMatchObject({ type: 'session' });
  });

  it('opens the existing session of that routine and date instead of a second one', async () => {
    const { db } = await setup();
    const first = await startSession(db, {
      date: '2026-11-02',
      routineId: 'push',
      today: '2026-11-04',
    });
    const again = await startSession(db, {
      date: '2026-11-02',
      routineId: 'push',
      today: '2026-11-04',
    });
    expect(again).toEqual({ session: first.session, existed: true });
    expect(await db.sessions.count()).toBe(1);
  });

  it('ignores deleted sessions when looking for an existing one', async () => {
    const { db, repos } = await setup();
    await repos.session.put(makeSession({ id: 'old', date: '2026-11-04', routineId: null }));
    await repos.session.remove('old');
    const { existed } = await startSession(db, {
      date: '2026-11-04',
      routineId: null,
      today: '2026-11-04',
    });
    expect(existed).toBe(false);
  });

  it('starts a free session without exercises', async () => {
    const { db } = await setup();
    const { session } = await startSession(db, {
      date: '2026-11-04',
      routineId: null,
      today: '2026-11-04',
    });
    expect(session.routineId).toBeNull();
    expect(session.items).toEqual([]);
  });

  it('reduces the plan when the week is a deload week', async () => {
    const { db, repos } = await setup();
    await repos.weekPlan.put({
      id: 'week_2026-11-02',
      week: '2026-11-02',
      hiking: false,
      deload: true,
      size: 5,
    });
    const { session } = await startSession(db, {
      date: '2026-11-04',
      routineId: 'push',
      today: '2026-11-04',
    });
    expect(countPlanSets(session.items)).toBeLessThan(pushSets);
  });

  it('fails for a routine that does not exist or was deleted', async () => {
    const { db, repos } = await setup();
    await expect(
      startSession(db, { date: '2026-11-04', routineId: 'nope', today: '2026-11-04' }),
    ).rejects.toBeInstanceOf(RoutineNotFoundError);
    await repos.routine.remove('pull');
    await expect(
      startSession(db, { date: '2026-11-04', routineId: 'pull', today: '2026-11-04' }),
    ).rejects.toMatchObject({ routineId: 'pull', name: 'RoutineNotFoundError' });
    expect(await db.sessions.count()).toBe(0);
  });
});

describe('readSession', () => {
  it('returns the session with the catalog', async () => {
    const { db } = await setup();
    const { session } = await startSession(db, {
      date: '2026-11-04',
      routineId: 'pull',
      today: '2026-11-04',
    });
    const view = await readSession(db, session.id);
    expect(view?.session).toEqual(session);
    expect(view?.exercises.get('remo-t')).toBeDefined();
  });

  it('returns null for unknown and deleted sessions', async () => {
    const { db, repos } = await setup();
    expect(await readSession(db, 'nope')).toBeNull();
    await repos.session.put(makeSession({ id: 'gone', date: '2026-11-04' }));
    await repos.session.remove('gone');
    expect(await readSession(db, 'gone')).toBeNull();
  });
});

describe('newId', () => {
  it('builds prefixed ids that do not repeat', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId('ses', NOW)));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^ses_[0-9a-z]+_[0-9a-z]{10}$/);
    expect(newId('act').startsWith('act_')).toBe(true);
  });
});
