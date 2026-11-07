// Everything the calendar shows, computed from the stored records and the domain rules.
import {
  NORMAL_WEEK,
  addDays,
  compareRoutines,
  compareSessions,
  dayContents,
  dayPlan,
  doneSetsByGroup,
  isEffectiveSet,
  mondayOf,
  monthSummary,
  monthWeeks,
  planWeekNumber,
  totalSets,
  weekPlanId,
  weekPlanSummary,
  weekSchedule,
  weekSpecials,
  weekTiming,
  type Activity,
  type DayContent,
  type DayPlan,
  type Exercise,
  type Routine,
  type SetEntry,
  type WeekPlan,
  type WeekSpecials,
  type WeekTiming,
  type WorkoutSession,
} from '../../domain';
import type { CalendarData } from '../../data/calendar';

export interface CalendarDay extends DayContent {
  date: string;
  inMonth: boolean;
  isToday: boolean;
}

export interface CalendarWeek {
  monday: string;
  days: CalendarDay[];
  specials: WeekSpecials;
  timing: WeekTiming;
  closed: boolean;
}

export type Selection = { kind: 'day'; date: string } | { kind: 'week'; monday: string };

export interface CalendarModel {
  today: string;
  /** First day of the visible month. */
  month: string;
  weeks: CalendarWeek[];
  summary: DayContent;
  routines: Routine[];
  routinesById: ReadonlyMap<string, Routine>;
  exercisesById: ReadonlyMap<string, Exercise>;
  data: CalendarData;
}

export function buildCalendarModel(
  data: CalendarData,
  month: string,
  today: string,
): CalendarModel {
  const contents = dayContents(data.sessions, data.activities);
  const records = new Map(data.weekPlans.map((w) => [w.week, w]));
  const weeks = monthWeeks(month).map((dates): CalendarWeek => {
    const monday = dates[0] ?? month;
    const record = records.get(monday);
    return {
      monday,
      specials: weekSpecials(record),
      timing: weekTiming(monday, today),
      closed: record?.plannedSetsByGroup !== undefined,
      days: dates.map((date) => ({
        date,
        inMonth: date.slice(0, 7) === month.slice(0, 7),
        isToday: date === today,
        sessions: contents.get(date)?.sessions ?? 0,
        activities: contents.get(date)?.activities ?? 0,
      })),
    };
  });
  const routines = [...data.routines].sort(compareRoutines);
  return {
    today,
    month,
    weeks,
    summary: monthSummary(month, data.sessions, data.activities),
    routines,
    routinesById: new Map(routines.map((r) => [r.id, r])),
    exercisesById: new Map(data.exercises.map((e) => [e.id, e])),
    data,
  };
}

/** True when the selection is inside the visible weeks (otherwise the panel closes). */
export function isVisible(model: CalendarModel, selection: Selection): boolean {
  return model.weeks.some((week) =>
    selection.kind === 'week'
      ? week.monday === selection.monday
      : week.days.some((day) => day.date === selection.date),
  );
}

export interface DaySession {
  session: WorkoutSession;
  /** Effective sets logged (no warm-ups, no empty sets). */
  sets: number;
}

export interface DayDetail {
  date: string;
  plan: DayPlan;
  sessions: DaySession[];
  activities: Activity[];
  /** Today and past days can be logged; future days cannot. */
  canLog: boolean;
}

function weekRecord(model: CalendarModel, monday: string): WeekPlan | undefined {
  return model.data.weekPlans.find((w) => w.id === weekPlanId(monday));
}

function effectiveSets(sets: readonly SetEntry[], sessionId: string): number {
  return sets.filter((s) => s.sessionId === sessionId && isEffectiveSet(s)).length;
}

export function dayDetail(model: CalendarModel, date: string): DayDetail {
  const week = weekRecord(model, mondayOf(date));
  const plan = dayPlan(date, week ?? NORMAL_WEEK, model.routines);
  const sessions = model.data.sessions
    .filter((s) => s.date === date)
    .sort((a, b) => compareSessions(a, b) || a.updatedAt - b.updatedAt)
    .map((session) => ({ session, sets: effectiveSets(model.data.sets, session.id) }));
  const activities = model.data.activities
    .filter((a) => a.date === date)
    .sort((a, b) => a.updatedAt - b.updatedAt);
  return { date, plan, sessions, activities, canLog: date <= model.today };
}

export interface WeekDetail {
  monday: string;
  record: WeekPlan | undefined;
  options: Pick<WeekPlan, 'size' | 'hiking' | 'deload'>;
  timing: WeekTiming;
  closed: boolean;
  closedAt: number | undefined;
  weekNumber: number | null;
  doneSets: number;
  plannedSets: number;
  sessions: number;
  plannedSessions: number;
}

export function weekDetail(model: CalendarModel, monday: string): WeekDetail {
  const record = weekRecord(model, monday);
  const options = {
    size: record?.size ?? NORMAL_WEEK.size,
    hiking: record?.hiking ?? NORMAL_WEEK.hiking,
    deload: record?.deload ?? false,
  };
  const sunday = addDays(monday, 6);
  const sessions = model.data.sessions.filter((s) => s.date >= monday && s.date <= sunday);
  const summary = weekPlanSummary(
    monday,
    model.today,
    record,
    model.routinesById,
    model.exercisesById,
  );
  const done = doneSetsByGroup(monday, { sessions, sets: model.data.sets }, model.exercisesById);
  return {
    record,
    monday,
    options,
    timing: weekTiming(monday, model.today),
    closed: record?.plannedSetsByGroup !== undefined,
    closedAt: record?.closedAt,
    weekNumber: planWeekNumber(model.data.settings?.planStart ?? null, monday),
    doneSets: totalSets(done),
    plannedSets: summary.total,
    sessions: sessions.length,
    plannedSessions: weekSchedule(monday, options, model.routines).filter(
      (d) => d.plan.kind === 'routine',
    ).length,
  };
}
