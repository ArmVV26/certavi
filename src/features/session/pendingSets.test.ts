import { describe, expect, it } from 'vitest';
import { makeSet } from '../../domain/testing/builders';
import { addPending, dropPending, NO_PENDING, settle, withPending } from './pendingSets';

const set = (id: string, updatedAt: number, slot = 0, exerciseId = 'remo-t') =>
  makeSet({ id, updatedAt, slot, exerciseId, sessionId: 's1', weight: updatedAt });

describe('withPending', () => {
  it('returns the live sets themselves when nothing is pending', () => {
    const live = [set('a', 1)];
    expect(withPending(live, NO_PENDING)).toBe(live);
  });

  it('adds a pending set the live ones do not have yet', () => {
    const merged = withPending([set('a', 1)], addPending(NO_PENDING, set('b', 2, 1)));
    expect(merged.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('shows a pending set instead of the older live version, in the same place', () => {
    const merged = withPending([set('a', 1), set('b', 1, 1)], addPending(NO_PENDING, set('a', 5)));
    expect(merged.map((s) => [s.id, s.weight])).toEqual([
      ['a', 5],
      ['b', 1],
    ]);
  });

  it('keeps the live set when it is as new as the pending one', () => {
    const live = set('a', 5);
    expect(withPending([live], addPending(NO_PENDING, set('a', 5)))).toEqual([live]);
  });
});

describe('settle', () => {
  it('drops the pending sets the live ones have caught up with', () => {
    const pending = addPending(addPending(NO_PENDING, set('a', 5)), set('b', 7, 1));
    const settled = settle(pending, [set('a', 5), set('b', 3, 1)]);
    expect([...settled.keys()]).toEqual(['b']);
  });

  it('keeps a pending set the live query has not brought yet', () => {
    const pending = addPending(NO_PENDING, set('a', 5));
    expect(settle(pending, [])).toBe(pending);
  });

  it('returns the same object when there is nothing to settle', () => {
    expect(settle(NO_PENDING, [set('a', 1)])).toBe(NO_PENDING);
  });
});

describe('dropPending', () => {
  it('drops only the sets that match', () => {
    const pending = addPending(addPending(NO_PENDING, set('a', 5, 0)), set('b', 6, 1));
    const dropped = dropPending(pending, (s) => s.slot === 0);
    expect([...dropped.keys()]).toEqual(['b']);
  });

  it('returns the same object when nothing matched', () => {
    const pending = addPending(NO_PENDING, set('a', 5));
    expect(dropPending(pending, () => false)).toBe(pending);
  });
});
