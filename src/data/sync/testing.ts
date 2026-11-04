// Test helpers for the client sync code: an in-memory server that applies the real merge rule
// (src/domain/sync/merge.ts) and timers the test advances by hand. Not part of the app bundle.
import {
  changesSince,
  emptyDocument,
  mergeRecords,
  type BackupFile,
  type StoredWireRecord,
  type SyncDocument,
  type SyncRequest,
  type SyncResponse,
} from '../../domain';
import type { CertaviDb } from '../db';
import { createSyncEngine, type Scheduler, type SyncEngineOptions } from './engine';
import { memoryKeyStore } from './syncKey';
import { SyncError, type SyncErrorCode, type SyncTransport } from './transport';

export const TEST_KEY = 'test-sync-key-0123456789-abcdefghij'; // synthetic, ≥ 32 chars

export interface FakeServer {
  transport: SyncTransport;
  /** What the server stores. */
  document: () => SyncDocument;
  records: () => StoredWireRecord[];
  /** Every sync request received, with its options. */
  requests: { request: SyncRequest; keepalive: boolean }[];
  /** The next `count` calls fail with `code`. */
  failNext: (code: SyncErrorCode, count?: number) => void;
  /** Holds every call until `release` is called (to test work done while a request is in flight). */
  hold: () => { release: () => void };
  /** Stores records directly, as if another device had pushed them. */
  push: (records: readonly object[]) => void;
  backups: Map<string, BackupFile>;
}

export function createFakeServer(): FakeServer {
  let document = emptyDocument();
  const requests: FakeServer['requests'] = [];
  const failures: SyncErrorCode[] = [];
  let gate: Promise<void> | null = null;
  const backups = new Map<string, BackupFile>();

  async function before() {
    if (gate) await gate;
    const code = failures.shift();
    if (code !== undefined) throw new SyncError(code);
  }

  const transport: SyncTransport = {
    async sync(request, options = {}) {
      requests.push({ request: structuredClone(request), keepalive: options.keepalive === true });
      await before();
      const merged = mergeRecords(document, structuredClone(request.records));
      document = merged.document;
      const response: SyncResponse = {
        serverSeq: document.serverSeq,
        records: structuredClone(changesSince(document, request.since)),
        rejected: merged.rejected,
      };
      return response;
    },
    async listBackups() {
      await before();
      return {
        backups: [...backups.values()]
          .sort((a, b) => (a.date < b.date ? 1 : -1))
          .map((b) => ({ date: b.date, count: b.records.length, createdAt: null })),
      };
    },
    async getBackup(date) {
      await before();
      const backup = backups.get(date);
      if (!backup) throw new SyncError('not-found', 404);
      return structuredClone(backup);
    },
  };

  return {
    transport,
    document: () => document,
    records: () => changesSince(document, 0),
    requests,
    failNext(code, count = 1) {
      for (let i = 0; i < count; i++) failures.push(code);
    },
    hold() {
      let release: () => void = () => undefined;
      gate = new Promise((resolve) => {
        release = () => {
          gate = null;
          resolve();
        };
      });
      return { release };
    },
    push(records) {
      document = mergeRecords(document, records).document;
    },
    backups,
  };
}

/** Timers that only fire when the test says so. */
export function manualScheduler() {
  let nextId = 0;
  const tasks = new Map<number, { callback: () => void; ms: number }>();
  const scheduler: Scheduler = {
    set: (callback, ms) => {
      nextId += 1;
      tasks.set(nextId, { callback, ms });
      return nextId;
    },
    clear: (handle) => {
      tasks.delete(handle as number);
    },
  };
  return {
    scheduler,
    /** Delays of the timers waiting, in creation order. */
    delays: () => [...tasks.values()].map((t) => t.ms),
    /** Fires every waiting timer (not the ones they create). */
    fire() {
      const due = [...tasks.entries()];
      for (const [id] of due) tasks.delete(id);
      for (const [, task] of due) task.callback();
    },
  };
}

/** An engine over `db` and a fake server, with manual timers; not started. */
export function createTestEngine(
  db: CertaviDb,
  { key = TEST_KEY, ...options }: Partial<SyncEngineOptions> & { key?: string | null } = {},
) {
  const server = createFakeServer();
  const timers = manualScheduler();
  const keyStore = memoryKeyStore(key);
  const engine = createSyncEngine({
    db,
    keyStore,
    createTransport: () => server.transport,
    scheduler: timers.scheduler,
    ...options,
  });
  return { engine, server, timers, keyStore };
}
