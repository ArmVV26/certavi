// The calendar: month grid, what each day holds, special weeks and the closing of finished weeks.
import { addDays, mondayOf, parseIsoDate, toIsoDate } from '../dates';
import type { Activity } from '../model/activity';
import type { WeekSize } from '../model/enums';
import type { WorkoutSession } from '../model/session';
import type { WeekPlan } from '../model/weekPlan';
import { closeWeek, defaultWeekPlan, isWeekFrozen, livePlan, type RoutineLookup } from './weekPlan';
import type { ExerciseLookup } from './weeklySets';

/** First day of the month of `date` ('2026-11-04' → '2026-11-01'). */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** First day of the month `delta` months after (or before, if negative) the one of `first`. */
export function addMonths(first: string, delta: number): string {
  const date = parseIsoDate(monthStart(first));
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() + delta, 1));
}

export function isInMonth(date: string, first: string): boolean {
  return date.slice(0, 7) === first.slice(0, 7);
}

/**
 * The weeks that touch the month of `first`: 4 to 6 rows of 7 dates, Monday first. The first and
 * last rows include days of the neighbouring months.
 */
export function monthWeeks(first: string): string[][] {
  const start = monthStart(first);
  const next = addMonths(start, 1);
  const rows: string[][] = [];
  for (let monday = mondayOf(start); monday < next; monday = addDays(monday, 7)) {
    rows.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }
  return rows;
}

export interface DayContent {
  sessions: number;
  activities: number;
}

/** Sessions and activities of every date that has any. Records must already be live ones. */
export function dayContents(
  sessions: readonly Pick<WorkoutSession, 'date'>[],
  activities: readonly Pick<Activity, 'date'>[],
): Map<string, DayContent> {
  const map = new Map<string, DayContent>();
  const at = (date: string) => {
    let content = map.get(date);
    if (!content) {
      content = { sessions: 0, activities: 0 };
      map.set(date, content);
    }
    return content;
  };
  for (const s of sessions) at(s.date).sessions += 1;
  for (const a of activities) at(a.date).activities += 1;
  return map;
}

/** Sessions and activities that fall inside the month of `first`. */
export function monthSummary(
  first: string,
  sessions: readonly Pick<WorkoutSession, 'date'>[],
  activities: readonly Pick<Activity, 'date'>[],
): DayContent {
  return {
    sessions: sessions.filter((s) => isInMonth(s.date, first)).length,
    activities: activities.filter((a) => isInMonth(a.date, first)).length,
  };
}

/** What makes a week special (shown as markers in the calendar). */
export interface WeekSpecials {
  deload: boolean;
  hiking: boolean;
  /** 4 or 3 sessions; null for a normal week. */
  short: Exclude<WeekSize, 5> | null;
}

export function weekSpecials(
  record: Pick<WeekPlan, 'deload' | 'hiking' | 'size'> | undefined,
): WeekSpecials {
  return {
    deload: record?.deload ?? false,
    hiking: record?.hiking ?? false,
    short: record && record.size !== 5 ? record.size : null,
  };
}

/** Where a week stands compared with `today`. Only a past week can be closed. */
export type WeekTiming = 'past' | 'current' | 'future';

export function weekTiming(monday: string, today: string): WeekTiming {
  const current = mondayOf(today);
  if (monday < current) return 'past';
  return monday === current ? 'current' : 'future';
}

export interface ClosingInput {
  today: string;
  /** Live week records. */
  weekPlans: readonly WeekPlan[];
  /** Dates of live sessions and activities. */
  dates: readonly string[];
  routines: RoutineLookup;
  exercises: ExerciseLookup;
  now: number;
}

/**
 * The week records to write to close every finished week that has data (a session, an activity
 * or a week record) and is not closed yet. A week without a record gets the default options.
 */
export function pendingWeekClosings(input: ClosingInput): WeekPlan[] {
  const { today, weekPlans, dates, routines, exercises, now } = input;
  const records = new Map(weekPlans.map((w) => [w.week, w]));
  const mondays = new Set([...dates.map((d) => mondayOf(d)), ...records.keys()]);
  return [...mondays]
    .filter((monday) => weekTiming(monday, today) === 'past')
    .sort()
    .flatMap((monday) => {
      const record = records.get(monday) ?? defaultWeekPlan(monday, 0);
      if (isWeekFrozen(record)) return [];
      const plan = livePlan(record, routines, exercises);
      return [closeWeek(record, plan, now)];
    });
}
