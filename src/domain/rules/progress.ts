// Numbers behind the Progress screens: weekly totals, sets per group against the plan, the
// evolution of an exercise, the latest records, the "how you arrive" averages and the cycle review.
import { addDays, daysBetween, isInWeek, mondayOf } from '../dates';
import type { Activity } from '../model/activity';
import type { Exercise } from '../model/exercise';
import type { SetEntry, WorkoutSession } from '../model/session';
import type { WeekPlan } from '../model/weekPlan';
import { exerciseHistory, type HistoryEntry, type TrainingLog } from './history';
import { recordEvents, type RecordEvent } from './records';
import { bestE1rm, countsForStrength, volume } from './sets';
import {
  averageGroupCounts,
  doneSetsByGroup,
  totalSets,
  type ExerciseLookup,
  type GroupCounts,
} from './weeklySets';
import { weekPlanSummary, type RoutineLookup } from './weekPlan';

/** The `count` weeks that end with the week of `monday`, oldest first. */
export function recentMondays(monday: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(monday, -7 * (count - 1 - i)));
}

export interface WeekTotals {
  monday: string;
  /** Effective sets done in the week. */
  sets: number;
  sessions: number;
  /** Minutes of other activities (football, swimming…). */
  activityMinutes: number;
}

export function weeklyTotals(
  mondays: readonly string[],
  log: TrainingLog,
  exercises: ExerciseLookup,
  activities: readonly Pick<Activity, 'date' | 'minutes'>[] = [],
): WeekTotals[] {
  return mondays.map((monday) => ({
    monday,
    sets: totalSets(doneSetsByGroup(monday, log, exercises)),
    sessions: log.sessions.filter((s) => isInWeek(s.date, monday)).length,
    activityMinutes: activities
      .filter((a) => isInWeek(a.date, monday))
      .reduce((sum, a) => sum + a.minutes, 0),
  }));
}

export type GroupPeriod = 'week' | 'previous' | 'average';

export interface GroupPeriodData {
  period: GroupPeriod;
  /** First Monday and last Sunday covered. */
  from: string;
  to: string;
  done: GroupCounts;
  planned: GroupCounts;
  /** A single week only: its options. */
  hiking: boolean;
  deload: boolean;
}

export interface GroupPeriodInput {
  /** Monday of the current week. */
  monday: string;
  today: string;
  log: TrainingLog;
  weekPlans: readonly WeekPlan[];
  routines: RoutineLookup;
  exercises: ExerciseLookup;
}

/**
 * Sets done and planned per group in the current week, the previous one, or the average of the
 * four weeks before the current one. Closed weeks use their frozen plan (`weekPlanSummary`).
 */
export function groupPeriod(period: GroupPeriod, input: GroupPeriodInput): GroupPeriodData {
  const { monday, today, log, weekPlans, routines, exercises } = input;
  const record = (week: string) => weekPlans.find((w) => w.week === week);
  const one = (week: string) => {
    const plan = weekPlanSummary(week, today, record(week), routines, exercises);
    return { done: doneSetsByGroup(week, log, exercises), planned: plan.groups, plan };
  };

  if (period === 'average') {
    const weeks = recentMondays(addDays(monday, -7), 4).map(one);
    return {
      period,
      from: addDays(monday, -28),
      to: addDays(monday, -1),
      done: averageGroupCounts(weeks.map((w) => w.done)),
      planned: averageGroupCounts(weeks.map((w) => w.planned)),
      hiking: false,
      deload: false,
    };
  }
  const week = period === 'week' ? monday : addDays(monday, -7);
  const { done, planned } = one(week);
  return {
    period,
    from: week,
    to: addDays(week, 6),
    done,
    planned,
    hiking: record(week)?.hiking ?? false,
    deload: record(week)?.deload ?? false,
  };
}

/** Average "how do you arrive" (1–5) of the sessions dated in `[from, to]`, or null if none. */
export function readinessBetween(
  sessions: readonly Pick<WorkoutSession, 'date' | 'readiness'>[],
  from: string,
  to: string,
): { avg: number; n: number } | null {
  const values = sessions
    .filter((s) => s.date >= from && s.date <= to)
    .flatMap((s) => (s.readiness === null ? [] : [s.readiness]));
  if (values.length === 0) return null;
  return { avg: values.reduce((sum, v) => sum + v, 0) / values.length, n: values.length };
}

export type ExerciseMetric = 'e1rm' | 'maxWeight' | 'volume' | 'reps';

export interface MetricPoint {
  date: string;
  sessionId: string;
  value: number;
}

/**
 * One value per session for the evolution chart, oldest first. Deload sessions are left out (they
 * would look like a drop) and so are sessions with nothing to measure (for example no working set
 * for the 1RM).
 */
export function metricSeries(
  history: readonly HistoryEntry[],
  metric: ExerciseMetric,
): MetricPoint[] {
  return history.flatMap((entry) => {
    if (entry.deload) return [];
    const strength = entry.sets.filter(countsForStrength);
    let value: number | undefined;
    if (metric === 'e1rm') value = bestE1rm(entry.sets)?.value;
    else if (metric === 'maxWeight') {
      value = strength.length > 0 ? Math.max(...strength.map((s) => s.weight)) : undefined;
    } else if (metric === 'volume') value = volume(entry.sets);
    else value = entry.sets.reduce((sum, s) => sum + s.reps, 0);
    if (value === undefined || value <= 0) return [];
    return [{ date: entry.session.date, sessionId: entry.session.id, value }];
  });
}

/** Histories of several exercises, reading the log once. */
export function exerciseHistories(
  ids: readonly string[],
  log: TrainingLog,
): Map<string, HistoryEntry[]> {
  const byExercise = new Map<string, SetEntry[]>();
  for (const set of log.sets) {
    const list = byExercise.get(set.exerciseId);
    if (list) list.push(set);
    else byExercise.set(set.exerciseId, [set]);
  }
  return new Map(
    ids.map((id) => [id, exerciseHistory(id, { ...log, sets: byExercise.get(id) ?? [] })]),
  );
}

/** The most recent record events of every exercise, newest first (ties: more recent session first). */
export function latestRecords(
  exercises: readonly Pick<Exercise, 'id' | 'equipment'>[],
  histories: ReadonlyMap<string, readonly HistoryEntry[]>,
  limit: number,
): RecordEvent[] {
  return exercises
    .flatMap((exercise) => recordEvents(exercise, histories.get(exercise.id) ?? []))
    .sort((a, b) =>
      a.date === b.date ? b.sessionId.localeCompare(a.sessionId) : b.date.localeCompare(a.date),
    )
    .slice(0, limit);
}

/** How many events fall in the month of `date` ("2026-11-07" → November 2026). */
export function eventsInMonth(events: readonly Pick<RecordEvent, 'date'>[], date: string): number {
  const prefix = date.slice(0, 7);
  return events.filter((e) => e.date.startsWith(prefix)).length;
}

/** Days from the cycle start to its review: six weeks. */
export const REVIEW_WEEKS = 6;

/**
 * Monday of week 1 of the cycle: the plan start if there is one, otherwise the week of the first
 * session. null when there is nothing to start from.
 */
export function cycleStart(
  planStart: string | null,
  sessions: readonly Pick<WorkoutSession, 'date'>[],
): string | null {
  if (planStart !== null) return mondayOf(planStart);
  const first = sessions.reduce<string | null>(
    (min, s) => (min === null || s.date < min ? s.date : min),
    null,
  );
  return first === null ? null : mondayOf(first);
}

export interface ReviewRow {
  exerciseId: string;
  from: number;
  to: number;
  /** Change in percent. */
  pct: number;
}

export type ReadinessTrend = 'better' | 'worse' | 'steady';

export interface CycleReview {
  start: string;
  /** The date six weeks after the start. */
  reviewDate: string;
  /** Days until `reviewDate` (0 or negative once it has passed). */
  daysToReview: number;
  /** There is at least one week after the first two to compare with. */
  available: boolean;
  rows: ReviewRow[];
  /** Lifts above +1 % / the others. */
  up: number;
  flat: number;
  readiness: { early: number; late: number; trend: ReadinessTrend } | null;
}

export interface CycleReviewInput {
  today: string;
  start: string;
  exercises: readonly Pick<Exercise, 'id' | 'kind' | 'equipment'>[];
  histories: ReadonlyMap<string, readonly HistoryEntry[]>;
  sessions: readonly Pick<WorkoutSession, 'date' | 'readiness'>[];
}

/**
 * Compares the best estimated 1RM of the first two weeks of the cycle with the best of the last
 * week (from the Monday of the previous week up to `today`) in every basic lift: compound exercises
 * that are not bodyweight. Deload sessions are ignored; lifts missing in either window are left out.
 */
export function cycleReview(input: CycleReviewInput): CycleReview {
  const { today, start, exercises, histories, sessions } = input;
  const reviewDate = addDays(start, 7 * REVIEW_WEEKS);
  const earlyEnd = addDays(start, 14);
  const lateFrom = addDays(mondayOf(today), -7);
  const available = lateFrom >= earlyEnd;
  const base = {
    start,
    reviewDate,
    daysToReview: daysBetween(today, reviewDate),
    available,
  };
  if (!available) return { ...base, rows: [], up: 0, flat: 0, readiness: null };

  const best = (entries: readonly HistoryEntry[]) =>
    Math.max(0, ...entries.map((e) => bestE1rm(e.sets)?.value ?? 0));
  const rows: ReviewRow[] = [];
  for (const exercise of exercises) {
    if (exercise.kind !== 'compound' || exercise.equipment === 'bodyweight') continue;
    const history = (histories.get(exercise.id) ?? []).filter((h) => !h.deload);
    const from = best(history.filter((h) => h.session.date >= start && h.session.date < earlyEnd));
    const to = best(history.filter((h) => h.session.date >= lateFrom && h.session.date <= today));
    if (from > 0 && to > 0)
      rows.push({ exerciseId: exercise.id, from, to, pct: (to / from - 1) * 100 });
  }
  rows.sort((a, b) => b.pct - a.pct);

  const early = readinessBetween(sessions, start, addDays(start, 13));
  const late = readinessBetween(sessions, lateFrom, today);
  let readiness: CycleReview['readiness'] = null;
  if (early && late) {
    const diff = late.avg - early.avg;
    const trend = diff <= -0.7 ? 'worse' : diff >= 0.5 ? 'better' : 'steady';
    readiness = { early: early.avg, late: late.avg, trend };
  }
  const up = rows.filter((r) => r.pct > 1).length;
  return { ...base, rows, up, flat: rows.length - up, readiness };
}
