import { describe, expect, it } from 'vitest';
import { makeSession, makeSet } from '../testing/builders';
import {
  statsPeriodStart,
  periodStats,
  recentPeriods,
  shiftPeriod,
  trainedWeeks,
  weeklyStreak,
  type StatsLog,
} from './trainingStats';

/** One session per date with one effective set each, ids `s-<date>`. */
function trainedOn(...dates: string[]): StatsLog {
  return {
    sessions: dates.map((date) => makeSession({ id: `s-${date}`, date })),
    sets: dates.map((date) => makeSet({ sessionId: `s-${date}`, exerciseId: 'remo-t' })),
  };
}

describe('periods', () => {
  it('starts a week on its Monday and a month on the 1st', () => {
    expect(statsPeriodStart('week', '2026-11-07')).toBe('2026-11-02');
    expect(statsPeriodStart('week', '2026-11-02')).toBe('2026-11-02');
    expect(statsPeriodStart('month', '2026-11-30')).toBe('2026-11-01');
  });

  it('moves by weeks and by months across the year', () => {
    expect(shiftPeriod('week', '2026-11-02', -2)).toBe('2026-10-19');
    expect(shiftPeriod('month', '2026-11-01', 1)).toBe('2026-12-01');
    expect(shiftPeriod('month', '2026-11-01', 2)).toBe('2027-01-01');
    expect(shiftPeriod('month', '2026-02-01', -2)).toBe('2025-12-01');
    expect(shiftPeriod('month', '2026-01-01', -12)).toBe('2025-01-01');
  });

  it('lists the last periods, oldest first and the current one last', () => {
    expect(recentPeriods('week', '2026-11-07', 3)).toEqual([
      '2026-10-19',
      '2026-10-26',
      '2026-11-02',
    ]);
    expect(recentPeriods('month', '2026-02-15', 3)).toEqual([
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
    expect(recentPeriods('week', '2026-11-07', 0)).toEqual([]);
  });
});

describe('periodStats', () => {
  const sessions = [
    makeSession({ id: 'a', date: '2026-11-02' }),
    makeSession({ id: 'b', date: '2026-11-04' }),
    makeSession({ id: 'c', date: '2026-10-28' }),
    makeSession({ id: 'empty', date: '2026-11-05' }),
  ];
  const sets = [
    makeSet({ sessionId: 'a', exerciseId: 'press', weight: 80, reps: 5, slot: 0 }),
    makeSet({ sessionId: 'a', exerciseId: 'press', weight: 80, reps: 5, slot: 1 }),
    makeSet({ sessionId: 'a', exerciseId: 'remo', weight: 60, reps: 10, slot: 2 }),
    makeSet({ sessionId: 'b', exerciseId: 'press', weight: 82.5, reps: 4 }),
    makeSet({ sessionId: 'c', exerciseId: 'press', weight: 100, reps: 3 }),
  ];

  it('adds weight × reps, exercises, sets and sessions of each week', () => {
    const starts = ['2026-10-26', '2026-11-02', '2026-11-09'];
    expect(periodStats('week', starts, { sessions, sets })).toEqual([
      { start: '2026-10-26', volume: 300, exercises: 1, sets: 1, sessions: 1 },
      // 80×5 + 80×5 + 60×10 + 82.5×4
      { start: '2026-11-02', volume: 1730, exercises: 3, sets: 4, sessions: 2 },
      { start: '2026-11-09', volume: 0, exercises: 0, sets: 0, sessions: 0 },
    ]);
  });

  it('groups the same sets by month', () => {
    expect(periodStats('month', ['2026-10-01', '2026-11-01'], { sessions, sets })).toEqual([
      { start: '2026-10-01', volume: 300, exercises: 1, sets: 1, sessions: 1 },
      { start: '2026-11-01', volume: 1730, exercises: 3, sets: 4, sessions: 2 },
    ]);
  });

  it('keeps only the requested periods, in the order asked', () => {
    const [only, first] = periodStats('week', ['2026-11-02', '2026-10-26'], { sessions, sets });
    expect(only?.start).toBe('2026-11-02');
    expect(first?.start).toBe('2026-10-26');
  });

  it('ignores warm-ups, sets without repetitions and sets of unknown or other sessions', () => {
    const log: StatsLog = {
      sessions: [makeSession({ id: 'a', date: '2026-11-02' })],
      sets: [
        makeSet({ sessionId: 'a', exerciseId: 'press', kind: 'warmup', weight: 40, reps: 10 }),
        makeSet({ sessionId: 'a', exerciseId: 'press', weight: 80, reps: 0 }),
        makeSet({ sessionId: 'gone', exerciseId: 'press', weight: 80, reps: 5 }),
        makeSet({ sessionId: 'a', exerciseId: 'press', kind: 'approach', weight: 60, reps: 5 }),
      ],
    };
    expect(periodStats('week', ['2026-11-02'], log)).toEqual([
      { start: '2026-11-02', volume: 300, exercises: 1, sets: 1, sessions: 1 },
    ]);
  });

  it('adds no weight for bodyweight sets (0 kg) but still counts the sets', () => {
    const log: StatsLog = {
      sessions: [makeSession({ id: 'a', date: '2026-11-02' })],
      sets: [
        makeSet({ sessionId: 'a', exerciseId: 'dominadas', weight: 0, reps: 8 }),
        makeSet({ sessionId: 'a', exerciseId: 'dominadas', weight: 0, reps: 7 }),
      ],
    };
    expect(periodStats('week', ['2026-11-02'], log)).toEqual([
      { start: '2026-11-02', volume: 0, exercises: 1, sets: 2, sessions: 1 },
    ]);
  });

  it('leaves the weight of an exercise marked "does not count" out of the volume only', () => {
    const log: StatsLog = {
      sessions: [makeSession({ id: 'a', date: '2026-11-02' })],
      sets: [
        makeSet({ sessionId: 'a', exerciseId: 'press', weight: 80, reps: 5 }),
        makeSet({ sessionId: 'a', exerciseId: 'remo', weight: 60, reps: 10 }),
      ],
      notes: [
        { sessionId: 'a', exerciseId: 'press', excludeFromProgression: true },
        { sessionId: 'a', exerciseId: 'remo', excludeFromProgression: false },
        { sessionId: 'a', exerciseId: 'curl' },
      ],
    };
    expect(periodStats('week', ['2026-11-02'], log)).toEqual([
      { start: '2026-11-02', volume: 600, exercises: 2, sets: 2, sessions: 1 },
    ]);
  });
});

describe('trainedWeeks', () => {
  it('lists the Mondays of the weeks with a session that has an effective set', () => {
    const log: StatsLog = {
      sessions: [
        makeSession({ id: 'a', date: '2026-11-04' }),
        makeSession({ id: 'warm', date: '2026-10-28' }),
        makeSession({ id: 'empty', date: '2026-10-20' }),
      ],
      sets: [
        makeSet({ sessionId: 'a', exerciseId: 'press' }),
        makeSet({ sessionId: 'warm', exerciseId: 'press', kind: 'warmup' }),
      ],
    };
    expect([...trainedWeeks(log)]).toEqual(['2026-11-02']);
  });
});

describe('weeklyStreak', () => {
  it('is zero without sessions', () => {
    expect(weeklyStreak({ sessions: [], sets: [] }, '2026-11-07')).toEqual({
      current: 0,
      best: 0,
      activeThisWeek: false,
    });
  });

  it('counts the weeks in a row up to the current one', () => {
    const log = trainedOn('2026-10-20', '2026-10-28', '2026-11-03');
    expect(weeklyStreak(log, '2026-11-07')).toEqual({ current: 3, best: 3, activeThisWeek: true });
  });

  it('does not break when the current week has no session yet', () => {
    const log = trainedOn('2026-10-20', '2026-10-28');
    expect(weeklyStreak(log, '2026-11-02')).toEqual({
      current: 2,
      best: 2,
      activeThisWeek: false,
    });
    expect(weeklyStreak(log, '2026-11-08').current).toBe(2);
  });

  it('breaks when a whole week was skipped and keeps the best run', () => {
    const log = trainedOn('2026-09-29', '2026-10-06', '2026-10-13', '2026-10-27', '2026-11-03');
    expect(weeklyStreak(log, '2026-11-07')).toEqual({ current: 2, best: 3, activeThisWeek: true });
  });

  it('is zero when the last trained week is older than last week', () => {
    const log = trainedOn('2026-10-13', '2026-10-20');
    expect(weeklyStreak(log, '2026-11-07')).toEqual({ current: 0, best: 2, activeThisWeek: false });
  });

  it('counts several sessions of a week once and ignores sessions after the current week', () => {
    const log = trainedOn('2026-11-02', '2026-11-04', '2026-11-06', '2026-11-16');
    expect(weeklyStreak(log, '2026-11-07')).toEqual({ current: 1, best: 1, activeThisWeek: true });
  });

  it('does not count a week with only warm-ups or sets without repetitions', () => {
    const log: StatsLog = {
      sessions: [
        makeSession({ id: 'a', date: '2026-11-03' }),
        makeSession({ id: 'b', date: '2026-10-27' }),
      ],
      sets: [
        makeSet({ sessionId: 'a', exerciseId: 'press', kind: 'warmup' }),
        makeSet({ sessionId: 'b', exerciseId: 'press', reps: 0 }),
      ],
    };
    expect(weeklyStreak(log, '2026-11-07').current).toBe(0);
  });
});
