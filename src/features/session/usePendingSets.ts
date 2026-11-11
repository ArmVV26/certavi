import { useCallback, useMemo, useState } from 'react';
import type { SetEntry } from '../../domain';
import {
  addPending,
  dropPending,
  NO_PENDING,
  settle,
  withPending,
  type PendingSets,
} from './pendingSets';

export interface PendingSetsApi {
  /** The live sets plus the ones just saved that the live query has not delivered yet. */
  sets: SetEntry[];
  /** A set was just saved: show it right away. */
  add: (set: SetEntry) => void;
  /** The set of a row was taken out or its rows changed: stop showing the pending one. */
  forgetSlot: (exerciseId: string, slot: number) => void;
  forgetExercise: (exerciseId: string) => void;
}

/**
 * The sets of the session screen. A set just saved shows at once (the row turns to "done" with its
 * values) instead of waiting for the live query to read the session again; once the query brings
 * the set, the pending copy goes away.
 */
export function usePendingSets(live: SetEntry[]): PendingSetsApi {
  const [pending, setPending] = useState<PendingSets>(NO_PENDING);
  const [seen, setSeen] = useState(live);

  // The live query answered: forget the pending sets it has caught up with.
  let current = pending;
  if (seen !== live) {
    setSeen(live);
    current = settle(pending, live);
    if (current !== pending) setPending(current);
  }

  const sets = useMemo(() => withPending(live, current), [live, current]);
  const add = useCallback((set: SetEntry) => {
    setPending((now) => addPending(now, set));
  }, []);
  const forgetSlot = useCallback((exerciseId: string, slot: number) => {
    setPending((now) =>
      dropPending(now, (set) => set.exerciseId === exerciseId && set.slot === slot),
    );
  }, []);
  const forgetExercise = useCallback((exerciseId: string) => {
    setPending((now) => dropPending(now, (set) => set.exerciseId === exerciseId));
  }, []);

  return { sets, add, forgetSlot, forgetExercise };
}
