// Axis maths for the charts: round tick values and linear scales. Pure, no DOM.

export interface Ticks {
  /** Tick values, ascending, first = `min`, last = `max`. */
  values: number[];
  min: number;
  max: number;
}

/** A "nice" step (1, 2, 2.5, 5 × 10ⁿ), the closest one to `raw`. */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice =
    fraction < 1.5 ? 1 : fraction < 2.25 ? 2 : fraction < 3.5 ? 2.5 : fraction < 7 ? 5 : 10;
  return nice * power;
}

/**
 * Round axis bounds around `[min, max]` with about `count` intervals. A flat range (or a single
 * value) gets a sensible span so the line does not sit on the edge.
 */
export function niceTicks(min: number, max: number, count = 4): Ticks {
  let low = Math.min(min, max);
  let high = Math.max(min, max);
  if (high === low) {
    const pad = Math.max(Math.abs(high) * 0.1, 1);
    low -= pad;
    high += pad;
  }
  const step = niceStep((high - low) / count);
  const from = Math.floor(low / step + 1e-9) * step;
  const to = Math.ceil(high / step - 1e-9) * step;
  const values: number[] = [];
  const total = Math.round((to - from) / step);
  for (let i = 0; i <= total; i++) values.push(Math.round((from + i * step) * 1e6) / 1e6);
  return { values, min: values[0] ?? from, max: values.at(-1) ?? to };
}

/** Maps `[domainMin, domainMax]` linearly onto `[rangeMin, rangeMax]`. A flat domain maps to the middle. */
export function linearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): (value: number) => number {
  const span = domainMax - domainMin;
  if (span === 0) return () => (rangeMin + rangeMax) / 2;
  return (value) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}
