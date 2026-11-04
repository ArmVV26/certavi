// Contract test: docs/api/sync-v1.md, the zod schemas in src/domain/sync/contract.ts and the
// server must agree. If this fails, update the document, the schemas and the server together.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_LOG_SIZE,
  AUTH_FAILURE_DELAY_MS,
  BACKUP_TIME_ZONE,
  backupFileSchema,
  backupListSchema,
  BACKUPS_KEPT,
  BACKUPS_PATH,
  ERROR_STATUS,
  errorBodySchema,
  KEEPALIVE_TIMEOUT_MS,
  MAX_BATCH_RECORDS,
  MAX_BODY_BYTES,
  MAX_WRITE_ATTEMPTS,
  MIN_SECRET_LENGTH,
  PENDING_SYNC_INTERVAL_MS,
  REQUEST_TIMEOUT_MS,
  RETRY_BACKOFF_SECONDS,
  SYNC_PATH,
  syncRequestSchema,
  syncResponseSchema,
  type ErrorCode,
} from '../../src/domain/sync/contract';
import { RECORDS_KEY } from './store';
import { bodyOf, DAY, rec, request, setupServer, syncRequest } from './testing';

const doc = readFileSync(new URL('../../docs/api/sync-v1.md', import.meta.url), 'utf8');

/** The ```json blocks of the document, in order. */
function jsonBlocks(): unknown[] {
  return [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map(
    (match) => JSON.parse(match[1] ?? '') as unknown,
  );
}

/** Rows of the error table (§7): `| 400 | \`invalid-json\` | …`. */
function documentedErrors(): [ErrorCode, number][] {
  return [...doc.matchAll(/^\| (\d{3}) +\| `([a-z-]+)` +\|/gm)].map((match) => [
    match[2] as ErrorCode,
    Number(match[1]),
  ]);
}

describe('the document and the schemas', () => {
  it('has examples that the schemas accept (request, response, backup list, backup file)', () => {
    const [requestExample, responseExample, listExample, fileExample, ...rest] = jsonBlocks();
    expect(rest).toEqual([]);
    expect(syncRequestSchema.safeParse(requestExample).success).toBe(true);
    expect(syncResponseSchema.safeParse(responseExample).success).toBe(true);
    expect(backupListSchema.safeParse(listExample).success).toBe(true);
    expect(backupFileSchema.safeParse(fileExample).success).toBe(true);
  });

  it('documents exactly the error codes and statuses the schemas know', () => {
    expect(Object.fromEntries(documentedErrors())).toEqual(ERROR_STATUS);
  });

  it('states the same numbers as the code', () => {
    const expected = [
      SYNC_PATH,
      `${BACKUPS_PATH}/{date}`,
      `shorter than **${String(MIN_SECRET_LENGTH)} characters**`,
      `wait **${String(AUTH_FAILURE_DELAY_MS)} ms**`,
      `up to **${String(MAX_WRITE_ATTEMPTS)} attempts**`,
      `at most **${String(MAX_BATCH_RECORDS)}** per request`,
      `larger than **${String(MAX_BODY_BYTES / 1024 / 1024)} MiB**`,
      `**${String(BACKUPS_KEPT)} most recent**`,
      `**${BACKUP_TIME_ZONE}**`,
      `Timeout** ${String(REQUEST_TIMEOUT_MS / 1000)} s`,
      `backoff **${RETRY_BACKOFF_SECONDS.join(', ')} s**`,
      `every **${String(PENDING_SYNC_INTERVAL_MS / 1000)} s**`,
      `${String(KEEPALIVE_TIMEOUT_MS / 1000)} s timeout`,
      `last ${String(ATTEMPT_LOG_SIZE)} attempts`,
    ];
    for (const text of expected) expect(doc, text).toContain(text);
  });
});

describe('the server honours the document', () => {
  it('answers the documented request example with a response that matches the schema', async () => {
    const { handle } = setupServer();
    const [requestExample] = jsonBlocks();
    const response = await handle(syncRequest(requestExample));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/^application\/json/);
    const body = syncResponseSchema.parse(await bodyOf(response));
    expect(body.rejected).toEqual([]);
    // The example's `since` (1234) is ahead of this fresh server, so pull everything to check
    // that both example records were stored.
    const all = syncResponseSchema.parse(
      await bodyOf(await handle(syncRequest({ since: 0, records: [] }))),
    );
    expect(all.records.map((r) => r.type)).toEqual(['set', 'note']);
  });

  it('answers the backup routes with bodies that match the schemas', async () => {
    const { handle, clock } = setupServer();
    await handle(syncRequest({ since: 0, records: [rec('a', 1)] }));
    clock.now += DAY;
    await handle(syncRequest({ since: 0, records: [rec('b', 1)] }));
    const list = backupListSchema.parse(await bodyOf(await handle(request(BACKUPS_PATH))));
    const date = list.backups[0]?.date ?? '';
    backupFileSchema.parse(await bodyOf(await handle(request(`${BACKUPS_PATH}/${date}`))));
  });

  // One scenario per documented error code: the status and the body must match §7.
  const scenarios: Record<ErrorCode, () => Promise<Response>> = {
    'invalid-json': () => setupServer().handle(syncRequest('{')),
    'invalid-request': () => setupServer().handle(syncRequest({ since: 'x', records: [] })),
    'invalid-date': () => setupServer().handle(request(`${BACKUPS_PATH}/2026-99-99`)),
    unauthorized: () => setupServer().handle(syncRequest({ since: 0, records: [] }, { key: 'x' })),
    'not-found': () => setupServer().handle(request(`${BACKUPS_PATH}/2020-01-01`)),
    'method-not-allowed': () => setupServer().handle(request(SYNC_PATH)),
    conflict: () =>
      setupServer({
        wrapStore: (store) => ({
          ...store,
          write: (key, data, options) =>
            key === RECORDS_KEY ? Promise.resolve(false) : store.write(key, data, options),
        }),
      }).handle(syncRequest({ since: 0, records: [rec('a', 1)] })),
    'payload-too-large': () =>
      setupServer().handle(
        syncRequest(
          { since: 0, records: [] },
          { headers: { 'Content-Length': String(MAX_BODY_BYTES + 1) } },
        ),
      ),
    'server-misconfigured': () => setupServer({ secret: undefined }).handle(request(SYNC_PATH)),
    'internal-error': () =>
      setupServer({
        wrapStore: (store) => ({ ...store, read: () => Promise.reject(new Error('down')) }),
      }).handle(syncRequest({ since: 0, records: [] })),
  };

  it.each(Object.keys(ERROR_STATUS) as ErrorCode[])('answers %s as documented', async (code) => {
    const response = await scenarios[code]();
    expect(response.status).toBe(ERROR_STATUS[code]);
    expect(errorBodySchema.parse(await bodyOf(response))).toEqual({ error: code });
  });
});
