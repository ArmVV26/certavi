// Which logged sets count for what, and the estimated one-rep max.
import type { SetEntry } from '../model/session';

type LoggedSet = Pick<SetEntry, 'kind' | 'weight' | 'reps'>;

/**
 * Effective set: counts for weekly sets and volume. Warm-ups never count; approach, dropset and
 * extra sets do.
 */
export function isEffectiveSet(set: Pick<SetEntry, 'kind' | 'reps'>): boolean {
  return set.kind !== 'warmup' && set.reps > 0;
}

/**
 * Counts for strength figures (1RM, max weight, records): no warm-up, approach or dropset sets
 * (their weights are not the weight the exercise is judged on).
 */
export function countsForStrength(set: Pick<SetEntry, 'kind' | 'reps'>): boolean {
  return isEffectiveSet(set) && set.kind !== 'approach' && set.kind !== 'dropset';
}

/** Epley: weight × (1 + reps / 30). 0 when weight or reps are not positive. */
export function epley1rm(weight: number, reps: number): number {
  return weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;
}

/** The set with the highest estimated 1RM, ignoring warm-up, approach and dropset sets. */
export function bestE1rm<T extends LoggedSet>(
  sets: readonly T[],
): { value: number; set: T } | null {
  let best: { value: number; set: T } | null = null;
  for (const set of sets) {
    if (!countsForStrength(set)) continue;
    const value = epley1rm(set.weight, set.reps);
    if (value > 0 && (!best || value > best.value)) best = { value, set };
  }
  return best;
}

/** Volume (kg × reps) of the effective sets. */
export function volume(sets: readonly LoggedSet[]): number {
  return sets.filter(isEffectiveSet).reduce((sum, set) => sum + set.weight * set.reps, 0);
}

/**
 * Display order inside an exercise: by slot, the position of the row in the session. The type of
 * a row can change without the row moving, so the kind plays no part.
 */
export function compareSets(a: Pick<SetEntry, 'slot'>, b: Pick<SetEntry, 'slot'>) {
  return a.slot - b.slot;
}
