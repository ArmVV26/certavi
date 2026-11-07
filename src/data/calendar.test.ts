import { describe, expect, it } from 'vitest';
import { totalSets } from '../domain';
import { makeSession, makeSet, makeWeekPlan } from '../domain/testing/builders';
import { closeFinishedWeeks, readCalendar } from './calendar';
import { openTestDatabase } from '../test/render';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';

async function seeded() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return db;
}

describe('readCalendar', () => {
  it('reads the sessions, sets and activities of the visible weeks only, without deleted ones', async () => {
    const db = await seeded();
    const repos = createRepositories(db);
    await repos.session.putMany([
      makeSession({ id: 'in', date: '2026-11-03' }),
      makeSession({ id: 'edge', date: '2026-12-06' }), // last visible day of November 2026
      makeSession({ id: 'out', date: '2026-12-07' }),
      makeSession({ id: 'gone', date: '2026-11-04' }),
    ]);
    await repos.session.remove('gone');
    await repos.set.putMany([
      makeSet({ sessionId: 'in', exerciseId: 'x' }),
      makeSet({ sessionId: 'out', exerciseId: 'x' }),
    ]);
    await repos.activity.putMany([
      { id: 'a1', date: '2026-10-26', kind: 'football', minutes: 0, note: '' },
      { id: 'a2', date: '2026-10-25', kind: 'football', minutes: 0, note: '' },
    ]);

    const data = await readCalendar(db, '2026-11-01');
    expect(data.sessions.map((s) => s.id).sort()).toEqual(['edge', 'in']);
    expect(data.sets).toHaveLength(1);
    expect(data.activities.map((a) => a.id)).toEqual(['a1']);
    expect(data.routines.length).toBeGreaterThan(0);
    expect(data.exercises.length).toBeGreaterThan(0);
    expect(data.settings).toBeDefined();
  });
});

describe('closeFinishedWeeks', () => {
  it('freezes the finished weeks that have data, once, and queues them to sync', async () => {
    const db = await seeded();
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 's1', date: '2026-10-28', routineId: 'push' }));
    await repos.weekPlan.put(makeWeekPlan({ week: '2026-10-19', size: 3 }));

    const closed = await closeFinishedWeeks(db, '2026-11-04', { now: () => 5000 });
    expect(closed).toBe(2);

    const week = await repos.weekPlan.get('week_2026-10-26');
    expect(week).toMatchObject({ closedAt: 5000, size: 5, deload: false });
    expect(week?.plannedSetsByGroup && totalSets(week.plannedSetsByGroup)).toBeGreaterThan(0);
    expect((await repos.weekPlan.get('week_2026-10-19'))?.size).toBe(3);
    expect((await db.pending.toArray()).map((p) => p.id)).toEqual(
      expect.arrayContaining(['week_2026-10-26', 'week_2026-10-19']),
    );

    expect(await closeFinishedWeeks(db, '2026-11-04')).toBe(0);
  });

  it('does not close the current week or weeks without data', async () => {
    const db = await seeded();
    await createRepositories(db).session.put(makeSession({ id: 's1', date: '2026-11-03' }));
    expect(await closeFinishedWeeks(db, '2026-11-04')).toBe(0);
    expect(await db.weekPlans.count()).toBe(0);
  });

  it('ignores deleted sessions', async () => {
    const db = await seeded();
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 's1', date: '2026-10-28' }));
    await repos.session.remove('s1');
    expect(await closeFinishedWeeks(db, '2026-11-04')).toBe(0);
  });
});
