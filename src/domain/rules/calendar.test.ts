import { describe, expect, it } from 'vitest';
import type { PlanItem } from '../model/routine';
import { makeWeekPlan } from '../testing/builders';
import {
  addMonths,
  dayContents,
  isInMonth,
  monthStart,
  monthSummary,
  monthWeeks,
  pendingWeekClosings,
  weekSpecials,
  weekTiming,
} from './calendar';
import { emptyGroupCounts, totalSets, type ExerciseLookup } from './weeklySets';
import type { RoutineLookup } from './weekPlan';

describe('months', () => {
  it('finds the first day of a month and moves between months', () => {
    expect(monthStart('2026-11-04')).toBe('2026-11-01');
    expect(addMonths('2026-11-17', 1)).toBe('2026-12-01');
    expect(addMonths('2026-11-01', -1)).toBe('2026-10-01');
    expect(addMonths('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', -2)).toBe('2025-11-01');
    expect(isInMonth('2026-11-30', '2026-11-01')).toBe(true);
    expect(isInMonth('2026-12-01', '2026-11-01')).toBe(false);
  });

  it('lays out the weeks of a month, Monday first, with days of the neighbours', () => {
    const rows = monthWeeks('2026-11-15');
    // 1 Nov 2026 is a Sunday: it ends the first row, and 30 Nov starts a sixth one.
    expect(rows).toHaveLength(6);
    expect(rows[0]?.[0]).toBe('2026-10-26');
    expect(rows[0]?.[6]).toBe('2026-11-01');
    expect(rows[5]?.[0]).toBe('2026-11-30');
    expect(rows[5]?.[6]).toBe('2026-12-06');
    expect(monthWeeks('2026-10-01')).toHaveLength(5);
  });

  it('adds a sixth row when the month needs it and four when it fits', () => {
    // 1 Feb 2027 is a Monday and the month has 28 days: exactly four weeks.
    expect(monthWeeks('2027-02-10')).toHaveLength(4);
    // 1 Aug 2026 is a Saturday and the month has 31 days: six rows.
    expect(monthWeeks('2026-08-01')).toHaveLength(6);
    expect(monthWeeks('2026-08-01').at(-1)?.at(-1)).toBe('2026-09-06');
  });
});

describe('what each day holds', () => {
  const sessions = [{ date: '2026-11-02' }, { date: '2026-11-02' }, { date: '2026-10-31' }];
  const activities = [{ date: '2026-11-04' }, { date: '2026-12-01' }];

  it('counts sessions and activities per date', () => {
    const contents = dayContents(sessions, activities);
    expect(contents.get('2026-11-02')).toEqual({ sessions: 2, activities: 0 });
    expect(contents.get('2026-11-04')).toEqual({ sessions: 0, activities: 1 });
    expect(contents.has('2026-11-03')).toBe(false);
  });

  it('summarises only the days inside the month', () => {
    expect(monthSummary('2026-11-01', sessions, activities)).toEqual({
      sessions: 2,
      activities: 1,
    });
    expect(monthSummary('2027-01-01', sessions, activities)).toEqual({
      sessions: 0,
      activities: 0,
    });
  });
});

describe('special weeks', () => {
  it('reads the markers of a week record', () => {
    expect(weekSpecials(undefined)).toEqual({ deload: false, hiking: false, short: null });
    expect(weekSpecials(makeWeekPlan({ week: '2026-11-02', size: 4, deload: true }))).toEqual({
      deload: true,
      hiking: false,
      short: 4,
    });
    expect(weekSpecials(makeWeekPlan({ week: '2026-11-02', size: 3, hiking: true })).short).toBe(3);
  });

  it('tells past, current and future weeks apart', () => {
    expect(weekTiming('2026-10-26', '2026-11-04')).toBe('past');
    expect(weekTiming('2026-11-02', '2026-11-08')).toBe('current');
    expect(weekTiming('2026-11-09', '2026-11-08')).toBe('future');
  });
});

describe('closing finished weeks', () => {
  const exercises: ExerciseLookup = new Map([['press', { primaryGroup: 'chest' }]]);
  const item: PlanItem = {
    exerciseId: 'press',
    scheme: { blocks: [{ kind: 'straight', reps: '10', count: 3 }], rir: '1-2' },
    optional: false,
  };
  const routines: RoutineLookup = new Map([
    ['push', { items: [item] }],
    ['pull', { items: [] }],
    ['lowerB', { items: [] }],
    ['upper', { items: [item] }],
    ['lowerA', { items: [] }],
  ]);
  const base = { today: '2026-11-04', routines, exercises, now: 500 };

  it('closes past weeks with data using default options, and skips the current one', () => {
    const closed = pendingWeekClosings({
      ...base,
      weekPlans: [],
      dates: ['2026-10-27', '2026-11-03'],
    });
    expect(closed.map((w) => w.week)).toEqual(['2026-10-26']);
    const [week] = closed;
    expect(week).toMatchObject({ closedAt: 500, updatedAt: 500, size: 5, deload: false });
    expect(week?.plannedSetsByGroup && totalSets(week.plannedSetsByGroup)).toBe(6);
  });

  it('uses the options of the week record and closes record-only weeks', () => {
    const closed = pendingWeekClosings({
      ...base,
      weekPlans: [makeWeekPlan({ week: '2026-10-19', size: 3, deload: true })],
      dates: [],
    });
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({ week: '2026-10-19', size: 3, deload: true });
  });

  it('leaves already closed weeks alone and orders the result', () => {
    const frozen = makeWeekPlan({ week: '2026-10-12', plannedSetsByGroup: emptyGroupCounts() });
    const closed = pendingWeekClosings({
      ...base,
      weekPlans: [frozen],
      dates: ['2026-10-28', '2026-10-13', '2026-10-21'],
    });
    expect(closed.map((w) => w.week)).toEqual(['2026-10-19', '2026-10-26']);
  });

  it('closes nothing without data', () => {
    expect(pendingWeekClosings({ ...base, weekPlans: [], dates: [] })).toEqual([]);
  });
});
