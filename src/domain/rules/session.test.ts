import { describe, expect, it } from 'vitest';
import { SEED_ROUTINES_BY_ID } from '../seed';
import { makeSession } from '../testing/builders';
import { countPlanSets } from './scheme';
import {
  PAST_SESSION_MINUTES,
  findSession,
  isInProgress,
  newSession,
  planCounts,
  sessionItems,
} from './session';

const push = SEED_ROUTINES_BY_ID.get('push');
if (!push) throw new Error('seed routine push missing');

const NOW = new Date(2026, 10, 4, 9, 30).getTime();

describe('newSession', () => {
  it('starts a session for today now, in progress, with a copy of the routine', () => {
    const session = newSession({
      id: 'ses_1',
      date: '2026-11-04',
      routine: push,
      today: '2026-11-04',
      now: NOW,
      deload: false,
    });
    expect(session).toMatchObject({
      id: 'ses_1',
      type: 'session',
      date: '2026-11-04',
      routineId: 'push',
      startedAt: NOW,
      endedAt: null,
      note: '',
      readiness: null,
    });
    expect(session.items).toEqual(push.items);
    expect(session.items).not.toBe(push.items);
    expect(session.items[0]?.scheme).not.toBe(push.items[0]?.scheme);
  });

  it('creates a session for another day as finished, from 18:00 to 19:15', () => {
    const session = newSession({
      id: 'ses_2',
      date: '2026-11-02',
      routine: push,
      today: '2026-11-04',
      now: NOW,
      deload: false,
    });
    const start = new Date(session.startedAt ?? 0);
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([
      2026, 10, 2, 18,
    ]);
    expect(start.getMinutes()).toBe(0);
    expect(session.endedAt).toBe((session.startedAt ?? 0) + PAST_SESSION_MINUTES * 60_000);
  });

  it('starts a free session without exercises', () => {
    const session = newSession({
      id: 'ses_3',
      date: '2026-11-04',
      routine: null,
      today: '2026-11-04',
      now: NOW,
      deload: true,
    });
    expect(session.routineId).toBeNull();
    expect(session.items).toEqual([]);
  });

  it('reduces the plan in a deload week', () => {
    const items = sessionItems(push.items, true);
    expect(countPlanSets(items)).toBeLessThan(countPlanSets(push.items));
    expect(items.every((item) => item.scheme.rir === '3-4')).toBe(true);
  });
});

describe('findSession', () => {
  const sessions = [
    makeSession({ id: 'b', date: '2026-11-02', routineId: 'push', startedAt: 20 }),
    makeSession({ id: 'a', date: '2026-11-02', routineId: 'push', startedAt: 10 }),
    makeSession({ id: 'c', date: '2026-11-02', routineId: null, startedAt: null }),
    makeSession({ id: 'd', date: '2026-11-02', routineId: null, startedAt: 5 }),
    makeSession({ id: 'e', date: '2026-11-03', routineId: 'push', startedAt: 1 }),
  ];

  it('finds the oldest session of that date and routine', () => {
    expect(findSession(sessions, '2026-11-02', 'push')?.id).toBe('a');
  });

  it('finds free sessions with a null routine', () => {
    expect(findSession(sessions, '2026-11-02', null)?.id).toBe('c');
  });

  it('returns undefined when there is none', () => {
    expect(findSession(sessions, '2026-11-02', 'pull')).toBeUndefined();
  });
});

describe('isInProgress and planCounts', () => {
  it('tells in-progress sessions apart', () => {
    expect(isInProgress({ endedAt: null })).toBe(true);
    expect(isInProgress({ endedAt: 1 })).toBe(false);
  });

  it('counts exercises and sets of the Push routine', () => {
    expect(planCounts(push.items)).toEqual({ exercises: 7, sets: 19 });
    expect(planCounts([])).toEqual({ exercises: 0, sets: 0 });
  });
});
