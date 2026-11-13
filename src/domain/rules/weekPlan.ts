// The plan of a week: which routines it has (normal or short week) and its planned sets.
// Closed weeks keep the plan frozen when they were closed; open weeks use the live routines.
import { addDays, mondayOf } from '../dates';
import type { WeekSize } from '../model/enums';
import type { Routine } from '../model/routine';
import { weekPlanId, type WeekPlan } from '../model/weekPlan';
import { deloadItems } from './deload';
import { plannedSetsByGroup, totalSets, type ExerciseLookup, type GroupCounts } from './weeklySets';

/**
 * Routines of each week size (rutina-actual.md, "Si la semana se complica"):
 * with 4 sessions Upper is dropped — never a leg day; with 3, Push, Pull and Lower Full.
 */
export const WEEK_ROUTINES: Readonly<Record<WeekSize, readonly string[]>> = {
  5: ['push', 'pull', 'lowerB', 'upper', 'lowerA'],
  4: ['push', 'pull', 'lowerA', 'lowerB'],
  3: ['push', 'pull', 'lowerFull'],
};

/** In a hiking week Sunday is for the mountain: its routine goes and Lower B becomes Lower Full. */
const HIKING_DROPS = 'lowerA';
const HIKING_SWAPS: Readonly<Record<string, string>> = { lowerB: 'lowerFull' };

/**
 * Routines planned in a week (as gym_app): with hiking, a normal week is Push, Pull, Lower Full and
 * Upper; with 4 sessions, Push, Pull and Lower Full; with 3 nothing changes.
 */
export function weekRoutines(options: { size: WeekSize; hiking?: boolean }): string[] {
  const ids = WEEK_ROUTINES[options.size];
  if (!options.hiking) return [...ids];
  const swapped = ids.filter((id) => id !== HIKING_DROPS).map((id) => HIKING_SWAPS[id] ?? id);
  return [...new Set(swapped)];
}

export type RoutineLookup = ReadonlyMap<string, Pick<Routine, 'items'>>;

export interface PlanSummary {
  size: WeekSize;
  deload: boolean;
  groups: GroupCounts;
  total: number;
  /** True when the numbers come from a closed (frozen) week. */
  closed: boolean;
}

/** Plan computed from the current routines. Missing routines count as empty. */
export function livePlan(
  options: { size: WeekSize; deload: boolean; hiking?: boolean },
  routines: RoutineLookup,
  exercises: ExerciseLookup,
): PlanSummary {
  const { size, deload } = options;
  const plans = weekRoutines(options).map((id) => {
    const items = routines.get(id)?.items ?? [];
    return deload ? deloadItems(items) : items;
  });
  const groups = plannedSetsByGroup(plans, exercises);
  return { size, deload, groups, total: totalSets(groups), closed: false };
}

/** A week plan with default values: 5 sessions, no hiking, no deload, not closed. */
export function defaultWeekPlan(monday: string, updatedAt: number): WeekPlan {
  return {
    id: weekPlanId(monday),
    type: 'weekPlan',
    updatedAt,
    week: monday,
    hiking: false,
    deload: false,
    size: 5,
  };
}

/**
 * A week is frozen once its plan was saved: `plannedSetsByGroup` decides (`closedAt` only says
 * when). The stored shape does not change (sync-v1), so this is the one place that reads it.
 */
export function isWeekFrozen(
  record: WeekPlan | undefined,
): record is WeekPlan & { plannedSetsByGroup: GroupCounts } {
  return record?.plannedSetsByGroup !== undefined;
}

/** The plan of the week starting `monday`, seen on `today`. */
export function weekPlanSummary(
  monday: string,
  today: string,
  record: WeekPlan | undefined,
  routines: RoutineLookup,
  exercises: ExerciseLookup,
): PlanSummary {
  const size = record?.size ?? 5;
  const deload = record?.deload ?? false;
  if (isWeekFrozen(record) && monday < mondayOf(today)) {
    const groups = record.plannedSetsByGroup;
    return { size, deload, groups, total: totalSets(groups), closed: true };
  }
  return livePlan({ size, deload, hiking: record?.hiking ?? false }, routines, exercises);
}

/** Freezes the plan of a finished week. Already closed weeks keep their first closing time. */
export function closeWeek(record: WeekPlan, plan: PlanSummary, now: number): WeekPlan {
  return {
    ...record,
    plannedSetsByGroup: { ...plan.groups },
    closedAt: record.closedAt ?? now,
    updatedAt: now,
  };
}

/** Past weeks (before `today`'s week) that still have no frozen plan. */
export function weeksToClose(
  firstMonday: string,
  today: string,
  records: readonly WeekPlan[],
): string[] {
  const frozen = new Set(records.filter((r) => isWeekFrozen(r)).map((r) => r.week));
  const current = mondayOf(today);
  const out: string[] = [];
  for (let monday = mondayOf(firstMonday); monday < current; monday = addDays(monday, 7)) {
    if (!frozen.has(monday)) out.push(monday);
  }
  return out;
}
