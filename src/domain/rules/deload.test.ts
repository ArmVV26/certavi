import { describe, expect, it } from 'vitest';
import type { PlanItem } from '../model/routine';
import type { SetScheme } from '../model/scheme';
import { makeSession, makeWeekPlan } from '../testing/builders';
import { DELOAD_RIR, deloadItems, deloadScheme, weeksSinceDeload } from './deload';
import { countSchemeSets } from './scheme';

const scheme = (...blocks: SetScheme['blocks']): SetScheme => ({ blocks, rir: '1-2' });

describe('deloadScheme', () => {
  it('keeps top + back-off with half the sets, rounded up', () => {
    const topBo2 = scheme(
      { kind: 'top', reps: '6-8', count: 1 },
      { kind: 'backoff', reps: '8-10', count: 2 },
    );
    expect(deloadScheme(topBo2)).toEqual({
      blocks: [
        { kind: 'top', reps: '6-8', count: 1 },
        { kind: 'backoff', reps: '8-10', count: 1 },
      ],
      rir: DELOAD_RIR,
    });
  });

  it('leaves only the top set of a top + 1 back-off', () => {
    const topBo1 = scheme(
      { kind: 'top', reps: '6-8', count: 1 },
      { kind: 'backoff', reps: '8-10', count: 1 },
    );
    expect(deloadScheme(topBo1)).toEqual({
      blocks: [{ kind: 'top', reps: '6-8', count: 1 }],
      rir: '3-4',
    });
  });

  it('drops the approach set of the banded hack squat', () => {
    const hack = scheme(
      { kind: 'approach', reps: '', count: 1 },
      { kind: 'top', reps: '6-8', count: 1 },
      { kind: 'backoff', reps: '8-10', count: 2 },
    );
    const deloaded = deloadScheme(hack);
    expect(deloaded && countSchemeSets(deloaded)).toBe(2);
    expect(deloaded?.blocks.some((b) => b.kind === 'approach')).toBe(false);
  });

  it('halves straight sets, rounding up, with at least one', () => {
    expect(deloadScheme(scheme({ kind: 'straight', reps: '10-15', count: 3 }))?.blocks).toEqual([
      { kind: 'straight', reps: '10-15', count: 2 },
    ]);
    expect(
      deloadScheme(scheme({ kind: 'straight', reps: '12-15', count: 1 }))?.blocks[0]?.count,
    ).toBe(1);
  });

  it('falls back to 10-15 straight sets when there is nothing to halve', () => {
    expect(deloadScheme(scheme({ kind: 'approach', reps: '', count: 1 }))?.blocks).toEqual([
      { kind: 'straight', reps: '10-15', count: 1 },
    ]);
  });

  it('drops Bilbo sets', () => {
    expect(deloadScheme(scheme({ kind: 'bilbo', reps: '20-30', count: 1 }))).toBeNull();
  });
});

describe('deloadItems', () => {
  it('drops optional and Bilbo exercises', () => {
    const items: PlanItem[] = [
      {
        exerciseId: 'a',
        scheme: scheme({ kind: 'straight', reps: '10-15', count: 3 }),
        optional: false,
      },
      {
        exerciseId: 'b',
        scheme: scheme({ kind: 'straight', reps: '12-20', count: 3 }),
        optional: true,
      },
      {
        exerciseId: 'c',
        scheme: scheme({ kind: 'bilbo', reps: '20-30', count: 1 }),
        optional: false,
      },
    ];
    const result = deloadItems(items);
    expect(result.map((i) => i.exerciseId)).toEqual(['a']);
    expect(result[0]?.scheme.rir).toBe('3-4');
  });
});

describe('weeksSinceDeload', () => {
  const sessions = [
    makeSession({ id: 'a', date: '2026-10-06' }),
    makeSession({ id: 'b', date: '2026-10-14' }),
    // no session in the week of 19 Oct
    makeSession({ id: 'c', date: '2026-10-27' }),
    makeSession({ id: 'd', date: '2026-11-03' }),
    makeSession({ id: 'e', date: '2026-11-10' }),
  ];

  it('counts full weeks with sessions before the current one', () => {
    expect(weeksSinceDeload('2026-11-11', sessions)).toBe(4);
  });

  it('stops at the last deload week', () => {
    const plans = [makeWeekPlan({ week: '2026-10-26', deload: true })];
    expect(weeksSinceDeload('2026-11-11', sessions, plans)).toBe(1);
  });

  it('is 0 without sessions', () => {
    expect(weeksSinceDeload('2026-11-11', [])).toBe(0);
  });
});
