import { describe, expect, it, vi } from 'vitest';
import sample from '../../tests/fixtures/gym-app-sample.json?raw';
import { makeSession } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import { reserveTimestamps } from './clock';
import { applyImport, planImport } from './importRecords';
import { readGymAppExport } from './legacy/gymApp';
import { countLiveRecords, countPending } from './queries';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';

function sampleRecords() {
  const result = readGymAppExport(sample);
  if (!result.ok) throw new Error('sample did not read');
  return result.records;
}

async function seededDb() {
  const db = openTestDatabase();
  await ensureSeed(db);
  return db;
}

describe('planImport', () => {
  it('previews what would be written without writing anything', async () => {
    const db = await seededDb();

    const plan = await planImport(db, sampleRecords());

    expect(plan.toWrite).toHaveLength(29);
    expect(plan.unchanged).toBe(0);
    expect(plan.byType).toEqual({
      session: 3,
      set: 11,
      note: 2,
      activity: 2,
      bodyWeight: 2,
      weekPlan: 2,
      routine: 1,
      exercise: 2,
      block: 1,
      blockLog: 2,
      weeklyMetric: 1,
    });
    expect(await db.sessions.count()).toBe(0);
    expect(await countPending(db)).toBe(0);
  });
});

describe('applyImport', () => {
  it('saves the gym_app sample: the counts add up and everything is queued', async () => {
    const db = await seededDb();

    const result = await applyImport(db, sampleRecords());

    expect(result.toWrite).toHaveLength(29);
    expect(await countLiveRecords(db)).toEqual({
      exercise: 45,
      routine: 6,
      session: 3,
      set: 11,
      note: 2,
      activity: 2,
      bodyWeight: 2,
      weekPlan: 2,
      block: 2,
      blockLog: 2,
      weeklyMetric: 1,
      settings: 1,
    });
    expect(await countPending(db)).toBe(29);
    expect(await db.exercises.get('remo-t')).toMatchObject({ increment: 5 });
  });

  it('does nothing the second time', async () => {
    const db = await seededDb();
    await applyImport(db, sampleRecords());

    const again = await applyImport(db, sampleRecords());

    expect(again.toWrite).toHaveLength(0);
    expect(again.unchanged).toBe(29);
    expect(await db.sets.count()).toBe(11);
  });

  it('never replaces a record edited later on this device; ties keep the local copy', async () => {
    const db = await seededDb();
    const repos = createRepositories(db, { now: () => 1_900_000_000_000 });
    await repos.session.put(
      makeSession({ id: 'ses_mg8x1k2a3b4c5d6e7f', date: '2026-10-19', note: 'editada aquí' }),
    );
    const imported = makeSession({ id: 'tie', date: '2026-10-20', note: 'importada' });
    await db.sessions.put({ ...imported, note: 'local', updatedAt: 50 });

    const result = await applyImport(db, [...sampleRecords(), { ...imported, updatedAt: 50 }]);

    expect(result.unchanged).toBe(2);
    expect((await db.sessions.get('ses_mg8x1k2a3b4c5d6e7f'))?.updatedAt).toBe(1_900_000_000_000);
    expect(await db.sessions.get('tie')).toMatchObject({ note: 'local' });
  });

  it('drops the server sequence of imported records', async () => {
    const db = await seededDb();
    await applyImport(db, [{ ...makeSession({ id: 's', date: '2026-10-20' }), serverSeq: 7 }]);
    expect(await db.sessions.get('s')).not.toHaveProperty('serverSeq');
  });

  it('moves the clock past imported records, so the next local edit is newer', async () => {
    const db = await seededDb();
    await applyImport(db, [{ ...makeSession({ id: 's', date: '2026-10-20' }), updatedAt: 5000 }]);

    const next = await db.transaction('rw', db.meta, () => reserveTimestamps(db, 1, 10));

    expect(next).toBe(5001);
  });

  it('saves nothing if any write fails', async () => {
    const db = await seededDb();
    vi.spyOn(db.pending, 'bulkPut').mockImplementation(() => {
      throw new Error('disk full');
    });

    await expect(applyImport(db, sampleRecords())).rejects.toThrow('disk full');

    expect(await db.sessions.count()).toBe(0);
    expect((await db.exercises.get('remo-t'))?.updatedAt).toBe(0);
  });

  it('handles an empty import', async () => {
    const db = await seededDb();
    expect(await applyImport(db, [])).toEqual({ toWrite: [], byType: {}, unchanged: 0 });
  });
});
