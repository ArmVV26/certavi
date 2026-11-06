import { describe, expect, it } from 'vitest';
import { SEED_ROUTINES } from '../seed/routines';
import {
  NORMAL_WEEK,
  compareRoutines,
  dayPlan,
  routineDays,
  weekSchedule,
  type DayPlan,
  type WeekOptions,
} from './dayPlan';

// 2 November 2026 is a Monday.
const MONDAY = '2026-11-02';

const labels = (options: WeekOptions) =>
  weekSchedule(MONDAY, options, SEED_ROUTINES).map(({ plan }) =>
    plan.kind === 'routine' ? plan.routineId : plan.rest,
  );

describe('weekSchedule', () => {
  it('follows the routines of a normal week, with the fixed rest days', () => {
    expect(labels(NORMAL_WEEK)).toEqual([
      'push',
      'pull',
      'lowerB',
      'active-rest',
      'upper',
      'football',
      'lowerA',
    ]);
  });

  it('drops Upper with 4 sessions, never a leg day', () => {
    expect(labels({ size: 4, hiking: false })).toEqual([
      'push',
      'pull',
      'lowerB',
      'active-rest',
      'rest',
      'football',
      'lowerA',
    ]);
  });

  it('puts Lower Full on the Wednesday with 3 sessions', () => {
    expect(labels({ size: 3, hiking: false })).toEqual([
      'push',
      'pull',
      'lowerFull',
      'active-rest',
      'rest',
      'football',
      'rest',
    ]);
  });

  it('makes Wednesday Lower Full and Sunday a hiking day in a hiking week (as gym_app)', () => {
    expect(labels({ size: 5, hiking: true })).toEqual([
      'push',
      'pull',
      'lowerFull',
      'active-rest',
      'upper',
      'football',
      'hiking',
    ]);
  });

  it('leaves Push, Pull and Lower Full in a hiking week of 4 sessions', () => {
    expect(labels({ size: 4, hiking: true })).toEqual([
      'push',
      'pull',
      'lowerFull',
      'active-rest',
      'rest',
      'football',
      'hiking',
    ]);
  });

  it('only turns Sunday into hiking in a hiking week of 3 sessions', () => {
    expect(labels({ size: 3, hiking: true }).slice(3)).toEqual([
      'active-rest',
      'rest',
      'football',
      'hiking',
    ]);
  });

  it('gives each day its date, Monday first', () => {
    const days = weekSchedule(MONDAY, NORMAL_WEEK, SEED_ROUTINES);
    expect(days.map((d) => d.date)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });

  it('offers quick activities on rest days', () => {
    const days = weekSchedule(MONDAY, { size: 5, hiking: true }, SEED_ROUTINES);
    const rest = (i: number) => days[i]?.plan as Extract<DayPlan, { kind: 'rest' }>;
    expect(rest(5).activities).toEqual(['football', 'swimming']);
    expect(rest(6).activities).toEqual(['hiking']);
  });
});

describe('routineDays', () => {
  it('skips routines that no longer exist', () => {
    const withoutPull = SEED_ROUTINES.filter((r) => r.id !== 'pull');
    expect(routineDays(NORMAL_WEEK, withoutPull).has(2)).toBe(false);
  });

  it('does not place a routine without a day when no day is free', () => {
    const routines = [
      { id: 'push', weekday: 1 as const },
      { id: 'pull', weekday: 2 as const },
      { id: 'lowerFull', weekday: null },
    ];
    expect([...routineDays({ size: 3, hiking: false }, routines).values()]).toEqual([
      'push',
      'pull',
    ]);
  });

  it('places a second routine on the same day like a routine without a day', () => {
    const routines = [
      { id: 'push', weekday: 1 as const },
      { id: 'pull', weekday: 1 as const },
      { id: 'lowerFull', weekday: 3 as const },
      { id: 'lowerB', weekday: 3 as const },
    ];
    const days = routineDays({ size: 3, hiking: false }, routines);
    expect(days.get(1)).toBe('push');
    expect(days.get(3)).toBe('lowerFull');
    expect(days.has(2)).toBe(false);
  });

  it('never puts a routine on Sunday in a hiking week', () => {
    const routines = [
      { id: 'push', weekday: 1 as const },
      { id: 'pull', weekday: 7 as const },
      { id: 'lowerB', weekday: 7 as const },
      { id: 'lowerFull', weekday: null },
    ];
    const days = routineDays({ size: 5, hiking: true }, routines);
    expect(days.has(7)).toBe(false);
    expect([...days.values()]).toEqual(['push']);
  });
});

describe('dayPlan', () => {
  it('returns the routine of the day', () => {
    expect(dayPlan('2026-11-02', NORMAL_WEEK, SEED_ROUTINES)).toEqual({
      kind: 'routine',
      routineId: 'push',
    });
  });

  it('returns a rest day with its activities', () => {
    expect(dayPlan('2026-11-05', NORMAL_WEEK, SEED_ROUTINES)).toEqual({
      kind: 'rest',
      rest: 'active-rest',
      activities: ['swimming', 'mobility'],
    });
  });

  it('turns Sunday into hiking and Wednesday into Lower Full in a hiking week', () => {
    expect(dayPlan('2026-11-08', { size: 5, hiking: true }, SEED_ROUTINES)).toMatchObject({
      rest: 'hiking',
    });
    expect(dayPlan('2026-11-04', { size: 5, hiking: true }, SEED_ROUTINES)).toEqual({
      kind: 'routine',
      routineId: 'lowerFull',
    });
  });
});

describe('compareRoutines', () => {
  it('sorts by weekday, routines without a day last, then by id', () => {
    const sorted = [...SEED_ROUTINES].sort(compareRoutines).map((r) => r.id);
    expect(sorted).toEqual(['push', 'pull', 'lowerB', 'upper', 'lowerA', 'lowerFull']);
    const noDay = [
      { id: 'b', weekday: null },
      { id: 'a', weekday: null },
      { id: 'a', weekday: null },
    ].sort(compareRoutines);
    expect(noDay.map((r) => r.id)).toEqual(['a', 'a', 'b']);
  });
});
