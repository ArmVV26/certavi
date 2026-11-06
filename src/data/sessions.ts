// Starting and reading workout sessions.
import {
  deloadWeeks,
  findSession,
  isDeloadDate,
  lastReference,
  mondayOf,
  newSession,
  weekPlanId,
  type Exercise,
  type ExerciseNote,
  type HistoryEntry,
  type Routine,
  type SetEntry,
  type WorkoutSession,
} from '../domain';
import { isLive, type CertaviDb } from './db';
import { ID_PREFIX, newId } from './ids';
import { createRepository, type RepositoryOptions } from './repository';

export interface StartSessionInput {
  date: string;
  /** null = free session. */
  routineId: string | null;
  /** The device's current date. */
  today: string;
}

export interface StartSessionResult {
  session: WorkoutSession;
  /** True when a session with that routine already existed on that date (it is reused). */
  existed: boolean;
}

export class RoutineNotFoundError extends Error {
  readonly routineId: string;

  constructor(routineId: string) {
    super(`Routine not found: ${routineId}`);
    this.name = 'RoutineNotFoundError';
    this.routineId = routineId;
  }
}

/**
 * Opens the session of `routineId` on `date`, creating it if there is none. A new session copies
 * the routine (reduced in a deload week). Check and write run in one transaction.
 */
export function startSession(
  db: CertaviDb,
  input: StartSessionInput,
  { now = Date.now }: RepositoryOptions = {},
): Promise<StartSessionResult> {
  const sessions = createRepository(db, 'session', { now });
  return db.transaction(
    'rw',
    [db.sessions, db.routines, db.weekPlans, db.pending, db.meta],
    async () => {
      const sameDay = (await db.sessions.where('date').equals(input.date).toArray()).filter((row) =>
        isLive(row),
      );
      const existing = findSession(sameDay, input.date, input.routineId);
      if (existing) return { session: existing, existed: true };

      let routine = null;
      if (input.routineId !== null) {
        const row = await db.routines.get(input.routineId);
        if (!row || !isLive(row)) throw new RoutineNotFoundError(input.routineId);
        routine = row;
      }
      const week = await db.weekPlans.get(weekPlanId(mondayOf(input.date)));
      const time = now();
      const session = await sessions.put(
        newSession({
          id: newId(ID_PREFIX.session, time),
          date: input.date,
          routine,
          today: input.today,
          now: time,
          deload: week !== undefined && isLive(week) && week.deload,
        }),
      );
      return { session, existed: false };
    },
  );
}

export interface SessionView {
  session: WorkoutSession;
  /** The session's routine; undefined for a free session or a deleted routine. */
  routine: Routine | undefined;
  exercises: ReadonlyMap<string, Exercise>;
  /** Live sets logged in this session. */
  sets: SetEntry[];
  /** Live notes of this session, one per exercise at most. */
  notes: ExerciseNote[];
  /** "Last time" per exercise of the session; an exercise without a last time is absent. */
  references: ReadonlyMap<string, HistoryEntry>;
  /** The session falls in a deload week. */
  deload: boolean;
  /** Every live routine, for the routine choice of the session details. */
  routines: Routine[];
  /** Ids of the exercises that are in at least one routine (for the "in a routine" filter). */
  routineExerciseIds: ReadonlySet<string>;
}

/**
 * A live session with its routine, the exercises it may show, what has been logged and the
 * "last time" of each of its exercises; null if there is no such session.
 */
export function readSession(db: CertaviDb, id: string): Promise<SessionView | null> {
  return db.transaction(
    'r',
    [db.sessions, db.routines, db.exercises, db.sets, db.notes, db.weekPlans],
    async () => {
      const row = await db.sessions.get(id);
      if (!row || !isLive(row)) return null;
      const routines = (await db.routines.toArray()).filter((r) => isLive(r));
      const routineRow = routines.find((r) => r.id === row.routineId);
      const exercises = (await db.exercises.toArray()).filter((e) => isLive(e));
      const sessions = (await db.sessions.toArray()).filter((s) => isLive(s));
      const notes = (await db.notes.toArray()).filter((n) => isLive(n));
      const weekPlans = (await db.weekPlans.toArray()).filter((w) => isLive(w));

      const exerciseIds = [...new Set(row.items.map((item) => item.exerciseId))];
      const history = (
        await Promise.all(exerciseIds.map((ex) => db.sets.where('exerciseId').equals(ex).toArray()))
      )
        .flat()
        .filter((s) => isLive(s));
      const log = { sessions, sets: history, notes, weekPlans };
      const references = new Map<string, HistoryEntry>();
      for (const exerciseId of exerciseIds) {
        const reference = lastReference(exerciseId, log, row);
        if (reference) references.set(exerciseId, reference);
      }
      return {
        session: row,
        routine: routineRow,
        exercises: new Map(exercises.map((e) => [e.id, e])),
        sets: history.filter((s) => s.sessionId === id),
        notes: notes.filter((n) => n.sessionId === id),
        references,
        deload: isDeloadDate(row.date, deloadWeeks(weekPlans)),
        routines,
        routineExerciseIds: new Set(routines.flatMap((r) => r.items.map((i) => i.exerciseId))),
      };
    },
  );
}
