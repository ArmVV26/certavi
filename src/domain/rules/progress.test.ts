import { describe, expect, it } from 'vitest';
import type { Exercise } from '../model/exercise';
import type { SetEntry } from '../model/session';
import { makeSession, makeSet, makeWeekPlan } from '../testing/builders';
import {
  cycleReview,
  cycleStart,
  eventsInMonth,
  exerciseHistories,
  groupPeriod,
  latestRecords,
  metricSeries,
  readinessBetween,
  recentMondays,
  weeklyTotals,
} from './progress';
import { emptyGroupCounts, type ExerciseLookup } from './weeklySets';
import type { HistoryEntry } from './history';

const exercises: ExerciseLookup = new Map([
  ['press', { primaryGroup: 'chest' }],
  ['remo', { primaryGroup: 'back' }],
]);

function sets(sessionId: string, exerciseId: string, count: number, extra: Partial<SetEntry> = {}) {
  return Array.from({ length: count }, (_, slot) =>
    makeSet({ sessionId, exerciseId, slot, ...extra }),
  );
}

describe('recentMondays', () => {
  it('lists the weeks that end with the given one, oldest first', () => {
    expect(recentMondays('2026-11-23', 3)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
    expect(recentMondays('2026-11-23', 1)).toEqual(['2026-11-23']);
  });
});

describe('weeklyTotals', () => {
  it('counts effective sets, sessions and activity minutes per week', () => {
    const log = {
      sessions: [
        makeSession({ id: 'a', date: '2026-11-16' }),
        makeSession({ id: 'b', date: '2026-11-17' }),
        makeSession({ id: 'c', date: '2026-11-23' }),
      ],
      sets: [
        ...sets('a', 'press', 3),
        ...sets('a', 'press', 1, { kind: 'warmup' }),
        ...sets('b', 'remo', 2),
        ...sets('c', 'press', 4),
        ...sets('c', 'press', 1, { reps: 0 }),
        ...sets('c', 'desconocido', 5),
      ],
    };
    const totals = weeklyTotals(['2026-11-16', '2026-11-23', '2026-11-30'], log, exercises, [
      { date: '2026-11-18', minutes: 60 },
      { date: '2026-11-19', minutes: 30 },
      { date: '2026-11-24', minutes: 45 },
    ]);
    expect(totals).toEqual([
      { monday: '2026-11-16', sets: 5, sessions: 2, activityMinutes: 90 },
      { monday: '2026-11-23', sets: 4, sessions: 1, activityMinutes: 45 },
      { monday: '2026-11-30', sets: 0, sessions: 0, activityMinutes: 0 },
    ]);
  });

  it('works without activities', () => {
    expect(weeklyTotals(['2026-11-16'], { sessions: [], sets: [] }, exercises)).toEqual([
      { monday: '2026-11-16', sets: 0, sessions: 0, activityMinutes: 0 },
    ]);
  });
});

describe('groupPeriod', () => {
  const frozen = (week: string, chest: number, extra = {}) =>
    makeWeekPlan({
      week,
      plannedSetsByGroup: { ...emptyGroupCounts(), chest },
      closedAt: 5,
      ...extra,
    });
  const input = {
    monday: '2026-11-23',
    today: '2026-11-25',
    log: {
      sessions: [
        makeSession({ id: 'now', date: '2026-11-24' }),
        makeSession({ id: 'last', date: '2026-11-17' }),
        makeSession({ id: 'old', date: '2026-11-03' }),
      ],
      sets: [...sets('now', 'press', 5), ...sets('last', 'press', 12), ...sets('old', 'remo', 8)],
    },
    weekPlans: [
      frozen('2026-11-16', 16, { hiking: true }),
      frozen('2026-11-09', 12),
      frozen('2026-11-02', 8, { deload: true }),
    ],
    routines: new Map(),
    exercises,
  };

  it('this week: sets done and the live plan (no routines → nothing planned)', () => {
    const data = groupPeriod('week', input);
    expect(data).toMatchObject({ period: 'week', from: '2026-11-23', to: '2026-11-29' });
    expect(data.done.chest).toBe(5);
    expect(data.planned.chest).toBe(0);
    expect([data.hiking, data.deload]).toEqual([false, false]);
  });

  it('last week: its sets and its frozen plan, with its options', () => {
    const data = groupPeriod('previous', input);
    expect(data).toMatchObject({ from: '2026-11-16', to: '2026-11-22', hiking: true });
    expect(data.done.chest).toBe(12);
    expect(data.planned.chest).toBe(16);
  });

  it('average: the four weeks before the current one, plan included', () => {
    const data = groupPeriod('average', input);
    expect(data).toMatchObject({ from: '2026-10-26', to: '2026-11-22' });
    expect(data.done.chest).toBe(3); // 12 / 4
    expect(data.done.back).toBe(2); // 8 / 4
    expect(data.planned.chest).toBe(9); // (16 + 12 + 8 + 0) / 4
  });
});

describe('readinessBetween', () => {
  const sessions = [
    makeSession({ id: 'a', date: '2026-11-16', readiness: 3 }),
    makeSession({ id: 'b', date: '2026-11-18', readiness: 4 }),
    makeSession({ id: 'c', date: '2026-11-19', readiness: null }),
    makeSession({ id: 'd', date: '2026-11-23', readiness: 1 }),
  ];

  it('averages the answered sessions of the period', () => {
    expect(readinessBetween(sessions, '2026-11-16', '2026-11-22')).toEqual({ avg: 3.5, n: 2 });
  });

  it('is null without answers', () => {
    expect(readinessBetween(sessions, '2026-11-19', '2026-11-22')).toBeNull();
  });
});

function entry(id: string, date: string, list: Partial<SetEntry>[], deload = false): HistoryEntry {
  return {
    session: makeSession({ id, date }),
    sets: list.map((s, slot) => makeSet({ sessionId: id, exerciseId: 'press', slot, ...s })),
    deload,
    excluded: false,
  };
}

describe('metricSeries', () => {
  const history = [
    entry('a', '2026-11-02', [
      { kind: 'approach', weight: 120, reps: 3 },
      { kind: 'top', weight: 100, reps: 5 },
      { kind: 'backoff', weight: 90, reps: 8 },
    ]),
    entry('b', '2026-11-09', [{ kind: 'top', weight: 200, reps: 5 }], true),
    entry('c', '2026-11-16', [{ kind: 'dropset', weight: 60, reps: 10 }]),
    entry('d', '2026-11-23', [{ kind: 'straight', weight: 0, reps: 12 }]),
  ];

  it('1RM: the best working set of each session; deload and unmeasurable sessions are skipped', () => {
    const points = metricSeries(history, 'e1rm');
    expect(points.map((p) => p.sessionId)).toEqual(['a']);
    expect(points[0]?.value).toBeCloseTo(100 * (1 + 5 / 30));
  });

  it('max weight ignores approach and dropset sets', () => {
    expect(metricSeries(history, 'maxWeight').map((p) => [p.sessionId, p.value])).toEqual([
      ['a', 100],
    ]);
  });

  it('volume sums every effective set, and a session without load has none', () => {
    expect(metricSeries(history, 'volume').map((p) => [p.sessionId, p.value])).toEqual([
      ['a', 120 * 3 + 500 + 720],
      ['c', 600],
    ]);
  });

  it('reps add up the repetitions, bodyweight sessions included', () => {
    expect(metricSeries(history, 'reps').map((p) => [p.sessionId, p.value])).toEqual([
      ['a', 16],
      ['c', 10],
      ['d', 12],
    ]);
  });

  it('is empty for an empty history', () => {
    expect(metricSeries([], 'volume')).toEqual([]);
  });
});

describe('records', () => {
  const log = {
    sessions: [
      makeSession({ id: 'p1', date: '2026-10-20' }),
      makeSession({ id: 'p2', date: '2026-11-03' }),
      makeSession({ id: 'p3', date: '2026-11-10' }),
      makeSession({ id: 'r1', date: '2026-11-04' }),
      makeSession({ id: 'r2', date: '2026-11-11' }),
    ],
    sets: [
      ...sets('p1', 'press', 1, { weight: 80, reps: 5 }),
      ...sets('p2', 'press', 1, { weight: 82.5, reps: 5 }),
      ...sets('p3', 'press', 1, { weight: 85, reps: 5 }),
      ...sets('r1', 'remo', 1, { weight: 60, reps: 8 }),
      ...sets('r2', 'remo', 1, { weight: 60, reps: 10 }),
    ],
  };
  const list = [
    { id: 'press', equipment: 'barbell' as const },
    { id: 'remo', equipment: 'cable' as const },
    { id: 'flexiones', equipment: 'bodyweight' as const },
  ];
  const histories = exerciseHistories(
    list.map((e) => e.id),
    log,
  );

  it('reads each exercise history with its own sets only', () => {
    expect(histories.get('press')?.map((h) => h.session.id)).toEqual(['p1', 'p2', 'p3']);
    expect(histories.get('flexiones')).toEqual([]);
  });

  it('lists record events of every exercise, newest first, up to the limit', () => {
    const events = latestRecords(list, histories, 10);
    expect(events.map((e) => [e.exerciseId, e.date, e.kind])).toEqual([
      ['remo', '2026-11-11', 'e1rm'],
      ['press', '2026-11-10', 'weight'],
      ['press', '2026-11-03', 'weight'],
    ]);
    expect(latestRecords(list, histories, 2)).toHaveLength(2);
  });

  it('breaks date ties by session id, newest first', () => {
    const tie = latestRecords(
      [
        { id: 'a', equipment: 'barbell' },
        { id: 'b', equipment: 'barbell' },
      ],
      new Map([
        [
          'a',
          [
            entry('s1', '2026-11-01', [{ weight: 50, reps: 5 }]),
            entry('sa', '2026-11-08', [{ weight: 60, reps: 5 }]),
          ],
        ],
        [
          'b',
          [
            entry('s2', '2026-11-01', [{ weight: 50, reps: 5 }]),
            entry('sb', '2026-11-08', [{ weight: 60, reps: 5 }]),
          ],
        ],
      ]),
      5,
    );
    expect(tie.map((e) => e.sessionId)).toEqual(['sb', 'sa']);
  });

  it('counts the events of a month', () => {
    const events = latestRecords(list, histories, 10);
    expect(eventsInMonth(events, '2026-11-25')).toBe(3);
    expect(eventsInMonth(events, '2026-10-25')).toBe(0);
  });
});

describe('cycleStart', () => {
  it('is the Monday of the plan start', () => {
    expect(cycleStart('2026-11-04', [])).toBe('2026-11-02');
  });

  it('falls back to the week of the first session', () => {
    const sessions = [{ date: '2026-11-12' }, { date: '2026-11-04' }];
    expect(cycleStart(null, sessions)).toBe('2026-11-02');
  });

  it('is null with nothing to start from', () => {
    expect(cycleStart(null, [])).toBeNull();
  });
});

describe('cycleReview', () => {
  const start = '2026-10-26';
  const basics: Pick<Exercise, 'id' | 'kind' | 'equipment'>[] = [
    { id: 'press', kind: 'compound', equipment: 'barbell' },
    { id: 'sentadilla', kind: 'compound', equipment: 'barbell' },
    { id: 'curl', kind: 'isolation', equipment: 'dumbbell' },
    { id: 'dominadas', kind: 'compound', equipment: 'bodyweight' },
    { id: 'remo', kind: 'compound', equipment: 'cable' },
  ];
  const at = (id: string, date: string, weight: number, deload = false) =>
    entry(id, date, [{ kind: 'top', weight, reps: 5 }], deload);
  const histories = new Map<string, HistoryEntry[]>([
    ['press', [at('p1', '2026-10-27', 100), at('p2', '2026-11-18', 105)]],
    ['sentadilla', [at('s1', '2026-10-28', 140), at('s2', '2026-11-19', 130)]],
    ['curl', [at('c1', '2026-10-28', 20), at('c2', '2026-11-19', 25)]],
    ['dominadas', [at('d1', '2026-10-28', 0), at('d2', '2026-11-19', 0)]],
    ['remo', [at('r1', '2026-10-28', 60), at('r2', '2026-11-19', 200, true)]],
  ]);
  const sessions = [
    makeSession({ id: 'e1', date: '2026-10-27', readiness: 3 }),
    makeSession({ id: 'l1', date: '2026-11-18', readiness: 4 }),
  ];
  const base = { start, exercises: basics, histories, sessions };

  it('compares the first two weeks with the last one in the basic lifts', () => {
    const review = cycleReview({ ...base, today: '2026-11-25' });
    expect(review).toMatchObject({
      available: true,
      reviewDate: '2026-12-07',
      daysToReview: 12,
      up: 1,
      flat: 1,
    });
    expect(review.rows.map((r) => r.exerciseId)).toEqual(['press', 'sentadilla']);
    expect(review.rows[0]?.pct).toBeCloseTo(
      ((105 * (1 + 5 / 30)) / (100 * (1 + 5 / 30)) - 1) * 100,
    );
    expect(review.rows[1]?.pct).toBeLessThan(0);
  });

  it('reads the trend of how you arrive', () => {
    expect(cycleReview({ ...base, today: '2026-11-25' }).readiness).toEqual({
      early: 3,
      late: 4,
      trend: 'better',
    });
    const worse = [
      makeSession({ id: 'e1', date: '2026-10-27', readiness: 4 }),
      makeSession({ id: 'l1', date: '2026-11-18', readiness: 3 }),
    ];
    expect(cycleReview({ ...base, sessions: worse, today: '2026-11-25' }).readiness?.trend).toBe(
      'worse',
    );
    const steady = [
      makeSession({ id: 'e1', date: '2026-10-27', readiness: 3 }),
      makeSession({ id: 'l1', date: '2026-11-18', readiness: 3 }),
    ];
    expect(cycleReview({ ...base, sessions: steady, today: '2026-11-25' }).readiness?.trend).toBe(
      'steady',
    );
    expect(cycleReview({ ...base, sessions: [], today: '2026-11-25' }).readiness).toBeNull();
  });

  it('is available from the fourth week, when the last week no longer overlaps the first two', () => {
    const early = cycleReview({ ...base, today: '2026-11-15' });
    expect(early).toMatchObject({ available: false, rows: [], up: 0, flat: 0, readiness: null });
    expect(cycleReview({ ...base, today: '2026-11-16' }).available).toBe(true);
  });

  it('counts down to the review and past it', () => {
    expect(cycleReview({ ...base, today: '2026-12-07' }).daysToReview).toBe(0);
    expect(cycleReview({ ...base, today: '2026-12-10' }).daysToReview).toBe(-3);
  });
});
