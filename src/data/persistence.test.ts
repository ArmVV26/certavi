import { describe, expect, it, vi } from 'vitest';
import { makeSession } from '../domain/testing/builders';
import { openTestDatabase } from '../test/render';
import { getStorageStatus, requestPersistentStorage } from './persistence';
import { countLiveRecords, countPending } from './queries';
import { createRepositories } from './repository';
import { startDatabase } from './startup';

const storage = (persisted: boolean | Error, persist: boolean | Error = false) => ({
  persisted: vi.fn(() =>
    persisted instanceof Error ? Promise.reject(persisted) : Promise.resolve(persisted),
  ),
  persist: vi.fn(() =>
    persist instanceof Error ? Promise.reject(persist) : Promise.resolve(persist),
  ),
});

describe('persistent storage', () => {
  it('reports the current status without asking', async () => {
    expect(await getStorageStatus(storage(true))).toBe('persisted');
    expect(await getStorageStatus(storage(false))).toBe('not-persisted');
    expect(await getStorageStatus(storage(new Error('nope')))).toBe('unsupported');
    expect(await getStorageStatus(undefined)).toBe('unsupported');
    expect(await getStorageStatus({})).toBe('unsupported');
  });

  it('asks only when not granted yet', async () => {
    const granted = storage(true);
    expect(await requestPersistentStorage(granted)).toBe('persisted');
    expect(granted.persist).not.toHaveBeenCalled();

    const accepts = storage(false, true);
    expect(await requestPersistentStorage(accepts)).toBe('persisted');
    expect(accepts.persist).toHaveBeenCalledOnce();

    expect(await requestPersistentStorage(storage(false, false))).toBe('not-persisted');
    expect(await requestPersistentStorage(storage(false, new Error('no')))).toBe('not-persisted');
    expect(await requestPersistentStorage({ persisted: () => Promise.resolve(false) })).toBe(
      'not-persisted',
    );
    expect(await requestPersistentStorage(undefined)).toBe('unsupported');
  });
});

describe('startDatabase', () => {
  it('writes the seed and asks for persistent storage', async () => {
    const db = openTestDatabase();
    const browser = storage(false, true);

    expect(await startDatabase(db, browser)).toBe('persisted');
    expect(await db.exercises.count()).toBe(45);
    expect(browser.persist).toHaveBeenCalledOnce();
  });
});

describe('counts', () => {
  it('counts live records per type and the pending queue', async () => {
    const db = openTestDatabase();
    await startDatabase(db, undefined);
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 's1', date: '2026-11-03' }));
    await repos.session.put(makeSession({ id: 's2', date: '2026-11-04' }));
    await repos.session.remove('s2');

    const counts = await countLiveRecords(db);

    expect(counts).toMatchObject({ exercise: 45, routine: 6, block: 2, settings: 1, session: 1 });
    expect(counts.set).toBe(0);
    expect(await countPending(db)).toBe(2);
  });
});
