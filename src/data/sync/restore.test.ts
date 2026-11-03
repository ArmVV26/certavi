import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES, SEED_SETTINGS, type BackupFile } from '../../domain';
import { makeSession, makeSet } from '../../domain/testing/builders';
import { openTestDatabase } from '../../test/render';
import { countLiveRecords } from '../queries';
import { createRepositories } from '../repository';
import { ensureSeed } from '../seed';
import { restoreBackup } from './restore';

const backupOf = (records: object[]): BackupFile => ({
  date: '2026-11-02',
  records: records.map((r, i) => ({ serverSeq: i + 1, ...r })) as BackupFile['records'],
});

async function setup() {
  const db = openTestDatabase();
  await ensureSeed(db);
  const repos = createRepositories(db, { now: () => 1000 });
  return { db, repos };
}

const firstExercise = SEED_EXERCISES[0];
if (!firstExercise) throw new Error('no seed exercise');

describe('restoreBackup', () => {
  it('changes nothing when the device already matches the backup', async () => {
    const { db, repos } = await setup();
    const session = await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    await db.pending.clear();

    // Same content, other timestamp and key order: still the same record.
    const reordered = Object.fromEntries(Object.entries({ ...session, updatedAt: 1 }).reverse());
    const changed = await restoreBackup(db, backupOf([reordered]), 5000);

    expect(changed).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });

  it('brings back what the backup has as new edits, and deletes what it does not', async () => {
    const { db, repos } = await setup();
    await repos.session.put(makeSession({ id: 'kept', date: '2026-11-02', note: 'now' }));
    await repos.session.put(makeSession({ id: 'later', date: '2026-11-05' }));
    await db.pending.clear();
    const backup = backupOf([
      makeSession({ id: 'kept', date: '2026-11-02', note: 'then', updatedAt: 10 }),
      makeSession({ id: 'gone', date: '2026-11-01', updatedAt: 10 }),
      makeSet({ id: 'set-a', sessionId: 'gone', exerciseId: firstExercise.id, updatedAt: 10 }),
    ]);

    const changed = await restoreBackup(db, backup, 5000);

    expect(changed).toBe(4);
    expect(await db.sessions.get('kept')).toMatchObject({ note: 'then', updatedAt: 5000 });
    expect(await db.sessions.get('gone')).toMatchObject({ date: '2026-11-01' });
    expect(await db.sets.get('set-a')).toBeDefined();
    expect(await db.sessions.get('later')).toEqual({
      id: 'later',
      type: 'session',
      updatedAt: expect.any(Number) as number,
      deleted: true,
    });
    const pending = await db.pending.toArray();
    expect(pending.map((e) => e.id).sort()).toEqual(['gone', 'kept', 'later', 'set-a']);
    expect(new Set(pending.map((e) => e.updatedAt)).size).toBe(4);
  });

  it('puts built-in records back to their seed version instead of deleting them', async () => {
    const { db, repos } = await setup();
    await repos.exercise.put({ ...firstExercise, increment: 7.5 });
    await repos.settings.put({ ...SEED_SETTINGS, planStart: '2026-11-02' });
    await db.pending.clear();

    const changed = await restoreBackup(db, backupOf([]), 5000);

    expect(changed).toBe(2);
    expect(await db.exercises.get(firstExercise.id)).toEqual({
      ...firstExercise,
      updatedAt: expect.any(Number) as number,
    });
    expect(await db.settings.get('settings')).toMatchObject({ planStart: null });
    const counts = await countLiveRecords(db);
    expect(counts.exercise).toBe(SEED_EXERCISES.length);
  });

  it('keeps a deletion of a built-in record that the backup holds', async () => {
    const { db } = await setup();
    const backup = backupOf([
      { id: firstExercise.id, type: 'exercise', updatedAt: 10, deleted: true },
    ]);

    await restoreBackup(db, backup, 5000);

    expect(await db.exercises.get(firstExercise.id)).toMatchObject({ deleted: true });
  });

  it('does not write tombstones for records this device never had', async () => {
    const { db } = await setup();
    const backup = backupOf([{ id: 'ghost', type: 'session', updatedAt: 10, deleted: true }]);

    expect(await restoreBackup(db, backup, 5000)).toBe(0);
    expect(await db.sessions.get('ghost')).toBeUndefined();
  });

  it('skips records of the backup that are not valid', async () => {
    const { db } = await setup();
    const backup = backupOf([
      { id: 'bad', type: 'session', updatedAt: 10 },
      { id: 'odd', type: 'future-type', updatedAt: 10 },
    ]);

    expect(await restoreBackup(db, backup, 5000)).toBe(0);
  });
});
