// What the calendar reads (the visible weeks) and the closing of finished weeks.
import {
  SETTINGS_ID,
  monthWeeks,
  pendingWeekClosings,
  type Activity,
  type BodyWeight,
  type Exercise,
  type Routine,
  type SetEntry,
  type SyncedSettings,
  type WeekPlan,
  type WorkoutSession,
} from '../domain';
import { isLive, type CertaviDb } from './db';
import { createRepository, type RepositoryOptions } from './repository';

export interface CalendarData {
  routines: Routine[];
  exercises: Exercise[];
  weekPlans: WeekPlan[];
  /** Sessions dated inside the visible weeks. */
  sessions: WorkoutSession[];
  /** Sets of those sessions. */
  sets: SetEntry[];
  /** Activities dated inside the visible weeks. */
  activities: Activity[];
  bodyWeights: BodyWeight[];
  settings: SyncedSettings | undefined;
}

/** Everything the calendar needs for the month that starts on `first`, in one transaction. */
export function readCalendar(db: CertaviDb, first: string): Promise<CalendarData> {
  const rows = monthWeeks(first);
  const from = rows[0]?.[0] ?? first;
  const to = rows.at(-1)?.[6] ?? first;
  return db.transaction(
    'r',
    [
      db.routines,
      db.exercises,
      db.weekPlans,
      db.sessions,
      db.sets,
      db.activities,
      db.bodyWeights,
      db.settings,
    ],
    async () => {
      const sessions = (
        await db.sessions.where('date').between(from, to, true, true).toArray()
      ).filter((row) => isLive(row));
      const activities = await db.activities.where('date').between(from, to, true, true).toArray();
      const sets = await db.sets
        .where('sessionId')
        .anyOf(sessions.map((s) => s.id))
        .toArray();
      const settings = await db.settings.get(SETTINGS_ID);
      return {
        routines: (await db.routines.toArray()).filter((row) => isLive(row)),
        exercises: (await db.exercises.toArray()).filter((row) => isLive(row)),
        weekPlans: (await db.weekPlans.toArray()).filter((row) => isLive(row)),
        sessions,
        sets: sets.filter((row) => isLive(row)),
        activities: activities.filter((row) => isLive(row)),
        bodyWeights: (await db.bodyWeights.toArray()).filter((row) => isLive(row)),
        settings: settings && isLive(settings) ? settings : undefined,
      };
    },
  );
}

/**
 * Closes every finished week that has data and no frozen plan yet (see `pendingWeekClosings`).
 * Returns how many weeks it closed. Check and writes run in one transaction.
 */
export function closeFinishedWeeks(
  db: CertaviDb,
  today: string,
  options: RepositoryOptions = {},
): Promise<number> {
  const now = options.now ?? Date.now;
  const weeks = createRepository(db, 'weekPlan', options);
  return db.transaction(
    'rw',
    [db.sessions, db.activities, db.weekPlans, db.routines, db.exercises, db.pending, db.meta],
    async () => {
      const [sessions, activities, weekPlans, routines, exercises] = await Promise.all([
        db.sessions.toArray(),
        db.activities.toArray(),
        db.weekPlans.toArray(),
        db.routines.toArray(),
        db.exercises.toArray(),
      ]);
      const closings = pendingWeekClosings({
        today,
        weekPlans: weekPlans.filter((row) => isLive(row)),
        dates: [...sessions, ...activities].filter((row) => isLive(row)).map((row) => row.date),
        routines: new Map(routines.filter((row) => isLive(row)).map((row) => [row.id, row])),
        exercises: new Map(exercises.filter((row) => isLive(row)).map((row) => [row.id, row])),
        now: now(),
      });
      await weeks.putMany(closings);
      return closings.length;
    },
  );
}
