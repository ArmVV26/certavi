import { describe, expect, it, vi } from 'vitest';
import { syncResponseSchema } from '../../src/domain/sync/contract';
import { createSyncHandler } from './handler';
import { createMemoryStore } from './memoryStore';
import { RECORDS_KEY, type SyncStore } from './store';
import { bodyOf, DAY, rec, request, setupServer, syncRequest, TEST_SECRET } from './testing';

describe('configuration and authentication', () => {
  it.each([
    ['missing', undefined],
    ['shorter than 32 characters', 'x'.repeat(31)],
  ])('answers 500 server-misconfigured when CLAVE_SYNC is %s', async (_, secret) => {
    const { handle, sleep } = setupServer({ secret });
    const response = await handle(syncRequest({ since: 0, records: [] }));
    expect(response.status).toBe(500);
    expect(await bodyOf(response)).toEqual({ error: 'server-misconfigured' });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('accepts a secret of exactly 32 characters', async () => {
    const secret = 'k'.repeat(32);
    const { handle } = setupServer({ secret });
    const response = await handle(syncRequest({ since: 0, records: [] }, { key: secret }));
    expect(response.status).toBe(200);
  });

  it.each([
    ['no Authorization header', { key: null }],
    ['a wrong key', { key: `${TEST_SECRET}x` }],
    ['an empty key', { key: '' }],
    ['another scheme', { key: null, headers: { Authorization: `Basic ${TEST_SECRET}` } }],
  ])('answers 401 after 400 ms with %s', async (_, options) => {
    const { handle, sleep } = setupServer();
    const response = await handle(syncRequest({ since: 0, records: [] }, options));
    expect(response.status).toBe(401);
    expect(await bodyOf(response)).toEqual({ error: 'unauthorized' });
    expect(sleep).toHaveBeenCalledWith(400);
  });

  it('checks the key before the method, the route and the body', async () => {
    const { handle } = setupServer();
    const wrong = { key: 'nope' };
    expect((await handle(request('/api/v1/sync', undefined, wrong))).status).toBe(401);
    expect((await handle(request('/api/v1/nowhere', undefined, wrong))).status).toBe(401);
    expect((await handle(syncRequest('{not json', wrong))).status).toBe(401);
  });

  it('accepts the scheme name in any case', async () => {
    const { handle } = setupServer();
    const response = await handle(
      syncRequest(
        { since: 0, records: [] },
        { key: null, headers: { Authorization: `bearer ${TEST_SECRET}` } },
      ),
    );
    expect(response.status).toBe(200);
  });
});

describe('routing', () => {
  it.each(['/api/v1/nowhere', '/api/v1/backups/2026-11-02/extra', '/api/v1/backups/', '/'])(
    'answers 404 not-found for %s',
    async (path) => {
      const { handle } = setupServer();
      const response = await handle(request(path));
      expect(response.status).toBe(404);
      expect(await bodyOf(response)).toEqual({ error: 'not-found' });
    },
  );

  it.each([
    ['/api/v1/sync', 'GET', 'POST'],
    ['/api/v1/sync', 'PUT', 'POST'],
    ['/api/v1/backups', 'POST', 'GET'],
    ['/api/v1/backups/2026-11-02', 'DELETE', 'GET'],
  ])('answers 405 for %s with %s and an Allow header', async (path, method, allow) => {
    const { handle } = setupServer();
    const response = await handle(request(path, undefined, { method }));
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe(allow);
    expect(await bodyOf(response)).toEqual({ error: 'method-not-allowed' });
  });

  it('sends the no-store, noindex and JSON headers on every response', async () => {
    const { handle } = setupServer();
    for (const response of [
      await handle(syncRequest({ since: 0, records: [] })),
      await handle(request('/api/v1/nowhere')),
      await handle(syncRequest({ since: 0, records: [] }, { key: 'wrong' })),
    ]) {
      expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    }
  });
});

describe('POST /api/v1/sync — request validation', () => {
  it('answers 400 invalid-json when the body is not JSON', async () => {
    const { handle } = setupServer();
    for (const body of ['{not json', '']) {
      const response = await handle(syncRequest(body));
      expect(response.status).toBe(400);
      expect(await bodyOf(response)).toEqual({ error: 'invalid-json' });
    }
  });

  it.each([
    ['since missing', { records: [] }],
    ['negative since', { since: -1, records: [] }],
    ['fractional since', { since: 1.5, records: [] }],
    ['records not an array', { since: 0, records: {} }],
    ['a JSON array', []],
    ['JSON null', null],
  ])('answers 400 invalid-request with %s', async (_, body) => {
    const { handle } = setupServer();
    const response = await handle(syncRequest(body));
    expect(response.status).toBe(400);
    expect(await bodyOf(response)).toEqual({ error: 'invalid-request' });
  });

  it('answers 413 when the declared body is larger than 8 MiB', async () => {
    const { handle } = setupServer();
    const response = await handle(
      syncRequest(
        { since: 0, records: [] },
        { headers: { 'Content-Length': String(8 * 1024 * 1024 + 1) } },
      ),
    );
    expect(response.status).toBe(413);
    expect(await bodyOf(response)).toEqual({ error: 'payload-too-large' });
  });

  it('answers 413 when the actual body is larger than 8 MiB', async () => {
    const { handle } = setupServer();
    const big = JSON.stringify({
      since: 0,
      records: [rec('a', 1, { pad: 'é'.repeat(4.2 * 1024 * 1024) })],
    });
    const response = await handle(syncRequest(big));
    expect(response.status).toBe(413);
  });
});

describe('POST /api/v1/sync — push and pull', () => {
  it('stores new records and echoes them back with their serverSeq', async () => {
    const { handle, memory } = setupServer();
    const response = await handle(syncRequest({ since: 0, records: [rec('a', 10), rec('b', 11)] }));
    expect(response.status).toBe(200);
    const body = syncResponseSchema.parse(await bodyOf(response));
    expect(body).toEqual({
      serverSeq: 2,
      records: [
        { ...rec('a', 10), serverSeq: 1 },
        { ...rec('b', 11), serverSeq: 2 },
      ],
      rejected: [],
    });
    expect(await memory.read(RECORDS_KEY)).not.toBeNull();
  });

  it('returns only what changed after `since`', async () => {
    const { handle } = setupServer();
    await handle(syncRequest({ since: 0, records: [rec('a', 1), rec('b', 1)] }));
    await handle(syncRequest({ since: 2, records: [rec('c', 1)] }));
    const body = syncResponseSchema.parse(
      await bodyOf(await handle(syncRequest({ since: 2, records: [] }))),
    );
    expect(body.serverSeq).toBe(3);
    expect(body.records.map((r) => r.id)).toEqual(['c']);
  });

  it('applies last-write-wins: newer replaces, ties and older keep the stored version', async () => {
    const { handle } = setupServer();
    await handle(syncRequest({ since: 0, records: [rec('a', 10, { reps: 8 })] }));

    const tie = syncResponseSchema.parse(
      await bodyOf(await handle(syncRequest({ since: 1, records: [rec('a', 10, { reps: 1 })] }))),
    );
    expect(tie).toEqual({ serverSeq: 1, records: [], rejected: [] });

    const newer = syncResponseSchema.parse(
      await bodyOf(await handle(syncRequest({ since: 1, records: [rec('a', 12, { reps: 9 })] }))),
    );
    expect(newer.records).toEqual([{ ...rec('a', 12, { reps: 9 }), serverSeq: 2 }]);

    const all = syncResponseSchema.parse(
      await bodyOf(await handle(syncRequest({ since: 0, records: [rec('a', 11)] }))),
    );
    expect(all.records).toEqual([{ ...rec('a', 12, { reps: 9 }), serverSeq: 2 }]);
  });

  it('includes soft-deleted records in the pull', async () => {
    const { handle } = setupServer();
    await handle(syncRequest({ since: 0, records: [rec('a', 1)] }));
    await handle(
      syncRequest({ since: 1, records: [{ id: 'a', type: 'set', updatedAt: 2, deleted: true }] }),
    );
    const body = syncResponseSchema.parse(
      await bodyOf(await handle(syncRequest({ since: 0, records: [] }))),
    );
    expect(body.records).toEqual([
      { id: 'a', type: 'set', updatedAt: 2, deleted: true, serverSeq: 2 },
    ]);
  });

  it('rejects invalid records, stores the valid ones and strips a client serverSeq', async () => {
    const { handle } = setupServer();
    const body = syncResponseSchema.parse(
      await bodyOf(
        await handle(
          syncRequest({
            since: 0,
            records: [{ id: 'bad', type: '', updatedAt: 1 }, rec('ok', 1, { serverSeq: 77 })],
          }),
        ),
      ),
    );
    expect(body.rejected).toEqual(['bad']);
    expect(body.records).toEqual([{ ...rec('ok', 1), serverSeq: 1 }]);
  });

  it('does not write anything when nothing changes', async () => {
    let writes = 0;
    const { handle } = setupServer({
      wrapStore: (store) => ({
        ...store,
        write: (...args) => {
          writes += 1;
          return store.write(...args);
        },
      }),
    });
    await handle(syncRequest({ since: 0, records: [] }));
    expect(writes).toBe(0);
    await handle(syncRequest({ since: 0, records: [rec('a', 1)] }));
    expect(writes).toBe(1);
    await handle(syncRequest({ since: 0, records: [rec('a', 1)] }));
    expect(writes).toBe(1);
  });

  it('keeps ids such as "__proto__" as ordinary records across requests', async () => {
    const { handle } = setupServer();
    await handle(syncRequest({ since: 0, records: [rec('__proto__', 1, { v: 1 })] }));
    const body = syncResponseSchema.parse(
      await bodyOf(await handle(syncRequest({ since: 0, records: [] }))),
    );
    expect(body.records).toEqual([{ ...rec('__proto__', 1, { v: 1 }), serverSeq: 1 }]);
  });

  it('returns no records when `since` is ahead of the server', async () => {
    const { handle } = setupServer();
    await handle(syncRequest({ since: 0, records: [rec('a', 1)] }));
    const body = syncResponseSchema.parse(
      await bodyOf(await handle(syncRequest({ since: 50, records: [] }))),
    );
    expect(body).toEqual({ serverSeq: 1, records: [], rejected: [] });
  });
});

describe('POST /api/v1/sync — optimistic concurrency', () => {
  it('re-reads and retries when another write got in first, keeping both changes', async () => {
    let raced = false;
    const { handle } = setupServer({
      wrapStore: (store) => ({
        ...store,
        async write(key, data, options) {
          if (key === RECORDS_KEY && !raced) {
            raced = true;
            // Another request writes between our read and our write.
            const current = await store.read(RECORDS_KEY);
            await store.write(
              RECORDS_KEY,
              {
                serverSeq: 1,
                records: { other: { ...rec('other', 5), serverSeq: 1 } },
              },
              current ? { condition: { onlyIfMatch: current.etag } } : {},
            );
          }
          return store.write(key, data, options);
        },
      }),
    });
    const body = syncResponseSchema.parse(
      await bodyOf(await handle(syncRequest({ since: 0, records: [rec('mine', 1)] }))),
    );
    expect(body.records.map((r) => [r.id, r.serverSeq])).toEqual([
      ['other', 1],
      ['mine', 2],
    ]);
  });

  it('answers 409 conflict after 5 failed attempts', async () => {
    let reads = 0;
    const { handle } = setupServer({
      wrapStore: (store) => ({
        ...store,
        read: (key) => {
          if (key === RECORDS_KEY) reads += 1;
          return store.read(key);
        },
        write: (key, data, options) =>
          key === RECORDS_KEY ? Promise.resolve(false) : store.write(key, data, options),
      }),
    });
    const response = await handle(syncRequest({ since: 0, records: [rec('a', 1)] }));
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toEqual({ error: 'conflict' });
    expect(reads).toBe(5);
  });
});

describe('unexpected failures', () => {
  it('answers 500 internal-error and logs when the stored document is corrupt', async () => {
    const { handle, memory, log } = setupServer();
    await memory.write(RECORDS_KEY, { serverSeq: 'x', records: {} });
    const response = await handle(syncRequest({ since: 0, records: [] }));
    expect(response.status).toBe(500);
    expect(await bodyOf(response)).toEqual({ error: 'internal-error' });
    expect(log).toHaveBeenCalledWith('sync: unexpected error', expect.any(Error));
    expect(JSON.stringify(log.mock.calls)).not.toContain(TEST_SECRET);
  });

  it.each([
    ['not an object', 'nope'],
    ['records missing', { serverSeq: 1 }],
    ['negative serverSeq', { serverSeq: -1, records: {} }],
    ['an invalid record', { serverSeq: 1, records: { a: { id: 'a' } } }],
  ])('treats a stored document with %s as corrupt', async (_, stored) => {
    const { handle, memory } = setupServer();
    await memory.write(RECORDS_KEY, stored);
    expect((await handle(syncRequest({ since: 0, records: [] }))).status).toBe(500);
  });

  it('answers 500 internal-error when the store fails', async () => {
    const { handle } = setupServer({
      wrapStore: (store) => ({ ...store, read: () => Promise.reject(new Error('blobs down')) }),
    });
    expect((await handle(syncRequest({ since: 0, records: [] }))).status).toBe(500);
  });
});

describe('uses real timers by default', () => {
  it('waits for real before answering 401 when no sleep is injected', async () => {
    const handle = createSyncHandler({ store: createMemoryStore(), secret: TEST_SECRET });
    const started = Date.now();
    const response = await handle(syncRequest({ since: 0, records: [] }, { key: 'wrong' }));
    expect(response.status).toBe(401);
    expect(Date.now() - started).toBeGreaterThanOrEqual(390);
  });

  it('logs to the console by default', async () => {
    const failing: SyncStore = {
      read: () => Promise.reject(new Error('down')),
      write: () => Promise.resolve(false),
      readMetadata: () => Promise.resolve(null),
      listKeys: () => Promise.resolve([]),
      delete: () => Promise.resolve(),
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handle = createSyncHandler({ store: failing, secret: TEST_SECRET, now: () => DAY });
    expect((await handle(syncRequest({ since: 0, records: [] }))).status).toBe(500);
    expect(spy).toHaveBeenCalledWith('sync: unexpected error', expect.any(Error));
  });
});
