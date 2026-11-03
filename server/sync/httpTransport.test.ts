// The client's HTTP transport against the real server handler (contract test, client side):
// what the client sends is what the server accepts, and what the server answers parses.
import { describe, expect, it, vi } from 'vitest';
import { createHttpTransport, type FetchLike } from '../../src/data/sync/httpTransport';
import { BASE_URL, NOV_3, rec, setupServer, TEST_SECRET } from './testing';

function transportFor(handle: (request: Request) => Promise<Response>, key = TEST_SECRET) {
  const requests: Request[] = [];
  const fetch: FetchLike = async (url, init) => {
    const request = new Request(url, init);
    requests.push(request.clone());
    return handle(request);
  };
  return { transport: createHttpTransport({ key, baseUrl: BASE_URL, fetch }), requests };
}

describe('HTTP transport', () => {
  it('pushes and pulls through POST /api/v1/sync with the bearer key', async () => {
    const { handle } = setupServer();
    const { transport, requests } = transportFor(handle);

    const response = await transport.sync({ since: 0, records: [rec('a', 1, { weight: 80 })] });

    expect(response).toEqual({
      serverSeq: 1,
      records: [{ id: 'a', type: 'set', updatedAt: 1, weight: 80, serverSeq: 1 }],
      rejected: [],
    });
    const [request] = requests;
    expect(request?.method).toBe('POST');
    expect(request?.url).toBe(`${BASE_URL}/api/v1/sync`);
    expect(request?.headers.get('authorization')).toBe(`Bearer ${TEST_SECRET}`);
    expect(request?.headers.get('content-type')).toBe('application/json');
  });

  it('lists and reads backups', async () => {
    const { handle, clock } = setupServer();
    const { transport } = transportFor(handle);
    await transport.sync({ since: 0, records: [rec('a', 1)] });
    clock.now = NOV_3 + 24 * 60 * 60 * 1000;
    await transport.sync({ since: 0, records: [rec('b', 2)] });

    const list = await transport.listBackups();
    expect(list.backups.map((b) => b.date)).toEqual(['2026-11-04']);
    const backup = await transport.getBackup('2026-11-04');
    expect(backup.records.map((r) => r.id)).toEqual(['a']);
  });

  it('turns error bodies into typed errors', async () => {
    const { handle } = setupServer();
    await expect(
      transportFor(handle, 'w'.repeat(40)).transport.listBackups(),
    ).rejects.toMatchObject({ code: 'unauthorized', kind: 'fatal', status: 401 });
    await expect(transportFor(handle).transport.getBackup('2026-13-45')).rejects.toMatchObject({
      code: 'invalid-date',
      status: 400,
    });
    await expect(transportFor(handle).transport.getBackup('2026-01-01')).rejects.toMatchObject({
      code: 'not-found',
      status: 404,
    });
    const { handle: misconfigured } = setupServer({ secret: 'short' });
    await expect(transportFor(misconfigured).transport.listBackups()).rejects.toMatchObject({
      code: 'server-misconfigured',
      kind: 'fatal',
    });
  });

  it('treats answers that are not the API as retryable', async () => {
    const html = (status: number) => () =>
      Promise.resolve(new Response('<html>portal</html>', { status }));
    await expect(transportFor(html(200)).transport.listBackups()).rejects.toMatchObject({
      code: 'bad-response',
      kind: 'retryable',
    });
    await expect(transportFor(html(404)).transport.listBackups()).rejects.toMatchObject({
      code: 'bad-response',
    });
    await expect(transportFor(html(502)).transport.listBackups()).rejects.toMatchObject({
      code: 'http',
      status: 502,
    });
    const wrongShape = () => Promise.resolve(Response.json({ backups: 'none' }));
    await expect(transportFor(wrongShape).transport.listBackups()).rejects.toMatchObject({
      code: 'bad-response',
    });
  });

  it('reports network failures', async () => {
    const fetch: FetchLike = () => Promise.reject(new TypeError('Failed to fetch'));
    const transport = createHttpTransport({ key: TEST_SECRET, fetch });
    await expect(transport.listBackups()).rejects.toMatchObject({ code: 'network' });
  });

  it('cuts a request that takes too long', async () => {
    vi.useFakeTimers();
    try {
      const fetch: FetchLike = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      const transport = createHttpTransport({ key: TEST_SECRET, fetch, timeoutMs: 1000 });
      const result = expect(transport.listBackups()).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(1000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });

  it('cuts an answer whose body takes too long', async () => {
    vi.useFakeTimers();
    try {
      const fetch: FetchLike = (_url, init) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener('abort', () => {
                reject(new DOMException('aborted', 'AbortError'));
              });
            }),
        } as Response);
      const transport = createHttpTransport({ key: TEST_SECRET, fetch, timeoutMs: 1000 });
      const result = expect(transport.listBackups()).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(1000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends the exit flush with keepalive and its own timeout', async () => {
    const seen: RequestInit[] = [];
    const { handle } = setupServer();
    const fetch: FetchLike = (url, init) => {
      seen.push(init);
      return handle(new Request(url, init));
    };
    const transport = createHttpTransport({ key: TEST_SECRET, baseUrl: BASE_URL, fetch });

    await transport.sync({ since: 0, records: [] }, { keepalive: true });
    await transport.sync({ since: 0, records: [] });

    expect(seen.map((init) => init.keepalive)).toEqual([true, false]);
  });

  it('uses the global fetch by default', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ backups: [] }, { status: 200 }));
    try {
      const transport = createHttpTransport({ key: TEST_SECRET });
      expect(await transport.listBackups()).toEqual({ backups: [] });
      expect(spy).toHaveBeenCalledWith(
        '/api/v1/backups',
        expect.objectContaining({ method: 'GET' }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
