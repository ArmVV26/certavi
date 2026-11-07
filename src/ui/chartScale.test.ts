import { describe, expect, it } from 'vitest';
import { linearScale, niceTicks } from './chartScale';

describe('niceTicks', () => {
  it('rounds the bounds to nice steps', () => {
    expect(niceTicks(0, 107)).toEqual({ values: [0, 25, 50, 75, 100, 125], min: 0, max: 125 });
    expect(niceTicks(80, 97.5, 4)).toMatchObject({ min: 80, max: 100 });
    expect(niceTicks(1, 5, 4).values).toEqual([1, 2, 3, 4, 5]);
  });

  it('gives a flat range some room', () => {
    const ticks = niceTicks(82, 82);
    expect(ticks.min).toBeLessThan(82);
    expect(ticks.max).toBeGreaterThan(82);
    expect(niceTicks(0, 0).max).toBeGreaterThan(0);
  });

  it('accepts the bounds in any order and keeps the values ascending', () => {
    const ticks = niceTicks(10, 2);
    expect(ticks.values).toEqual([...ticks.values].sort((a, b) => a - b));
    expect(ticks.min).toBeLessThanOrEqual(2);
    expect(ticks.max).toBeGreaterThanOrEqual(10);
  });

  it('avoids floating point noise in decimal steps', () => {
    expect(niceTicks(0, 1, 4).values).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});

describe('linearScale', () => {
  it('maps the domain onto the range, also inverted', () => {
    expect(linearScale(0, 10, 0, 100)(5)).toBe(50);
    expect(linearScale(0, 10, 100, 0)(2.5)).toBe(75);
  });

  it('maps a flat domain to the middle of the range', () => {
    expect(linearScale(3, 3, 0, 100)(3)).toBe(50);
  });
});
