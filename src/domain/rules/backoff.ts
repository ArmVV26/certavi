// Suggested back-off weight: about 10 % below the top set, on the exercise's weight steps.

export const BACKOFF_DROP = 0.1;

/** Rounds `value` to the nearest multiple of `step` (avoids float noise like 57.49999). */
export function roundToStep(value: number, step: number): number {
  if (!(step > 0)) return value;
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

/**
 * Back-off weight for a top set of `topWeight` kg: −10 % rounded to `step`, always at least one
 * step below the top set and never negative. null when there is no top weight.
 */
export function backoffWeight(topWeight: number, step: number): number | null {
  if (!(topWeight > 0)) return null;
  const weight = roundToStep(topWeight * (1 - BACKOFF_DROP), step);
  if (weight < topWeight) return weight;
  return Math.max(0, roundToStep(topWeight - step, step));
}
