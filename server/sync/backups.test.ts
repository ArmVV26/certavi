import { describe, expect, it } from 'vitest';
import { backupFileSchema, backupListSchema } from '../../src/domain/sync/contract';
import { emptyDocument, mergeRecords } from '../../src/domain/sync/merge';
import { ensureDailyBackup, listBackups, madridDate, pruneBackups } from './backups';
import { createMemoryStore } from './memoryStore';
import { bodyOf, DAY, NOV_3, rec, request, setupServer, syncRequest } from './testing';

describe('madridDate', () => {
  it('uses the calendar day in Madrid, not in UTC', () => {
    expect(madridDate(Date.UTC(2026, 10, 2, 22, 59))).toBe('2026-11-02'); // 23:59 CET
    expect(madridDate(Date.UTC(2026, 10, 2, 23, 0))).toBe('2026-11-03'); // 00:00 CET
  });

  it('follows summer time (UTC+2) and its changes', () => {
    expect(madridDate(Date.UTC(2026, 6, 14, 21, 59))).toBe('2026-07-14'); // 23:59 CEST
    expect(madridDate(Date.UTC(2026, 6, 14, 22, 0))).toBe('2026-07-15'); // 00:00 CEST
    expect(madridDate(Date.UTC(2026, 2, 28, 23, 30))).toBe('2026-03-29'); // spring forward
    expect(madridDate(Date.UTC(2026, 9, 24, 22, 30))).toBe('2026-10-25'); // fall back
  });
});

describe('daily backups through the sync endpoint', () => {
  it('backs up the data as it was before the first write of the day', async () => {
    const { handle, clock } = setupServer();
    await handle(syncRequest({ since: 0, records: [rec('a', 1)] })); // nothing stored yet → no backup
    let list = backupListSchema.parse(await bodyOf(await handle(request('/api/v1/backups'))));
    expect(list.backups).toEqual([]);

    clock.now = NOV_3 + DAY;
    await handle(syncRequest({ since: 1, records: [rec('b', 1)] })); // first write of Nov 4
    await handle(syncRequest({ since: 2, records: [rec('c', 1)] })); // same day → no new backup
    list = backupListSchema.parse(await bodyOf(await handle(request('/api/v1/backups'))));
    expect(list.backups).toEqual([{ date: '2026-11-04', count: 1, createdAt: NOV_3 + DAY }]);

    const file = backupFileSchema.parse(
      await bodyOf(await handle(request('/api/v1/backups/2026-11-04'))),
    );
    expect(file).toEqual({ date: '2026-11-04', records: [{ ...rec('a', 1), serverSeq: 1 }] });
  });

  it('does not back up on a request that changes nothing', async () => {
    const { handle, clock, memory } = setupServer();
    await handle(syncRequest({ since: 0, records: [rec('a', 1)] }));
    clock.now = NOV_3 + DAY;
    await handle(syncRequest({ since: 0, records: [rec('a', 1)] }));
    expect(await memory.listKeys('backup/')).toEqual([]);
  });

  it('keeps the 14 newest backups, newest first', async () => {
    const { handle, clock } = setupServer();
    await handle(syncRequest({ since: 0, records: [rec('seed', 1)] }));
    for (let day = 1; day <= 16; day++) {
      clock.now = NOV_3 + day * DAY;
      await handle(syncRequest({ since: 0, records: [rec(`r${String(day)}`, 1)] }));
    }
    const list = backupListSchema.parse(await bodyOf(await handle(request('/api/v1/backups'))));
    expect(list.backups).toHaveLength(14);
    expect(list.backups[0]?.date).toBe('2026-11-19');
    expect(list.backups.at(-1)?.date).toBe('2026-11-06');
  });

  it('logs a backup failure and still saves the sync', async () => {
    const { handle, clock, log } = setupServer({
      wrapStore: (store) => ({
        ...store,
        readMetadata: () => Promise.reject(new Error('metadata down')),
      }),
    });
    await handle(syncRequest({ since: 0, records: [rec('a', 1)] }));
    clock.now = NOV_3 + DAY;
    const response = await handle(syncRequest({ since: 1, records: [rec('b', 1)] }));
    expect(response.status).toBe(200);
    expect(log).toHaveBeenCalledWith('sync: daily backup failed', expect.any(Error));
  });
});

describe('GET /api/v1/backups/{date}', () => {
  it.each(['2026-13-01', '2026-02-30', 'yesterday', '2026-1-1'])(
    'answers 400 invalid-date for %s',
    async (date) => {
      const { handle } = setupServer();
      const response = await handle(request(`/api/v1/backups/${date}`));
      expect(response.status).toBe(400);
      expect(await bodyOf(response)).toEqual({ error: 'invalid-date' });
    },
  );

  it('answers 404 not-found for a day without a backup', async () => {
    const { handle } = setupServer();
    const response = await handle(request('/api/v1/backups/2026-11-01'));
    expect(response.status).toBe(404);
    expect(await bodyOf(response)).toEqual({ error: 'not-found' });
  });
});

describe('backup helpers', () => {
  const document = mergeRecords(emptyDocument(), [rec('a', 1)]).document;

  it('does not create a backup that already exists', async () => {
    const store = createMemoryStore();
    expect(await ensureDailyBackup(store, document, NOV_3)).toBe(true);
    expect(await ensureDailyBackup(store, document, NOV_3 + 1000)).toBe(false);
  });

  it('skips an empty document', async () => {
    const store = createMemoryStore();
    expect(await ensureDailyBackup(store, emptyDocument(), NOV_3)).toBe(false);
    expect(store.size).toBe(0);
  });

  it('does not prune when a concurrent request created the backup first', async () => {
    let prunedLists = 0;
    const store = createMemoryStore();
    const racing = {
      ...store,
      readMetadata: () => Promise.resolve(null), // looks missing…
      write: () => Promise.resolve(false), // …but onlyIfNew loses the race
      listKeys: (prefix: string) => {
        prunedLists += 1;
        return store.listKeys(prefix);
      },
    };
    expect(await ensureDailyBackup(racing, document, NOV_3)).toBe(false);
    expect(prunedLists).toBe(0);
  });

  it('reports null count and createdAt when the metadata is missing or not numeric', async () => {
    const store = createMemoryStore();
    await store.write('backup/2026-11-01', { date: '2026-11-01', records: [] });
    await store.write(
      'backup/2026-11-02',
      { date: '2026-11-02', records: [] },
      {
        metadata: { count: 'many', createdAt: Number.POSITIVE_INFINITY },
      },
    );
    expect(await listBackups(store)).toEqual([
      { date: '2026-11-02', count: null, createdAt: null },
      { date: '2026-11-01', count: null, createdAt: null },
    ]);
  });

  it('prunes only backups, oldest first', async () => {
    const store = createMemoryStore();
    await store.write('records', {});
    for (let day = 1; day <= 16; day++) {
      await store.write(`backup/2026-11-${String(day).padStart(2, '0')}`, {});
    }
    await pruneBackups(store);
    const keys = (await store.listKeys('backup/')).sort();
    expect(keys).toHaveLength(14);
    expect(keys[0]).toBe('backup/2026-11-03');
    expect(await store.read('records')).not.toBeNull();
  });
});
