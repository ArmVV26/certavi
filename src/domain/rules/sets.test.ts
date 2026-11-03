import { describe, expect, it } from 'vitest';
import { makeSet } from '../testing/builders';
import { backoffWeight, roundToStep } from './backoff';
import {
  countPlanSets,
  countSchemeSets,
  expandScheme,
  findBlock,
  hasBlock,
  parseRepRange,
} from './scheme';
import { bestE1rm, compareSets, countsForStrength, epley1rm, isEffectiveSet, volume } from './sets';
import type { SetScheme } from '../model/scheme';

const hack: SetScheme = {
  blocks: [
    { kind: 'approach', reps: '', count: 1 },
    { kind: 'top', reps: '6-8', count: 1 },
    { kind: 'backoff', reps: '8-10', count: 2 },
  ],
  rir: '1-2',
};

describe('schemes', () => {
  it.each([
    ['6-8', { min: 6, max: 8 }],
    ['12', { min: 12, max: 12 }],
    ['~10', { min: 10, max: 10 }],
    ['', null],
  ])('parses %j', (range, expected) => {
    expect(parseRepRange(range)).toEqual(expected);
  });

  it('expands "1 aprox + 1 + 2" into four slots', () => {
    expect(expandScheme(hack)).toEqual([
      { kind: 'approach', reps: '', slot: 0 },
      { kind: 'top', reps: '6-8', slot: 1 },
      { kind: 'backoff', reps: '8-10', slot: 2 },
      { kind: 'backoff', reps: '8-10', slot: 3 },
    ]);
  });

  it('counts the approach set as a planned set', () => {
    expect(countSchemeSets(hack)).toBe(4);
    expect(countPlanSets([{ exerciseId: 'a', scheme: hack, optional: false }])).toBe(4);
  });

  it('finds blocks by kind', () => {
    expect(hasBlock(hack, 'top')).toBe(true);
    expect(hasBlock(hack, 'bilbo')).toBe(false);
    expect(findBlock(hack, 'backoff')?.count).toBe(2);
    expect(findBlock(hack, 'straight')).toBeUndefined();
  });
});

describe('sets', () => {
  const base = { sessionId: 's', exerciseId: 'e' };

  it('counts approach but not warm-up or 0-rep sets as effective', () => {
    expect(isEffectiveSet(makeSet({ ...base, kind: 'approach' }))).toBe(true);
    expect(isEffectiveSet(makeSet({ ...base, kind: 'warmup' }))).toBe(false);
    expect(isEffectiveSet(makeSet({ ...base, reps: 0 }))).toBe(false);
    expect(isEffectiveSet(makeSet({ ...base, kind: 'extra', weight: 0 }))).toBe(true);
  });

  it('leaves approach sets out of strength figures', () => {
    expect(countsForStrength(makeSet({ ...base, kind: 'approach' }))).toBe(false);
    expect(countsForStrength(makeSet({ ...base, kind: 'top' }))).toBe(true);
  });

  it('estimates the 1RM with Epley', () => {
    expect(epley1rm(100, 5)).toBeCloseTo(116.667, 3);
    expect(epley1rm(60, 1)).toBeCloseTo(62, 9);
    expect(epley1rm(0, 10)).toBe(0);
    expect(epley1rm(80, 0)).toBe(0);
  });

  it('picks the best set ignoring warm-up and approach', () => {
    const sets = [
      makeSet({ ...base, kind: 'warmup', weight: 200, reps: 10 }),
      makeSet({ ...base, kind: 'approach', weight: 150, reps: 5 }),
      makeSet({ ...base, kind: 'top', weight: 100, reps: 8 }),
      makeSet({ ...base, kind: 'backoff', weight: 90, reps: 10 }),
    ];
    const best = bestE1rm(sets);
    expect(best?.set).toBe(sets[2]);
    expect(best?.value).toBeCloseTo(126.667, 3);
    expect(bestE1rm([makeSet({ ...base, weight: 0 })])).toBeNull();
    expect(bestE1rm([])).toBeNull();
  });

  it('adds up the volume of effective sets', () => {
    const sets = [
      makeSet({ ...base, kind: 'warmup', weight: 40, reps: 10 }),
      makeSet({ ...base, kind: 'approach', weight: 60, reps: 3 }),
      makeSet({ ...base, kind: 'top', weight: 100, reps: 8 }),
    ];
    expect(volume(sets)).toBe(980);
  });

  it('orders warm-ups, planned sets by slot, then extras', () => {
    const sets = [
      makeSet({ ...base, kind: 'extra', slot: 0 }),
      makeSet({ ...base, kind: 'backoff', slot: 2 }),
      makeSet({ ...base, kind: 'warmup', slot: 1 }),
      makeSet({ ...base, kind: 'top', slot: 1 }),
      makeSet({ ...base, kind: 'warmup', slot: 0 }),
    ];
    expect(sets.sort(compareSets).map((s) => `${s.kind}${String(s.slot)}`)).toEqual([
      'warmup0',
      'warmup1',
      'top1',
      'backoff2',
      'extra0',
    ]);
  });
});

describe('back-off', () => {
  it('rounds to the weight step without float noise', () => {
    expect(roundToStep(58.5, 2.5)).toBe(57.5);
    expect(roundToStep(44.9, 2)).toBe(44);
    expect(roundToStep(0.1 + 0.2, 0.01)).toBe(0.3);
    expect(roundToStep(12.3, 0)).toBe(12.3);
  });

  it('suggests about 10 % below the top set', () => {
    expect(backoffWeight(65, 2.5)).toBe(57.5);
    expect(backoffWeight(50, 2)).toBe(46);
    expect(backoffWeight(170, 5)).toBe(155);
  });

  it('stays at least one step below the top set and never below 0', () => {
    expect(backoffWeight(5, 2.5)).toBe(2.5);
    expect(backoffWeight(2, 2.5)).toBe(0);
  });

  it('has no suggestion without a top weight', () => {
    expect(backoffWeight(0, 2.5)).toBeNull();
    expect(backoffWeight(Number.NaN, 2.5)).toBeNull();
  });
});
