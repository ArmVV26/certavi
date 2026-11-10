import { describe, expect, it } from 'vitest';
import sample from '../../tests/fixtures/gym-app-sample.json?raw';
import { makeSession, makeSet } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import { exportAll, exportSession, exportWeek, readBackup } from './backup';
import { setExerciseSetup } from './exercises';
import { applyImport } from './importRecords';
import { readGymAppExport } from './legacy/gymApp';
import { countLiveRecords } from './queries';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';

const NOW = new Date('2026-11-03T10:00:00');

async function importedDb() {
  const db = openTestDatabase();
  await ensureSeed(db);
  const legacy = readGymAppExport(sample);
  if (!legacy.ok) throw new Error('sample did not read');
  await applyImport(db, legacy.records);
  return db;
}

function read(content: string) {
  const result = readBackup(content);
  if (!result.ok) throw new Error('backup did not read');
  return result;
}

describe('full backup', () => {
  it('round-trips: importing it on a new device gives the same counts', async () => {
    const db = await importedDb();
    const file = await exportAll(db, NOW);

    expect(file.fileName).toBe('certavi-backup-2026-11-03.json');
    expect(file.mimeType).toBe('application/json');
    const other = openTestDatabase();
    await ensureSeed(other);
    const result = await applyImport(other, read(file.content).records);

    expect(await countLiveRecords(other)).toEqual(await countLiveRecords(db));
    expect(result.toWrite).toHaveLength(29); // seed records are already there, unchanged
  });

  it('carries the machine settings of an exercise to a new device', async () => {
    const db = openTestDatabase();
    await ensureSeed(db);
    const setup = [{ label: 'Respaldo', value: '3' }];
    await setExerciseSetup(db, 'remo-t', setup);
    const file = await exportAll(db, NOW);

    const other = openTestDatabase();
    await ensureSeed(other);
    await applyImport(other, read(file.content).records);
    expect((await createRepositories(other).exercise.get('remo-t'))?.setup).toEqual(setup);
  });

  it('describes itself and leaves out deleted records and server sequences', async () => {
    const db = openTestDatabase();
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 'keep', date: '2026-11-02' }));
    await repos.session.put(makeSession({ id: 'gone', date: '2026-11-02' }));
    await repos.session.remove('gone');
    const synced = await db.sessions.get('keep');
    if (!synced) throw new Error('missing session');
    await db.sessions.put({ ...synced, serverSeq: 3 });

    const file = JSON.parse((await exportAll(db, NOW)).content) as Record<string, unknown>;

    expect(file).toMatchObject({ app: 'certavi', format: 1, kind: 'full' });
    expect(file.exportedAt).toBe(NOW.toISOString());
    expect(file.records).toEqual([expect.objectContaining({ id: 'keep' })]);
    expect((file.records as object[])[0]).not.toHaveProperty('serverSeq');
  });
});

describe('session and week backups', () => {
  it('exports one session with its sets and notes', async () => {
    const db = await importedDb();

    const file = await exportSession(db, 'ses_mg8x1k2a3b4c5d6e7f', NOW);

    expect(file?.fileName).toBe('certavi-session-2026-10-19-ses_mg8x1k2a3b4c5d6e7f.json');
    const types = read(file?.content ?? '').records.map((r) => r.type);
    expect(types.filter((t) => t === 'session')).toHaveLength(1);
    expect(types.filter((t) => t === 'set')).toHaveLength(7);
    expect(types.filter((t) => t === 'note')).toHaveLength(2);
    expect(await exportSession(db, 'nope', NOW)).toBeNull();
  });

  it('skips deleted sets and a deleted session', async () => {
    const db = openTestDatabase();
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 's', date: '2026-11-02' }));
    const [kept, removed] = await repos.set.putMany([
      makeSet({ sessionId: 's', exerciseId: 'remo-t', slot: 0 }),
      makeSet({ sessionId: 's', exerciseId: 'remo-t', slot: 1 }),
    ]);
    await repos.set.remove(removed?.id ?? '');

    const file = await exportSession(db, 's', NOW);
    expect(read(file?.content ?? '').records.map((r) => r.id)).toEqual(['s', kept?.id]);

    await repos.session.remove('s');
    expect(await exportSession(db, 's', NOW)).toBeNull();
  });

  it('exports one week: plan, weight, sessions with details, activities and rehab', async () => {
    const db = await importedDb();

    const file = await exportWeek(db, '2026-10-19', NOW);

    expect(file.fileName).toBe('certavi-week-2026-10-19.json');
    const counts: Record<string, number> = {};
    for (const r of read(file.content).records) counts[r.type] = (counts[r.type] ?? 0) + 1;
    expect(counts).toEqual({
      weekPlan: 1,
      bodyWeight: 1,
      session: 2,
      set: 10,
      note: 2,
      activity: 2,
      blockLog: 2,
      weeklyMetric: 1,
    });
  });

  it('exports an empty week as an empty list', async () => {
    const file = await exportWeek(openTestDatabase(), '2026-11-02', NOW);
    expect(read(file.content).records).toEqual([]);
  });
});

describe('readBackup', () => {
  const backup = (records: unknown[]) => JSON.stringify({ app: 'certavi', format: 1, records });

  it('rejects files that are not a Certavi backup', () => {
    expect(readBackup('nope').ok).toBe(false);
    expect(readBackup(sample).ok).toBe(false);
    expect(readBackup('{"app":"certavi","format":2,"records":[]}').ok).toBe(false);
  });

  it('ignores deleted records, reports invalid ones and keeps the newest per id', () => {
    const session = makeSession({ id: 's', date: '2026-11-02' });
    const result = readBackup(
      backup([
        { ...session, updatedAt: 3 },
        { ...session, updatedAt: 8, note: 'newer' },
        { id: 'gone', type: 'session', updatedAt: 4, deleted: true },
        { ...session, id: 'bad', date: 'yesterday' },
        { id: 'x', type: 'mystery', updatedAt: 1 },
      ]),
    );
    expect(result).toEqual({
      ok: true,
      records: [{ ...session, updatedAt: 8, note: 'newer' }],
      ignored: 1,
      invalid: 2,
    });
  });
});
