import { describe, expect, it } from 'vitest';
import { ANKLE_REHAB_BLOCK_ID, emptyGroupCounts, livePlan, weeksSinceDeload } from '../domain';
import { makeSession, makeSet, makeWeekPlan } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import { isLive } from './db';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';
import { readToday, saveActivity, saveBodyWeight, updateBlockLog, updateWeek } from './today';

const NOW = 1_800_000_000_000;
const now = () => NOW;
const TODAY = '2026-11-04';
const MONDAY = '2026-11-02';

async function setup() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return { db, repos: createRepositories(db, { now }) };
}

describe('readToday', () => {
  it('reads the seed on a fresh install', async () => {
    const { db } = await setup();
    const data = await readToday(db, TODAY);
    expect(data.routines).toHaveLength(6);
    expect(data.exercises.length).toBeGreaterThan(40);
    expect(data.blocks).toHaveLength(2);
    expect(data.settings?.id).toBe('settings');
    expect(data.sessions).toEqual([]);
    expect(data.weekSets).toEqual([]);
  });

  it('keeps only live records, this week’s sets and activities and today’s logs', async () => {
    const { db, repos } = await setup();
    await repos.session.putMany([
      makeSession({ id: 'this-week', date: '2026-11-03' }),
      makeSession({ id: 'last-week', date: '2026-10-28' }),
      makeSession({ id: 'deleted', date: TODAY }),
    ]);
    await repos.session.remove('deleted');
    await repos.set.putMany([
      makeSet({ id: 'a', sessionId: 'this-week', exerciseId: 'remo-t' }),
      makeSet({ id: 'b', sessionId: 'last-week', exerciseId: 'remo-t' }),
    ]);
    await repos.set.put(makeSet({ id: 'c', sessionId: 'this-week', exerciseId: 'remo-t' }));
    await repos.set.remove('c');
    await saveActivity(db, { date: '2026-11-08', kind: 'hiking', minutes: 240, note: '' });
    await saveActivity(db, { date: '2026-11-09', kind: 'football', minutes: 60, note: '' });
    await updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, TODAY, { note: 'hoy' });
    await updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, '2026-11-03', { note: 'ayer' });
    await repos.settings.remove('settings');

    const data = await readToday(db, TODAY);
    expect(data.sessions.map((s) => s.id).sort()).toEqual(['last-week', 'this-week']);
    expect(data.weekSets.map((s) => s.id)).toEqual(['a']);
    expect(data.weekActivities.map((a) => a.kind)).toEqual(['hiking']);
    expect(data.blockLogs.map((l) => l.note)).toEqual(['hoy']);
    expect(data.settings).toBeUndefined();
  });
});

describe('updateWeek', () => {
  it('creates the week with defaults and then changes only the patched fields', async () => {
    const { db } = await setup();
    const created = await updateWeek(db, MONDAY, { hiking: true }, { now });
    expect(created).toMatchObject({
      id: 'week_2026-11-02',
      week: MONDAY,
      hiking: true,
      deload: false,
      size: 5,
      updatedAt: NOW,
    });
    const changed = await updateWeek(db, MONDAY, { size: 4, deload: true }, { now });
    expect(changed).toMatchObject({ hiking: true, deload: true, size: 4 });
    expect(await db.pending.get('week_2026-11-02')).toBeDefined();
  });

  describe('in a closed week', () => {
    const PAST = '2026-10-26';

    async function closedWeek() {
      const { db, repos } = await setup();
      const frozen = { ...emptyGroupCounts(), chest: 99 };
      await repos.weekPlan.put(
        makeWeekPlan({ week: PAST, plannedSetsByGroup: frozen, closedAt: 5, size: 5 }),
      );
      const routines = new Map(
        (await db.routines.toArray()).filter((r) => isLive(r)).map((r) => [r.id, r]),
      );
      const exercises = new Map(
        (await db.exercises.toArray()).filter((e) => isLive(e)).map((e) => [e.id, e]),
      );
      return { db, routines, exercises };
    }

    it('recomputes the planned sets when the deload changes and keeps the closing time', async () => {
      const { db, routines, exercises } = await closedWeek();
      const week = await updateWeek(db, PAST, { deload: true }, { now });
      const expected = livePlan({ size: 5, deload: true, hiking: false }, routines, exercises);
      expect(week.plannedSetsByGroup).toEqual(expected.groups);
      expect(week).toMatchObject({ deload: true, closedAt: 5 });
      expect(week.updatedAt).toBeGreaterThanOrEqual(NOW);
      expect(await db.pending.get(`week_${PAST}`)).toBeDefined();
    });

    it('recomputes the planned sets when the hiking option changes', async () => {
      const { db, routines, exercises } = await closedWeek();
      const week = await updateWeek(db, PAST, { hiking: true }, { now });
      const expected = livePlan({ size: 5, deload: false, hiking: true }, routines, exercises);
      expect(week.plannedSetsByGroup).toEqual(expected.groups);
      expect(week.hiking).toBe(true);
    });

    it('ignores a change of size', async () => {
      const { db } = await closedWeek();
      const week = await updateWeek(db, PAST, { size: 3 }, { now });
      expect(week.size).toBe(5);
    });

    it('lets the deload reminder see the week as a deload', async () => {
      const { db } = await closedWeek();
      await updateWeek(db, PAST, { deload: true }, { now });
      const sessions = [
        makeSession({ id: 'a', date: '2026-10-20' }),
        makeSession({ id: 'b', date: '2026-10-27' }),
        makeSession({ id: 'c', date: '2026-11-03' }),
      ];
      const plans = (await db.weekPlans.toArray()).filter((w) => isLive(w));
      expect(weeksSinceDeload('2026-11-11', sessions, plans)).toBe(1);
      expect(weeksSinceDeload('2026-11-11', sessions, [])).toBe(3);
    });
  });
});

describe('saveActivity and saveBodyWeight', () => {
  it('saves an activity with a new id and a trimmed note', async () => {
    const { db } = await setup();
    const activity = await saveActivity(
      db,
      { date: TODAY, kind: 'swimming', minutes: 45, note: '  piscina  ' },
      { now },
    );
    expect(activity).toMatchObject({ kind: 'swimming', minutes: 45, note: 'piscina' });
    expect(activity.id).toMatch(/^act_/);
  });

  it('keeps one weight per week', async () => {
    const { db } = await setup();
    await saveBodyWeight(db, MONDAY, 76.4);
    const replaced = await saveBodyWeight(db, MONDAY, 76.1);
    expect(replaced).toMatchObject({ id: 'bw_2026-11-02', week: MONDAY, kg: 76.1 });
    expect(await db.bodyWeights.count()).toBe(1);
  });
});

describe('updateBlockLog', () => {
  it('creates the day log and merges later changes', async () => {
    const { db } = await setup();
    await updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, TODAY, {
      done: { itemId: 'foam-roll', value: true },
    });
    await updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, TODAY, {
      metric: { metricId: 'stairs', value: 4 },
    });
    const log = await updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, TODAY, {
      done: { itemId: 'pogos', value: true },
    });
    expect(log).toMatchObject({
      id: `blocklog_${ANKLE_REHAB_BLOCK_ID}_${TODAY}`,
      done: { 'foam-roll': true, pogos: true },
      metrics: { stairs: 4 },
    });
    expect(await db.blockLogs.count()).toBe(1);
  });

  it('starts again from an empty log after a deletion', async () => {
    const { db, repos } = await setup();
    const log = await updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, TODAY, { note: 'x' });
    await repos.blockLog.remove(log.id);
    const fresh = await updateBlockLog(db, ANKLE_REHAB_BLOCK_ID, TODAY, {
      metric: { metricId: 'pogos', value: 2 },
    });
    expect(fresh).toMatchObject({ note: '', metrics: { pogos: 2 }, done: {} });
  });
});
