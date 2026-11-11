import type { SetEntry } from '../../domain';

/**
 * Sets just saved on this device that the live query has not delivered yet, by set id. Reading a
 * session again takes a moment (it reads the history of every exercise), and until it is done the
 * row would show as empty: these sets cover that gap.
 */
export type PendingSets = ReadonlyMap<string, SetEntry>;

export const NO_PENDING: PendingSets = new Map();

/** The live sets with the pending ones on top: a newer version replaces, a missing one is added. */
export function withPending(live: SetEntry[], pending: PendingSets): SetEntry[] {
  if (pending.size === 0) return live;
  const byId = new Map(live.map((set) => [set.id, set]));
  for (const [id, set] of pending) {
    const current = byId.get(id);
    if (!current || current.updatedAt < set.updatedAt) byId.set(id, set);
  }
  return [...byId.values()];
}

/** The pending sets the live ones have not caught up with yet (same object when none left). */
export function settle(pending: PendingSets, live: SetEntry[]): PendingSets {
  if (pending.size === 0) return pending;
  const byId = new Map(live.map((set) => [set.id, set]));
  const waiting = [...pending].filter(([id, set]) => {
    const current = byId.get(id);
    return !current || current.updatedAt < set.updatedAt;
  });
  return waiting.length === pending.size ? pending : new Map(waiting);
}

export function addPending(pending: PendingSets, set: SetEntry): PendingSets {
  return new Map(pending).set(set.id, set);
}

/** The pending sets without those that match (same object when none did). */
export function dropPending(
  pending: PendingSets,
  matches: (set: SetEntry) => boolean,
): PendingSets {
  const kept = [...pending].filter(([, set]) => !matches(set));
  return kept.length === pending.size ? pending : new Map(kept);
}
