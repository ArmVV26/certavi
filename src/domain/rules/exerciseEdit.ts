// Creating and editing exercises: the draft the form works with, its validation and the exercise
// built from it. Only exercises the user creates are edited this way; seed exercises only change
// their weight step.
import { plainText } from '../model/envelope';
import type { Equipment, ExerciseKind, MuscleGroup } from '../model/enums';
import type { Exercise } from '../model/exercise';
import type { Routine } from '../model/routine';
import { repRangeSchema, rirRangeSchema, type SetScheme } from '../model/scheme';
import { defaultIncrement } from '../seed/catalog';
import { straightSets } from '../seed/routines';
import { normalizeText } from './exerciseFilter';
import { countSchemeSets, parseRepRange } from './scheme';

export const MAX_EXERCISE_NAME = 80;
/** Allowed weight steps, in kg. */
export const INCREMENT_RANGE = { min: 0.25, max: 50 } as const;
/** Rows of the default scheme the form can create. */
export const DRAFT_SETS_RANGE = { min: 1, max: 10 } as const;

/** What a record of an exercise looks like before the repository stamps it. */
export type ExerciseInput = Omit<Exercise, 'type' | 'updatedAt' | 'deleted' | 'serverSeq'>;

/** The default scheme as the form shows it: straight sets of the same reps. */
export interface SimpleScheme {
  /** Null while the field is empty. */
  sets: number | null;
  reps: string;
  rir: string;
}

export interface ExerciseDraft {
  name: string;
  primaryGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  kind: ExerciseKind;
  unilateral: boolean;
  supportsStraps: boolean;
  supportsBand: boolean;
  scheme: SimpleScheme;
  /** Weight step in kg; null while the field is empty. */
  increment: number | null;
}

export type ExerciseDraftField = 'name' | 'increment' | 'sets' | 'reps' | 'rir';

export type ExerciseDraftErrorCode =
  | 'name-empty'
  | 'name-too-long'
  | 'name-taken'
  | 'increment-range'
  | 'sets-range'
  | 'reps-invalid'
  | 'rir-invalid';

export interface ExerciseDraftError {
  field: ExerciseDraftField;
  code: ExerciseDraftErrorCode;
}

/** The weight step suggested for a group, equipment and type (the seed catalog's rule). */
export function suggestedIncrement(
  draft: Pick<ExerciseDraft, 'primaryGroup' | 'equipment' | 'kind'>,
): number {
  return defaultIncrement({
    group: draft.primaryGroup,
    equipment: draft.equipment,
    kind: draft.kind,
  });
}

/** A new exercise: no name, chest, "other" equipment, isolation, 3 × 8-12 and the suggested step. */
export function newExerciseDraft(): ExerciseDraft {
  const draft = {
    primaryGroup: 'chest',
    equipment: 'other',
    kind: 'isolation',
  } as const;
  return {
    name: '',
    ...draft,
    secondaryMuscles: [],
    unilateral: false,
    supportsStraps: false,
    supportsBand: false,
    scheme: { sets: 3, reps: '8-12', rir: '1-2' },
    increment: suggestedIncrement(draft),
  };
}

/**
 * The form values of an existing exercise. `name` is the displayed name (the exercise stores raw
 * text or an i18n key; only the caller can resolve it).
 */
export function draftFromExercise(exercise: Exercise, name: string): ExerciseDraft {
  return {
    name,
    primaryGroup: exercise.primaryGroup,
    secondaryMuscles: [...exercise.secondaryMuscles],
    equipment: exercise.equipment,
    kind: exercise.kind,
    unilateral: exercise.unilateral,
    supportsStraps: exercise.supportsStraps,
    supportsBand: exercise.supportsBand,
    scheme: simpleSchemeOf(exercise.defaultScheme),
    increment: exercise.increment,
  };
}

/** A scheme as straight sets: exact for the schemes the form creates, an approximation otherwise. */
export function simpleSchemeOf(scheme: SetScheme): SimpleScheme {
  const [only] = scheme.blocks;
  if (scheme.blocks.length === 1 && only?.kind === 'straight') {
    return { sets: only.count, reps: only.reps, rir: scheme.rir };
  }
  const reps = scheme.blocks.find((block) => block.reps !== '')?.reps ?? '8-12';
  const sets = Math.min(
    DRAFT_SETS_RANGE.max,
    Math.max(DRAFT_SETS_RANGE.min, countSchemeSets(scheme)),
  );
  return { sets, reps, rir: scheme.rir };
}

function validReps(reps: string): boolean {
  if (!repRangeSchema.safeParse(reps).success) return false;
  const bounds = parseRepRange(reps);
  return bounds !== null && bounds.min >= 1 && bounds.min <= bounds.max;
}

export interface ValidateOptions {
  /** The displayed name of an exercise (an i18n key is resolved by the caller). */
  nameOf: (exercise: Pick<Exercise, 'name'>) => string;
  /** The exercise being edited, which may keep its own name. */
  editingId?: string;
}

/** Every problem of the draft, in the order of the form's fields; empty when it can be saved. */
export function validateExerciseDraft(
  draft: ExerciseDraft,
  exercises: readonly Pick<Exercise, 'id' | 'name'>[],
  { nameOf, editingId }: ValidateOptions,
): ExerciseDraftError[] {
  const errors: ExerciseDraftError[] = [];
  const name = draft.name.trim();
  if (name === '') {
    errors.push({ field: 'name', code: 'name-empty' });
  } else if (name.length > MAX_EXERCISE_NAME) {
    errors.push({ field: 'name', code: 'name-too-long' });
  } else {
    const wanted = normalizeText(name);
    if (exercises.some((e) => e.id !== editingId && normalizeText(nameOf(e)) === wanted)) {
      errors.push({ field: 'name', code: 'name-taken' });
    }
  }

  const { sets, reps, rir } = draft.scheme;
  if (
    sets === null ||
    !Number.isInteger(sets) ||
    sets < DRAFT_SETS_RANGE.min ||
    sets > DRAFT_SETS_RANGE.max
  ) {
    errors.push({ field: 'sets', code: 'sets-range' });
  }
  if (!validReps(reps.trim())) errors.push({ field: 'reps', code: 'reps-invalid' });
  if (!rirRangeSchema.safeParse(rir.trim()).success)
    errors.push({ field: 'rir', code: 'rir-invalid' });

  const { increment } = draft;
  if (
    increment === null ||
    !(increment >= INCREMENT_RANGE.min && increment <= INCREMENT_RANGE.max)
  ) {
    errors.push({ field: 'increment', code: 'increment-range' });
  }
  return errors;
}

/** True when the weight step is a valid one (the detail page edits it on its own). */
export function isValidIncrement(value: number | null): value is number {
  return value !== null && value >= INCREMENT_RANGE.min && value <= INCREMENT_RANGE.max;
}

/**
 * The exercise a valid draft describes. Throws if the draft is not valid, so callers validate
 * first. The secondary muscles never include the primary group or repeat.
 */
export function exerciseFromDraft(
  draft: ExerciseDraft,
  id: string,
  archived = false,
): ExerciseInput {
  const { sets } = draft.scheme;
  const { increment } = draft;
  if (sets === null || increment === null) throw new Error('The exercise draft is not valid');
  return {
    id,
    name: plainText(draft.name.trim()),
    primaryGroup: draft.primaryGroup,
    secondaryMuscles: [...new Set(draft.secondaryMuscles)].filter((g) => g !== draft.primaryGroup),
    equipment: draft.equipment,
    kind: draft.kind,
    unilateral: draft.unilateral,
    supportsStraps: draft.supportsStraps,
    supportsBand: draft.supportsBand,
    defaultScheme: straightSets(draft.scheme.reps.trim(), sets, draft.scheme.rir.trim()),
    increment,
    custom: true,
    archived,
  };
}

/** The routines that have the exercise, in the order given. */
export function routinesWithExercise<T extends Pick<Routine, 'items'>>(
  exerciseId: string,
  routines: readonly T[],
): T[] {
  return routines.filter((routine) => routine.items.some((item) => item.exerciseId === exerciseId));
}

/** Ids of the exercises that are in at least one routine. */
export function routineExerciseIds(routines: readonly Pick<Routine, 'items'>[]): Set<string> {
  return new Set(routines.flatMap((routine) => routine.items.map((item) => item.exerciseId)));
}
