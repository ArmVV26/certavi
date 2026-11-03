import { describe, expect, it } from 'vitest';
import type { ExerciseNote } from '../model/session';
import { makeSession, makeSet, makeWeekPlan } from '../testing/builders';
import {
  compareSessions,
  deloadWeeks,
  exerciseHistory,
  lastReference,
  type TrainingLog,
} from './history';

const EX = 'remo-t';

function note(sessionId: string, exclude: boolean): ExerciseNote {
  return {
    id: `note_${sessionId}_${EX}`,
    type: 'note',
    updatedAt: 1,
    sessionId,
    exerciseId: EX,
    text: 'Máquina ocupada',
    ...(exclude ? { excludeFromProgression: true, reason: 'machine-busy' as const } : {}),
  };
}

// Three weeks: 2 Nov (normal), 9 Nov (deload), 16 Nov (normal, "does not count").
const sessions = [
  makeSession({ id: 's3', date: '2026-11-17' }),
  makeSession({ id: 's1', date: '2026-11-03', startedAt: 2000 }),
  makeSession({ id: 's0', date: '2026-11-03', startedAt: 1000 }),
  makeSession({ id: 's2', date: '2026-11-10' }),
];
const sets = [
  makeSet({ sessionId: 's1', exerciseId: EX, kind: 'backoff', slot: 1, weight: 40 }),
  makeSet({ sessionId: 's1', exerciseId: EX, kind: 'top', slot: 0, weight: 45 }),
  makeSet({ sessionId: 's1', exerciseId: EX, kind: 'warmup', slot: 0, weight: 20 }),
  makeSet({ sessionId: 's1', exerciseId: 'other', weight: 99 }),
  makeSet({ sessionId: 's2', exerciseId: EX, kind: 'top', weight: 40 }),
  makeSet({ sessionId: 's3', exerciseId: EX, kind: 'top', weight: 47.5 }),
];
const log: TrainingLog = {
  sessions,
  sets,
  notes: [note('s3', true), note('s1', false)],
  weekPlans: [
    makeWeekPlan({ week: '2026-11-09', deload: true }),
    makeWeekPlan({ week: '2026-11-02' }),
  ],
};

describe('exerciseHistory', () => {
  it('lists sessions with effective sets of the exercise, oldest first, sets in order', () => {
    const history = exerciseHistory(EX, log);
    expect(history.map((h) => h.session.id)).toEqual(['s1', 's2', 's3']);
    expect(history[0]?.sets.map((x) => x.kind)).toEqual(['top', 'backoff']);
  });

  it('flags deload weeks and sessions that do not count', () => {
    const history = exerciseHistory(EX, log);
    expect(history.map((h) => [h.deload, h.excluded])).toEqual([
      [false, false],
      [true, false],
      [false, true],
    ]);
  });

  it('works without notes or week plans', () => {
    const history = exerciseHistory(EX, { sessions, sets });
    expect(history.every((h) => !h.deload && !h.excluded)).toBe(true);
  });

  it('sorts sessions by date and then start time', () => {
    const sorted = [...sessions].sort(compareSessions).map((x) => x.id);
    expect(sorted).toEqual(['s0', 's1', 's2', 's3']);
    expect(deloadWeeks()).toEqual(new Set());
  });
});

describe('lastReference', () => {
  it('skips sessions that do not count and deload sessions', () => {
    const ref = lastReference(EX, log, { id: 'new', date: '2026-11-23' });
    expect(ref?.session.id).toBe('s1');
  });

  it('uses a deload session when there is no normal one', () => {
    const onlyDeload: TrainingLog = { ...log, sets: sets.filter((x) => x.sessionId === 's2') };
    expect(lastReference(EX, onlyDeload, { id: 'new', date: '2026-11-23' })?.session.id).toBe('s2');
  });

  it('never uses the current session', () => {
    // s1 is the only normal session that counts; without it only the deload one is left.
    expect(lastReference(EX, log, { id: 's1', date: '2026-11-23' })?.session.id).toBe('s2');
  });

  it('prefers sessions before the date, and falls back to later ones', () => {
    const counted: TrainingLog = { ...log, notes: [], weekPlans: [] };
    expect(lastReference(EX, counted, { id: 'new', date: '2026-11-12' })?.session.id).toBe('s2');
    expect(lastReference(EX, counted, { id: 'new', date: '2026-10-01' })?.session.id).toBe('s3');
  });

  it('returns null without history', () => {
    expect(lastReference('nothing', log, { id: 'new', date: '2026-11-23' })).toBeNull();
  });
});
