import { describe, expect, it } from 'vitest';
import type { SetEntry } from '../model/session';
import { makeSession, makeSet } from '../testing/builders';
import type { HistoryEntry } from './history';
import { exerciseStats, recordEvents, repRecords } from './records';

function entry(id: string, date: string, sets: Partial<SetEntry>[], deload = false): HistoryEntry {
  return {
    session: makeSession({ id, date }),
    sets: sets.map((s) => makeSet({ sessionId: id, exerciseId: 'prensa', ...s })),
    deload,
    excluded: false,
  };
}

const history = [
  entry('w1', '2026-11-01', [
    { kind: 'approach', weight: 200, reps: 3 },
    { kind: 'top', weight: 150, reps: 8 },
    { kind: 'backoff', weight: 135, reps: 10 },
  ]),
  entry('w2', '2026-11-08', [{ kind: 'top', weight: 300, reps: 8 }], true),
  entry('w3', '2026-11-15', [
    { kind: 'top', weight: 155, reps: 8 },
    { kind: 'backoff', weight: 140, reps: 10 },
  ]),
  entry('w4', '2026-11-22', [{ kind: 'top', weight: 150, reps: 12 }]),
  entry('w5', '2026-11-29', [{ kind: 'top', weight: 150, reps: 6 }]),
];

describe('exerciseStats', () => {
  const stats = exerciseStats(history);

  it('counts sessions, sets and reps over the whole history', () => {
    expect([stats.sessions, stats.sets, stats.reps]).toEqual([5, 8, 65]);
  });

  it('takes best marks from non-deload sessions, without approach sets', () => {
    expect(stats.maxWeight).toMatchObject({ weight: 155, sessionId: 'w3' });
    expect(stats.bestE1rm?.sessionId).toBe('w4');
    expect(stats.bestE1rm?.value).toBeCloseTo(210, 6);
    expect(stats.bestVolume).toMatchObject({ sessionId: 'w1', volume: 3150 });
    expect(stats.maxReps).toBe(12);
  });

  it('keeps rep records that no higher rep count beats', () => {
    expect(stats.repRecords.map((r) => [r.reps, r.weight])).toEqual([
      [8, 155],
      [12, 150],
    ]);
  });

  it('is empty without history', () => {
    expect(exerciseStats([])).toMatchObject({
      sessions: 0,
      bestE1rm: null,
      maxWeight: null,
      repRecords: [],
    });
  });

  it('records a 0 kg set as max weight when it is all there is', () => {
    const zero = exerciseStats([entry('z', '2026-11-01', [{ weight: 0, reps: 15 }])]);
    expect(zero.maxWeight?.weight).toBe(0);
    expect(zero.bestE1rm).toBeNull();
  });
});

describe('repRecords', () => {
  it('hides lighter marks at fewer reps (100 × 5 hides 95 × 3)', () => {
    const marks = [
      { reps: 3, weight: 95, date: 'd', sessionId: 'a' },
      { reps: 5, weight: 100, date: 'd', sessionId: 'b' },
      { reps: 1, weight: 110, date: 'd', sessionId: 'c' },
    ];
    expect(repRecords(marks).map((r) => r.reps)).toEqual([1, 5]);
  });
});

describe('recordEvents', () => {
  it('reports new max weights, then better 1RMs, skipping deloads and the first session', () => {
    const events = recordEvents({ id: 'prensa', equipment: 'plate-loaded' }, history);
    expect(events.map((e) => [e.sessionId, e.kind, e.previous])).toEqual([
      ['w3', 'weight', 150],
      ['w4', 'e1rm', 155 * (1 + 8 / 30)],
    ]);
    expect(events[1]?.value).toBeCloseTo(210, 6);
    expect(events[1]?.set?.reps).toBe(12);
  });

  it('ignores sessions with only approach sets and bodyweight exercises', () => {
    const approachOnly = [
      entry('a', '2026-11-01', [{ kind: 'approach', weight: 999 }]),
      ...history,
    ];
    expect(recordEvents({ id: 'prensa', equipment: 'plate-loaded' }, approachOnly)).toHaveLength(2);
    expect(recordEvents({ id: 'dominadas', equipment: 'bodyweight' }, history)).toEqual([]);
  });
});
