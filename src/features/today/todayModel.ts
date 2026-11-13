// Everything the Today screen shows, computed from the stored records and the domain rules.
import {
  NORMAL_WEEK,
  addDays,
  blocksForDay,
  compareRoutines,
  compareSessions,
  doneSetsByGroup,
  isInProgress,
  mondayOf,
  planWeekNumber,
  sessionItems,
  totalSets,
  weekPlanId,
  weekPlanSummary,
  weekSchedule,
  weeksSinceDeload,
  type Activity,
  type BlockLog,
  type BodyWeight,
  type DayPlan,
  type Exercise,
  type OptionalBlock,
  type PlanItem,
  type Routine,
  type WeekPlan,
  type WorkoutSession,
} from '../../domain';
import type { TodayData } from '../../data/today';

export interface TodayDay {
  date: string;
  plan: DayPlan;
  sessions: WorkoutSession[];
  activities: Activity[];
}

/** What the "today" card offers: start the routine, go back to it, see it done, or rest. */
export type HeroState =
  | { kind: 'start'; routine: Routine }
  | { kind: 'continue'; routine: Routine; session: WorkoutSession }
  | { kind: 'done'; routine: Routine; session: WorkoutSession }
  | { kind: 'rest'; plan: Extract<DayPlan, { kind: 'rest' }> };

const NO_ROUTINE_PLAN: Extract<DayPlan, { kind: 'rest' }> = {
  kind: 'rest',
  rest: 'rest',
  activities: [],
};

/** The state of the hero card. A routine day whose routine is gone counts as a plain rest day. */
export function heroOf(
  plan: DayPlan,
  routine: Routine | undefined,
  mainSession: WorkoutSession | undefined,
): HeroState {
  if (plan.kind === 'rest') return { kind: 'rest', plan };
  if (!routine) return { kind: 'rest', plan: NO_ROUTINE_PLAN };
  if (!mainSession) return { kind: 'start', routine };
  return isInProgress(mainSession)
    ? { kind: 'continue', routine, session: mainSession }
    : { kind: 'done', routine, session: mainSession };
}

export interface TodayModel {
  today: string;
  monday: string;
  week: Pick<WeekPlan, 'size' | 'hiking' | 'deload'>;
  weekNumber: number | null;
  /** Plan of today, with the routine and the items a new session would get. */
  plan: DayPlan;
  routine: Routine | undefined;
  /** What the hero card shows (derived from `plan`, `routine` and `mainSession`). */
  hero: HeroState;
  items: PlanItem[];
  /** The session of today's planned routine, if one exists. */
  mainSession: WorkoutSession | undefined;
  /** Other sessions dated today. */
  otherSessions: WorkoutSession[];
  days: TodayDay[];
  doneSets: number;
  plannedSets: number;
  weekSessions: number;
  /** Sessions planned this week: the days with a routine (4 in a hiking week). */
  plannedSessions: number;
  weeksSinceDeload: number;
  routines: Routine[];
  routinesById: ReadonlyMap<string, Routine>;
  exercisesById: ReadonlyMap<string, Exercise>;
  todayActivities: Activity[];
  blocks: OptionalBlock[];
  /** Today's logs of the optional blocks. */
  blockLogs: BlockLog[];
  bodyWeights: BodyWeight[];
}

export function buildTodayModel(data: TodayData, today: string): TodayModel {
  const monday = mondayOf(today);
  const record = data.weekPlans.find((w) => w.id === weekPlanId(monday));
  const week = {
    size: record?.size ?? NORMAL_WEEK.size,
    hiking: record?.hiking ?? NORMAL_WEEK.hiking,
    deload: record?.deload ?? false,
  };
  const routines = [...data.routines].sort(compareRoutines);
  const routinesById = new Map(routines.map((r) => [r.id, r]));
  const exercisesById = new Map(data.exercises.map((e) => [e.id, e]));

  const sunday = addDays(monday, 6);
  // Ties (same start, e.g. two sessions logged at once) keep the order they were saved in.
  const weekSessions = data.sessions
    .filter((s) => s.date >= monday && s.date <= sunday)
    .sort((a, b) => compareSessions(a, b) || a.updatedAt - b.updatedAt);
  // Activities in the order they were saved: updatedAt comes from the device's monotonic clock.
  const weekActivities = [...data.weekActivities].sort((a, b) => a.updatedAt - b.updatedAt);
  const days = weekSchedule(monday, week, routines).map(({ date, plan }) => ({
    date,
    plan,
    sessions: weekSessions.filter((s) => s.date === date),
    activities: weekActivities.filter((a) => a.date === date),
  }));
  const todayDay = days.find((d) => d.date === today);
  const fallbackPlan: DayPlan = { kind: 'rest', rest: 'rest', activities: [] };
  let plan = todayDay?.plan ?? fallbackPlan;
  const routine = plan.kind === 'routine' ? routinesById.get(plan.routineId) : undefined;
  if (plan.kind === 'routine' && !routine) plan = fallbackPlan;

  const todaySessions = todayDay?.sessions ?? [];
  const mainSession = routine ? todaySessions.find((s) => s.routineId === routine.id) : undefined;

  const summary = weekPlanSummary(monday, today, record, routinesById, exercisesById);
  const done = doneSetsByGroup(
    monday,
    { sessions: weekSessions, sets: data.weekSets },
    exercisesById,
  );

  return {
    today,
    monday,
    week,
    weekNumber: planWeekNumber(data.settings?.planStart ?? null, today),
    plan,
    routine,
    hero: heroOf(plan, routine, mainSession),
    items: routine ? sessionItems(routine.items, week.deload) : [],
    mainSession,
    otherSessions: todaySessions.filter((s) => s !== mainSession),
    days,
    doneSets: totalSets(done),
    plannedSets: summary.total,
    weekSessions: weekSessions.length,
    plannedSessions: days.filter((d) => d.plan.kind === 'routine').length,
    weeksSinceDeload: weeksSinceDeload(today, data.sessions, data.weekPlans),
    routines,
    routinesById,
    exercisesById,
    todayActivities: weekActivities.filter((a) => a.date === today),
    blocks: blocksForDay(data.blocks, today),
    blockLogs: data.blockLogs,
    bodyWeights: data.bodyWeights,
  };
}
