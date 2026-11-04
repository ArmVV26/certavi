// What is planned for each day of a week: a routine or a rest day. The routines carry their own
// day (`Routine.weekday`); the week's size and the hiking switch drop or swap them.
import { addDays, isoWeekday } from '../dates';
import type { ActivityKind, Weekday } from '../model/enums';
import type { Routine } from '../model/routine';
import type { WeekPlan } from '../model/weekPlan';
import { weekRoutines } from './weekPlan';

export const REST_DAY_KINDS = ['active-rest', 'football', 'hiking', 'rest'] as const;
export type RestDayKind = (typeof REST_DAY_KINDS)[number];

export type DayPlan =
  | { kind: 'routine'; routineId: string }
  | { kind: 'rest'; rest: RestDayKind; activities: readonly ActivityKind[] };

/** Fixed rest days of the week (rutina-actual.md). Other free days are a plain rest day. */
const REST_DAYS: Partial<Record<Weekday, RestDayKind>> = { 4: 'active-rest', 6: 'football' };

/** Activities offered as quick actions on each kind of rest day. */
export const REST_DAY_ACTIVITIES: Readonly<Record<RestDayKind, readonly ActivityKind[]>> = {
  'active-rest': ['swimming', 'mobility'],
  football: ['football', 'swimming'],
  hiking: ['hiking'],
  rest: [],
};

/** In a hiking week Sunday is for the mountain (see `weekRoutines`): no routine that day. */
const HIKING_DAY: Weekday = 7;

export type WeekOptions = Pick<WeekPlan, 'size' | 'hiking'>;

/** Default options of a week without a record: 5 sessions, no hiking. */
export const NORMAL_WEEK: WeekOptions = { size: 5, hiking: false };

type RoutineDays = Pick<Routine, 'id' | 'weekday'>;

/**
 * Routine of each weekday. The week's routines keep their day; a routine without a day takes the
 * first day left free by a routine dropped from this week (Lower Full goes to Wednesday, the day
 * of Lower B). In a hiking week Sunday never has a routine.
 */
export function routineDays(
  options: WeekOptions,
  routines: readonly RoutineDays[],
): Map<Weekday, string> {
  const byId = new Map(routines.map((r) => [r.id, r]));
  const inWeek = weekRoutines(options).filter((id) => byId.has(id));
  const days = new Map<Weekday, string>();
  const floating: string[] = [];
  for (const id of inWeek) {
    const weekday = byId.get(id)?.weekday ?? null;
    if (weekday === null || days.has(weekday)) floating.push(id);
    else days.set(weekday, id);
  }
  const freed = routines
    .filter((r) => r.weekday !== null && !inWeek.includes(r.id) && !days.has(r.weekday))
    .map((r) => r.weekday)
    .filter((weekday): weekday is Weekday => weekday !== null)
    .filter((weekday) => !(options.hiking && weekday === HIKING_DAY))
    .sort((a, b) => a - b);
  for (const id of floating) {
    const weekday = freed.shift();
    if (weekday !== undefined) days.set(weekday, id);
  }
  if (options.hiking) days.delete(HIKING_DAY);
  return days;
}

function restDay(weekday: Weekday, hiking: boolean): DayPlan {
  const rest: RestDayKind =
    hiking && weekday === HIKING_DAY ? 'hiking' : (REST_DAYS[weekday] ?? 'rest');
  return { kind: 'rest', rest, activities: REST_DAY_ACTIVITIES[rest] };
}

/** The plan of one date, given its week's options and the current routines. */
export function dayPlan(
  date: string,
  options: WeekOptions,
  routines: readonly RoutineDays[],
): DayPlan {
  const weekday = isoWeekday(date);
  const routineId = routineDays(options, routines).get(weekday);
  return routineId ? { kind: 'routine', routineId } : restDay(weekday, options.hiking);
}

/** The plan of the seven days of the week that starts on `monday`, Monday first. */
export function weekSchedule(
  monday: string,
  options: WeekOptions,
  routines: readonly RoutineDays[],
): { date: string; plan: DayPlan }[] {
  const days = routineDays(options, routines);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const weekday = (i + 1) as Weekday;
    const routineId = days.get(weekday);
    const plan: DayPlan = routineId
      ? { kind: 'routine', routineId }
      : restDay(weekday, options.hiking);
    return { date, plan };
  });
}

/** Order of routines in pickers: routines with a day in weekday order, then the others by id. */
export function compareRoutines(a: RoutineDays, b: RoutineDays): number {
  const da = a.weekday ?? 8;
  const db = b.weekday ?? 8;
  return da - db || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
