// Starting and reading workout sessions.
import {
  findSession,
  mondayOf,
  newSession,
  weekPlanId,
  type Exercise,
  type Routine,
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
}

/** A live session with its routine and the exercises it may show, or null if there is none. */
export function readSession(db: CertaviDb, id: string): Promise<SessionView | null> {
  return db.transaction('r', [db.sessions, db.routines, db.exercises], async () => {
    const row = await db.sessions.get(id);
    if (!row || !isLive(row)) return null;
    const routineRow = row.routineId === null ? undefined : await db.routines.get(row.routineId);
    const exercises = (await db.exercises.toArray()).filter((e) => isLive(e));
    return {
      session: row,
      routine: routineRow && isLive(routineRow) ? routineRow : undefined,
      exercises: new Map(exercises.map((e) => [e.id, e])),
    };
  });
}
