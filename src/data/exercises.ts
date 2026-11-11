// Writing exercises: creating, editing and archiving the ones the user makes, and changing the
// weight step of any exercise. Each function is one transaction that validates, writes the record
// and queues it for sync (ADR-0002). Seed exercises are never renamed or archived.
import {
  exerciseFromDraft,
  isValidIncrement,
  normalizeSetup,
  routinesWithExercise,
  sameSetup,
  validateExerciseDraft,
  type Exercise,
  type ExerciseDraft,
  type ExerciseDraftError,
  type SetupDraftRow,
  type SetupError,
  type ValidateOptions,
} from '../domain';
import type { CertaviDb } from './db';
import { ID_PREFIX, newId } from './ids';
import { createRepository, type Repository, type RepositoryOptions } from './repository';
import { ExerciseNotFoundError } from './sessionTools';

export class InvalidExerciseError extends Error {
  readonly errors: readonly ExerciseDraftError[];

  constructor(errors: readonly ExerciseDraftError[]) {
    super(`Invalid exercise: ${errors.map((e) => `${e.field}:${e.code}`).join(', ')}`);
    this.name = 'InvalidExerciseError';
    this.errors = errors;
  }
}

/** The exercise belongs to the seed catalog, which only allows changing the weight step. */
export class ExerciseNotEditableError extends Error {
  readonly exerciseId: string;

  constructor(exerciseId: string) {
    super(`The seed exercise ${exerciseId} cannot be edited or archived`);
    this.name = 'ExerciseNotEditableError';
    this.exerciseId = exerciseId;
  }
}

/** An exercise that is in a routine cannot be archived. */
export class ExerciseInRoutineError extends Error {
  readonly exerciseId: string;
  readonly routineIds: readonly string[];

  constructor(exerciseId: string, routineIds: readonly string[]) {
    super(`The exercise ${exerciseId} is in the routines: ${routineIds.join(', ')}`);
    this.name = 'ExerciseInRoutineError';
    this.exerciseId = exerciseId;
    this.routineIds = routineIds;
  }
}

/** The machine settings are not valid; `errors` says which row and field. */
export class InvalidSetupError extends Error {
  readonly errors: readonly SetupError[];

  constructor(errors: readonly SetupError[]) {
    super(
      `Invalid machine settings: ${errors.map((e) => `${String(e.row)}:${e.code}`).join(', ')}`,
    );
    this.name = 'InvalidSetupError';
    this.errors = errors;
  }
}

export interface ExerciseWriteOptions extends RepositoryOptions {
  /**
   * The displayed name of an exercise, to find repeated names. The data layer has no translations,
   * so by default it compares the raw text (or the i18n key of a seed exercise); the UI passes the
   * translated name.
   */
  nameOf?: ValidateOptions['nameOf'];
}

const rawName: ValidateOptions['nameOf'] = (exercise) =>
  'text' in exercise.name ? exercise.name.text : exercise.name.key;

async function liveExercise(exercises: Repository<'exercise'>, id: string): Promise<Exercise> {
  const exercise = await exercises.get(id);
  if (!exercise) throw new ExerciseNotFoundError(id);
  return exercise;
}

async function editableExercise(exercises: Repository<'exercise'>, id: string): Promise<Exercise> {
  const exercise = await liveExercise(exercises, id);
  if (!exercise.custom) throw new ExerciseNotEditableError(id);
  return exercise;
}

/** Creates an exercise from the form. Throws `InvalidExerciseError` (and writes nothing). */
export function createExercise(
  db: CertaviDb,
  draft: ExerciseDraft,
  options: ExerciseWriteOptions = {},
): Promise<Exercise> {
  const { nameOf = rawName, now = Date.now } = options;
  const exercises = createRepository(db, 'exercise', options);
  return db.transaction('rw', [db.exercises, db.pending, db.meta], async () => {
    const errors = validateExerciseDraft(draft, await exercises.list(), { nameOf });
    if (errors.length > 0) throw new InvalidExerciseError(errors);
    return exercises.put(exerciseFromDraft(draft, newId(ID_PREFIX.exercise, now())));
  });
}

/**
 * Saves the form over an exercise the user created, keeping its id and archived state.
 * Throws `InvalidExerciseError`, `ExerciseNotFoundError` or `ExerciseNotEditableError`.
 */
export function updateExercise(
  db: CertaviDb,
  id: string,
  draft: ExerciseDraft,
  options: ExerciseWriteOptions = {},
): Promise<Exercise> {
  const { nameOf = rawName } = options;
  const exercises = createRepository(db, 'exercise', options);
  return db.transaction('rw', [db.exercises, db.pending, db.meta], async () => {
    const current = await editableExercise(exercises, id);
    const errors = validateExerciseDraft(draft, await exercises.list(), { nameOf, editingId: id });
    if (errors.length > 0) throw new InvalidExerciseError(errors);
    // The form does not edit the machine settings: keep them.
    return exercises.put({
      ...exerciseFromDraft(draft, id, current.archived),
      ...(current.setup ? { setup: current.setup } : {}),
    });
  });
}

/**
 * Archives or restores an exercise the user created. Archiving one that is in a routine throws
 * `ExerciseInRoutineError`. Writes nothing when the exercise is already in that state.
 */
export function setExerciseArchived(
  db: CertaviDb,
  id: string,
  archived: boolean,
  options: RepositoryOptions = {},
): Promise<Exercise> {
  const exercises = createRepository(db, 'exercise', options);
  return db.transaction('rw', [db.exercises, db.routines, db.pending, db.meta], async () => {
    const current = await editableExercise(exercises, id);
    if (current.archived === archived) return current;
    if (archived) {
      const routines = await createRepository(db, 'routine', options).list();
      const using = routinesWithExercise(id, routines);
      if (using.length > 0) {
        throw new ExerciseInRoutineError(
          id,
          using.map((routine) => routine.id),
        );
      }
    }
    return exercises.put({ ...current, archived });
  });
}

/**
 * Changes the weight step of any exercise, seed or not. Throws `InvalidExerciseError` when it is
 * out of range. Writes nothing when it does not change.
 */
export function setExerciseIncrement(
  db: CertaviDb,
  id: string,
  increment: number | null,
  options: RepositoryOptions = {},
): Promise<Exercise> {
  const exercises = createRepository(db, 'exercise', options);
  return db.transaction('rw', [db.exercises, db.pending, db.meta], async () => {
    if (!isValidIncrement(increment)) {
      throw new InvalidExerciseError([{ field: 'increment', code: 'increment-range' }]);
    }
    const current = await liveExercise(exercises, id);
    if (current.increment === increment) return current;
    return exercises.put({ ...current, increment });
  });
}

/**
 * Saves the machine settings of any exercise, seed or not. The rows are trimmed and the empty ones
 * dropped; no rows removes the settings. Throws `InvalidSetupError` (and writes nothing) when a row
 * is not valid and `ExerciseNotFoundError` for an unknown id. Writes nothing when they do not change.
 */
export function setExerciseSetup(
  db: CertaviDb,
  id: string,
  rows: readonly SetupDraftRow[],
  options: RepositoryOptions = {},
): Promise<Exercise> {
  const exercises = createRepository(db, 'exercise', options);
  return db.transaction('rw', [db.exercises, db.pending, db.meta], async () => {
    const result = normalizeSetup(rows);
    if (!result.ok) throw new InvalidSetupError(result.errors);
    const current = await liveExercise(exercises, id);
    if (sameSetup(current.setup, result.setup)) return current;
    const next: Exercise = { ...current };
    if (result.setup.length > 0) next.setup = result.setup;
    else delete next.setup;
    return exercises.put(next);
  });
}
