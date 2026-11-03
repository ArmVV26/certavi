// Which logged sets count for what, and the estimated one-rep max.
import type { SetKind } from '../model/enums';
import type { SetEntry } from '../model/session';

type LoggedSet = Pick<SetEntry, 'kind' | 'weight' | 'reps'>;

/** Effective set: counts for weekly sets and volume. Warm-ups never count; approach sets do. */
export function isEffectiveSet(set: Pick<SetEntry, 'kind' | 'reps'>): boolean {
  return set.kind !== 'warmup' && set.reps > 0;
}

/** Counts for strength figures (1RM, max weight, records): no warm-up and no approach sets. */
export function countsForStrength(set: Pick<SetEntry, 'kind' | 'reps'>): boolean {
  return isEffectiveSet(set) && set.kind !== 'approach';
}

/** Epley: weight × (1 + reps / 30). 0 when weight or reps are not positive. */
export function epley1rm(weight: number, reps: number): number {
  return weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;
}

/** The set with the highest estimated 1RM, ignoring warm-up and approach sets. */
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

const KIND_ORDER: Readonly<Record<SetKind, number>> = {
  warmup: 0,
  approach: 1,
  top: 1,
  backoff: 1,
  straight: 1,
  bilbo: 1,
  extra: 2,
};

/** Display order inside an exercise: warm-ups, planned sets by slot, extra sets. */
export function compareSets(
  a: Pick<SetEntry, 'kind' | 'slot'>,
  b: Pick<SetEntry, 'kind' | 'slot'>,
) {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.slot - b.slot;
}
