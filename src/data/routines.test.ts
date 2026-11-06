import { describe, expect, it } from 'vitest';
import {
  SEED_ROUTINES_BY_ID,
  addRoutineRow,
  differsFromSeed,
  exerciseFromDraft,
  newExerciseDraft,
  removeExerciseItem,
  type PlanItem,
  type Routine,
} from '../domain';
import { makeSession } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import { createRepositories } from './repository';
import {
  InvalidRoutineError,
  RoutineNotFoundError,
  RoutineNotRestorableError,
  restoreSeedRoutine,
  saveRoutine,
} from './routines';
import { ensureSeed } from './seed';
import { ExerciseNotFoundError } from './sessionTools';

const NOW = new Date(2026, 10, 6, 10, 0).getTime();
const now = () => NOW;

const seedPush = SEED_ROUTINES_BY_ID.get('push');
if (!seedPush) throw new Error('push routine missing');
const pushItems = (): PlanItem[] => structuredClone([...seedPush.items]);

async function setup() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return { db, repos: createRepositories(db, { now }) };
}

describe('saveRoutine', () => {
  it('saves the edited exercises, keeps name and day, and queues the routine', async () => {
    const { db, repos } = await setup();
    const items = removeExerciseItem(pushItems(), 'aperturas-maquina') ?? [];

    const saved = await saveRoutine(db, 'push', items, { now });

    expect(saved.items.map((i) => i.exerciseId)).not.toContain('aperturas-maquina');
    expect(saved).toMatchObject({
      id: 'push',
      weekday: 1,
      custom: false,
      name: { key: 'routines.names.push' },
      updatedAt: NOW,
    });
    expect(await repos.routine.get('push')).toEqual(saved);
    expect(await db.pending.get('push')).toMatchObject({ type: 'routine', updatedAt: NOW });
    expect(differsFromSeed(saved)).toBe(true);
  });

  it('saves a changed scheme and a custom exercise', async () => {
    const { db, repos } = await setup();
    await repos.exercise.put(
      exerciseFromDraft(
        { ...newExerciseDraft(), name: 'Mi remo', primaryGroup: 'back' },
        'exe_mine',
      ),
    );
    const items = pushItems();
    const first = items[0];
    if (!first) throw new Error('empty routine');
    items[0] = { ...first, scheme: addRoutineRow(first.scheme) ?? first.scheme };
    items.push({
      exerciseId: 'exe_mine',
      scheme: { blocks: [{ kind: 'straight', reps: '10', count: 3 }], rir: '2' },
      optional: true,
    });

    const saved = await saveRoutine(db, 'push', items, { now });

    expect(saved.items).toHaveLength(8);
    expect(saved.items.at(-1)).toMatchObject({ exerciseId: 'exe_mine', optional: true });
    expect(saved.items[0]?.scheme.blocks.at(-1)).toMatchObject({ kind: 'backoff', count: 3 });
  });

  it('writes nothing when the routine does not change', async () => {
    const { db } = await setup();
    const saved = await saveRoutine(db, 'push', pushItems(), { now });
    expect(saved.updatedAt).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });

  it('rejects an invalid routine and writes nothing', async () => {
    const { db } = await setup();
    await expect(saveRoutine(db, 'push', [], { now })).rejects.toBeInstanceOf(InvalidRoutineError);
    const items = pushItems();
    const first = items[0];
    if (!first) throw new Error('empty routine');
    items[0] = {
      ...first,
      scheme: { blocks: [{ kind: 'straight', reps: '10-6', count: 1 }], rir: '' },
    };
    const error = await saveRoutine(db, 'push', items, { now }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidRoutineError);
    expect((error as InvalidRoutineError).issues).toEqual([
      { code: 'reps-invalid', exerciseId: first.exerciseId, row: 0 },
    ]);
    expect((await db.routines.get('push'))?.updatedAt).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });

  it('rejects an unknown routine and an unknown exercise', async () => {
    const { db } = await setup();
    await expect(saveRoutine(db, 'nope', pushItems(), { now })).rejects.toBeInstanceOf(
      RoutineNotFoundError,
    );
    const items = pushItems();
    const first = items[0];
    if (!first) throw new Error('empty routine');
    items[0] = { ...first, exerciseId: 'ghost' };
    await expect(saveRoutine(db, 'push', items, { now })).rejects.toBeInstanceOf(
      ExerciseNotFoundError,
    );
  });

  it('does not touch the sessions that were already started', async () => {
    const { db, repos } = await setup();
    const copy = pushItems();
    await repos.session.put(
      makeSession({
        id: 'ses_old',
        date: '2026-11-02',
        routineId: 'push',
        startedAt: NOW,
        items: copy,
      }),
    );
    await saveRoutine(db, 'push', removeExerciseItem(pushItems(), 'aperturas-maquina') ?? [], {
      now,
    });
    const session = await repos.session.get('ses_old');
    expect(session?.items).toHaveLength(7);
  });
});

describe('restoreSeedRoutine', () => {
  it('puts the original back with the current time so it syncs and the seed leaves it alone', async () => {
    const { db } = await setup();
    await saveRoutine(db, 'push', removeExerciseItem(pushItems(), 'aperturas-maquina') ?? [], {
      now: () => NOW,
    });
    await db.pending.clear();

    const restoredAt = NOW + 60_000;
    const restored: Routine = await restoreSeedRoutine(db, 'push', { now: () => restoredAt });

    expect(restored.updatedAt).toBe(restoredAt);
    expect(restored.items).toEqual(seedPush.items);
    expect(differsFromSeed(restored)).toBe(false);
    expect(await db.pending.get('push')).toMatchObject({ type: 'routine', updatedAt: restoredAt });

    // The start-up seed only refreshes records whose updatedAt is still 0.
    expect(await ensureSeed(db)).toBe(0);
    expect((await db.routines.get('push'))?.updatedAt).toBe(restoredAt);
  });

  it('writes nothing when the routine already is the original', async () => {
    const { db } = await setup();
    const same = await restoreSeedRoutine(db, 'pull', { now });
    expect(same.updatedAt).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });

  it('brings back a routine that was deleted', async () => {
    const { db, repos } = await setup();
    await repos.routine.remove('push');
    const restored = await restoreSeedRoutine(db, 'push', { now });
    expect(restored.items).toEqual(seedPush.items);
    expect(await repos.routine.get('push')).toBeDefined();
  });

  it('refuses a routine without an original', async () => {
    const { db } = await setup();
    await expect(restoreSeedRoutine(db, 'mine', { now })).rejects.toBeInstanceOf(
      RoutineNotRestorableError,
    );
  });
});
