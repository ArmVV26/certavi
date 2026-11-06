// Filter for lists of exercises (the "Añadir ejercicio" sheet; the catalog in Phase 6).
import type { Equipment, ExerciseKind, MuscleGroup } from '../model/enums';
import type { Exercise } from '../model/exercise';

export interface ExerciseFilter {
  /** Text to find in the name; ignores case and accents. */
  text: string;
  group: MuscleGroup | null;
  equipment: Equipment | null;
  kind: ExerciseKind | null;
  /** Only exercises that use straps. */
  straps: boolean;
  /** Only exercises created by the user. */
  custom: boolean;
  /** Only exercises that are in some routine. */
  inRoutine: boolean;
}

export const EMPTY_EXERCISE_FILTER: ExerciseFilter = {
  text: '',
  group: null,
  equipment: null,
  kind: null,
  straps: false,
  custom: false,
  inRoutine: false,
};

/** Lower case without accents, for comparing names. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

type FilterableExercise = Pick<
  Exercise,
  'id' | 'primaryGroup' | 'equipment' | 'kind' | 'supportsStraps' | 'custom' | 'archived'
>;

/** True when no filter is active. */
export function isFilterEmpty(filter: ExerciseFilter): boolean {
  return (
    normalizeText(filter.text) === '' &&
    filter.group === null &&
    filter.equipment === null &&
    filter.kind === null &&
    !filter.straps &&
    !filter.custom &&
    !filter.inRoutine
  );
}

/**
 * The exercises that pass every active filter, in alphabetical order of their displayed name.
 * Archived ones are left out unless `includeArchived` is set. `nameOf` resolves the name (an i18n
 * key for seed exercises); `routineExerciseIds` holds the ids of the exercises that are in some
 * routine.
 */
export function filterExercises<T extends FilterableExercise>(
  exercises: readonly T[],
  filter: ExerciseFilter,
  context: {
    nameOf: (exercise: T) => string;
    routineExerciseIds: ReadonlySet<string>;
    includeArchived?: boolean;
  },
): T[] {
  const text = normalizeText(filter.text);
  return exercises
    .filter((e) => {
      if (e.archived && context.includeArchived !== true) return false;
      if (filter.group !== null && e.primaryGroup !== filter.group) return false;
      if (filter.equipment !== null && e.equipment !== filter.equipment) return false;
      if (filter.kind !== null && e.kind !== filter.kind) return false;
      if (filter.straps && !e.supportsStraps) return false;
      if (filter.custom && !e.custom) return false;
      if (filter.inRoutine && !context.routineExerciseIds.has(e.id)) return false;
      return text === '' || normalizeText(context.nameOf(e)).includes(text);
    })
    .map((e) => ({ exercise: e, name: context.nameOf(e) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((entry) => entry.exercise);
}
