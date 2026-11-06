import { describe, expect, it } from 'vitest';
import type { PlanItem } from '../model/routine';
import type { SetScheme } from '../model/scheme';
import {
  addExerciseItem,
  canAddExercise,
  changeRoutineItems,
  moveExerciseItem,
  removeExerciseItem,
  restoreExerciseItem,
  sessionTimes,
  timeOfDay,
} from './sessionEdit';

const scheme: SetScheme = { blocks: [{ kind: 'straight', reps: '10', count: 3 }], rir: '1-2' };
const item = (exerciseId: string, extra: Partial<PlanItem> = {}): PlanItem => ({
  exerciseId,
  scheme,
  optional: false,
  ...extra,
});
const ids = (items: readonly PlanItem[]) => items.map((i) => i.exerciseId);

describe('addExerciseItem', () => {
  const exercise = { id: 'row', defaultScheme: scheme };

  it('adds the exercise at the end with a copy of its default scheme', () => {
    const items = [item('a'), item('b')];
    const result = addExerciseItem(items, exercise, false);
    expect(ids(result ?? [])).toEqual(['a', 'b', 'row']);
    expect(result?.[2]).toEqual({ exerciseId: 'row', scheme, optional: false });
    expect(result?.[2]?.scheme).not.toBe(scheme);
    expect(items).toHaveLength(2);
  });

  it('tags it as added when the session has a routine', () => {
    expect(addExerciseItem([], exercise, true)?.[0]?.added).toBe(true);
  });

  it('refuses an exercise that is already there', () => {
    expect(addExerciseItem([item('row')], exercise, false)).toBeNull();
    expect(canAddExercise([item('row')], 'row')).toBe(false);
    expect(canAddExercise([item('row')], 'other')).toBe(true);
  });
});

describe('moveExerciseItem', () => {
  const items = [item('a'), item('b'), item('c')];

  it('swaps the exercise with its neighbour', () => {
    expect(ids(moveExerciseItem(items, 'a', 1) ?? [])).toEqual(['b', 'a', 'c']);
    expect(ids(moveExerciseItem(items, 'c', -1) ?? [])).toEqual(['a', 'c', 'b']);
  });

  it('does not move past the ends or an unknown exercise', () => {
    expect(moveExerciseItem(items, 'a', -1)).toBeNull();
    expect(moveExerciseItem(items, 'c', 1)).toBeNull();
    expect(moveExerciseItem(items, 'zzz', 1)).toBeNull();
  });
});

describe('removeExerciseItem and restoreExerciseItem', () => {
  const items = [item('a'), item('b'), item('c')];

  it('removes the exercise, or returns null when it is not there', () => {
    expect(ids(removeExerciseItem(items, 'b') ?? [])).toEqual(['a', 'c']);
    expect(removeExerciseItem(items, 'zzz')).toBeNull();
  });

  it('puts it back at its place', () => {
    const without = removeExerciseItem(items, 'b') ?? [];
    expect(ids(restoreExerciseItem(without, item('b'), 1) ?? [])).toEqual(['a', 'b', 'c']);
  });

  it('clamps the place and refuses an exercise that is back already', () => {
    expect(ids(restoreExerciseItem([item('a')], item('b'), 9) ?? [])).toEqual(['a', 'b']);
    expect(ids(restoreExerciseItem([item('a')], item('b'), -3) ?? [])).toEqual(['b', 'a']);
    expect(restoreExerciseItem([item('a')], item('a'), 0)).toBeNull();
  });
});

describe('changeRoutineItems', () => {
  const other: SetScheme = { blocks: [{ kind: 'straight', reps: '12', count: 2 }], rir: '' };
  const routine = {
    items: [
      item('x', { scheme: other }),
      item('b', { scheme: other }),
      item('opt', { optional: true }),
    ],
  };

  it('takes the exercises of the new routine, in its order', () => {
    const result = changeRoutineItems({
      items: [item('a'), item('b')],
      withData: new Set(),
      routine,
      deload: false,
    });
    expect(ids(result)).toEqual(['x', 'b', 'opt']);
    expect(result[1]?.scheme).toEqual(other);
  });

  it('keeps the rows of a common exercise that has data', () => {
    const result = changeRoutineItems({
      items: [item('b', { added: true })],
      withData: new Set(['b']),
      routine,
      deload: false,
    });
    expect(result[1]).toEqual(item('b'));
  });

  it('keeps exercises with data that the routine does not have, at the end, tagged', () => {
    const result = changeRoutineItems({
      items: [item('a'), item('b'), item('c')],
      withData: new Set(['a', 'c']),
      routine,
      deload: false,
    });
    expect(ids(result)).toEqual(['x', 'b', 'opt', 'a', 'c']);
    expect(result.slice(3).every((i) => i.added === true)).toBe(true);
    expect(result[1]?.scheme).toEqual(other);
  });

  it('reduces the new routine in a deload week without losing an exercise with data', () => {
    const result = changeRoutineItems({
      items: [item('opt')],
      withData: new Set(['opt']),
      routine,
      deload: true,
    });
    expect(ids(result)).toContain('opt');
    expect(result.find((i) => i.exerciseId === 'opt')?.added).toBeUndefined();
  });

  it('does not touch the routine or the old plan', () => {
    const old = [item('a', { added: true })];
    const before = structuredClone(routine);
    changeRoutineItems({ items: old, withData: new Set(['a']), routine, deload: false });
    expect(routine).toEqual(before);
    expect(old[0]?.added).toBe(true);
  });

  it('keeps only the exercises with data in a free session, without the tag', () => {
    const result = changeRoutineItems({
      items: [item('a', { added: true }), item('b'), item('c')],
      withData: new Set(['a', 'c']),
      routine: null,
      deload: false,
    });
    expect(ids(result)).toEqual(['a', 'c']);
    expect(result.some((i) => i.added)).toBe(false);
  });
});

describe('sessionTimes', () => {
  const base = { date: '2026-11-04', today: '2026-11-05', start: '17:30', end: '18:45' };
  const at = (date: string, h: number, m: number) =>
    new Date(`${date}T00:00:00`).setHours(h, m, 0, 0);

  it('turns the date and hours into timestamps', () => {
    expect(sessionTimes(base)).toEqual({
      ok: true,
      startedAt: at('2026-11-04', 17, 30),
      endedAt: at('2026-11-04', 18, 45),
    });
  });

  it('has no end while the session is in progress', () => {
    expect(sessionTimes({ ...base, end: null })).toEqual({
      ok: true,
      startedAt: at('2026-11-04', 17, 30),
      endedAt: null,
    });
  });

  it('accepts today and an end equal to the start', () => {
    expect(sessionTimes({ ...base, date: '2026-11-05', end: '17:30' }).ok).toBe(true);
  });

  it('rejects a future date', () => {
    expect(sessionTimes({ ...base, date: '2026-11-06' })).toEqual({ ok: false, error: 'future' });
  });

  it('rejects an end earlier than the start', () => {
    expect(sessionTimes({ ...base, end: '17:29' })).toEqual({ ok: false, error: 'endBeforeStart' });
  });

  it('rejects malformed values', () => {
    expect(sessionTimes({ ...base, date: '' })).toEqual({ ok: false, error: 'invalid' });
    expect(sessionTimes({ ...base, start: '' })).toEqual({ ok: false, error: 'invalid' });
    expect(sessionTimes({ ...base, start: '25:00' })).toEqual({ ok: false, error: 'invalid' });
    expect(sessionTimes({ ...base, end: '7pm' })).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('timeOfDay', () => {
  it('formats the local time as HH:MM', () => {
    expect(timeOfDay(new Date(2026, 10, 4, 7, 5).getTime())).toBe('07:05');
    expect(timeOfDay(new Date(2026, 10, 4, 18, 45).getTime())).toBe('18:45');
  });
});
