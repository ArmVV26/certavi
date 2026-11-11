import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES_BY_ID, newExerciseDraft, type ExerciseDraft } from '../domain';
import { openTestDatabase } from '../test/render';
import {
  ExerciseInRoutineError,
  ExerciseNotEditableError,
  InvalidExerciseError,
  InvalidSetupError,
  createExercise,
  setExerciseArchived,
  setExerciseIncrement,
  setExerciseSetup,
  updateExercise,
} from './exercises';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';
import { ExerciseNotFoundError } from './sessionTools';

const NOW = new Date(2026, 10, 6, 10, 0).getTime();
const now = () => NOW;

async function setup() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return { db, repos: createRepositories(db, { now }) };
}

function draft(fields: Partial<ExerciseDraft> = {}): ExerciseDraft {
  return { ...newExerciseDraft(), name: 'Press landmine', primaryGroup: 'shoulders', ...fields };
}

describe('createExercise', () => {
  it('saves and queues a custom exercise with a new id', async () => {
    const { db } = await setup();
    const exercise = await createExercise(
      db,
      draft({ equipment: 'barbell', supportsStraps: true }),
      { now },
    );
    expect(exercise).toMatchObject({
      name: { text: 'Press landmine' },
      primaryGroup: 'shoulders',
      equipment: 'barbell',
      supportsStraps: true,
      custom: true,
      archived: false,
      updatedAt: NOW,
    });
    expect(exercise.id).toMatch(/^exe_/);
    expect(await db.exercises.get(exercise.id)).toEqual(exercise);
    expect(await db.pending.get(exercise.id)).toMatchObject({ type: 'exercise' });
  });

  it('gives two exercises with the same data two different ids', async () => {
    const { db } = await setup();
    const a = await createExercise(db, draft({ name: 'A' }), { now });
    const b = await createExercise(db, draft({ name: 'B' }), { now });
    expect(a.id).not.toBe(b.id);
  });

  it('writes nothing when the draft is not valid', async () => {
    const { db } = await setup();
    const before = await db.exercises.count();
    const error = await createExercise(db, draft({ name: ' ' }), { now }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidExerciseError);
    expect((error as InvalidExerciseError).errors).toEqual([{ field: 'name', code: 'name-empty' }]);
    expect(await db.exercises.count()).toBe(before);
    expect(await db.pending.count()).toBe(0);
  });

  it('rejects a name that is already taken by a created exercise', async () => {
    const { db } = await setup();
    await createExercise(db, draft(), { now });
    await expect(createExercise(db, draft({ name: 'press LANDMINE' }), { now })).rejects.toThrow(
      InvalidExerciseError,
    );
  });

  it('compares with the translated name of the seed exercises when given', async () => {
    const { db } = await setup();
    const nameOf = (e: { name: { key: string } | { text: string } }) =>
      'text' in e.name
        ? e.name.text
        : e.name.key === 'exercises.names.remo-t'
          ? 'Remo en T'
          : e.name.key;
    const error = await createExercise(db, draft({ name: 'remo en t' }), { now, nameOf }).catch(
      (e: unknown) => e,
    );
    expect((error as InvalidExerciseError).errors).toEqual([{ field: 'name', code: 'name-taken' }]);
    // Without translations the key is compared, so the same name goes through.
    await expect(createExercise(db, draft({ name: 'remo en t' }), { now })).resolves.toBeDefined();
  });
});

describe('updateExercise', () => {
  it('changes the exercise keeping its id and archived state', async () => {
    const { db } = await setup();
    const created = await createExercise(db, draft(), { now });
    await setExerciseArchived(db, created.id, true, { now });
    const updated = await updateExercise(
      db,
      created.id,
      draft({ name: 'Press landmine a una mano', unilateral: true, equipment: 'barbell' }),
      { now: () => NOW + 1000 },
    );
    expect(updated).toMatchObject({
      id: created.id,
      name: { text: 'Press landmine a una mano' },
      unilateral: true,
      archived: true,
      custom: true,
    });
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(await db.exercises.count()).toBe(SEED_EXERCISES_BY_ID.size + 1);
  });

  it('lets the exercise keep its own name but not take another one', async () => {
    const { db } = await setup();
    const a = await createExercise(db, draft({ name: 'A' }), { now });
    await createExercise(db, draft({ name: 'B' }), { now });
    await expect(
      updateExercise(db, a.id, draft({ name: 'A', unilateral: true }), { now }),
    ).resolves.toBeDefined();
    await expect(updateExercise(db, a.id, draft({ name: 'b' }), { now })).rejects.toThrow(
      InvalidExerciseError,
    );
  });

  it('refuses seed exercises and unknown ids', async () => {
    const { db } = await setup();
    await expect(updateExercise(db, 'remo-t', draft(), { now })).rejects.toThrow(
      ExerciseNotEditableError,
    );
    await expect(updateExercise(db, 'nope', draft(), { now })).rejects.toThrow(
      ExerciseNotFoundError,
    );
  });
});

describe('setExerciseArchived', () => {
  it('archives and restores a created exercise', async () => {
    const { db, repos } = await setup();
    const created = await createExercise(db, draft(), { now });
    expect((await setExerciseArchived(db, created.id, true, { now })).archived).toBe(true);
    expect((await repos.exercise.get(created.id))?.archived).toBe(true);
    expect((await setExerciseArchived(db, created.id, false, { now })).archived).toBe(false);
  });

  it('writes nothing when the exercise is already in that state', async () => {
    const { db } = await setup();
    const created = await createExercise(db, draft(), { now });
    await db.pending.clear();
    const same = await setExerciseArchived(db, created.id, false, { now });
    expect(same).toEqual(created);
    expect(await db.pending.count()).toBe(0);
  });

  it('refuses to archive an exercise that is in a routine', async () => {
    const { db, repos } = await setup();
    const created = await createExercise(db, draft(), { now });
    const push = await repos.routine.get('push');
    if (!push) throw new Error('seed routine missing');
    await repos.routine.put({
      ...push,
      items: [
        ...push.items,
        { exerciseId: created.id, scheme: created.defaultScheme, optional: false },
      ],
    });
    const error = await setExerciseArchived(db, created.id, true, { now }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExerciseInRoutineError);
    expect((error as ExerciseInRoutineError).routineIds).toEqual(['push']);
    expect((await repos.exercise.get(created.id))?.archived).toBe(false);
  });

  it('refuses seed exercises and unknown ids', async () => {
    const { db } = await setup();
    await expect(setExerciseArchived(db, 'remo-t', true, { now })).rejects.toThrow(
      ExerciseNotEditableError,
    );
    await expect(setExerciseArchived(db, 'nope', true, { now })).rejects.toThrow(
      ExerciseNotFoundError,
    );
  });
});

describe('setExerciseIncrement', () => {
  it('changes the step of a seed exercise and queues it', async () => {
    const { db } = await setup();
    const updated = await setExerciseIncrement(db, 'remo-t', 5, { now });
    expect(updated).toMatchObject({ id: 'remo-t', increment: 5, custom: false, updatedAt: NOW });
    expect(await db.pending.get('remo-t')).toMatchObject({ type: 'exercise' });
  });

  it('keeps the edited step when the seed is applied again', async () => {
    const { db, repos } = await setup();
    await setExerciseIncrement(db, 'remo-t', 5, { now });
    await ensureSeed(db);
    expect((await repos.exercise.get('remo-t'))?.increment).toBe(5);
  });

  it('changes the step of a created exercise too', async () => {
    const { db } = await setup();
    const created = await createExercise(db, draft(), { now });
    expect((await setExerciseIncrement(db, created.id, 1.25, { now })).increment).toBe(1.25);
  });

  it('writes nothing when the step does not change', async () => {
    const { db } = await setup();
    const current = SEED_EXERCISES_BY_ID.get('remo-t')?.increment;
    if (current === undefined) throw new Error('seed exercise missing');
    await setExerciseIncrement(db, 'remo-t', current, { now });
    expect(await db.pending.count()).toBe(0);
    expect((await db.exercises.get('remo-t'))?.updatedAt).toBe(0);
  });

  it('rejects steps out of range and unknown ids', async () => {
    const { db } = await setup();
    for (const value of [null, 0, 0.1, 60]) {
      await expect(setExerciseIncrement(db, 'remo-t', value, { now })).rejects.toThrow(
        InvalidExerciseError,
      );
    }
    await expect(setExerciseIncrement(db, 'nope', 5, { now })).rejects.toThrow(
      ExerciseNotFoundError,
    );
  });
});

describe('setExerciseSetup', () => {
  const rows = [
    { label: ' Respaldo ', value: '3' },
    { label: 'Asiento', value: '5' },
    { label: '', value: '' },
  ];
  const saved = [
    { label: 'Respaldo', value: '3' },
    { label: 'Asiento', value: '5' },
  ];

  it('saves the cleaned settings of a seed exercise and queues it', async () => {
    const { db, repos } = await setup();
    const updated = await setExerciseSetup(db, 'remo-t', rows, { now });
    expect(updated).toMatchObject({ id: 'remo-t', setup: saved, custom: false, updatedAt: NOW });
    expect((await repos.exercise.get('remo-t'))?.setup).toEqual(saved);
    expect(await db.pending.get('remo-t')).toMatchObject({ type: 'exercise' });
  });

  it('keeps the settings when the seed is applied again', async () => {
    const { db, repos } = await setup();
    await setExerciseSetup(db, 'remo-t', rows, { now });
    await ensureSeed(db);
    expect((await repos.exercise.get('remo-t'))?.setup).toEqual(saved);
  });

  it('works for a created exercise and replaces the previous settings', async () => {
    const { db } = await setup();
    const created = await createExercise(db, draft(), { now });
    await setExerciseSetup(db, created.id, rows, { now });
    const next = await setExerciseSetup(db, created.id, [{ label: 'Pin', value: '7' }], { now });
    expect(next.setup).toEqual([{ label: 'Pin', value: '7' }]);
  });

  it('removes the field when no rows are left', async () => {
    const { db } = await setup();
    await setExerciseSetup(db, 'remo-t', rows, { now });
    const cleared = await setExerciseSetup(db, 'remo-t', [{ label: '', value: ' ' }], { now });
    expect(cleared).not.toHaveProperty('setup');
    expect(await db.exercises.get('remo-t')).not.toHaveProperty('setup');
  });

  it('writes nothing when the settings do not change', async () => {
    const { db } = await setup();
    await setExerciseSetup(db, 'remo-t', [], { now });
    expect(await db.pending.count()).toBe(0);
    await setExerciseSetup(db, 'remo-t', rows, { now });
    await db.pending.clear();
    await setExerciseSetup(db, 'remo-t', saved, { now });
    expect(await db.pending.count()).toBe(0);
  });

  it('rejects invalid rows and unknown ids without writing', async () => {
    const { db } = await setup();
    await expect(
      setExerciseSetup(db, 'remo-t', [{ label: '', value: '3' }], { now }),
    ).rejects.toThrow(InvalidSetupError);
    await expect(setExerciseSetup(db, 'nope', rows, { now })).rejects.toThrow(
      ExerciseNotFoundError,
    );
    expect(await db.pending.count()).toBe(0);
  });

  it('survives editing the form of a created exercise', async () => {
    const { db } = await setup();
    const created = await createExercise(db, draft(), { now });
    await setExerciseSetup(db, created.id, rows, { now });
    const edited = await updateExercise(db, created.id, draft({ name: 'Press landmine 2' }), {
      now,
    });
    expect(edited.setup).toEqual(saved);
  });
});
