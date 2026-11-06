import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES, exerciseNoteId } from '../domain';
import { makeSession, makeSet, makeWeekPlan } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import { readCatalog, readExerciseDetail } from './exerciseCatalog';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';

async function setup() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return { db, repos: createRepositories(db) };
}

describe('readCatalog', () => {
  it('lists the live exercises and the exercises that are in a routine', async () => {
    const { db, repos } = await setup();
    const catalog = await readCatalog(db);
    expect(catalog.exercises).toHaveLength(SEED_EXERCISES.length);
    expect(catalog.routines).toHaveLength(6);
    expect(catalog.routineExerciseIds.has('remo-t')).toBe(true);
    expect(catalog.routineExerciseIds.has('dominadas')).toBe(false);

    const dominadas = catalog.exercises.find((e) => e.id === 'dominadas');
    if (!dominadas) throw new Error('seed exercise missing');
    await repos.exercise.put({ ...dominadas, archived: true });
    const after = await readCatalog(db);
    expect(after.exercises.find((e) => e.id === 'dominadas')?.archived).toBe(true);
  });

  it('leaves out deleted exercises', async () => {
    const { db, repos } = await setup();
    await repos.exercise.remove('dominadas');
    const ids = (await readCatalog(db)).exercises.map((e) => e.id);
    expect(ids).not.toContain('dominadas');
  });
});

describe('readExerciseDetail', () => {
  it('returns null for an unknown or deleted exercise', async () => {
    const { db, repos } = await setup();
    expect(await readExerciseDetail(db, 'nope')).toBeNull();
    await repos.exercise.remove('dominadas');
    expect(await readExerciseDetail(db, 'dominadas')).toBeNull();
  });

  it('has no history and the routines of an exercise never logged', async () => {
    const { db } = await setup();
    const detail = await readExerciseDetail(db, 'remo-t');
    expect(detail?.history).toEqual([]);
    expect(detail?.stats.bestE1rm).toBeNull();
    expect(detail?.routines.length).toBeGreaterThan(0);
    expect((await readExerciseDetail(db, 'dominadas'))?.routines).toEqual([]);
  });

  it('gives the history newest first and the records of the exercise only', async () => {
    const { db, repos } = await setup();
    await repos.session.putMany([
      makeSession({ id: 'old', date: '2026-10-26' }),
      makeSession({ id: 'new', date: '2026-11-02' }),
      makeSession({ id: 'deload', date: '2026-10-19' }),
      makeSession({ id: 'gone', date: '2026-10-12' }),
    ]);
    await repos.weekPlan.put(makeWeekPlan({ week: '2026-10-19', deload: true }));
    await repos.set.putMany([
      makeSet({ id: 's1', sessionId: 'old', exerciseId: 'remo-t', weight: 60, reps: 8 }),
      makeSet({ id: 's2', sessionId: 'new', exerciseId: 'remo-t', weight: 70, reps: 8 }),
      makeSet({ id: 's3', sessionId: 'deload', exerciseId: 'remo-t', weight: 100, reps: 8 }),
      makeSet({ id: 's4', sessionId: 'new', exerciseId: 'press-pecho-vertical', weight: 90 }),
      makeSet({ id: 's5', sessionId: 'gone', exerciseId: 'remo-t', weight: 200, reps: 8 }),
    ]);
    await repos.session.remove('gone');
    await repos.set.remove('s5');
    await repos.note.put({
      id: exerciseNoteId('old', 'remo-t'),
      sessionId: 'old',
      exerciseId: 'remo-t',
      text: '',
      excludeFromProgression: true,
      reason: 'machine-busy',
    });

    const detail = await readExerciseDetail(db, 'remo-t');
    expect(detail?.history.map((h) => h.session.id)).toEqual(['new', 'old', 'deload']);
    expect(detail?.history.map((h) => [h.deload, h.excluded])).toEqual([
      [false, false],
      [false, true],
      [true, false],
    ]);
    // The deload week does not set records, the other sessions do.
    expect(detail?.stats.maxWeight?.weight).toBe(70);
    expect(detail?.stats.sessions).toBe(3);
  });
});
