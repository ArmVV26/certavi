import { describe, expect, it } from 'vitest';
import { metricPoints, periodStart, weeklyPoints, withWeeklyValues } from './blockTrack';

const log = (date: string, metrics: Record<string, number>, blockId = 'b') => ({
  blockId,
  date,
  metrics,
});

describe('periodStart', () => {
  it('counts the period back from today, today included', () => {
    expect(periodStart('2026-11-07', '30')).toBe('2026-10-09');
    expect(periodStart('2026-11-07', '90')).toBe('2026-08-10');
    expect(periodStart('2026-11-07', 'all')).toBeNull();
  });
});

describe('metricPoints', () => {
  const logs = [
    log('2026-11-05', { stairs: 5 }),
    log('2026-09-01', { stairs: 1 }),
    log('2026-11-01', { stairs: 2, pogos: 4 }),
    log('2026-11-03', { pogos: 3 }),
    log('2026-11-02', { stairs: 9 }, 'other'),
    log('2026-11-09', { stairs: 7 }),
  ];

  it('keeps the days of the block with a value of the metric, oldest first', () => {
    expect(metricPoints(logs, 'b', 'stairs', '2026-11-07', '30')).toEqual([
      { date: '2026-11-01', value: 2 },
      { date: '2026-11-05', value: 5 },
    ]);
  });

  it('widens the period and never looks past today', () => {
    expect(metricPoints(logs, 'b', 'stairs', '2026-11-07', 'all')).toEqual([
      { date: '2026-09-01', value: 1 },
      { date: '2026-11-01', value: 2 },
      { date: '2026-11-05', value: 5 },
    ]);
    expect(metricPoints(logs, 'b', 'stairs', '2026-11-07', '90')).toHaveLength(3);
  });

  it('counts a value of 0 as a value', () => {
    expect(
      metricPoints([log('2026-11-05', { stairs: 0 })], 'b', 'stairs', '2026-11-07', '30'),
    ).toEqual([{ date: '2026-11-05', value: 0 }]);
  });
});

describe('weeklyPoints', () => {
  const record = (week: string, values: Record<string, number>, blockId = 'b') => ({
    blockId,
    metricId: 'wall-test',
    week,
    values,
  });
  const records = [
    record('2026-10-26', { left: 9, right: 10 }),
    record('2026-10-19', { left: 8 }),
    record('2026-11-02', { right: 11 }),
    record('2026-11-02', { left: 1 }, 'other'),
  ];

  it('returns one part over the weeks that have it, oldest first', () => {
    expect(weeklyPoints(records, 'b', 'wall-test', 'left')).toEqual([
      { week: '2026-10-19', value: 8 },
      { week: '2026-10-26', value: 9 },
    ]);
    expect(weeklyPoints(records, 'b', 'wall-test', 'right')).toEqual([
      { week: '2026-10-26', value: 10 },
      { week: '2026-11-02', value: 11 },
    ]);
  });

  it('keeps only the latest weeks', () => {
    expect(weeklyPoints(records, 'b', 'wall-test', 'right', 1)).toEqual([
      { week: '2026-11-02', value: 11 },
    ]);
  });
});

describe('withWeeklyValues', () => {
  it('sets the parts entered, clears the ones set to null and keeps the rest', () => {
    expect(withWeeklyValues({ left: 9, right: 10 }, { left: 9.5, right: null })).toEqual({
      left: 9.5,
    });
    expect(withWeeklyValues({ left: 9 }, { right: 11 })).toEqual({ left: 9, right: 11 });
    expect(withWeeklyValues({}, { left: null })).toEqual({});
  });
});
