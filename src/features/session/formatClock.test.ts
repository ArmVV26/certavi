import { describe, expect, it } from 'vitest';
import { formatClock } from './formatClock';

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [15, '0:15'],
    [60, '1:00'],
    [185, '3:05'],
    [210, '3:30'],
    [900, '15:00'],
  ])('writes %i s as %s', (seconds, text) => {
    expect(formatClock(seconds)).toBe(text);
  });
});
