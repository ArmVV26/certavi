// Deload week: half the sets (rounded up), no optional exercises and no Bilbo sets, RIR 3-4.
// The top + back-off structure is kept so reference weights keep coming out.
import { addDays, isInWeek, mondayOf } from '../dates';
import type { PlanItem } from '../model/routine';
import type { SchemeBlock, SetScheme } from '../model/scheme';
import type { WorkoutSession } from '../model/session';
import type { WeekPlan } from '../model/weekPlan';
import { compareSessions, deloadWeeks } from './history';
import { findBlock, hasBlock } from './scheme';

export const DELOAD_RIR = '3-4';

/** Straight block used when a scheme has neither top nor straight sets. */
const FALLBACK_BLOCK: SchemeBlock = { kind: 'straight', reps: '10-15', count: 2 };

/** The deload version of `scheme`, or null when the exercise is dropped (Bilbo). */
export function deloadScheme(scheme: SetScheme): SetScheme | null {
  if (hasBlock(scheme, 'bilbo')) return null;
  const top = findBlock(scheme, 'top');
  if (top) {
    const backoff = findBlock(scheme, 'backoff');
    const total = 1 + (backoff?.count ?? 0);
    const backoffCount = backoff ? Math.ceil(total / 2) - 1 : 0;
    const blocks: SchemeBlock[] = [{ kind: 'top', reps: top.reps, count: 1 }];
    if (backoff && backoffCount > 0) {
      blocks.push({ kind: 'backoff', reps: backoff.reps, count: backoffCount });
    }
    return { blocks, rir: DELOAD_RIR };
  }
  const straight = findBlock(scheme, 'straight') ?? FALLBACK_BLOCK;
  return {
    blocks: [
      { kind: 'straight', reps: straight.reps, count: Math.max(1, Math.ceil(straight.count / 2)) },
    ],
    rir: DELOAD_RIR,
  };
}

export function deloadItems(items: readonly PlanItem[]): PlanItem[] {
  return items.flatMap((item) => {
    if (item.optional) return [];
    const scheme = deloadScheme(item.scheme);
    return scheme ? [{ ...item, scheme }] : [];
  });
}

/**
 * Full weeks in a row, before the current one, with at least one session since the last deload
 * week (or since the first session).
 */
export function weeksSinceDeload(
  today: string,
  sessions: readonly WorkoutSession[],
  weekPlans: readonly WeekPlan[] = [],
): number {
  const first = [...sessions].sort(compareSessions)[0];
  if (!first) return 0;
  const deload = deloadWeeks(weekPlans);
  const firstMonday = mondayOf(first.date);
  let weeks = 0;
  for (
    let monday = addDays(mondayOf(today), -7);
    monday >= firstMonday;
    monday = addDays(monday, -7)
  ) {
    if (deload.has(monday)) break;
    if (sessions.some((s) => isInWeek(s.date, monday))) weeks++;
  }
  return weeks;
}
