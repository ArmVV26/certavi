// The session tools: add, move and remove exercises, change the routine, edit the date and hours,
// and bring a removed exercise back. Each function is one transaction that writes the records and
// the pending queue together (ADR-0002). The routine itself is never touched.
import {
  addExerciseItem,
  changeRoutineItems,
  deloadWeeks,
  exerciseNoteId,
  isDeloadDate,
  isInProgress,
  moveExerciseItem,
  removeExerciseItem,
  restoreExerciseItem,
  sessionTimes,
  type SessionTimesError,
  type WorkoutSession,
} from '../domain';
import { isLive, type CertaviDb } from './db';
import { createRepository, type RepositoryOptions } from './repository';
import {
  SessionNotFoundError,
  UndoConflictError,
  loadExercise,
  sessionTables,
  type UndoExercise,
} from './sessionLog';
import { RoutineNotFoundError } from './sessions';

export class ExerciseNotFoundError extends Error {
  readonly exerciseId: string;

  constructor(exerciseId: string) {
    super(`Exercise not found: ${exerciseId}`);
    this.name = 'ExerciseNotFoundError';
    this.exerciseId = exerciseId;
  }
}

export class ExerciseAlreadyInSessionError extends Error {
  readonly exerciseId: string;

  constructor(exerciseId: string) {
    super(`The session already has the exercise ${exerciseId}`);
    this.name = 'ExerciseAlreadyInSessionError';
    this.exerciseId = exerciseId;
  }
}

export class InvalidSessionTimesError extends Error {
  readonly reason: SessionTimesError;

  constructor(reason: SessionTimesError) {
    super(`Invalid session date or hours: ${reason}`);
    this.name = 'InvalidSessionTimesError';
    this.reason = reason;
  }
}

async function liveSession(db: CertaviDb, sessionId: string): Promise<WorkoutSession> {
  const session = await db.sessions.get(sessionId);
  if (!session || !isLive(session)) throw new SessionNotFoundError(sessionId);
  return session;
}

/** Adds an exercise at the end of the session's plan, with a copy of its default scheme. */
export function addExercise(
  db: CertaviDb,
  sessionId: string,
  exerciseId: string,
  options: RepositoryOptions = {},
): Promise<WorkoutSession> {
  const sessions = createRepository(db, 'session', options);
  return db.transaction('rw', [...sessionTables(db), db.exercises], async () => {
    const session = await liveSession(db, sessionId);
    const exercise = await db.exercises.get(exerciseId);
    if (!exercise || !isLive(exercise)) throw new ExerciseNotFoundError(exerciseId);
    const items = addExerciseItem(session.items, exercise, session.routineId !== null);
    if (!items) throw new ExerciseAlreadyInSessionError(exerciseId);
    return sessions.put({ ...session, items });
  });
}

/** Moves an exercise one place up (-1) or down (+1). False when it cannot move. */
export function moveExercise(
  db: CertaviDb,
  sessionId: string,
  exerciseId: string,
  direction: -1 | 1,
  options: RepositoryOptions = {},
): Promise<boolean> {
  const sessions = createRepository(db, 'session', options);
  return db.transaction('rw', sessionTables(db), async () => {
    const session = await liveSession(db, sessionId);
    const items = moveExerciseItem(session.items, exerciseId, direction);
    if (!items) return false;
    await sessions.put({ ...session, items });
    return true;
  });
}

/**
 * Removes an exercise from the session with its logged sets and its note. Returns what "Undo"
 * needs (`restoreExercise`).
 */
export function removeExercise(
  db: CertaviDb,
  sessionId: string,
  exerciseId: string,
  options: RepositoryOptions = {},
): Promise<UndoExercise> {
  const sessions = createRepository(db, 'session', options);
  const sets = createRepository(db, 'set', options);
  const notes = createRepository(db, 'note', options);
  return db.transaction('rw', sessionTables(db), async () => {
    const { session, item, index, sets: logged } = await loadExercise(db, sessionId, exerciseId);
    const noteId = exerciseNoteId(sessionId, exerciseId);
    const note = (await notes.get(noteId)) ?? null;
    const items = removeExerciseItem(session.items, exerciseId) ?? [];
    await sessions.put({ ...session, items });
    for (const set of logged) await sets.remove(set.id);
    if (note) await notes.remove(noteId);
    return { kind: 'exercise', sessionId, item, index, sets: logged, note };
  });
}

/**
 * Brings back a removed exercise at its place with its sets and note. Throws
 * `UndoConflictError` if the session is gone or the exercise was added again meanwhile.
 */
export function restoreExercise(
  db: CertaviDb,
  undo: UndoExercise,
  options: RepositoryOptions = {},
): Promise<WorkoutSession> {
  const sessions = createRepository(db, 'session', options);
  const sets = createRepository(db, 'set', options);
  const notes = createRepository(db, 'note', options);
  return db.transaction('rw', sessionTables(db), async () => {
    const session = await liveSession(db, undo.sessionId).catch(() => {
      throw new UndoConflictError('The session no longer exists');
    });
    const items = restoreExerciseItem(session.items, undo.item, undo.index);
    if (!items) throw new UndoConflictError('The exercise is already in the session');
    const restored = await sessions.put({ ...session, items });
    if (undo.sets.length > 0) await sets.putMany(undo.sets);
    if (undo.note) await notes.put(undo.note);
    return restored;
  });
}

/**
 * Changes the routine of a session (null = free session). The exercise list follows the new
 * routine, but no exercise with logged sets or a note is lost (see `changeRoutineItems`).
 */
export function changeSessionRoutine(
  db: CertaviDb,
  sessionId: string,
  routineId: string | null,
  options: RepositoryOptions = {},
): Promise<WorkoutSession> {
  const sessions = createRepository(db, 'session', options);
  return db.transaction('rw', [...sessionTables(db), db.routines, db.weekPlans], async () => {
    const session = await liveSession(db, sessionId);
    if (session.routineId === routineId) return session;
    let routine = null;
    if (routineId !== null) {
      const row = await db.routines.get(routineId);
      if (!row || !isLive(row)) throw new RoutineNotFoundError(routineId);
      routine = row;
    }
    const withData = new Set<string>();
    for (const set of await db.sets.where('sessionId').equals(sessionId).toArray()) {
      if (isLive(set)) withData.add(set.exerciseId);
    }
    for (const note of await db.notes.where('sessionId').equals(sessionId).toArray()) {
      if (isLive(note)) withData.add(note.exerciseId);
    }
    const weekPlans = (await db.weekPlans.toArray()).filter((w) => isLive(w));
    const items = changeRoutineItems({
      items: session.items,
      withData,
      routine,
      deload: isDeloadDate(session.date, deloadWeeks(weekPlans)),
    });
    return sessions.put({ ...session, routineId, items });
  });
}

export interface SessionTimesPatch {
  /** ISO date 'YYYY-MM-DD'. */
  date: string;
  /** 'HH:MM'. */
  start: string;
  /** 'HH:MM'; ignored while the session is in progress. */
  end: string | null;
}

/**
 * Edits the date and hours of a session. Throws `InvalidSessionTimesError` (and saves nothing)
 * when the date is after `today` or the end is earlier than the start.
 */
export function updateSessionTimes(
  db: CertaviDb,
  sessionId: string,
  patch: SessionTimesPatch,
  today: string,
  options: RepositoryOptions = {},
): Promise<WorkoutSession> {
  const sessions = createRepository(db, 'session', options);
  return db.transaction('rw', sessionTables(db), async () => {
    const session = await liveSession(db, sessionId);
    const finished = !isInProgress(session);
    if (finished && patch.end === null) throw new InvalidSessionTimesError('invalid');
    const result = sessionTimes({
      date: patch.date,
      today,
      start: patch.start,
      end: finished ? patch.end : null,
    });
    if (!result.ok) throw new InvalidSessionTimesError(result.error);
    return sessions.put({
      ...session,
      date: patch.date,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
    });
  });
}
