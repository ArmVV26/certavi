// Fake sync server for the e2e tests (docs/spec/sync.md §6). It runs the REAL server handler
// (server/sync/handler.ts) over an in-memory store and answers every request the browser makes
// to /api/v1/** through Playwright routing: no extra process, no port.
//
// Usage:
//   const server = createFakeSyncServer();
//   await server.attach(context);          // one call per browser context ("device")
//   ... type E2E_SYNC_KEY in Settings → Sincronización ...
//   expect(await server.records()).toHaveLength(29);
//
// Two contexts attached to the same server are two devices sharing one server.
import type { BrowserContext, Route } from '@playwright/test';
import { backupKey } from '../../server/sync/backups';
import { createSyncHandler } from '../../server/sync/handler';
import { createMemoryStore } from '../../server/sync/memoryStore';
import { RECORDS_KEY } from '../../server/sync/store';

/** The key this server accepts (synthetic, ≥ 32 characters). */
export const E2E_SYNC_KEY = 'e2e-sync-key-0123456789-abcdefghijkl';

/** A second valid-looking key the server rejects with 401. */
export const E2E_WRONG_KEY = 'e2e-wrong-key-0123456789-abcdefghij';

/** How the next requests fail: cut the connection, or answer with that HTTP error. */
export type FakeFailure = 'abort' | 401 | 409 | 500;

export interface FakeSyncServer {
  readonly key: string;
  /** Routes /api/v1/** of every page in `context` to this server. */
  attach: (context: BrowserContext) => Promise<void>;
  /** The next `count` requests (any route) fail as `failure`. */
  failNext: (failure: FakeFailure, count?: number) => void;
  /** Every following request waits `ms` before it is answered (0 = no delay). */
  setDelay: (ms: number) => void;
  /** Requests received so far (`path` filters, e.g. '/api/v1/sync'). Failed ones included. */
  requestCount: (path?: string) => number;
  /** The records stored on the server, oldest change first (with their `serverSeq`). */
  records: () => Promise<Record<string, unknown>[]>;
  /** Stores a backup for `date` ('YYYY-MM-DD') holding `records`, as the server would. */
  addBackup: (date: string, records: readonly Record<string, unknown>[]) => Promise<void>;
}

const ERROR_BODY: Record<Exclude<FakeFailure, 'abort'>, string> = {
  401: 'unauthorized',
  409: 'conflict',
  500: 'internal-error',
};

export function createFakeSyncServer(): FakeSyncServer {
  const store = createMemoryStore();
  const handle = createSyncHandler({
    store,
    secret: E2E_SYNC_KEY,
    sleep: () => Promise.resolve(), // no 400 ms wait on a wrong key: keeps the suite fast
    log: () => undefined,
  });
  const failures: FakeFailure[] = [];
  const paths: string[] = [];
  let delayMs = 0;

  async function answer(route: Route): Promise<void> {
    const browserRequest = route.request();
    const url = new URL(browserRequest.url());
    paths.push(url.pathname);
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    const failure = failures.shift();
    if (failure === 'abort') {
      await route.abort('connectionreset');
      return;
    }
    if (failure !== undefined) {
      await route.fulfill({
        status: failure,
        contentType: 'application/json',
        body: JSON.stringify({ error: ERROR_BODY[failure] }),
      });
      return;
    }

    const body = browserRequest.postDataBuffer();
    const request = new Request(url, {
      method: browserRequest.method(),
      headers: await browserRequest.allHeaders(),
      body: body === null ? undefined : new Uint8Array(body),
    });
    const response = await handle(request);
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  }

  return {
    key: E2E_SYNC_KEY,

    async attach(context) {
      await context.route('**/api/v1/**', answer);
    },

    failNext(failure, count = 1) {
      for (let i = 0; i < count; i++) failures.push(failure);
    },

    setDelay(ms) {
      delayMs = ms;
    },

    requestCount: (path) =>
      path === undefined ? paths.length : paths.filter((p) => p === path).length,

    async records() {
      const stored = await store.read(RECORDS_KEY);
      if (stored === null) return [];
      const { records } = stored.data as { records: Record<string, Record<string, unknown>> };
      return Object.values(records).sort(
        (a, b) => (a.serverSeq as number) - (b.serverSeq as number),
      );
    },

    async addBackup(date, records) {
      const withSeq = records.map((record, i) => ({ ...record, serverSeq: i + 1 }));
      await store.write(
        backupKey(date),
        { date, records: withSeq },
        { metadata: { createdAt: Date.now(), count: withSeq.length } },
      );
    },
  };
}
