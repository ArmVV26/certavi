// The sync v1 server (docs/api/sync-v1.md) as a plain `Request → Response` function, so the
// Netlify Function, the unit tests and the e2e fake server all run exactly the same code.
import { isoDateSchema } from '../../src/domain/model/envelope';
import {
  AUTH_FAILURE_DELAY_MS,
  BACKUPS_PATH,
  ERROR_STATUS,
  MAX_BODY_BYTES,
  MAX_WRITE_ATTEMPTS,
  storedWireRecordSchema,
  SYNC_PATH,
  syncRequestShapeSchema,
  type BackupList,
  type ErrorCode,
  type StoredWireRecord,
  type SyncResponse,
} from '../../src/domain/sync/contract';
import {
  changesSince,
  emptyDocument,
  mergeRecords,
  type SyncDocument,
} from '../../src/domain/sync/merge';
import { bearerToken, isSecretConfigured, keyMatches } from './auth';
import { backupKey, ensureDailyBackup, listBackups } from './backups';
import { RECORDS_KEY, type SyncStore, type WriteCondition } from './store';

export interface SyncServerOptions {
  store: SyncStore;
  /** The value of `CLAVE_SYNC`. */
  secret: string | undefined;
  /** Clock, injectable for tests. */
  now?: () => number;
  /** Waits `ms`; injectable so tests do not really wait 400 ms. */
  sleep?: (ms: number) => Promise<void>;
  /** Where unexpected errors and backup failures go. Never receives the secret. */
  log?: (message: string, error?: unknown) => void;
}

export type SyncHandler = (request: Request) => Promise<Response>;

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
} as const;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...headers } });
}

function error(code: ErrorCode, headers?: Record<string, string>): Response {
  return json(ERROR_STATUS[code], { error: code }, headers);
}

type Route =
  { kind: 'sync' } | { kind: 'backups' } | { kind: 'backup'; date: string } | { kind: 'unknown' };

function routeOf(pathname: string): Route {
  if (pathname === SYNC_PATH) return { kind: 'sync' };
  if (pathname === BACKUPS_PATH) return { kind: 'backups' };
  const prefix = `${BACKUPS_PATH}/`;
  if (pathname.startsWith(prefix)) {
    const date = pathname.slice(prefix.length);
    if (date.length > 0 && !date.includes('/')) return { kind: 'backup', date };
  }
  return { kind: 'unknown' };
}

const ALLOWED_METHOD: Record<Exclude<Route['kind'], 'unknown'>, string> = {
  sync: 'POST',
  backups: 'GET',
  backup: 'GET',
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads the stored document. Throws if what is stored is not a valid document. */
function parseDocument(data: unknown): SyncDocument {
  if (!isPlainObject(data) || !isPlainObject(data.records)) {
    throw new Error('Stored sync document is malformed');
  }
  const { serverSeq } = data;
  if (typeof serverSeq !== 'number' || !Number.isInteger(serverSeq) || serverSeq < 0) {
    throw new Error('Stored sync document has an invalid serverSeq');
  }
  // Object.entries + Map: ids such as "__proto__" stay ordinary keys.
  const records = new Map<string, StoredWireRecord>();
  for (const [id, value] of Object.entries(data.records)) {
    records.set(id, storedWireRecordSchema.parse(value));
  }
  return { serverSeq, records };
}

function serializeDocument(document: SyncDocument) {
  return { serverSeq: document.serverSeq, records: Object.fromEntries(document.records) };
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function createSyncHandler({
  store,
  secret,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = (message, cause) => {
    console.error(message, cause);
  },
}: SyncServerOptions): SyncHandler {
  async function readDocument(): Promise<{ document: SyncDocument; condition: WriteCondition }> {
    const stored = await store.read(RECORDS_KEY);
    if (stored === null) return { document: emptyDocument(), condition: { onlyIfNew: true } };
    return { document: parseDocument(stored.data), condition: { onlyIfMatch: stored.etag } };
  }

  async function sync(request: Request): Promise<Response> {
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return error('payload-too-large');
    const text = await request.text();
    if (byteLength(text) > MAX_BODY_BYTES) return error('payload-too-large');

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return error('invalid-json');
    }
    const parsed = syncRequestShapeSchema.safeParse(body);
    if (!parsed.success) return error('invalid-request');
    const { since, records } = parsed.data;

    let backupDone = false;
    for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
      const { document, condition } = await readDocument();
      const merged = mergeRecords(document, records);
      const respond = () => {
        const response: SyncResponse = {
          serverSeq: merged.document.serverSeq,
          records: changesSince(merged.document, since),
          rejected: merged.rejected,
        };
        return json(200, response);
      };
      if (!merged.changed) return respond();

      if (!backupDone) {
        backupDone = true;
        try {
          await ensureDailyBackup(store, document, now());
        } catch (cause) {
          log('sync: daily backup failed', cause);
        }
      }
      const written = await store.write(RECORDS_KEY, serializeDocument(merged.document), {
        condition,
      });
      if (written) return respond();
    }
    return error('conflict');
  }

  async function backups(): Promise<Response> {
    const body: BackupList = { backups: await listBackups(store) };
    return json(200, body);
  }

  async function backup(date: string): Promise<Response> {
    if (!isoDateSchema.safeParse(date).success) return error('invalid-date');
    const stored = await store.read(backupKey(date));
    return stored === null ? error('not-found') : json(200, stored.data);
  }

  return async (request) => {
    try {
      if (!isSecretConfigured(secret)) return error('server-misconfigured');
      if (!keyMatches(bearerToken(request.headers.get('authorization')), secret)) {
        await sleep(AUTH_FAILURE_DELAY_MS);
        return error('unauthorized');
      }

      const route = routeOf(new URL(request.url).pathname);
      if (route.kind === 'unknown') return error('not-found');
      const allowed = ALLOWED_METHOD[route.kind];
      if (request.method !== allowed) return error('method-not-allowed', { Allow: allowed });

      switch (route.kind) {
        case 'sync':
          return await sync(request);
        case 'backups':
          return await backups();
        case 'backup':
          return await backup(route.date);
      }
    } catch (cause) {
      log('sync: unexpected error', cause);
      return error('internal-error');
    }
  };
}
