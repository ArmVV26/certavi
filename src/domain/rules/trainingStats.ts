// Training statistics: weight lifted, exercises and sets per week or month, and the weekly streak.
import { addDays, mondayOf } from '../dates';
import type { ExerciseNote, SetEntry, WorkoutSession } from '../model/session';
import { isEffectiveSet } from './sets';

/** What the statistics read. Callers pass live (non-deleted) records only. */
export interface StatsLog {
  sessions: readonly Pick<WorkoutSession, 'id' | 'date'>[];
  sets: readonly Pick<SetEntry, 'sessionId' | 'exerciseId' | 'kind' | 'weight' | 'reps'>[];
  notes?: readonly Pick<ExerciseNote, 'sessionId' | 'exerciseId' | 'excludeFromProgression'>[];
}

export type StatsPeriod = 'week' | 'month';

/** First day of the period that holds `date`: its Monday, or the 1st of its month. */
export function statsPeriodStart(period: StatsPeriod, date: string): string {
  return period === 'week' ? mondayOf(date) : `${date.slice(0, 7)}-01`;
}

/** The period `by` places after (or before, if negative) the one that starts on `start`. */
export function shiftPeriod(period: StatsPeriod, start: string, by: number): string {
  if (period === 'week') return addDays(start, 7 * by);
  const index = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1 + by;
  const year = String(Math.floor(index / 12)).padStart(4, '0');
  const month = String((index % 12) + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/** The `count` periods that end with the one of `date`, oldest first (their first days). */
export function recentPeriods(period: StatsPeriod, date: string, count: number): string[] {
  const last = statsPeriodStart(period, date);
  return Array.from({ length: count }, (_, i) => shiftPeriod(period, last, i + 1 - count));
}

export interface PeriodStats {
  /** First day of the period. */
  start: string;
  /** Weight lifted: kg × reps of the effective sets, without the exercises marked "does not count". */
  volume: number;
  /** Exercises done: one per exercise and session. */
  exercises: number;
  /** Effective sets done. */
  sets: number;
  /** Sessions with at least one effective set. */
  sessions: number;
}

/**
 * Statistics of each period that starts on one of `starts`. Warm-ups and sets without repetitions
 * never count. The weight lifted leaves out the sets of an exercise marked "does not count" in
 * its session (another band, missing plates…); a bodyweight set (0 kg) adds nothing to it.
 */
export function periodStats(
  period: StatsPeriod,
  starts: readonly string[],
  log: StatsLog,
): PeriodStats[] {
  const dateOf = new Map(log.sessions.map((s) => [s.id, s.date]));
  const excluded = new Set(
    (log.notes ?? [])
      .filter((n) => n.excludeFromProgression === true)
      .map((n) => `${n.sessionId}|${n.exerciseId}`),
  );
  const stats = new Map<string, PeriodStats>(
    starts.map((start) => [start, { start, volume: 0, exercises: 0, sets: 0, sessions: 0 }]),
  );
  const exercises = new Set<string>();
  const sessions = new Set<string>();

  for (const set of log.sets) {
    const date = dateOf.get(set.sessionId);
    if (date === undefined || !isEffectiveSet(set)) continue;
    const entry = stats.get(statsPeriodStart(period, date));
    if (!entry) continue;
    entry.sets += 1;
    if (!excluded.has(`${set.sessionId}|${set.exerciseId}`)) entry.volume += set.weight * set.reps;
    const exerciseKey = `${set.sessionId}|${set.exerciseId}`;
    if (!exercises.has(exerciseKey)) {
      exercises.add(exerciseKey);
      entry.exercises += 1;
    }
    if (!sessions.has(set.sessionId)) {
      sessions.add(set.sessionId);
      entry.sessions += 1;
    }
  }
  return starts.flatMap((start) => stats.get(start) ?? []);
}

export interface WeeklyStreak {
  /** Weeks in a row with training, counted back from the current week (see `weeklyStreak`). */
  current: number;
  /** The longest run of weeks in a row with training, ever. */
  best: number;
  /** The current week already has a session. */
  activeThisWeek: boolean;
}

/** Mondays of the weeks that have at least one session with an effective set. */
export function trainedWeeks(log: Pick<StatsLog, 'sessions' | 'sets'>): Set<string> {
  const dateOf = new Map(log.sessions.map((s) => [s.id, s.date]));
  const weeks = new Set<string>();
  for (const set of log.sets) {
    const date = dateOf.get(set.sessionId);
    if (date !== undefined && isEffectiveSet(set)) weeks.add(mondayOf(date));
  }
  return weeks;
}

/**
 * The weekly streak: a week is active when it has at least one session that counts (one effective
 * set). Activities do not count; deload and hiking weeks keep the streak when they have a session.
 * The current week without a session yet does not break it: the streak is counted from last week.
 * Sessions dated after the current week are ignored.
 */
export function weeklyStreak(
  log: Pick<StatsLog, 'sessions' | 'sets'>,
  today: string,
): WeeklyStreak {
  const current = mondayOf(today);
  const weeks = [...trainedWeeks(log)].filter((week) => week <= current).sort();
  const active = new Set(weeks);

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const week of weeks) {
    run = previous !== null && addDays(previous, 7) === week ? run + 1 : 1;
    best = Math.max(best, run);
    previous = week;
  }

  const activeThisWeek = active.has(current);
  let count = 0;
  let week = activeThisWeek ? current : addDays(current, -7);
  while (active.has(week)) {
    count += 1;
    week = addDays(week, -7);
  }
  return { current: count, best, activeThisWeek };
}
