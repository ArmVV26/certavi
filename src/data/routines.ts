// Writing routines: saving an edited routine and restoring one of the originals. Each function is
// one transaction that validates, writes the record and queues it for sync (ADR-0002).
// Sessions keep their own copy of the plan, so none of this changes a session.
import {
  SEED_ROUTINES_BY_ID,
  normalizeRoutineItems,
  sameItems,
  validateRoutineItems,
  type PlanItem,
  type Routine,
  type RoutineIssue,
} from '../domain';
import type { CertaviDb } from './db';
import { createRepository, type RepositoryOptions } from './repository';
import { ExerciseNotFoundError } from './sessionTools';

export class RoutineNotFoundError extends Error {
  readonly routineId: string;

  constructor(routineId: string) {
    super(`Routine not found: ${routineId}`);
    this.name = 'RoutineNotFoundError';
    this.routineId = routineId;
  }
}

export class InvalidRoutineError extends Error {
  readonly issues: readonly RoutineIssue[];

  constructor(issues: readonly RoutineIssue[]) {
    super(`Invalid routine: ${issues.map((i) => `${i.code}:${i.exerciseId ?? '-'}`).join(', ')}`);
    this.name = 'InvalidRoutineError';
    this.issues = issues;
  }
}

/** Only the six routines that come with the app have an original to go back to. */
export class RoutineNotRestorableError extends Error {
  readonly routineId: string;

  constructor(routineId: string) {
    super(`The routine ${routineId} has no original to restore`);
    this.name = 'RoutineNotRestorableError';
    this.routineId = routineId;
  }
}

/**
 * Replaces the exercises of a routine (tidied with `normalizeRoutineItems`); its name and day
 * never change. Throws `InvalidRoutineError`
 * (nothing is written), `RoutineNotFoundError` or `ExerciseNotFoundError`. Writes nothing when the
 * routine ends up the same.
 */
export function saveRoutine(
  db: CertaviDb,
  routineId: string,
  items: readonly PlanItem[],
  options: RepositoryOptions = {},
): Promise<Routine> {
  const routines = createRepository(db, 'routine', options);
  const exercises = createRepository(db, 'exercise', options);
  return db.transaction('rw', [db.routines, db.exercises, db.pending, db.meta], async () => {
    const current = await routines.get(routineId);
    if (!current) throw new RoutineNotFoundError(routineId);
    const clean = normalizeRoutineItems(items);
    const issues = validateRoutineItems(clean);
    if (issues.length > 0) throw new InvalidRoutineError(issues);
    for (const item of clean) {
      if (!(await exercises.get(item.exerciseId))) throw new ExerciseNotFoundError(item.exerciseId);
    }
    if (sameItems(current.items, clean)) return current;
    return routines.put({ ...current, items: clean });
  });
}

/**
 * Puts one of the original routines back. The copy is stamped with the current time (not the
 * seed's 0), so it wins over the edited version on every device and the start-up seed does not
 * overwrite it. Throws `RoutineNotRestorableError`. Writes nothing when it is already the original.
 */
export function restoreSeedRoutine(
  db: CertaviDb,
  routineId: string,
  options: RepositoryOptions = {},
): Promise<Routine> {
  const seed = SEED_ROUTINES_BY_ID.get(routineId);
  if (!seed) return Promise.reject(new RoutineNotRestorableError(routineId));
  const routines = createRepository(db, 'routine', options);
  return db.transaction('rw', [db.routines, db.pending, db.meta], async () => {
    const current = await routines.get(routineId);
    if (current && sameItems(current.items, seed.items)) return current;
    return routines.put(structuredClone(seed));
  });
}
