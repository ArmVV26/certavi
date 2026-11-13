// The client sync engine (docs/api/sync-v1.md §8, ADR-0004): when to sync, batches, retries,
// the exit flush, the key and the attempt log. Every dependency is injected, so it is tested
// without a browser or a network.
import { liveQuery, type Subscription } from 'dexie';
import {
  KEEPALIVE_MAX_BYTES,
  MAX_BATCH_RECORDS,
  PENDING_SYNC_INTERVAL_MS,
  RETRY_BACKOFF_SECONDS,
  type BackupFile,
  type BackupList,
  type SyncResponse,
} from '../../domain';
import type { CertaviDb, SyncTrigger } from '../db';
import { addAttempt, lastSuccessAt } from './attemptLog';
import { commitResponse, type AppliedChange } from './commit';
import { keepaliveBatch, nextBatch, queueEverything, readSince } from './queue';
import { restoreBackup } from './restore';
import { isValidKey, normalizeKey, type KeyStore } from './syncKey';
import { SyncError, toSyncError, type SyncErrorCode, type SyncTransport } from './transport';

/** What is true whatever the status is. */
interface SyncCounters {
  /** Records waiting to be sent. */
  pending: number;
  /** Time of the last attempt that worked. */
  lastSuccessAt: number | null;
}

/**
 * Where the engine is. Each status carries only what belongs to it, so a state such as "idle with
 * an old error" or "disabled with a key" cannot be built.
 *
 * - `disabled`: no key on this device.
 * - `syncing`: an attempt is running. With a key and no attempt finished yet (just saved, or
 *   app start-up) it is `syncing`, never `idle`: "Synced" must not show before the server has
 *   answered (docs/spec/sync.md §2.1).
 * - `idle`: the last attempt worked.
 * - `offline`: the browser has no network (`error` null) or the last attempt hit a network error.
 * - `error`: the last attempt failed for `error`.
 */
export type SyncPhase =
  | { status: 'disabled' }
  | { status: 'syncing' }
  | { status: 'idle' }
  | { status: 'offline'; error: SyncErrorCode | null }
  | { status: 'error'; error: SyncErrorCode };

export type SyncState = SyncCounters & SyncPhase;

/** Whether this device has a sync key (every status but `disabled`). */
export function hasSyncKey(state: SyncState): boolean {
  return state.status !== 'disabled';
}

/** Why the last attempt failed, or null when it did not (or the failure is just "no network"). */
export function syncErrorOf(state: SyncState): SyncErrorCode | null {
  return state.status === 'error' || state.status === 'offline' ? state.error : null;
}

/** Timers, injectable so tests control time. */
export interface Scheduler {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

export interface SyncEngineOptions {
  db: CertaviDb;
  keyStore: KeyStore;
  createTransport: (key: string) => SyncTransport;
  now?: () => number;
  scheduler?: Scheduler;
  /** `navigator.onLine` in the browser. */
  isOnline?: () => boolean;
  /** Wait after the queue grows before syncing, so a burst of edits goes in one request. */
  debounceMs?: number;
}

export type SetKeyResult = 'saved' | 'unchanged' | 'invalid' | 'storage-error';

export interface SyncEngine {
  getState: () => SyncState;
  /** For `useSyncExternalStore`. */
  subscribe: (listener: () => void) => () => void;
  /**
   * Calls the listener with what a sync wrote that came from the server (other devices); this
   * device's own records coming back are not reported. Returns the unsubscribe function.
   */
  subscribeRemote: (listener: (changes: AppliedChange[]) => void) => () => void;
  /** Starts watching the queue and runs the first sync. */
  start: () => void;
  stop: () => void;
  /** Asks for a sync; it runs now, after the current one, or not at all (no key, offline…). */
  trigger: (reason: SyncTrigger) => void;
  /** "Sync now": also clears a stop after a fatal error. Resolves when it has finished. */
  syncNow: () => Promise<SyncState>;
  /** The page is being hidden or closed: send what fits in one `keepalive` request. */
  flush: () => void;
  /** The browser lost the network. */
  wentOffline: () => void;
  setKey: (input: string) => Promise<SetKeyResult>;
  forgetKey: () => void;
  listBackups: () => Promise<BackupList>;
  getBackup: (date: string) => Promise<BackupFile>;
  /** Restores a server backup; returns how many records changed. */
  restore: (date: string) => Promise<number>;
}

type LogResult =
  | { ok: true; sent: number; received: number }
  | { ok: false; error: SyncErrorCode; sent: number; received: number };

export const SYNC_DEBOUNCE_MS = 2000;
/** Safety net: an attempt never loops forever, even if the queue keeps changing. */
const MAX_ROUNDS = 50;

const defaultScheduler: Scheduler = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

type TimerKind = 'write' | 'retry' | 'interval';

/** Triggers that bring new local data: worth another attempt if one is already running. */
const RERUN_TRIGGERS: ReadonlySet<SyncTrigger> = new Set(['write', 'manual', 'key', 'restore']);

export function backoffMs(failures: number): number {
  const index = Math.min(Math.max(failures, 1), RETRY_BACKOFF_SECONDS.length) - 1;
  return (RETRY_BACKOFF_SECONDS[index] ?? 60) * 1000;
}

export function createSyncEngine({
  db,
  keyStore,
  createTransport,
  now = Date.now,
  scheduler = defaultScheduler,
  isOnline = () => true,
  debounceMs = SYNC_DEBOUNCE_MS,
}: SyncEngineOptions): SyncEngine {
  let key = keyStore.read();
  let transport = key === null ? null : createTransport(key);
  let state: SyncState = {
    // With a key, `start()` runs the first attempt; until it ends nothing is known to be synced.
    status: key === null ? 'disabled' : 'syncing',
    pending: 0,
    lastSuccessAt: null,
  };
  const listeners = new Set<() => void>();
  const remoteListeners = new Set<(changes: AppliedChange[]) => void>();
  let running: Promise<void> | null = null;
  let rerun: SyncTrigger | null = null;
  let timer: { handle: unknown; kind: TimerKind } | null = null;
  let failures = 0;
  /** After a fatal error, only the user (key, "Sync now") starts a new attempt. */
  let blocked = false;
  let queueWatch: Subscription | null = null;
  /** Null until the first count: the queue as found at start-up is not a new edit. */
  let lastPending: number | null = null;

  function notify() {
    for (const listener of listeners) listener();
  }

  /** Moves to another status; the counters stay. The new status brings all of its own data. */
  function enter(next: SyncPhase) {
    state = { pending: state.pending, lastSuccessAt: state.lastSuccessAt, ...next };
    notify();
  }

  function setCounters(patch: Partial<SyncCounters>) {
    state = { ...state, ...patch };
    notify();
  }

  function clearTimer() {
    if (timer) scheduler.clear(timer.handle);
    timer = null;
  }

  function schedule(kind: TimerKind, ms: number) {
    clearTimer();
    const handle = scheduler.set(() => {
      timer = null;
      trigger(kind);
    }, ms);
    timer = { handle, kind };
  }

  function onQueueCount(count: number) {
    const grew = lastPending !== null && count > lastPending;
    lastPending = count;
    if (count !== state.pending) setCounters({ pending: count });
    if (!grew || key === null || blocked) return;
    if (running) {
      rerun ??= 'write';
      return;
    }
    // A backoff in progress is respected; otherwise sync shortly after the last edit.
    if (timer?.kind !== 'retry') schedule('write', debounceMs);
  }

  async function log(reason: SyncTrigger, startedAt: number, result: LogResult) {
    try {
      await addAttempt(db, {
        at: startedAt,
        trigger: reason,
        durationMs: now() - startedAt,
        ...result,
      });
    } catch {
      // The log is a diagnosis aid: failing to write it must not break sync.
    }
  }

  async function attempt(reason: SyncTrigger): Promise<void> {
    const activeKey = key;
    const activeTransport = transport;
    if (activeKey === null || activeTransport === null) return;
    const exit = reason === 'exit';
    const startedAt = now();
    let sent = 0;
    let received = 0;
    if (!exit) enter({ status: 'syncing' });
    try {
      let remaining = 0;
      let batchSize = MAX_BATCH_RECORDS;
      for (let round = 1; round <= MAX_ROUNDS; round++) {
        const since = await readSince(db);
        const batch = exit
          ? await keepaliveBatch(db, since, KEEPALIVE_MAX_BYTES)
          : await nextBatch(db, batchSize);
        if (exit && batch.records.length === 0) return; // nothing to save on the way out
        let response: SyncResponse;
        try {
          response = await activeTransport.sync(
            { since, records: batch.records },
            { keepalive: exit },
          );
        } catch (error) {
          const sentCount = batch.records.length;
          if (error instanceof SyncError && error.code === 'payload-too-large' && sentCount > 1) {
            batchSize = Math.ceil(sentCount / 2);
            continue;
          }
          throw error;
        }
        if (key !== activeKey) return; // the key changed meanwhile: this answer is stale
        const result = await commitResponse(db, batch.entries, response);
        if (result.changes.length > 0) {
          for (const listener of remoteListeners) listener(result.changes);
        }
        sent += batch.records.length;
        received += response.records.length;
        remaining = await db.pending.count();
        if (exit || remaining === 0 || result.dequeued === 0) break;
      }
      failures = 0;
      await log(reason, startedAt, { ok: true, sent, received });
      if (key !== activeKey) return;
      state = { status: 'idle', pending: state.pending, lastSuccessAt: startedAt };
      notify();
      if (remaining > 0 && !rerun) schedule('interval', PENDING_SYNC_INTERVAL_MS);
    } catch (cause) {
      const error = toSyncError(cause);
      await log(reason, startedAt, { ok: false, error: error.code, sent, received });
      if (key !== activeKey) return;
      if (error.kind === 'fatal') blocked = true;
      const offline = error.code === 'network' && !isOnline();
      enter(
        offline ? { status: 'offline', error: error.code } : { status: 'error', error: error.code },
      );
      if (error.kind === 'retryable' && !offline && !exit) {
        failures += 1;
        schedule('retry', backoffMs(failures));
      }
    }
  }

  function run(reason: SyncTrigger): Promise<void> {
    clearTimer();
    const current = attempt(reason).finally(() => {
      running = null;
      const next = rerun;
      rerun = null;
      if (next !== null) trigger(next);
    });
    running = current;
    return current;
  }

  function trigger(reason: SyncTrigger) {
    if (key === null) return;
    if (blocked && reason !== 'manual' && reason !== 'key') return;
    if (reason === 'manual' || reason === 'key') blocked = false;
    if (reason === 'online' || reason === 'visible' || reason === 'manual') failures = 0;
    if (running) {
      if (RERUN_TRIGGERS.has(reason)) rerun ??= reason;
      return;
    }
    if (!isOnline()) {
      clearTimer();
      enter({ status: 'offline', error: null });
      return;
    }
    void run(reason);
  }

  async function settle() {
    while (running) await running;
  }

  async function requireTransport(): Promise<SyncTransport> {
    if (transport === null) throw new SyncError('client-error');
    return Promise.resolve(transport);
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    subscribeRemote(listener) {
      remoteListeners.add(listener);
      return () => {
        remoteListeners.delete(listener);
      };
    },

    start() {
      if (queueWatch) return;
      queueWatch = liveQuery(() => db.pending.count()).subscribe({
        next: onQueueCount,
        error: () => undefined,
      });
      void lastSuccessAt(db)
        .then((at) => {
          if (at !== null && state.lastSuccessAt === null) setCounters({ lastSuccessAt: at });
        })
        .catch(() => undefined);
      trigger('start');
    },

    stop() {
      queueWatch?.unsubscribe();
      queueWatch = null;
      lastPending = null;
      clearTimer();
    },

    trigger,

    async syncNow() {
      trigger('manual');
      await settle();
      return state;
    },

    flush() {
      if (key === null || blocked || running || !isOnline()) return;
      void run('exit');
    },

    wentOffline() {
      if (key === null) return;
      clearTimer();
      if (!running) enter({ status: 'offline', error: null });
    },

    async setKey(input) {
      const next = normalizeKey(input);
      if (!isValidKey(next)) return 'invalid';
      if (next === key) {
        trigger('key');
        return 'unchanged';
      }
      if (!keyStore.write(next)) return 'storage-error';
      key = next;
      transport = createTransport(next);
      blocked = false;
      failures = 0;
      rerun = null;
      clearTimer();
      // The first attempt with this key is about to run; it ends in idle, error or offline.
      enter({ status: 'syncing' });
      try {
        await settle(); // a stale attempt drops its answer; let it finish before re-queueing
        await queueEverything(db);
      } finally {
        // Even if re-queueing failed, the attempt runs, so the state never stays "syncing".
        trigger('key');
      }
      return 'saved';
    },

    forgetKey() {
      keyStore.remove();
      key = null;
      transport = null;
      blocked = false;
      failures = 0;
      rerun = null;
      clearTimer();
      enter({ status: 'disabled' });
    },

    listBackups: async () => (await requireTransport()).listBackups(),

    getBackup: async (date) => (await requireTransport()).getBackup(date),

    async restore(date) {
      const backup = await (await requireTransport()).getBackup(date);
      const changed = await restoreBackup(db, backup, now());
      trigger('restore');
      return changed;
    },
  };
}
