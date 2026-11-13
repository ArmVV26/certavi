import { describe, expect, it } from 'vitest';
import type { DayPlan, Routine } from '../../domain';
import { makeSession } from '../../domain/testing/builders';
import { heroOf } from './todayModel';

// Only what heroOf reads is real; the rest of a routine is not needed here.
const routine = {
  id: 'push',
  type: 'routine',
  name: { text: 'Push' },
  items: [],
} as unknown as Routine;
const routinePlan: DayPlan = { kind: 'routine', routineId: 'push' };
const restPlan: DayPlan = { kind: 'rest', rest: 'football', activities: ['football'] };

describe('heroOf', () => {
  it('offers to start a routine day that has no session yet', () => {
    expect(heroOf(routinePlan, routine, undefined)).toEqual({ kind: 'start', routine });
  });

  it('continues a session in progress and shows a finished one as done', () => {
    const open = makeSession({ id: 'a', date: '2026-11-04', routineId: 'push', endedAt: null });
    const finished = makeSession({ id: 'b', date: '2026-11-04', routineId: 'push', endedAt: 99 });
    expect(heroOf(routinePlan, routine, open)).toEqual({
      kind: 'continue',
      routine,
      session: open,
    });
    expect(heroOf(routinePlan, routine, finished)).toEqual({
      kind: 'done',
      routine,
      session: finished,
    });
  });

  it('shows a rest day with its activities', () => {
    expect(heroOf(restPlan, undefined, undefined)).toEqual({ kind: 'rest', plan: restPlan });
  });

  it('treats a routine day whose routine is gone as a plain rest day', () => {
    expect(heroOf(routinePlan, undefined, undefined)).toEqual({
      kind: 'rest',
      plan: { kind: 'rest', rest: 'rest', activities: [] },
    });
  });
});
