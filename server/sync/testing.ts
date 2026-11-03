// Helpers for the server tests: a handler over an in-memory store, with a fake clock and no
// real waiting, plus small request builders.
import { vi } from 'vitest';
import { createSyncHandler, type SyncServerOptions } from './handler';
import { createMemoryStore, type MemoryStore } from './memoryStore';
import type { SyncStore } from './store';

export const TEST_SECRET = 'test-secret-0123456789-abcdefghijkl'; // ≥ 32 chars, synthetic
export const BASE_URL = 'https://certavi.test';
/** 2026-11-03 10:00 UTC (11:00 in Madrid). */
export const NOV_3 = Date.UTC(2026, 10, 3, 10);
export const DAY = 24 * 60 * 60 * 1000;

export function setupServer(
  options: Partial<SyncServerOptions> & { wrapStore?: (store: MemoryStore) => SyncStore } = {},
) {
  const memory = createMemoryStore();
  const clock = { now: NOV_3 };
  const sleep = vi.fn(() => Promise.resolve());
  const log = vi.fn();
  const handle = createSyncHandler({
    store: options.wrapStore ? options.wrapStore(memory) : memory,
    secret: TEST_SECRET,
    now: () => clock.now,
    sleep,
    log,
    ...options,
  });
  return { handle, memory, clock, sleep, log };
}

interface RequestOptions {
  method?: string;
  key?: string | null;
  headers?: Record<string, string>;
}

export function request(
  path: string,
  body?: unknown,
  { method, key = TEST_SECRET, headers = {} }: RequestOptions = {},
): Request {
  const allHeaders: Record<string, string> = { ...headers };
  if (key !== null) allHeaders.Authorization = `Bearer ${key}`;
  let payload: string | undefined;
  if (body !== undefined) {
    payload = typeof body === 'string' ? body : JSON.stringify(body);
    allHeaders['Content-Type'] = 'application/json';
  }
  return new Request(`${BASE_URL}${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: allHeaders,
    body: payload,
  });
}

export const syncRequest = (body: unknown, options?: RequestOptions) =>
  request('/api/v1/sync', body, options);

export const rec = (id: string, updatedAt: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'set',
  updatedAt,
  ...extra,
});

export async function bodyOf(response: Response): Promise<unknown> {
  return response.json();
}
