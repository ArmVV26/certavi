// SyncTransport over HTTP for the sync v1 contract (docs/api/sync-v1.md). It serves the Netlify
// Function today and any other backend that honours the same contract.
import type { z } from 'zod';
import {
  BACKUPS_PATH,
  backupFileSchema,
  backupListSchema,
  errorBodySchema,
  KEEPALIVE_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  SYNC_PATH,
  syncResponseSchema,
} from '../../domain';
import { SyncError, type SyncTransport } from './transport';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface HttpTransportOptions {
  key: string;
  /** Origin of the API; same origin as the app by default. */
  baseUrl?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  keepaliveTimeoutMs?: number;
}

export function createHttpTransport({
  key,
  baseUrl = '',
  fetch: doFetch = (url, init) => fetch(url, init),
  timeoutMs = REQUEST_TIMEOUT_MS,
  keepaliveTimeoutMs = KEEPALIVE_TIMEOUT_MS,
}: HttpTransportOptions): SyncTransport {
  async function call<T>(
    path: string,
    schema: z.ZodType<T>,
    { body, keepalive = false }: { body?: string; keepalive?: boolean } = {},
  ): Promise<T> {
    const timeout = keepalive ? keepaliveTimeoutMs : timeoutMs;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // Only the timer aborts this controller, so "aborted" means "timed out".
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeout);
    let response: Response;
    let data: unknown;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body,
        keepalive,
        signal: controller.signal,
      });
      try {
        data = await response.json();
      } catch {
        if (controller.signal.aborted) throw new SyncError('timeout');
        data = undefined;
      }
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw new SyncError(controller.signal.aborted ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = errorBodySchema.safeParse(data);
      if (body.success) throw new SyncError(body.data.error, response.status);
      throw new SyncError(response.status >= 500 ? 'http' : 'bad-response', response.status);
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new SyncError('bad-response', response.status);
    return parsed.data;
  }

  return {
    sync: (request, { keepalive = false } = {}) =>
      call(SYNC_PATH, syncResponseSchema, { body: JSON.stringify(request), keepalive }),
    listBackups: () => call(BACKUPS_PATH, backupListSchema),
    getBackup: (date) => call(`${BACKUPS_PATH}/${encodeURIComponent(date)}`, backupFileSchema),
  };
}
