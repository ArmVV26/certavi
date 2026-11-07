// Everything the Progress screen shows, computed from the data read from the device.
import {
  cycleReview,
  cycleStart,
  eventsInMonth,
  exerciseHistories,
  groupPeriod,
  latestRecords,
  mondayOf,
  planWeekNumber,
  periodStats,
  readinessBetween,
  recentMondays,
  recentPeriods,
  addDays,
  totalSets,
  weekPlanSummary,
  weeklyStreak,
  weeklyTotals,
  type BodyWeight,
  type CycleReview,
  type Exercise,
  type GroupPeriod,
  type GroupPeriodData,
  type HistoryEntry,
  type PeriodStats,
  type RecordEvent,
  type StatsPeriod,
  type TrainingLog,
  type WeekTotals,
  type WeeklyStreak,
} from '../../domain';
import type { ProgressData } from '../../data/progress';

/** Weeks the weekly charts look at. */
export const CHART_WEEKS = 12;
/** Periods the training statistics chart shows: the last 12 weeks or the last 6 months. */
export const STATS_PERIODS: Record<StatsPeriod, number> = { week: CHART_WEEKS, month: 6 };
/** Records listed. */
export const RECORDS_SHOWN = 12;

export interface WeekColumn extends WeekTotals {
  /** Planned sets of the week, or null for weeks before the cycle started. */
  planned: number | null;
}

export interface ReadinessWeek {
  monday: string;
  avg: number;
  n: number;
}

export interface ProgressModel {
  monday: string;
  sessionsTotal: number;
  /** Week of the cycle, null without a cycle. */
  weekNumber: number | null;
  setsThisWeek: { done: number; planned: number };
  recordsThisMonth: number;
  records: RecordEvent[];
  weeks: WeekColumn[];
  readiness: ReadinessWeek[];
  /** Null without a cycle (no plan start and no session). */
  review: CycleReview | null;
  exercises: ReadonlyMap<string, Exercise>;
  /** Exercises with at least one session. */
  withData: Exercise[];
  histories: ReadonlyMap<string, readonly HistoryEntry[]>;
  bodyWeights: BodyWeight[];
  groups: (period: GroupPeriod) => GroupPeriodData;
  streak: WeeklyStreak;
  /** Weight lifted, exercises and sets of the last periods, oldest first (the current one last). */
  stats: (period: StatsPeriod) => PeriodStats[];
}

export function buildProgressModel(data: ProgressData, today: string): ProgressModel {
  const monday = mondayOf(today);
  const log: TrainingLog = {
    sessions: data.sessions,
    sets: data.sets,
    weekPlans: data.weekPlans,
  };
  const exercises = new Map(data.exercises.map((e) => [e.id, e]));
  const routines = new Map(data.routines.map((r) => [r.id, r]));
  const histories = exerciseHistories(
    data.exercises.map((e) => e.id),
    log,
  );
  const start = cycleStart(data.settings?.planStart ?? null, data.sessions);

  const planFor = (week: string) =>
    weekPlanSummary(
      week,
      today,
      data.weekPlans.find((w) => w.week === week),
      routines,
      exercises,
    );
  const groups = (period: GroupPeriod) =>
    groupPeriod(period, { monday, today, log, weekPlans: data.weekPlans, routines, exercises });

  const thisWeek = groups('week');
  const records = latestRecords(data.exercises, histories, Number.POSITIVE_INFINITY);

  const mondays = recentMondays(monday, CHART_WEEKS);
  const weeks = weeklyTotals(mondays, log, exercises, data.activities).map((totals) => ({
    ...totals,
    planned: start !== null && totals.monday >= start ? planFor(totals.monday).total : null,
  }));

  const readiness = mondays.flatMap((week) => {
    const found = readinessBetween(data.sessions, week, addDays(week, 6));
    return found ? [{ monday: week, ...found }] : [];
  });

  return {
    monday,
    sessionsTotal: data.sessions.length,
    weekNumber: start === null ? null : planWeekNumber(start, today),
    setsThisWeek: { done: totalSets(thisWeek.done), planned: planFor(monday).total },
    recordsThisMonth: eventsInMonth(records, today),
    records: records.slice(0, RECORDS_SHOWN),
    weeks,
    readiness,
    review:
      start === null
        ? null
        : cycleReview({
            today,
            start,
            exercises: data.exercises,
            histories,
            sessions: data.sessions,
          }),
    exercises,
    withData: data.exercises.filter((e) => (histories.get(e.id)?.length ?? 0) > 0),
    histories,
    bodyWeights: [...data.bodyWeights].sort((a, b) => a.week.localeCompare(b.week)),
    groups,
    streak: weeklyStreak(log, today),
    stats: (period) =>
      periodStats(period, recentPeriods(period, today, STATS_PERIODS[period]), {
        sessions: data.sessions,
        sets: data.sets,
        notes: data.notes,
      }),
  };
}
