import { describe, expect, it } from 'vitest';
import type { SetScheme } from '../model/scheme';
import type { SetEntry } from '../model/session';
import { makeSet } from '../testing/builders';
import { progressionAdvice, suggestedWeights, type ProgressionInput } from './progression';

const topBackoff: SetScheme = {
  blocks: [
    { kind: 'top', reps: '6-8', count: 1 },
    { kind: 'backoff', reps: '8-10', count: 2 },
  ],
  rir: '1-2',
};
const straight3: SetScheme = {
  blocks: [{ kind: 'straight', reps: '10-15', count: 3 }],
  rir: '1-2',
};
const bilbo: SetScheme = { blocks: [{ kind: 'bilbo', reps: '20-30', count: 1 }], rir: '1-2' };
const pullUps: SetScheme = { blocks: [{ kind: 'straight', reps: '~10', count: 3 }], rir: '1-2' };

const machine = { increment: 2.5, equipment: 'selectorized' } as const;
const legMachine = { increment: 5, equipment: 'plate-loaded' } as const;

const s = (fields: Partial<SetEntry>) => makeSet({ sessionId: 'ref', exerciseId: 'x', ...fields });
const advise = (input: Partial<ProgressionInput> & Pick<ProgressionInput, 'referenceSets'>) =>
  progressionAdvice({ scheme: topBackoff, exercise: machine, ...input });

describe('progression: top set', () => {
  const backoffs = [s({ kind: 'backoff', weight: 55, reps: 10 })];

  it('goes up when the top of the range is reached at RIR 1-2', () => {
    for (const rir of [1, 2]) {
      const advice = advise({
        referenceSets: [s({ kind: 'top', weight: 62.5, reps: 8, rir }), ...backoffs],
      });
      expect(advice).toEqual({
        action: 'increase',
        from: 62.5,
        to: 65,
        reason: 'range-top-reached',
      });
    }
  });

  it('goes up at the top of the range with more reserve or no RIR noted', () => {
    for (const rir of [3, null]) {
      const advice = advise({ referenceSets: [s({ kind: 'top', weight: 62.5, reps: 8, rir })] });
      expect(advice).toMatchObject({ action: 'increase', reason: 'range-top-reached' });
    }
  });

  it('holds at the top of the range with RIR 0', () => {
    const advice = advise({ referenceSets: [s({ kind: 'top', weight: 62.5, reps: 8, rir: 0 })] });
    expect(advice).toEqual({ action: 'hold', weight: 62.5, targetReps: 8, reason: 'top-rir-0' });
  });

  it('goes up no matter the RIR when the range is exceeded', () => {
    const advice = advise({ referenceSets: [s({ kind: 'top', weight: 62.5, reps: 10, rir: 0 })] });
    expect(advice).toEqual({ action: 'increase', from: 62.5, to: 65, reason: 'range-exceeded' });
  });

  it('uses the exercise increment (+5 kg on leg compounds)', () => {
    const advice = advise({
      exercise: legMachine,
      referenceSets: [s({ kind: 'top', weight: 170, reps: 9, rir: 1 })],
    });
    expect(advice).toMatchObject({ action: 'increase', from: 170, to: 175 });
  });

  it('holds below the range and asks for one more rep', () => {
    expect(advise({ referenceSets: [s({ kind: 'top', weight: 65, reps: 7, rir: 1 })] })).toEqual({
      action: 'hold',
      weight: 65,
      targetReps: 8,
      reason: 'below-range',
    });
    expect(
      advise({ referenceSets: [s({ kind: 'top', weight: 65, reps: 4, rir: 0 })] }),
    ).toMatchObject({
      targetReps: 6,
    });
  });

  it('falls back to straight sets when no top set was logged', () => {
    const scheme: SetScheme = {
      blocks: [...topBackoff.blocks, { kind: 'straight', reps: '10-12', count: 1 }],
      rir: '1-2',
    };
    const advice = advise({
      scheme,
      referenceSets: [s({ kind: 'straight', weight: 40, reps: 12 })],
    });
    expect(advice).toMatchObject({ action: 'increase', reason: 'all-sets-at-top' });
    expect(advise({ referenceSets: backoffs })).toEqual({ action: 'no-reference' });
  });

  it('handles the incline curl (top + back-off on the same 8-12 range, dumbbells +2 kg)', () => {
    const scheme: SetScheme = {
      blocks: [
        { kind: 'top', reps: '8-12', count: 1 },
        { kind: 'backoff', reps: '8-12', count: 2 },
      ],
      rir: '1-2',
    };
    const advice = progressionAdvice({
      scheme,
      exercise: { increment: 2, equipment: 'dumbbell' },
      referenceSets: [s({ kind: 'top', weight: 24, reps: 12, rir: 1 })],
    });
    expect(advice).toEqual({ action: 'increase', from: 24, to: 26, reason: 'range-top-reached' });
  });
});

describe('progression: straight sets (double progression)', () => {
  it('goes up when every planned set reaches the top at the same weight', () => {
    const sets = [12, 15, 15, 15].map((reps, i) => s({ weight: i === 0 ? 15 : 20, reps }));
    const advice = advise({ scheme: straight3, referenceSets: sets });
    expect(advice).toEqual({ action: 'increase', from: 20, to: 22.5, reason: 'all-sets-at-top' });
  });

  it('holds while some set is below the top', () => {
    const sets = [15, 14, 15].map((reps) => s({ weight: 20, reps }));
    expect(advise({ scheme: straight3, referenceSets: sets })).toEqual({
      action: 'hold',
      weight: 20,
      targetReps: 15,
      reason: 'not-all-sets-at-top',
    });
  });

  it('holds when fewer sets than planned were done', () => {
    const sets = [15, 15].map((reps) => s({ weight: 20, reps }));
    expect(advise({ scheme: straight3, referenceSets: sets })).toMatchObject({ action: 'hold' });
  });

  it('works with 0 kg', () => {
    const sets = [15, 15, 15].map((reps) => s({ weight: 0, reps }));
    expect(advise({ scheme: straight3, referenceSets: sets })).toMatchObject({
      action: 'increase',
      from: 0,
      to: 2.5,
    });
  });

  it('has no reference without straight sets or without a range', () => {
    expect(advise({ scheme: straight3, referenceSets: [s({ kind: 'extra' })] })).toEqual({
      action: 'no-reference',
    });
    const noRange: SetScheme = { blocks: [{ kind: 'straight', reps: '', count: 2 }], rir: '' };
    expect(advise({ scheme: noRange, referenceSets: [s({})] })).toEqual({ action: 'no-reference' });
  });
});

describe('progression: special cases', () => {
  it('does not progress in a deload week', () => {
    expect(advise({ deload: true, referenceSets: [s({ kind: 'top', reps: 10 })] })).toEqual({
      action: 'deload',
    });
  });

  it('has no reference without history', () => {
    expect(advise({ referenceSets: null })).toEqual({ action: 'no-reference' });
    expect(advise({ referenceSets: [] })).toEqual({ action: 'no-reference' });
  });

  it('adds 5 kg to a Bilbo set past 30 reps', () => {
    const input = { scheme: bilbo, exercise: { increment: 2.5, equipment: 'barbell' } as const };
    expect(
      progressionAdvice({ ...input, referenceSets: [s({ kind: 'bilbo', weight: 40, reps: 31 })] }),
    ).toEqual({
      action: 'increase',
      from: 40,
      to: 45,
      reason: 'range-exceeded',
    });
    expect(
      progressionAdvice({ ...input, referenceSets: [s({ kind: 'bilbo', weight: 40, reps: 30 })] }),
    ).toEqual({
      action: 'hold',
      weight: 40,
      targetReps: 31,
      reason: 'below-range',
    });
    expect(progressionAdvice({ ...input, referenceSets: [s({ kind: 'extra' })] })).toEqual({
      action: 'no-reference',
    });
  });

  it('progresses pull-ups with a thinner band', () => {
    const input = {
      scheme: pullUps,
      exercise: { increment: 2.5, equipment: 'bodyweight' } as const,
    };
    const all10 = [10, 11, 10].map((reps) => s({ weight: 0, reps }));
    expect(progressionAdvice({ ...input, referenceSets: all10 })).toEqual({
      action: 'thinner-band',
      targetReps: 10,
    });
    const short = [10, 9, 8].map((reps) => s({ weight: 0, reps }));
    expect(progressionAdvice({ ...input, referenceSets: short })).toEqual({
      action: 'same-band',
      targetReps: 10,
    });
    const approachOnly = [s({ kind: 'approach', reps: 5 })];
    expect(progressionAdvice({ ...input, referenceSets: approachOnly })).toEqual({
      action: 'same-band',
      targetReps: 10,
    });
  });

  it('defaults pull-ups to 10 reps when the scheme has no range', () => {
    const scheme: SetScheme = { blocks: [{ kind: 'top', reps: '', count: 1 }], rir: '' };
    const advice = progressionAdvice({
      scheme,
      exercise: { increment: 2.5, equipment: 'bodyweight' },
      referenceSets: [s({ kind: 'top', reps: 10 })],
    });
    expect(advice).toEqual({ action: 'thinner-band', targetReps: 10 });
  });
});

describe('suggestedWeights', () => {
  it('derives the back-off from the next top weight', () => {
    expect(
      suggestedWeights({ action: 'increase', from: 62.5, to: 65, reason: 'range-exceeded' }, 2.5),
    ).toEqual({
      main: 65,
      backoff: 57.5,
    });
    expect(
      suggestedWeights({ action: 'hold', weight: 0, targetReps: 15, reason: 'below-range' }, 2.5),
    ).toEqual({
      main: 0,
      backoff: null,
    });
  });

  it('has nothing to suggest without a weight', () => {
    expect(suggestedWeights({ action: 'no-reference' }, 2.5)).toBeNull();
    expect(suggestedWeights({ action: 'thinner-band', targetReps: 10 }, 2.5)).toBeNull();
  });
});
