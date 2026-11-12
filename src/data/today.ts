// What the Today screen reads, and the small writes it makes: week options, activity, body
// weight and the daily log of the optional blocks.
import {
  SETTINGS_ID,
  addDays,
  applyBlockLogPatch,
  blockLogId,
  bodyWeightId,
  closeWeek,
  defaultWeekPlan,
  emptyBlockLog,
  isWeekFrozen,
  livePlan,
  mondayOf,
  weekPlanId,
  type Activity,
  type ActivityKind,
  type BlockLog,
  type BlockLogPatch,
  type BodyWeight,
  type Exercise,
  type OptionalBlock,
  type Routine,
  type SetEntry,
  type SyncedSettings,
  type WeekPlan,
  type WorkoutSession,
} from '../domain';
import { isLive, type CertaviDb } from './db';
import { ID_PREFIX, newId } from './ids';
import { createRepository, type RepositoryOptions } from './repository';

export interface TodayData {
  routines: Routine[];
  exercises: Exercise[];
  weekPlans: WeekPlan[];
  /** Every live session (the deload reminder looks back over weeks). */
  sessions: WorkoutSession[];
  /** Sets of the sessions of the current week. */
  weekSets: SetEntry[];
  /** Activities of the current week. */
  weekActivities: Activity[];
  bodyWeights: BodyWeight[];
  blocks: OptionalBlock[];
  /** Block logs of `today`. */
  blockLogs: BlockLog[];
  settings: SyncedSettings | undefined;
}

/** Everything Today needs, read in one consistent transaction. */
export function readToday(db: CertaviDb, today: string): Promise<TodayData> {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
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
      db.blocks,
      db.blockLogs,
      db.settings,
    ],
    async () => {
      const sessions = (await db.sessions.toArray()).filter((row) => isLive(row));
      const weekIds = sessions.filter((s) => s.date >= monday && s.date <= sunday).map((s) => s.id);
      const settings = await db.settings.get(SETTINGS_ID);
      const sets = await db.sets.where('sessionId').anyOf(weekIds).toArray();
      const activities = await db.activities
        .where('date')
        .between(monday, sunday, true, true)
        .toArray();
      const logs = await db.blockLogs.where('date').equals(today).toArray();
      return {
        routines: (await db.routines.toArray()).filter((row) => isLive(row)),
        exercises: (await db.exercises.toArray()).filter((row) => isLive(row)),
        weekPlans: (await db.weekPlans.toArray()).filter((row) => isLive(row)),
        sessions,
        weekSets: sets.filter((row) => isLive(row)),
        weekActivities: activities.filter((row) => isLive(row)),
        bodyWeights: (await db.bodyWeights.toArray()).filter((row) => isLive(row)),
        blocks: (await db.blocks.toArray()).filter((row) => isLive(row)),
        blockLogs: logs.filter((row) => isLive(row)),
        settings: settings && isLive(settings) ? settings : undefined,
      };
    },
  );
}

export type WeekPatch = Partial<Pick<WeekPlan, 'size' | 'hiking' | 'deload'>>;

/**
 * Changes the options of the week that starts on `monday`, creating its record if needed.
 * In a closed week only deload and hiking can change (its size is ignored); the frozen planned
 * sets are recomputed with the new options and the routines of this moment, and the closing
 * time is kept.
 */
export function updateWeek(
  db: CertaviDb,
  monday: string,
  patch: WeekPatch,
  options: RepositoryOptions = {},
): Promise<WeekPlan> {
  const weeks = createRepository(db, 'weekPlan', options);
  const now = options.now ?? Date.now;
  return db.transaction(
    'rw',
    [db.weekPlans, db.routines, db.exercises, db.pending, db.meta],
    async () => {
      const row = await db.weekPlans.get(weekPlanId(monday));
      const base = row && isLive(row) ? row : defaultWeekPlan(monday, 0);
      if (!isWeekFrozen(base)) return weeks.put({ ...base, ...patch });

      const { deload = base.deload, hiking = base.hiking } = patch;
      const next = { ...base, deload, hiking };
      const [routines, exercises] = await Promise.all([
        db.routines.toArray(),
        db.exercises.toArray(),
      ]);
      const plan = livePlan(
        next,
        new Map(routines.filter((r) => isLive(r)).map((r) => [r.id, r])),
        new Map(exercises.filter((e) => isLive(e)).map((e) => [e.id, e])),
      );
      return weeks.put(closeWeek(next, plan, now()));
    },
  );
}

export interface ActivityInput {
  date: string;
  kind: ActivityKind;
  minutes: number;
  note: string;
}

export function saveActivity(
  db: CertaviDb,
  input: ActivityInput,
  { now = Date.now }: RepositoryOptions = {},
): Promise<Activity> {
  return createRepository(db, 'activity', { now }).put({
    id: newId(ID_PREFIX.activity, now()),
    date: input.date,
    kind: input.kind,
    minutes: input.minutes,
    note: input.note.trim(),
  });
}

/** Saves (or replaces) the average body weight of the week that starts on `monday`. */
export function saveBodyWeight(
  db: CertaviDb,
  monday: string,
  kg: number,
  options: RepositoryOptions = {},
): Promise<BodyWeight> {
  return createRepository(db, 'bodyWeight', options).put({
    id: bodyWeightId(monday),
    week: monday,
    kg,
  });
}

/** Applies one change to the log of `blockId` on `date`, creating the log if needed. */
export function updateBlockLog(
  db: CertaviDb,
  blockId: string,
  date: string,
  patch: BlockLogPatch,
  options: RepositoryOptions = {},
): Promise<BlockLog> {
  const logs = createRepository(db, 'blockLog', options);
  return db.transaction('rw', [db.blockLogs, db.pending, db.meta], async () => {
    const row = await db.blockLogs.get(blockLogId(blockId, date));
    const base = row && isLive(row) ? row : emptyBlockLog(blockId, date);
    return logs.put(applyBlockLogPatch(base, patch));
  });
}
