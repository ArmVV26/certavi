import { describe, expect, it } from 'vitest';
import type { PlanItem } from '../model/routine';
import { makeSession, makeSet, makeWeekPlan } from '../testing/builders';
import {
  closeWeek,
  defaultWeekPlan,
  isWeekFrozen,
  livePlan,
  weekPlanSummary,
  weekRoutines,
  weeksToClose,
  WEEK_ROUTINES,
  type RoutineLookup,
} from './weekPlan';
import {
  averageGroupCounts,
  compareWithPlan,
  doneSetsByGroup,
  emptyGroupCounts,
  plannedSetsByGroup,
  totalSets,
  type ExerciseLookup,
} from './weeklySets';

const exercises: ExerciseLookup = new Map([
  ['press', { primaryGroup: 'chest' }],
  ['remo', { primaryGroup: 'back' }],
  ['prensa', { primaryGroup: 'quads' }],
]);

const item = (exerciseId: string, count: number, optional = false): PlanItem => ({
  exerciseId,
  scheme: { blocks: [{ kind: 'straight', reps: '10-15', count }], rir: '1-2' },
  optional,
});

describe('weekly sets per group', () => {
  it('starts every group at 0', () => {
    const empty = emptyGroupCounts();
    expect(Object.keys(empty)).toHaveLength(10);
    expect(totalSets(empty)).toBe(0);
  });

  it('adds up planned sets, optional ones included, skipping unknown exercises', () => {
    const counts = plannedSetsByGroup(
      [
        [item('press', 3), item('remo', 2, true)],
        [item('press', 2), item('ghost', 9)],
      ],
      exercises,
    );
    expect(counts.chest).toBe(5);
    expect(counts.back).toBe(2);
    expect(totalSets(counts)).toBe(7);
  });

  it('counts effective sets done in the week, approach included, warm-ups not', () => {
    const log = {
      sessions: [
        makeSession({ id: 'mon', date: '2026-11-02' }),
        makeSession({ id: 'sun', date: '2026-11-08' }),
        makeSession({ id: 'next', date: '2026-11-09' }),
      ],
      sets: [
        makeSet({ sessionId: 'mon', exerciseId: 'press', kind: 'warmup' }),
        makeSet({ sessionId: 'mon', exerciseId: 'press', kind: 'top' }),
        makeSet({ sessionId: 'mon', exerciseId: 'press', kind: 'backoff', reps: 0 }),
        makeSet({ sessionId: 'sun', exerciseId: 'prensa', kind: 'approach' }),
        makeSet({ sessionId: 'sun', exerciseId: 'prensa', kind: 'extra' }),
        makeSet({ sessionId: 'sun', exerciseId: 'ghost' }),
        makeSet({ sessionId: 'next', exerciseId: 'remo' }),
      ],
    };
    const done = doneSetsByGroup('2026-11-02', log, exercises);
    expect([done.chest, done.quads, done.back]).toEqual([1, 2, 0]);
  });

  it('compares done with planned', () => {
    const done = { ...emptyGroupCounts(), chest: 10, back: 15 };
    const planned = { ...emptyGroupCounts(), chest: 13, back: 14 };
    const result = compareWithPlan(done, planned);
    expect(result.chest).toEqual({ done: 10, planned: 13, diff: -3 });
    expect(result.back.diff).toBe(1);
  });

  it('averages weeks to one decimal', () => {
    const weeks = [10, 13, 13, 0].map((chest) => ({ ...emptyGroupCounts(), chest }));
    expect(averageGroupCounts(weeks).chest).toBe(9);
    expect(
      averageGroupCounts([
        { ...emptyGroupCounts(), back: 1 },
        emptyGroupCounts(),
        emptyGroupCounts(),
      ]).back,
    ).toBe(0.3);
    expect(averageGroupCounts([])).toEqual(emptyGroupCounts());
  });
});

describe('week plan', () => {
  const routines: RoutineLookup = new Map([
    ['push', { items: [item('press', 4)] }],
    ['pull', { items: [item('remo', 3), item('remo', 3, true)] }],
    ['upper', { items: [item('press', 2), item('remo', 2)] }],
    ['lowerA', { items: [item('prensa', 3)] }],
    ['lowerB', { items: [item('prensa', 2)] }],
  ]);

  it('drops Upper with 4 sessions (never a leg day) and uses Lower Full with 3', () => {
    expect(WEEK_ROUTINES[4]).not.toContain('upper');
    expect(WEEK_ROUTINES[4]).toEqual(expect.arrayContaining(['lowerA', 'lowerB']));
    expect(WEEK_ROUTINES[3]).toEqual(['push', 'pull', 'lowerFull']);
  });

  it('computes the live plan for each week size', () => {
    expect(livePlan({ size: 5, deload: false }, routines, exercises).total).toBe(19);
    expect(livePlan({ size: 4, deload: false }, routines, exercises).total).toBe(15);
    // Lower Full is missing from this lookup: it counts as empty.
    expect(livePlan({ size: 3, deload: false }, routines, exercises).total).toBe(10);
  });

  it('plans a hiking week as gym_app: no Lower A, and Lower B becomes Lower Full', () => {
    expect(weekRoutines({ size: 5 })).toEqual(WEEK_ROUTINES[5]);
    expect(weekRoutines({ size: 5, hiking: true })).toEqual(['push', 'pull', 'lowerFull', 'upper']);
    expect(weekRoutines({ size: 4, hiking: true })).toEqual(['push', 'pull', 'lowerFull']);
    expect(weekRoutines({ size: 3, hiking: true })).toEqual(['push', 'pull', 'lowerFull']);
    // Lower Full is missing from this lookup: push 4 + pull 6 + upper 4.
    expect(livePlan({ size: 5, deload: false, hiking: true }, routines, exercises).total).toBe(14);
    const record = makeWeekPlan({ week: '2026-11-02', hiking: true });
    expect(weekPlanSummary('2026-11-02', '2026-11-05', record, routines, exercises)).toMatchObject({
      total: 14,
      size: 5,
      closed: false,
    });
  });

  it('applies the deload to the live plan', () => {
    const plan = livePlan({ size: 5, deload: true }, routines, exercises);
    // press 4→2, remo 3→2 (optional dropped), upper 2→1 + 2→1, prensa 3→2, 2→1
    expect(plan.total).toBe(9);
    expect(plan.deload).toBe(true);
  });

  it('uses the frozen plan for closed past weeks and the live one otherwise', () => {
    const frozen = { ...emptyGroupCounts(), chest: 99 };
    const record = makeWeekPlan({ week: '2026-11-02', plannedSetsByGroup: frozen, closedAt: 5 });
    const past = weekPlanSummary('2026-11-02', '2026-11-10', record, routines, exercises);
    expect(past).toMatchObject({ closed: true, total: 99 });
    const current = weekPlanSummary('2026-11-02', '2026-11-05', record, routines, exercises);
    expect(current).toMatchObject({ closed: false, total: 19 });
    const none = weekPlanSummary('2026-11-02', '2026-11-10', undefined, routines, exercises);
    expect(none).toMatchObject({ closed: false, size: 5, deload: false });
  });

  it('freezes a week once, keeping the first closing time', () => {
    const plan = livePlan({ size: 4, deload: false }, routines, exercises);
    const closed = closeWeek(defaultWeekPlan('2026-11-02', 1), plan, 100);
    expect(closed).toMatchObject({ id: 'week_2026-11-02', closedAt: 100, updatedAt: 100, size: 5 });
    expect(closed.plannedSetsByGroup && totalSets(closed.plannedSetsByGroup)).toBe(15);
    expect(closeWeek(closed, plan, 200).closedAt).toBe(100);
  });

  it('tells a frozen week by its saved plan, not by the closing time', () => {
    expect(isWeekFrozen(undefined)).toBe(false);
    expect(isWeekFrozen(makeWeekPlan({ week: '2026-11-02' }))).toBe(false);
    expect(isWeekFrozen(makeWeekPlan({ week: '2026-11-02', closedAt: 5 }))).toBe(false);
    expect(
      isWeekFrozen(makeWeekPlan({ week: '2026-11-02', plannedSetsByGroup: emptyGroupCounts() })),
    ).toBe(true);
  });

  it('lists past weeks that still need closing', () => {
    const records = [makeWeekPlan({ week: '2026-10-19', plannedSetsByGroup: emptyGroupCounts() })];
    expect(weeksToClose('2026-10-14', '2026-11-03', records)).toEqual(['2026-10-12', '2026-10-26']);
    expect(weeksToClose('2026-11-03', '2026-11-04', [])).toEqual([]);
  });
});
