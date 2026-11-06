import { describe, expect, it } from 'vitest';
import type { PlanItem } from '../model/routine';
import type { SetScheme } from '../model/scheme';
import { SEED_ROUTINES, SEED_ROUTINES_BY_ID } from '../seed';
import {
  MAX_ROUTINE_SETS,
  addRoutineRow,
  differsFromSeed,
  isSeedRoutine,
  removeRoutineRow,
  routineRows,
  routineSummary,
  sameItems,
  setRoutineRowKind,
  setRoutineRowReps,
  setSchemeRir,
  sortRoutines,
  validateRoutineItems,
  normalizeRoutineItems,
  withNote,
  withScheme,
} from './routineEdit';
import { addExerciseItem, moveExerciseItem, removeExerciseItem } from './sessionEdit';

const topBackoff: SetScheme = {
  blocks: [
    { kind: 'top', reps: '6-8', count: 1 },
    { kind: 'backoff', reps: '8-10', count: 2 },
  ],
  rir: '1-2',
};

const item = (exerciseId: string, scheme: SetScheme = topBackoff): PlanItem => ({
  exerciseId,
  scheme,
  optional: false,
});

const codes = (items: PlanItem[]) =>
  validateRoutineItems(items).map(
    (i) => `${i.code}:${i.exerciseId ?? '-'}:${String(i.row ?? '-')}`,
  );

describe('editing the sets of a scheme', () => {
  it('lists one row per set', () => {
    expect(routineRows(topBackoff)).toEqual([
      { kind: 'top', reps: '6-8' },
      { kind: 'backoff', reps: '8-10' },
      { kind: 'backoff', reps: '8-10' },
    ]);
  });

  it('adds a set that copies the last one, and a top set is followed by a back-off', () => {
    const more = addRoutineRow(topBackoff);
    expect(more?.blocks).toEqual([
      { kind: 'top', reps: '6-8', count: 1 },
      { kind: 'backoff', reps: '8-10', count: 3 },
    ]);
    const onlyTop = addRoutineRow({ blocks: [{ kind: 'top', reps: '6-8', count: 1 }], rir: '' });
    expect(onlyTop?.blocks).toEqual([
      { kind: 'top', reps: '6-8', count: 1 },
      { kind: 'backoff', reps: '6-8', count: 1 },
    ]);
  });

  it('stops at 20 sets per exercise', () => {
    const full: SetScheme = {
      blocks: [{ kind: 'straight', reps: '10', count: 19 }],
      rir: '',
    };
    const next = addRoutineRow(full);
    expect(next?.blocks).toEqual([{ kind: 'straight', reps: '10', count: 20 }]);
    expect(next && addRoutineRow(next)).toBeNull();
    expect(MAX_ROUTINE_SETS).toBe(20);
  });

  it('removes a set but never the last one', () => {
    expect(removeRoutineRow(topBackoff, 0)?.blocks).toEqual([
      { kind: 'backoff', reps: '8-10', count: 2 },
    ]);
    const one: SetScheme = { blocks: [{ kind: 'straight', reps: '10', count: 1 }], rir: '' };
    expect(removeRoutineRow(one, 0)).toBeNull();
    expect(removeRoutineRow(topBackoff, 7)).toBeNull();
  });

  it('changes the kind and the reps of one set, splitting its block', () => {
    expect(setRoutineRowKind(topBackoff, 0, 'straight')?.blocks).toEqual([
      { kind: 'straight', reps: '6-8', count: 1 },
      { kind: 'backoff', reps: '8-10', count: 2 },
    ]);
    expect(setRoutineRowReps(topBackoff, 1, '5')?.blocks).toEqual([
      { kind: 'top', reps: '6-8', count: 1 },
      { kind: 'backoff', reps: '5', count: 1 },
      { kind: 'backoff', reps: '8-10', count: 1 },
    ]);
    expect(setRoutineRowKind(topBackoff, 9, 'top')).toBeNull();
    expect(setRoutineRowReps(topBackoff, 9, '5')).toBeNull();
  });

  it('keeps what the user typed, even when it is not valid yet', () => {
    expect(setRoutineRowReps(topBackoff, 0, '6-')?.blocks[0]).toEqual({
      kind: 'top',
      reps: '6-',
      count: 1,
    });
    expect(setSchemeRir(topBackoff, '1-').rir).toBe('1-');
  });
});

describe('items', () => {
  it('replaces the scheme and the note of an item', () => {
    const base = item('a');
    expect(withScheme(base, setSchemeRir(base.scheme, '3')).scheme.rir).toBe('3');
    expect(withNote(base, 'Agarre ancho ').note).toEqual({ text: 'Agarre ancho ' });
    expect(withNote(base, { key: 'routines.notes.calf' }).note).toEqual({
      key: 'routines.notes.calf',
    });
    const noted = withNote(base, 'x');
    expect('note' in withNote(noted, '')).toBe(false);
    expect('note' in withNote(noted, null)).toBe(false);
  });

  it('adds, moves and removes exercises with the session helpers', () => {
    const items = [item('a'), item('b')];
    const added = addExerciseItem(items, { id: 'c', defaultScheme: topBackoff }, false);
    expect(added?.map((i) => i.exerciseId)).toEqual(['a', 'b', 'c']);
    expect(added?.[2]).not.toHaveProperty('added');
    expect(moveExerciseItem(added ?? [], 'c', -1)?.map((i) => i.exerciseId)).toEqual([
      'a',
      'c',
      'b',
    ]);
    expect(removeExerciseItem(items, 'a')?.map((i) => i.exerciseId)).toEqual(['b']);
  });
});

describe('normalizeRoutineItems', () => {
  it('removes the spaces of reps and RIR and trims the notes', () => {
    const messy = withNote(
      item('a', {
        blocks: [{ kind: 'straight', reps: ' 6 - 8 ', count: 2 }],
        rir: ' 1 - 2',
      }),
      '  Agarre ancho \n',
    );
    const [clean] = normalizeRoutineItems([messy]);
    expect(clean?.scheme).toEqual({
      blocks: [{ kind: 'straight', reps: '6-8', count: 2 }],
      rir: '1-2',
    });
    expect(clean?.note).toEqual({ text: 'Agarre ancho' });
  });

  it('drops a note that is only spaces and leaves the notes that come with the app', () => {
    const [blank, keyed] = normalizeRoutineItems([
      withNote(item('a'), '   '),
      withNote(item('b'), { key: 'routines.notes.calf' }),
    ]);
    expect(blank).not.toHaveProperty('note');
    expect(keyed?.note).toEqual({ key: 'routines.notes.calf' });
  });
});

describe('validateRoutineItems', () => {
  it('accepts the six routines that come with the app', () => {
    for (const routine of SEED_ROUTINES) {
      expect(validateRoutineItems(routine.items)).toEqual([]);
    }
  });

  it('needs at least one exercise, and each one only once', () => {
    expect(codes([])).toEqual(['no-exercises:-:-']);
    expect(codes([item('a'), item('a')])).toEqual(['duplicate-exercise:a:-']);
  });

  it('asks for the reps of every set except approach sets', () => {
    const scheme: SetScheme = {
      blocks: [
        { kind: 'approach', reps: '', count: 1 },
        { kind: 'top', reps: '', count: 1 },
        { kind: 'backoff', reps: '8-10', count: 1 },
      ],
      rir: '',
    };
    expect(codes([item('a', scheme)])).toEqual(['reps-required:a:1']);
  });

  it.each(['abc', '10-6', '0', '8-', '1000', '6--8', '~', '0-5'])(
    'rejects the reps "%s"',
    (reps) => {
      const scheme: SetScheme = { blocks: [{ kind: 'straight', reps, count: 1 }], rir: '' };
      expect(codes([item('a', scheme)])).toEqual(['reps-invalid:a:0']);
    },
  );

  it.each(['8', '~10', '6-8', '12-12', '1', '100'])('accepts the reps "%s"', (reps) => {
    const scheme: SetScheme = { blocks: [{ kind: 'straight', reps, count: 1 }], rir: '' };
    expect(codes([item('a', scheme)])).toEqual([]);
  });

  it('checks the RIR', () => {
    const withRir = (rir: string): PlanItem =>
      item('a', { blocks: [{ kind: 'straight', reps: '10', count: 1 }], rir });
    expect(codes([withRir('abc')])).toEqual(['rir-invalid:a:-']);
    expect(codes([withRir('3-1')])).toEqual(['rir-invalid:a:-']);
    expect(codes([withRir('1-')])).toEqual(['rir-invalid:a:-']);
    expect(codes([withRir('')])).toEqual([]);
    expect(codes([withRir('2')])).toEqual([]);
    expect(codes([withRir('1-2')])).toEqual([]);
    expect(codes([withRir('2-2')])).toEqual([]);
  });

  it('reports the exercise without sets', () => {
    const empty = item('a', { blocks: [], rir: '' });
    expect(codes([empty])).toEqual(['no-sets:a:-']);
  });
});

describe('comparing with the original routine', () => {
  const push = SEED_ROUTINES_BY_ID.get('push');
  if (!push) throw new Error('push routine missing');

  it('knows the six seed routines and nothing else', () => {
    expect(SEED_ROUTINES.map((r) => isSeedRoutine(r.id))).toEqual(SEED_ROUTINES.map(() => true));
    expect(isSeedRoutine('mine')).toBe(false);
  });

  it('does not differ from itself, nor after set-by-set rewriting of its blocks', () => {
    expect(differsFromSeed(push)).toBe(false);
    // Same sets, written with the key order the schema produces after a save.
    const rewritten = push.items.map((i) => ({
      exerciseId: i.exerciseId,
      scheme: { rir: i.scheme.rir, blocks: i.scheme.blocks.map((b) => ({ ...b })) },
      ...(i.note ? { note: i.note } : {}),
      optional: i.optional,
    }));
    expect(differsFromSeed({ id: 'push', items: rewritten })).toBe(false);
    // Blocks split into one set each are the same sets.
    const split = push.items.map((i) =>
      withScheme(i, {
        rir: i.scheme.rir,
        blocks: routineRows(i.scheme).map((row) => ({ ...row, count: 1 })),
      }),
    );
    expect(differsFromSeed({ id: 'push', items: split })).toBe(false);
  });

  it.each([
    ['an exercise less', (items: PlanItem[]) => items.slice(1)],
    [
      'another order',
      (items: PlanItem[]) => moveExerciseItem(items, 'aperturas-maquina', -1) ?? [],
    ],
    [
      'a set more',
      (items: PlanItem[]) =>
        items.map((i, n) => (n === 0 ? withScheme(i, addRoutineRow(i.scheme) ?? i.scheme) : i)),
    ],
    [
      'other reps',
      (items: PlanItem[]) =>
        items.map((i, n) =>
          n === 0 ? withScheme(i, setRoutineRowReps(i.scheme, 0, '5') ?? i.scheme) : i,
        ),
    ],
    [
      'other RIR',
      (items: PlanItem[]) =>
        items.map((i, n) => (n === 0 ? withScheme(i, setSchemeRir(i.scheme, '4')) : i)),
    ],
    [
      'optional',
      (items: PlanItem[]) => items.map((i, n) => (n === 0 ? { ...i, optional: !i.optional } : i)),
    ],
    ['a note', (items: PlanItem[]) => items.map((i, n) => (n === 0 ? withNote(i, 'x') : i))],
  ])('differs with %s', (_label, change) => {
    expect(differsFromSeed({ id: 'push', items: change([...push.items]) })).toBe(true);
  });

  it('is false for a routine that is not one of the originals', () => {
    expect(differsFromSeed({ id: 'mine', items: [] })).toBe(false);
  });

  it('compares lists of different length', () => {
    expect(sameItems([item('a')], [])).toBe(false);
    expect(sameItems([item('a')], [item('b')])).toBe(false);
    expect(sameItems([item('a')], [item('a')])).toBe(true);
  });
});

describe('summaries and order', () => {
  it('counts exercises and planned sets', () => {
    expect(routineSummary([])).toEqual({ exercises: 0, sets: 0 });
    const push = SEED_ROUTINES_BY_ID.get('push');
    expect(routineSummary(push?.items ?? [])).toEqual({ exercises: 7, sets: 19 });
    const pull = SEED_ROUTINES_BY_ID.get('pull');
    expect(routineSummary(pull?.items ?? [])).toEqual({ exercises: 8, sets: 23 });
  });

  it('puts the routines in weekday order, the ones without a day last', () => {
    expect(sortRoutines(SEED_ROUTINES).map((r) => r.id)).toEqual([
      'push',
      'pull',
      'lowerB',
      'upper',
      'lowerA',
      'lowerFull',
    ]);
    expect(
      sortRoutines([
        { id: 'b', weekday: null },
        { id: 'a', weekday: null },
        { id: 'c', weekday: 1 as const },
      ]).map((r) => r.id),
    ).toEqual(['c', 'a', 'b']);
  });
});
