// How the client talks to a sync backend (ADR-0004). The engine only sees this interface, so a
// backend that does not speak sync v1 over HTTP needs only a new implementation.
import type { BackupFile, BackupList, ErrorCode, SyncRequest, SyncResponse } from '../../domain';

/** Server error codes (contract §7) plus what can go wrong on the client side. */
export type SyncErrorCode =
  ErrorCode | 'network' | 'timeout' | 'bad-response' | 'http' | 'client-error';

/**
 * - `fatal`: retrying cannot help (wrong key, server without key); wait for the user.
 * - `retryable`: try again later with backoff.
 * - `bug`: the request itself is wrong; log it and do not retry on a timer.
 */
export type SyncErrorKind = 'fatal' | 'retryable' | 'bug';

const KIND: Record<SyncErrorCode, SyncErrorKind> = {
  unauthorized: 'fatal',
  'server-misconfigured': 'fatal',
  conflict: 'retryable',
  'internal-error': 'retryable',
  network: 'retryable',
  timeout: 'retryable',
  'bad-response': 'retryable',
  http: 'retryable',
  'invalid-json': 'bug',
  'invalid-request': 'bug',
  'invalid-date': 'bug',
  'not-found': 'bug',
  'method-not-allowed': 'bug',
  'payload-too-large': 'bug',
  'client-error': 'bug',
};

export function errorKindOf(code: SyncErrorCode): SyncErrorKind {
  return KIND[code];
}

export class SyncError extends Error {
  readonly code: SyncErrorCode;
  readonly kind: SyncErrorKind;
  /** HTTP status, when there was an answer. */
  readonly status: number | null;

  constructor(code: SyncErrorCode, status: number | null = null) {
    super(`Sync failed: ${code}`);
    this.name = 'SyncError';
    this.code = code;
    this.kind = errorKindOf(code);
    this.status = status;
  }
}

/** Any failure as a SyncError: unexpected ones (a database error…) are client errors. */
export function toSyncError(error: unknown): SyncError {
  return error instanceof SyncError ? error : new SyncError('client-error');
}

export interface SyncCallOptions {
  /** Exit flush: sent with `keepalive` so it survives the page being hidden or closed. */
  keepalive?: boolean;
}

/** Every method throws a SyncError on failure. */
export interface SyncTransport {
  sync: (request: SyncRequest, options?: SyncCallOptions) => Promise<SyncResponse>;
  listBackups: () => Promise<BackupList>;
  getBackup: (date: string) => Promise<BackupFile>;
}
