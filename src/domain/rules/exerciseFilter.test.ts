import { describe, expect, it } from 'vitest';
import type { Exercise } from '../model/exercise';
import { SEED_EXERCISES } from '../seed';
import {
  EMPTY_EXERCISE_FILTER,
  filterExercises,
  isFilterEmpty,
  normalizeText,
  type ExerciseFilter,
} from './exerciseFilter';

const NAMES: Record<string, string> = {
  tbar: 'Remo en T',
  row: 'Remo con barra',
  press: 'Press de pecho',
  curl: 'Curl de bíceps',
  old: 'Ejercicio antiguo',
  mine: 'Ábaco propio',
};

function exercise(id: string, fields: Partial<Exercise>): Exercise {
  const base = SEED_EXERCISES[0];
  if (!base) throw new Error('seed catalog is empty');
  return { ...base, id, custom: false, archived: false, supportsStraps: false, ...fields };
}

const list: Exercise[] = [
  exercise('tbar', {
    primaryGroup: 'back',
    equipment: 'plate-loaded',
    kind: 'compound',
    supportsStraps: true,
  }),
  exercise('row', {
    primaryGroup: 'back',
    equipment: 'barbell',
    kind: 'compound',
    supportsStraps: true,
  }),
  exercise('press', { primaryGroup: 'chest', equipment: 'selectorized', kind: 'compound' }),
  exercise('curl', { primaryGroup: 'biceps', equipment: 'dumbbell', kind: 'isolation' }),
  exercise('old', { primaryGroup: 'back', archived: true }),
  exercise('mine', {
    primaryGroup: 'core',
    equipment: 'bodyweight',
    kind: 'isolation',
    custom: true,
  }),
];

const context = {
  nameOf: (e: Exercise) => NAMES[e.id] ?? e.id,
  routineExerciseIds: new Set(['tbar', 'press']),
};
const ids = (filter: Partial<ExerciseFilter>) =>
  filterExercises(list, { ...EMPTY_EXERCISE_FILTER, ...filter }, context).map((e) => e.id);

describe('normalizeText', () => {
  it('lower-cases and removes accents', () => {
    expect(normalizeText('  ÁBaco Bíceps ')).toBe('abaco biceps');
  });
});

describe('filterExercises', () => {
  it('lists every non-archived exercise alphabetically with no filter', () => {
    expect(ids({})).toEqual(['mine', 'curl', 'press', 'row', 'tbar']);
  });

  it('never lists archived exercises', () => {
    expect(ids({ group: 'back' })).not.toContain('old');
    expect(ids({ text: 'antiguo' })).toEqual([]);
  });

  it('lists archived exercises too when asked, with the other filters still applied', () => {
    const withArchived = (filter: Partial<ExerciseFilter>) =>
      filterExercises(
        list,
        { ...EMPTY_EXERCISE_FILTER, ...filter },
        { ...context, includeArchived: true },
      ).map((e) => e.id);
    expect(withArchived({})).toEqual(['mine', 'curl', 'old', 'press', 'row', 'tbar']);
    expect(withArchived({ group: 'back' })).toEqual(['old', 'row', 'tbar']);
    expect(withArchived({ custom: true })).toEqual(['mine']);
  });

  it('finds the text in the displayed name, ignoring case and accents', () => {
    expect(ids({ text: 'REMO' })).toEqual(['row', 'tbar']);
    expect(ids({ text: 'biceps' })).toEqual(['curl']);
    expect(ids({ text: 'abaco' })).toEqual(['mine']);
    expect(ids({ text: 'zzz' })).toEqual([]);
  });

  it('filters by group, equipment and kind', () => {
    expect(ids({ group: 'back' })).toEqual(['row', 'tbar']);
    expect(ids({ equipment: 'dumbbell' })).toEqual(['curl']);
    expect(ids({ kind: 'isolation' })).toEqual(['mine', 'curl']);
  });

  it('filters by straps, created by me and in some routine', () => {
    expect(ids({ straps: true })).toEqual(['row', 'tbar']);
    expect(ids({ custom: true })).toEqual(['mine']);
    expect(ids({ inRoutine: true })).toEqual(['press', 'tbar']);
  });

  it('applies all the active filters together', () => {
    expect(
      ids({ text: 'remo', group: 'back', kind: 'compound', straps: true, inRoutine: true }),
    ).toEqual(['tbar']);
    expect(ids({ group: 'chest', straps: true })).toEqual([]);
  });

  it('works with the seed catalog', () => {
    const found = filterExercises(SEED_EXERCISES, EMPTY_EXERCISE_FILTER, {
      nameOf: (e) => e.id,
      routineExerciseIds: new Set(),
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((e) => !e.archived)).toBe(true);
  });
});

describe('isFilterEmpty', () => {
  it('is true only when nothing is active', () => {
    expect(isFilterEmpty(EMPTY_EXERCISE_FILTER)).toBe(true);
    expect(isFilterEmpty({ ...EMPTY_EXERCISE_FILTER, text: '  ' })).toBe(true);
    expect(isFilterEmpty({ ...EMPTY_EXERCISE_FILTER, text: 'a' })).toBe(false);
    expect(isFilterEmpty({ ...EMPTY_EXERCISE_FILTER, group: 'back' })).toBe(false);
    expect(isFilterEmpty({ ...EMPTY_EXERCISE_FILTER, equipment: 'cable' })).toBe(false);
    expect(isFilterEmpty({ ...EMPTY_EXERCISE_FILTER, kind: 'compound' })).toBe(false);
    expect(isFilterEmpty({ ...EMPTY_EXERCISE_FILTER, straps: true })).toBe(false);
    expect(isFilterEmpty({ ...EMPTY_EXERCISE_FILTER, custom: true })).toBe(false);
    expect(isFilterEmpty({ ...EMPTY_EXERCISE_FILTER, inRoutine: true })).toBe(false);
  });
});
