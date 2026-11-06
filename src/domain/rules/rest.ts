// Rest timer: how long to rest after a set, and the ±15 s buttons.
import type { ExerciseKind, SetKind } from '../model/enums';
import type { SyncedSettings } from '../model/settings';

/** Fixed rests (seconds) for warm-up and approach rows; the top set rests longer than a basic one. */
export const WARMUP_REST = 60;
export const APPROACH_REST = 90;
export const TOP_REST_EXTRA = 30;

/** The step of the −15 s / +15 s buttons, and the shortest rest while counting. */
export const REST_STEP = 15;

/** The bar closes by itself this many seconds after the time is up. */
export const REST_AUTO_CLOSE = 30;

/**
 * Seconds to rest after saving a row of `kind` in an exercise of `exerciseKind`: warm-up 60,
 * approach 90, top = the basic rest + 30, anything else the basic or the isolation rest.
 */
export function restSeconds(
  kind: SetKind,
  exerciseKind: ExerciseKind,
  rest: SyncedSettings['rest'],
): number {
  if (kind === 'warmup') return WARMUP_REST;
  if (kind === 'approach') return APPROACH_REST;
  if (kind === 'top') return rest.compound + TOP_REST_EXTRA;
  return exerciseKind === 'isolation' ? rest.isolation : rest.compound;
}

/** The time left after a ±15 s press: never below 15 s (also when the time was already up). */
export function adjustRest(secondsLeft: number, delta: number): number {
  return Math.max(REST_STEP, Math.round(secondsLeft + delta));
}
