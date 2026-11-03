import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  isInWeek,
  isMonday,
  isoWeekday,
  mondayOf,
  parseIsoDate,
  toIsoDate,
} from './dates';

describe('ISO dates', () => {
  it('formats a local date with zero padding', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('parses back to local midnight', () => {
    const d = parseIsoDate('2026-11-02');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 2, 0]);
  });

  it.each(['2026-13-01', '2026-02-30', '2026-1-1', 'nope', ''])('rejects %j', (value) => {
    expect(() => parseIsoDate(value)).toThrow(RangeError);
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('gives ISO weekdays (Monday 1, Sunday 7)', () => {
    expect(isoWeekday('2026-11-02')).toBe(1);
    expect(isoWeekday('2026-11-08')).toBe(7);
  });

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');
    expect(isMonday('2026-11-09')).toBe(true);
    expect(isMonday('2026-11-10')).toBe(false);
  });

  it('counts days, also across a daylight-saving change', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-11-08', '2026-11-02')).toBe(-6);
  });

  it('tells whether a day is in a week', () => {
    expect(isInWeek('2026-11-08', '2026-11-02')).toBe(true);
    expect(isInWeek('2026-11-09', '2026-11-02')).toBe(false);
    expect(isInWeek('2026-11-01', '2026-11-02')).toBe(false);
  });
});
