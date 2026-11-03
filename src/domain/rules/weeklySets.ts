// Sets per muscle group: planned (from routines) and done (from the log) in a week.
import { isInWeek } from '../dates';
import { MUSCLE_GROUPS, type MuscleGroup } from '../model/enums';
import type { Exercise } from '../model/exercise';
import type { PlanItem } from '../model/routine';
import type { TrainingLog } from './history';
import { countSchemeSets } from './scheme';
import { isEffectiveSet } from './sets';

export type GroupCounts = Record<MuscleGroup, number>;

/** Looks exercises up by id; only the primary group matters for counting. */
export type ExerciseLookup = ReadonlyMap<string, Pick<Exercise, 'primaryGroup'>>;

export function emptyGroupCounts(): GroupCounts {
  return Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0])) as GroupCounts;
}

export function totalSets(counts: GroupCounts): number {
  return MUSCLE_GROUPS.reduce((sum, g) => sum + counts[g], 0);
}

/**
 * Planned sets per group for a set of routines (or session plans). Every planned set counts,
 * approach and optional ones included. Unknown exercises are skipped.
 */
export function plannedSetsByGroup(
  plans: readonly (readonly PlanItem[])[],
  exercises: ExerciseLookup,
): GroupCounts {
  const counts = emptyGroupCounts();
  for (const items of plans) {
    for (const item of items) {
      const group = exercises.get(item.exerciseId)?.primaryGroup;
      if (group) counts[group] += countSchemeSets(item.scheme);
    }
  }
  return counts;
}

/** Effective sets per group done in the week that starts on `monday`. */
export function doneSetsByGroup(
  monday: string,
  log: TrainingLog,
  exercises: ExerciseLookup,
): GroupCounts {
  const counts = emptyGroupCounts();
  const inWeek = new Set(log.sessions.filter((s) => isInWeek(s.date, monday)).map((s) => s.id));
  for (const set of log.sets) {
    if (!inWeek.has(set.sessionId) || !isEffectiveSet(set)) continue;
    const group = exercises.get(set.exerciseId)?.primaryGroup;
    if (group) counts[group] += 1;
  }
  return counts;
}

export interface GroupProgress {
  done: number;
  planned: number;
  /** done − planned: negative means sets are still missing. */
  diff: number;
}

export function compareWithPlan(
  done: GroupCounts,
  planned: GroupCounts,
): Record<MuscleGroup, GroupProgress> {
  return Object.fromEntries(
    MUSCLE_GROUPS.map((g) => [
      g,
      { done: done[g], planned: planned[g], diff: done[g] - planned[g] },
    ]),
  ) as Record<MuscleGroup, GroupProgress>;
}

/** Average per group over several weeks (e.g. the last 4), rounded to one decimal. */
export function averageGroupCounts(weeks: readonly GroupCounts[]): GroupCounts {
  const avg = emptyGroupCounts();
  if (weeks.length === 0) return avg;
  for (const g of MUSCLE_GROUPS) {
    avg[g] = Math.round((weeks.reduce((sum, w) => sum + w[g], 0) / weeks.length) * 10) / 10;
  }
  return avg;
}
