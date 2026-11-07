// What the Progress screen reads: the whole training log (the charts only look at recent weeks,
// but records, evolution and the cycle review look at the whole history).
import {
  SETTINGS_ID,
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

export interface ProgressData {
  routines: Routine[];
  exercises: Exercise[];
  weekPlans: WeekPlan[];
  sessions: WorkoutSession[];
  sets: SetEntry[];
  activities: Activity[];
  bodyWeights: BodyWeight[];
  settings: SyncedSettings | undefined;
}

/** Every live record the Progress screen needs, in one transaction. */
export function readProgress(db: CertaviDb): Promise<ProgressData> {
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
      const settings = await db.settings.get(SETTINGS_ID);
      const sessions = (await db.sessions.toArray()).filter((row) => isLive(row));
      const live = new Set(sessions.map((s) => s.id));
      return {
        routines: (await db.routines.toArray()).filter((row) => isLive(row)),
        exercises: (await db.exercises.toArray()).filter((row) => isLive(row)),
        weekPlans: (await db.weekPlans.toArray()).filter((row) => isLive(row)),
        sessions,
        sets: (await db.sets.toArray())
          .filter((row) => isLive(row))
          .filter((row) => live.has(row.sessionId)),
        activities: (await db.activities.toArray()).filter((row) => isLive(row)),
        bodyWeights: (await db.bodyWeights.toArray()).filter((row) => isLive(row)),
        settings: settings && isLive(settings) ? settings : undefined,
      };
    },
  );
}
