import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../../domain';
import { errorKindOf, SyncError, toSyncError } from './transport';

describe('sync errors', () => {
  it('stop for good only on a wrong key or a server without key', () => {
    const fatal = ERROR_CODES.filter((code) => errorKindOf(code) === 'fatal');
    expect(fatal.sort()).toEqual(['server-misconfigured', 'unauthorized']);
  });

  it('retry what the contract says to retry, and client-side failures of the network', () => {
    for (const code of ['conflict', 'internal-error', 'network', 'timeout', 'http'] as const) {
      expect(errorKindOf(code)).toBe('retryable');
    }
    // A captive portal or a host error page answers HTML: try again later.
    expect(errorKindOf('bad-response')).toBe('retryable');
  });

  it('treat malformed requests as bugs', () => {
    for (const code of ['invalid-json', 'invalid-request', 'method-not-allowed'] as const) {
      expect(errorKindOf(code)).toBe('bug');
    }
  });

  it('carry the code, the kind and the HTTP status', () => {
    const error = new SyncError('unauthorized', 401);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SyncError');
    expect(error.kind).toBe('fatal');
    expect(error.status).toBe(401);
    expect(new SyncError('network').status).toBeNull();
  });

  it('wraps unexpected failures as client errors', () => {
    const known = new SyncError('timeout');
    expect(toSyncError(known)).toBe(known);
    expect(toSyncError(new Error('IndexedDB exploded')).code).toBe('client-error');
  });
});
