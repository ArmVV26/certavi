// Progression rule (rutina-actual.md, "Regla de progresión"): what to do next time with an
// exercise, given its plan and the sets of the reference session.
import type { Exercise } from '../model/exercise';
import type { SetScheme } from '../model/scheme';
import type { SetEntry } from '../model/session';
import { backoffWeight, roundToStep } from './backoff';
import { findBlock, hasBlock, parseRepRange } from './scheme';

/** Bilbo sets go up a fixed 5 kg once they pass the top of the range (30 reps). */
export const BILBO_STEP = 5;

export type IncreaseReason =
  /** More reps than the top of the range: go up no matter the RIR. */
  | 'range-exceeded'
  /** Top of the range with RIR ≥ 1 (or no RIR noted). */
  | 'range-top-reached'
  /** Every planned straight set reached the top of the range at the same weight. */
  | 'all-sets-at-top';

export type HoldReason =
  /** Top of the range but at RIR 0: repeat until it comes with reps in reserve. */
  | 'top-rir-0'
  /** Below the top of the range: same weight, one more rep. */
  | 'below-range'
  /** Not every straight set reached the top of the range yet. */
  | 'not-all-sets-at-top';

export type ProgressionAdvice =
  | { action: 'no-reference' }
  | { action: 'deload' }
  | { action: 'increase'; from: number; to: number; reason: IncreaseReason }
  | { action: 'hold'; weight: number; targetReps: number; reason: HoldReason }
  /** Bodyweight exercises (pull-ups): progress by using a thinner band (or none). */
  | { action: 'thinner-band'; targetReps: number }
  | { action: 'same-band'; targetReps: number };

export interface ProgressionInput {
  scheme: SetScheme;
  exercise: Pick<Exercise, 'increment' | 'equipment'>;
  /** Effective sets of the reference session (see `lastReference`); null if none. */
  referenceSets: readonly SetEntry[] | null;
  /** The upcoming session is in a deload week: no progression. */
  deload?: boolean;
}

const up = (from: number, step: number) => roundToStep(from + step, 0.01);

export function progressionAdvice(input: ProgressionInput): ProgressionAdvice {
  const { scheme, exercise, referenceSets } = input;
  if (input.deload) return { action: 'deload' };
  if (!referenceSets || referenceSets.length === 0) return { action: 'no-reference' };

  if (exercise.equipment === 'bodyweight') return bandAdvice(scheme, referenceSets);
  if (hasBlock(scheme, 'bilbo')) return bilboAdvice(scheme, referenceSets);

  const topBlock = findBlock(scheme, 'top');
  const topRange = topBlock ? parseRepRange(topBlock.reps) : null;
  const top = referenceSets.find((s) => s.kind === 'top');
  if (topRange && top) {
    if (top.reps > topRange.max) {
      return {
        action: 'increase',
        from: top.weight,
        to: up(top.weight, exercise.increment),
        reason: 'range-exceeded',
      };
    }
    if (top.reps === topRange.max) {
      return top.rir === 0
        ? { action: 'hold', weight: top.weight, targetReps: topRange.max, reason: 'top-rir-0' }
        : {
            action: 'increase',
            from: top.weight,
            to: up(top.weight, exercise.increment),
            reason: 'range-top-reached',
          };
    }
    const targetReps = Math.max(topRange.min, Math.min(top.reps + 1, topRange.max));
    return { action: 'hold', weight: top.weight, targetReps, reason: 'below-range' };
  }

  return straightAdvice(scheme, exercise.increment, referenceSets);
}

/** Double progression: all planned straight sets at the top of the range → one step up. */
function straightAdvice(
  scheme: SetScheme,
  increment: number,
  sets: readonly SetEntry[],
): ProgressionAdvice {
  const block = findBlock(scheme, 'straight');
  const range = block ? parseRepRange(block.reps) : null;
  const work = sets.filter((s) => s.kind === 'straight');
  if (!range || work.length === 0) return { action: 'no-reference' };
  const planned = scheme.blocks
    .filter((b) => b.kind === 'straight')
    .reduce((sum, b) => sum + b.count, 0);
  const weight = Math.max(...work.map((s) => s.weight));
  const atWeight = work.filter((s) => s.weight === weight);
  if (atWeight.length >= planned && atWeight.every((s) => s.reps >= range.max)) {
    return {
      action: 'increase',
      from: weight,
      to: up(weight, increment),
      reason: 'all-sets-at-top',
    };
  }
  return { action: 'hold', weight, targetReps: range.max, reason: 'not-all-sets-at-top' };
}

function bilboAdvice(scheme: SetScheme, sets: readonly SetEntry[]): ProgressionAdvice {
  const block = findBlock(scheme, 'bilbo');
  const range = block ? parseRepRange(block.reps) : null;
  const bilbo = sets.find((s) => s.kind === 'bilbo');
  if (!range || !bilbo) return { action: 'no-reference' };
  if (bilbo.reps > range.max) {
    return {
      action: 'increase',
      from: bilbo.weight,
      to: up(bilbo.weight, BILBO_STEP),
      reason: 'range-exceeded',
    };
  }
  return { action: 'hold', weight: bilbo.weight, targetReps: range.max + 1, reason: 'below-range' };
}

function bandAdvice(scheme: SetScheme, sets: readonly SetEntry[]): ProgressionAdvice {
  const block = findBlock(scheme, 'straight') ?? scheme.blocks[0];
  const targetReps = (block && parseRepRange(block.reps)?.max) ?? 10;
  const work = sets.filter((s) => s.kind !== 'approach');
  return work.length > 0 && work.every((s) => s.reps >= targetReps)
    ? { action: 'thinner-band', targetReps }
    : { action: 'same-band', targetReps };
}

/**
 * Weights to propose for the next session: the top/straight weight from the advice and the
 * back-off weight derived from it (−10 %, on the exercise's steps).
 */
export function suggestedWeights(
  advice: ProgressionAdvice,
  increment: number,
): { main: number; backoff: number | null } | null {
  const main =
    advice.action === 'increase' ? advice.to : advice.action === 'hold' ? advice.weight : null;
  if (main === null) return null;
  return { main, backoff: backoffWeight(main, increment) };
}
