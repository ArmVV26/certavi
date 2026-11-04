import { describe, expect, it } from 'vitest';
import {
  DELOAD_REMINDER_WEEKS,
  isValidBodyWeight,
  needsDeloadReminder,
  planWeekNumber,
  previousBodyWeight,
} from './today';

describe('needsDeloadReminder', () => {
  it('asks for a deload after six weeks in a row', () => {
    expect(needsDeloadReminder(DELOAD_REMINDER_WEEKS - 1, false)).toBe(false);
    expect(needsDeloadReminder(DELOAD_REMINDER_WEEKS, false)).toBe(true);
    expect(needsDeloadReminder(9, false)).toBe(true);
  });

  it('stays quiet during a deload week', () => {
    expect(needsDeloadReminder(9, true)).toBe(false);
  });
});

describe('planWeekNumber', () => {
  it('numbers weeks from the plan start, Monday to Sunday', () => {
    expect(planWeekNumber('2026-11-02', '2026-11-02')).toBe(1);
    expect(planWeekNumber('2026-11-02', '2026-11-08')).toBe(1);
    expect(planWeekNumber('2026-11-02', '2026-11-09')).toBe(2);
    expect(planWeekNumber('2026-11-04', '2026-11-18')).toBe(3);
  });

  it('is null without a plan start or before it', () => {
    expect(planWeekNumber(null, '2026-11-02')).toBeNull();
    expect(planWeekNumber('2026-11-09', '2026-11-08')).toBeNull();
  });
});

describe('isValidBodyWeight', () => {
  it('accepts 20 to 300 kg', () => {
    expect(isValidBodyWeight(20)).toBe(true);
    expect(isValidBodyWeight(76.4)).toBe(true);
    expect(isValidBodyWeight(300)).toBe(true);
  });

  it('rejects empty and out-of-range values', () => {
    expect(isValidBodyWeight(null)).toBe(false);
    expect(isValidBodyWeight(12)).toBe(false);
    expect(isValidBodyWeight(300.5)).toBe(false);
  });
});

describe('previousBodyWeight', () => {
  const records = [
    { week: '2026-10-19', kg: 77 },
    { week: '2026-11-02', kg: 76 },
    { week: '2026-10-26', kg: 76.5 },
  ];

  it('returns the latest week before the given Monday', () => {
    expect(previousBodyWeight(records, '2026-11-02')?.kg).toBe(76.5);
    expect(previousBodyWeight(records, '2026-11-09')?.kg).toBe(76);
  });

  it('returns undefined when there is nothing earlier', () => {
    expect(previousBodyWeight(records, '2026-10-19')).toBeUndefined();
  });

  it('handles equal weeks', () => {
    const same = [
      { week: '2026-10-19', kg: 1 },
      { week: '2026-10-19', kg: 2 },
    ];
    expect(previousBodyWeight(same, '2026-11-02')?.kg).toBe(1);
  });
});
