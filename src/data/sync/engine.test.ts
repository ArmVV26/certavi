import { describe, expect, it, vi } from 'vitest';
import { makeSession } from '../../domain/testing/builders';
import { openTestDatabase } from '../../test/render';
import { createRepositories } from '../repository';
import { readAttempts } from './attemptLog';
import { backoffMs, createSyncEngine, SYNC_DEBOUNCE_MS } from './engine';
import { readSince } from './queue';
import { memoryKeyStore } from './syncKey';
import { createFakeServer, createTestEngine, TEST_KEY } from './testing';
import { SyncError } from './transport';

const OTHER_KEY = 'other-sync-key-0123456789-abcdefghij';

function setup(options: Parameters<typeof createTestEngine>[1] = {}) {
  const db = openTestDatabase();
  const repos = createRepositories(db);
  const online = { value: true };
  const test = createTestEngine(db, { isOnline: () => online.value, ...options });
  return { db, repos, online, ...test };
}

const sessions = (count: number, prefix = 's') =>
  Array.from({ length: count }, (_, i) =>
    makeSession({ id: `${prefix}${String(i).padStart(4, '0')}`, date: '2026-11-02' }),
  );

describe('backoff', () => {
  it('waits 4, 8, 15, 30 and 60 s, then 60 s', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(backoffMs)).toEqual([
      4000, 8000, 15000, 30000, 60000, 60000, 60000,
    ]);
  });
});

describe('sync engine', () => {
  it('does nothing without a key', async () => {
    const { engine, server, repos } = setup({ key: null });
    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));

    engine.start();
    expect(await engine.syncNow()).toMatchObject({ status: 'disabled', hasKey: false });
    expect(server.requests).toHaveLength(0);
    engine.flush();
    engine.wentOffline();
    expect(engine.getState().status).toBe('disabled');
    await expect(engine.listBackups()).rejects.toMatchObject({ code: 'client-error' });
    engine.stop();
  });

  it('pushes pending records, pulls the rest and logs the attempt', async () => {
    const { engine, server, repos, db } = setup({ now: () => 5000 });
    await repos.session.putMany(sessions(2));
    server.push([makeSession({ id: 'remote', date: '2026-11-03', updatedAt: 3000 })]);

    const state = await engine.syncNow();

    expect(state).toMatchObject({ status: 'idle', error: null, lastSuccessAt: 5000 });
    expect(await db.pending.count()).toBe(0);
    expect(await db.sessions.get('remote')).toMatchObject({ date: '2026-11-03' });
    expect(
      server
        .records()
        .map((r) => r.id)
        .sort(),
    ).toEqual(['remote', 's0000', 's0001']);
    expect(await readSince(db)).toBe(3);
    expect(await readAttempts(db)).toEqual([
      expect.objectContaining({ ok: true, sent: 2, received: 3, trigger: 'manual' }),
    ]);
  });

  it('always sends at least one request, to pull', async () => {
    const { engine, server } = setup();
    await engine.syncNow();
    expect(server.requests).toEqual([{ request: { since: 0, records: [] }, keepalive: false }]);
  });

  it('sends batches of 300 until the queue is empty, in one attempt', async () => {
    const { engine, server, repos, db } = setup();
    await repos.session.putMany(sessions(650));

    await engine.syncNow();

    expect(server.requests.map((r) => r.request.records.length)).toEqual([300, 300, 50]);
    expect(server.requests.map((r) => r.request.since)).toEqual([0, 300, 600]);
    expect(await db.pending.count()).toBe(0);
    expect(await readAttempts(db)).toHaveLength(1);
  });

  it('halves the batch when the server says it is too large', async () => {
    const { engine, server, repos, db } = setup();
    await repos.session.putMany(sessions(4));
    server.failNext('payload-too-large', 2);

    await engine.syncNow();

    expect(server.requests.map((r) => r.request.records.length)).toEqual([4, 2, 1, 1, 1, 1]);
    expect(await db.pending.count()).toBe(0);
  });

  it('gives up when even one record is too large', async () => {
    const { engine, server, repos, timers } = setup();
    await repos.session.putMany(sessions(1));
    server.failNext('payload-too-large', 1);

    expect(await engine.syncNow()).toMatchObject({ status: 'error', error: 'payload-too-large' });
    expect(timers.delays()).toEqual([]); // a bug: no automatic retry
  });

  it('starts by watching the queue and syncing once', async () => {
    const { engine, server, repos, db } = setup();
    await repos.session.putMany(sessions(3));

    engine.start();
    engine.start(); // idempotent

    await vi.waitFor(() => {
      expect(engine.getState()).toMatchObject({ status: 'idle', pending: 0 });
    });
    expect(server.requests).toHaveLength(1);
    expect(await db.pending.count()).toBe(0);
    engine.stop();
  });

  it('shows the last successful sync of earlier runs', async () => {
    const first = setup({ now: () => 1234 });
    await first.engine.syncNow();

    const again = createTestEngine(first.db, { key: null });
    again.engine.start();
    await vi.waitFor(() => {
      expect(again.engine.getState().lastSuccessAt).toBe(1234);
    });
    again.engine.stop();
  });

  it('syncs a couple of seconds after a local change', async () => {
    const { engine, server, repos, timers } = setup();
    engine.start();
    await vi.waitFor(() => {
      expect(server.requests).toHaveLength(1);
      expect(engine.getState().status).toBe('idle');
    });

    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    await vi.waitFor(() => {
      expect(engine.getState().pending).toBe(1);
    });
    expect(timers.delays()).toEqual([SYNC_DEBOUNCE_MS]);
    timers.fire();

    await vi.waitFor(() => {
      expect(engine.getState().pending).toBe(0);
    });
    expect(server.requests).toHaveLength(2);
    engine.stop();
  });

  it('syncs again right after an attempt when a record changed during it', async () => {
    const { engine, server, repos, db } = setup();
    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    engine.start();
    const gate = server.hold();
    engine.trigger('manual');
    await vi.waitFor(() => {
      expect(server.requests).toHaveLength(1);
    });

    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02', note: 'edited' }));
    await vi.waitFor(() => {
      expect(engine.getState().pending).toBe(1);
    });
    gate.release();

    await vi.waitFor(() => {
      expect(server.records()[0]).toMatchObject({ id: 'a', note: 'edited' });
    });
    await vi.waitFor(async () => {
      expect(await db.pending.count()).toBe(0);
    });
    engine.stop();
  });

  it('checks again every 45 s while something is still pending', async () => {
    const { engine, server, repos, timers } = setup();
    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
    const gate = server.hold();
    const done = engine.syncNow();
    await vi.waitFor(() => {
      expect(server.requests).toHaveLength(1);
    });
    // Edited during the request, and nothing watches the queue (engine not started).
    await repos.session.put(makeSession({ id: 'a', date: '2026-11-02', note: 'edited' }));
    gate.release();
    await done;

    expect(timers.delays()).toEqual([45_000]);
    timers.fire();
    await vi.waitFor(() => {
      expect(server.records()[0]).toMatchObject({ note: 'edited' });
    });
  });

  describe('failures', () => {
    it('retries with backoff, and coming back to the app retries at once', async () => {
      const { engine, server, repos, timers, db } = setup();
      await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
      server.failNext('internal-error', 3);

      expect(await engine.syncNow()).toMatchObject({ status: 'error', error: 'internal-error' });
      expect(timers.delays()).toEqual([4000]);
      timers.fire();
      await vi.waitFor(() => {
        expect(timers.delays()).toEqual([8000]);
      });
      expect(await db.pending.count()).toBe(1);

      engine.trigger('visible');
      await vi.waitFor(() => {
        expect(timers.delays()).toEqual([4000]); // backoff was reset, and this one failed too
      });
      timers.fire();
      await vi.waitFor(() => {
        expect(engine.getState()).toMatchObject({ status: 'idle', error: null });
      });
      expect(await db.pending.count()).toBe(0);
      const attempts = await readAttempts(db);
      expect(attempts.map((a) => a.ok)).toEqual([true, false, false, false]);
      expect(attempts[1]).toMatchObject({ error: 'internal-error', trigger: 'visible' });
    });

    it('does not cut a backoff short when the queue grows', async () => {
      const { engine, server, repos, timers } = setup();
      engine.start();
      await vi.waitFor(() => {
        expect(engine.getState().status).toBe('idle');
      });
      server.failNext('conflict');
      await engine.syncNow();
      expect(timers.delays()).toEqual([4000]);

      await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
      await vi.waitFor(() => {
        expect(engine.getState().pending).toBe(1);
      });
      expect(timers.delays()).toEqual([4000]);
      engine.stop();
    });

    it('stops after a wrong key until the user acts', async () => {
      const { engine, server, repos, timers, db } = setup();
      await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
      server.failNext('unauthorized');

      expect(await engine.syncNow()).toMatchObject({ status: 'error', error: 'unauthorized' });
      expect(timers.delays()).toEqual([]);
      for (const reason of ['online', 'visible', 'interval', 'retry', 'write'] as const) {
        engine.trigger(reason);
      }
      engine.flush();
      expect(server.requests).toHaveLength(1);
      expect(await db.pending.count()).toBe(1);

      expect(await engine.syncNow()).toMatchObject({ status: 'idle' });
      expect(await db.pending.count()).toBe(0);
    });

    it('does not retry a malformed request on a timer', async () => {
      const { engine, server, timers } = setup();
      server.failNext('invalid-request');

      expect(await engine.syncNow()).toMatchObject({ status: 'error' });
      expect(timers.delays()).toEqual([]);
      engine.trigger('online');
      await vi.waitFor(() => {
        expect(engine.getState().status).toBe('idle');
      });
    });

    it('treats unexpected errors as client errors', async () => {
      const { engine, server } = setup();
      vi.spyOn(server.transport, 'sync').mockRejectedValueOnce(new Error('boom'));
      expect(await engine.syncNow()).toMatchObject({ status: 'error', error: 'client-error' });
    });

    it('keeps syncing if the attempt log cannot be written', async () => {
      const { engine, db } = setup();
      vi.spyOn(db.syncLog, 'add').mockRejectedValue(new Error('quota'));
      expect(await engine.syncNow()).toMatchObject({ status: 'idle' });
    });
  });

  describe('offline', () => {
    it('makes no request while offline and syncs when the network comes back', async () => {
      const { engine, server, repos, online, db } = setup();
      await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
      online.value = false;

      expect(await engine.syncNow()).toMatchObject({ status: 'offline' });
      engine.flush();
      expect(server.requests).toHaveLength(0);

      online.value = true;
      engine.trigger('online');
      await vi.waitFor(() => {
        expect(engine.getState().status).toBe('idle');
      });
      expect(await db.pending.count()).toBe(0);
    });

    it('shows offline when the network drops, without a retry timer', async () => {
      const { engine, server, online, timers } = setup();
      server.failNext('conflict');
      await engine.syncNow();
      expect(timers.delays()).toEqual([4000]);

      online.value = false;
      engine.wentOffline();
      expect(engine.getState().status).toBe('offline');
      expect(timers.delays()).toEqual([]);
    });

    it('treats a network failure without network as offline', async () => {
      const { engine, server, online, timers } = setup();
      vi.spyOn(server.transport, 'sync').mockImplementationOnce(() => {
        online.value = false; // the connection dropped during the request
        return Promise.reject(new SyncError('network'));
      });

      expect(await engine.syncNow()).toMatchObject({ status: 'offline', error: 'network' });
      expect(timers.delays()).toEqual([]);
    });
  });

  describe('exit flush', () => {
    it('sends what fits with keepalive and commits the answer', async () => {
      const { engine, server, repos, db } = setup();
      await repos.session.putMany(sessions(2));

      engine.flush();
      await vi.waitFor(async () => {
        expect(await db.pending.count()).toBe(0);
      });
      expect(server.requests).toEqual([expect.objectContaining({ keepalive: true }) as unknown]);
      expect((await readAttempts(db))[0]).toMatchObject({ ok: true, trigger: 'exit', sent: 2 });
    });

    it('sends nothing when nothing is pending, or while another attempt runs', async () => {
      const { engine, server, repos } = setup();
      engine.flush();
      await engine.syncNow();
      expect(server.requests.filter((r) => r.keepalive)).toHaveLength(0);

      await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
      const gate = server.hold();
      const done = engine.syncNow();
      engine.flush();
      gate.release();
      await done;
      expect(server.requests.filter((r) => r.keepalive)).toHaveLength(0);
    });

    it('leaves the queue intact when it fails, without a retry timer', async () => {
      const { engine, server, repos, timers, db } = setup();
      await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
      server.failNext('network');

      engine.flush();
      await vi.waitFor(async () => {
        expect((await readAttempts(db))[0]).toMatchObject({ ok: false, trigger: 'exit' });
      });
      expect(await db.pending.count()).toBe(1);
      expect(timers.delays()).toEqual([]);
    });
  });

  describe('key', () => {
    it('rejects keys that are too short and saves valid ones trimmed', async () => {
      const { engine, keyStore, server } = setup({ key: null });
      expect(await engine.setKey('short')).toBe('invalid');
      expect(await engine.setKey(`  ${TEST_KEY}  `)).toBe('saved');
      expect(keyStore.read()).toBe(TEST_KEY);
      await vi.waitFor(() => {
        expect(engine.getState()).toMatchObject({ status: 'idle', hasKey: true });
      });
      expect(server.requests).toHaveLength(1);
    });

    it('re-sends everything written on this device with a new key', async () => {
      const { engine, server, repos, db } = setup();
      await repos.session.putMany(sessions(3));
      await engine.syncNow();
      expect(await readSince(db)).toBe(3);

      expect(await engine.setKey(OTHER_KEY)).toBe('saved');
      await vi.waitFor(() => {
        expect(server.requests).toHaveLength(2);
      });
      await vi.waitFor(() => {
        expect(engine.getState().status).toBe('idle');
      });
      expect(server.requests[1]?.request).toMatchObject({ since: 0 });
      expect(server.requests[1]?.request.records).toHaveLength(3);
    });

    it('does nothing new when the same key is saved again', async () => {
      const { engine, server, db } = setup();
      await engine.syncNow();
      expect(await engine.setKey(TEST_KEY)).toBe('unchanged');
      await vi.waitFor(() => {
        expect(server.requests).toHaveLength(2);
      });
      expect(await db.pending.count()).toBe(0);
    });

    it('reports a key that cannot be stored', async () => {
      const { engine, keyStore } = setup({ key: null });
      vi.spyOn(keyStore, 'write').mockReturnValue(false);
      expect(await engine.setKey(TEST_KEY)).toBe('storage-error');
      expect(engine.getState().hasKey).toBe(false);
    });

    it('drops an answer that arrives after the key was forgotten', async () => {
      const { engine, server, repos, db, keyStore } = setup();
      await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
      const gate = server.hold();
      const done = engine.syncNow();
      await vi.waitFor(() => {
        expect(server.requests).toHaveLength(1);
      });

      engine.forgetKey();
      gate.release();
      await done;

      expect(keyStore.read()).toBeNull();
      expect(engine.getState()).toMatchObject({ status: 'disabled', hasKey: false });
      expect(await db.pending.count()).toBe(1);
      expect(await readSince(db)).toBe(0);
    });

    it('drops a stale answer when the key changes during a request', async () => {
      const { engine, server, repos, db } = setup();
      await repos.session.put(makeSession({ id: 'a', date: '2026-11-02' }));
      const gate = server.hold();
      void engine.syncNow();
      await vi.waitFor(() => {
        expect(server.requests).toHaveLength(1);
      });

      const saving = engine.setKey(OTHER_KEY);
      gate.release();
      expect(await saving).toBe('saved');
      await vi.waitFor(async () => {
        expect(await db.pending.count()).toBe(0);
      });
      expect(server.requests.at(-1)?.request.since).toBe(0);
    });

    it('drops a failure that arrives after the key was forgotten', async () => {
      const { engine, server, timers } = setup();
      server.failNext('internal-error');
      const gate = server.hold();
      const done = engine.syncNow();
      await vi.waitFor(() => {
        expect(server.requests).toHaveLength(1);
      });
      engine.forgetKey();
      gate.release();
      await done;
      expect(engine.getState()).toMatchObject({ status: 'disabled', error: null });
      expect(timers.delays()).toEqual([]);
    });
  });

  describe('backups', () => {
    it('lists, downloads and restores server backups', async () => {
      const { engine, server, repos, db } = setup();
      await repos.session.put(makeSession({ id: 'later', date: '2026-11-05' }));
      server.backups.set('2026-11-02', {
        date: '2026-11-02',
        records: [{ ...makeSession({ id: 'old', date: '2026-11-01' }), serverSeq: 1 }],
      });

      expect(await engine.listBackups()).toEqual({
        backups: [{ date: '2026-11-02', count: 1, createdAt: null }],
      });
      expect((await engine.getBackup('2026-11-02')).records).toHaveLength(1);
      await expect(engine.getBackup('2026-11-09')).rejects.toMatchObject({ code: 'not-found' });

      expect(await engine.restore('2026-11-02')).toBe(2);
      expect(await db.sessions.get('later')).toMatchObject({ deleted: true });
      await vi.waitFor(async () => {
        expect(await db.pending.count()).toBe(0);
      });
      expect(
        server
          .records()
          .map((r) => r.id)
          .sort(),
      ).toEqual(['later', 'old']);
    });
  });

  it('uses real timers and assumes a network by default', async () => {
    const db = openTestDatabase();
    const server = createFakeServer();
    const engine = createSyncEngine({
      db,
      keyStore: memoryKeyStore(TEST_KEY),
      createTransport: () => server.transport,
    });
    const setTimer = vi.spyOn(globalThis, 'setTimeout');
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout');
    server.failNext('conflict');

    expect(await engine.syncNow()).toMatchObject({ status: 'error' });
    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 4000);
    engine.stop();
    expect(clearTimer).toHaveBeenCalled();
  });

  it('notifies subscribers of every state change until they unsubscribe', async () => {
    const { engine } = setup();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);
    await engine.syncNow();
    const calls = listener.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(2); // syncing, then idle
    unsubscribe();
    await engine.syncNow();
    expect(listener).toHaveBeenCalledTimes(calls);
  });
});
