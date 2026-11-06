import { describe, expect, it } from 'vitest';
import { exerciseSchema } from '../model/exercise';
import { SEED_EXERCISES, SEED_EXERCISES_BY_ID, SEED_ROUTINES } from '../seed';
import {
  INCREMENT_RANGE,
  MAX_EXERCISE_NAME,
  draftFromExercise,
  exerciseFromDraft,
  isValidIncrement,
  newExerciseDraft,
  routineExerciseIds,
  routinesWithExercise,
  simpleSchemeOf,
  suggestedIncrement,
  validateExerciseDraft,
  type ExerciseDraft,
} from './exerciseEdit';

const NAMES: Record<string, string> = { tbar: 'Remo en T', mine: 'Press landmine' };
const nameOf = (e: { name: { key: string } | { text: string } }) =>
  'text' in e.name ? e.name.text : (NAMES[e.name.key] ?? e.name.key);
const existing = [
  { id: 'tbar', name: { key: 'tbar' } },
  { id: 'mine', name: { text: 'Press landmine' } },
];

function draft(fields: Partial<ExerciseDraft> = {}): ExerciseDraft {
  return { ...newExerciseDraft(), name: 'Curl zottman', ...fields };
}

const codes = (d: ExerciseDraft, editingId?: string) =>
  validateExerciseDraft(d, existing, { nameOf, editingId }).map((e) => `${e.field}:${e.code}`);

describe('newExerciseDraft', () => {
  it('starts empty, with straight sets and the suggested step', () => {
    expect(newExerciseDraft()).toMatchObject({
      name: '',
      primaryGroup: 'chest',
      equipment: 'other',
      kind: 'isolation',
      secondaryMuscles: [],
      scheme: { sets: 3, reps: '8-12', rir: '1-2' },
      increment: 2.5,
    });
  });
});

describe('suggestedIncrement', () => {
  it('gives 2 kg to dumbbells, 5 kg to leg compounds and 2.5 kg to the rest', () => {
    expect(
      suggestedIncrement({ primaryGroup: 'chest', equipment: 'dumbbell', kind: 'compound' }),
    ).toBe(2);
    expect(
      suggestedIncrement({ primaryGroup: 'quads', equipment: 'plate-loaded', kind: 'compound' }),
    ).toBe(5);
    expect(
      suggestedIncrement({ primaryGroup: 'quads', equipment: 'selectorized', kind: 'isolation' }),
    ).toBe(2.5);
    expect(suggestedIncrement({ primaryGroup: 'back', equipment: 'cable', kind: 'compound' })).toBe(
      2.5,
    );
  });
});

describe('validateExerciseDraft', () => {
  it('accepts a good draft', () => {
    expect(codes(draft())).toEqual([]);
  });

  it('rejects an empty or blank name and one that is too long', () => {
    expect(codes(draft({ name: '' }))).toEqual(['name:name-empty']);
    expect(codes(draft({ name: '   ' }))).toEqual(['name:name-empty']);
    expect(codes(draft({ name: 'x'.repeat(MAX_EXERCISE_NAME + 1) }))).toEqual([
      'name:name-too-long',
    ]);
    expect(codes(draft({ name: 'x'.repeat(MAX_EXERCISE_NAME) }))).toEqual([]);
  });

  it('rejects a name already used, ignoring case, accents and spaces', () => {
    expect(codes(draft({ name: ' REMO en t ' }))).toEqual(['name:name-taken']);
    expect(codes(draft({ name: 'press LANDMINE' }))).toEqual(['name:name-taken']);
    expect(codes(draft({ name: 'Remó en T' }))).toEqual(['name:name-taken']);
  });

  it('lets the exercise being edited keep its own name', () => {
    expect(codes(draft({ name: 'Press landmine' }), 'mine')).toEqual([]);
    expect(codes(draft({ name: 'Remo en T' }), 'mine')).toEqual(['name:name-taken']);
  });

  it('checks the number of sets', () => {
    for (const sets of [null, 0, 11, 2.5]) {
      expect(codes(draft({ scheme: { sets, reps: '8-12', rir: '' } }))).toEqual([
        'sets:sets-range',
      ]);
    }
    expect(codes(draft({ scheme: { sets: 10, reps: '8-12', rir: '' } }))).toEqual([]);
  });

  it('accepts reps like 10, ~10 and 8-12 and rejects the rest', () => {
    const reps = (value: string) => codes(draft({ scheme: { sets: 3, reps: value, rir: '' } }));
    for (const ok of ['10', '~10', '8-12', ' 8-12 ']) expect(reps(ok)).toEqual([]);
    for (const bad of ['', 'abc', '0', '12-8', '8-', '8 - 12', '1000']) {
      expect(reps(bad)).toEqual(['reps:reps-invalid']);
    }
  });

  it('accepts an empty RIR, 2 and 1-2 and rejects the rest', () => {
    const rir = (value: string) => codes(draft({ scheme: { sets: 3, reps: '10', rir: value } }));
    for (const ok of ['', '2', '1-2']) expect(rir(ok)).toEqual([]);
    for (const bad of ['a', '12', '1-', '1-2-3']) expect(rir(bad)).toEqual(['rir:rir-invalid']);
  });

  it('checks the weight step range', () => {
    for (const increment of [null, 0, 0.1, 50.5, Number.NaN]) {
      expect(codes(draft({ increment }))).toEqual(['increment:increment-range']);
    }
    expect(codes(draft({ increment: INCREMENT_RANGE.min }))).toEqual([]);
    expect(codes(draft({ increment: INCREMENT_RANGE.max }))).toEqual([]);
  });

  it('lists every problem in the order of the form', () => {
    expect(
      codes(draft({ name: '', scheme: { sets: 0, reps: 'x', rir: 'x' }, increment: 0 })),
    ).toEqual([
      'name:name-empty',
      'sets:sets-range',
      'reps:reps-invalid',
      'rir:rir-invalid',
      'increment:increment-range',
    ]);
  });
});

describe('isValidIncrement', () => {
  it('accepts the allowed range only', () => {
    expect(isValidIncrement(2.5)).toBe(true);
    expect(isValidIncrement(null)).toBe(false);
    expect(isValidIncrement(0)).toBe(false);
    expect(isValidIncrement(51)).toBe(false);
  });
});

describe('exerciseFromDraft', () => {
  it('builds a custom exercise with plain-text name and straight sets that passes the schema', () => {
    const exercise = exerciseFromDraft(
      draft({
        name: '  Curl zottman ',
        primaryGroup: 'biceps',
        secondaryMuscles: ['forearms', 'biceps', 'forearms'],
        equipment: 'dumbbell',
        supportsStraps: true,
        scheme: { sets: 4, reps: ' 10-12', rir: '2 ' },
        increment: 2,
      }),
      'exe_1',
    );
    expect(exercise).toMatchObject({
      id: 'exe_1',
      name: { text: 'Curl zottman' },
      primaryGroup: 'biceps',
      secondaryMuscles: ['forearms'],
      equipment: 'dumbbell',
      supportsStraps: true,
      increment: 2,
      custom: true,
      archived: false,
      defaultScheme: { blocks: [{ kind: 'straight', reps: '10-12', count: 4 }], rir: '2' },
    });
    expect(exerciseSchema.safeParse({ ...exercise, type: 'exercise', updatedAt: 1 }).success).toBe(
      true,
    );
  });

  it('keeps the archived state it is given', () => {
    expect(exerciseFromDraft(draft(), 'exe_1', true).archived).toBe(true);
  });

  it('throws for a draft with empty numbers', () => {
    expect(() => exerciseFromDraft(draft({ increment: null }), 'exe_1')).toThrow();
    expect(() =>
      exerciseFromDraft(draft({ scheme: { sets: null, reps: '8', rir: '' } }), 'exe_1'),
    ).toThrow();
  });
});

describe('draftFromExercise and simpleSchemeOf', () => {
  it('turns a created exercise back into the same draft', () => {
    const d = draft({
      primaryGroup: 'biceps',
      secondaryMuscles: ['forearms'],
      unilateral: true,
      scheme: { sets: 4, reps: '10-12', rir: '2' },
      increment: 2,
    });
    const exercise = { ...exerciseFromDraft(d, 'exe_1'), type: 'exercise' as const, updatedAt: 1 };
    expect(draftFromExercise(exercise, 'Curl zottman')).toEqual(d);
  });

  it('approximates a seed scheme that is not straight sets', () => {
    const seed = SEED_EXERCISES_BY_ID.get('remo-t');
    if (!seed) throw new Error('seed exercise missing');
    // 1 top + back-offs: the reps of the first block with a target and every planned set.
    const simple = simpleSchemeOf(seed.defaultScheme);
    expect(simple.reps).not.toBe('');
    expect(simple.sets).toBeGreaterThanOrEqual(1);
    expect(simple.sets).toBeLessThanOrEqual(10);
  });

  it('falls back to 8-12 for a scheme with no rep target', () => {
    expect(simpleSchemeOf({ blocks: [{ kind: 'approach', reps: '', count: 1 }], rir: '' })).toEqual(
      { sets: 1, reps: '8-12', rir: '' },
    );
  });

  it('clamps the sets to what the form allows', () => {
    expect(
      simpleSchemeOf({
        blocks: [
          { kind: 'straight', reps: '10', count: 1 },
          { kind: 'backoff', reps: '10', count: 14 },
        ],
        rir: '',
      }).sets,
    ).toBe(10);
  });
});

describe('routines of an exercise', () => {
  it('finds the routines that have it, in order', () => {
    const found = routinesWithExercise('remo-t', SEED_ROUTINES).map((r) => r.id);
    expect(found.length).toBeGreaterThan(0);
    expect(routinesWithExercise('does-not-exist', SEED_ROUTINES)).toEqual([]);
  });

  it('collects the ids of every exercise in a routine', () => {
    const ids = routineExerciseIds(SEED_ROUTINES);
    expect(ids.has('remo-t')).toBe(true);
    // Exercises that are in the catalog but in no seed routine.
    expect(ids.has('dominadas')).toBe(false);
    expect(SEED_EXERCISES.length).toBeGreaterThan(ids.size);
  });
});
