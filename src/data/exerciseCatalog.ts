// Reading the exercise catalog and the detail of one exercise (records and history).
import {
  exerciseHistory,
  exerciseStats,
  routineExerciseIds,
  routinesWithExercise,
  type Exercise,
  type ExerciseStats,
  type HistoryEntry,
  type Routine,
} from '../domain';
import { isLive, type CertaviDb } from './db';

export interface CatalogView {
  /** Every live exercise, archived ones included. */
  exercises: Exercise[];
  routines: Routine[];
  /** Ids of the exercises that are in at least one routine. */
  routineExerciseIds: ReadonlySet<string>;
}

export function readCatalog(db: CertaviDb): Promise<CatalogView> {
  return db.transaction('r', [db.exercises, db.routines], async () => {
    const exercises = (await db.exercises.toArray()).filter((e) => isLive(e));
    const routines = (await db.routines.toArray()).filter((r) => isLive(r));
    return { exercises, routines, routineExerciseIds: routineExerciseIds(routines) };
  });
}

export interface ExerciseDetailView {
  exercise: Exercise;
  /** The routines that have the exercise. */
  routines: Routine[];
  /** Sessions with effective sets of the exercise, newest first. */
  history: HistoryEntry[];
  stats: ExerciseStats;
}

/** The exercise with its records and history; null if there is no such live exercise. */
export function readExerciseDetail(db: CertaviDb, id: string): Promise<ExerciseDetailView | null> {
  return db.transaction(
    'r',
    [db.exercises, db.routines, db.sessions, db.sets, db.notes, db.weekPlans],
    async () => {
      const exercise = await db.exercises.get(id);
      if (!exercise || !isLive(exercise)) return null;
      const routines = (await db.routines.toArray()).filter((r) => isLive(r));
      const sessions = (await db.sessions.toArray()).filter((s) => isLive(s));
      const sets = (await db.sets.where('exerciseId').equals(id).toArray()).filter((s) =>
        isLive(s),
      );
      const notes = (await db.notes.toArray())
        .filter((n) => isLive(n))
        .filter((n) => n.exerciseId === id);
      const weekPlans = (await db.weekPlans.toArray()).filter((w) => isLive(w));
      const chronological = exerciseHistory(id, { sessions, sets, notes, weekPlans });
      return {
        exercise,
        routines: routinesWithExercise(id, routines),
        history: [...chronological].reverse(),
        stats: exerciseStats(chronological),
      };
    },
  );
}
