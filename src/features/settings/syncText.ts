// What the sync state and errors are called on screen (docs/spec/sync.md §2.1 and §2.4).
import type { SyncState } from '../../data/sync/engine';
import type { SyncErrorCode } from '../../data/sync/transport';
import type { IconName } from '../../ui/Icon';

export type SyncLabel = 'disabled' | 'syncing' | 'offline' | 'error' | 'waiting' | 'synced';

export function syncLabelOf(state: SyncState): SyncLabel {
  if (state.status === 'idle') return state.pending > 0 ? 'waiting' : 'synced';
  return state.status;
}

export const SYNC_ICON: Readonly<Record<SyncLabel, IconName>> = {
  disabled: 'cloudOff',
  syncing: 'refresh',
  offline: 'cloudOff',
  error: 'warning',
  waiting: 'cloud',
  synced: 'cloud',
};

type ErrorMessage =
  | 'wrongKey'
  | 'serverKey'
  | 'network'
  | 'timeout'
  | 'busy'
  | 'server'
  | 'unexpected'
  | 'notFound'
  | 'internal';

const ERROR_MESSAGE: Readonly<Record<SyncErrorCode, ErrorMessage>> = {
  unauthorized: 'wrongKey',
  'server-misconfigured': 'serverKey',
  network: 'network',
  timeout: 'timeout',
  conflict: 'busy',
  'internal-error': 'server',
  http: 'server',
  'bad-response': 'unexpected',
  'not-found': 'notFound',
  'invalid-json': 'internal',
  'invalid-request': 'internal',
  'invalid-date': 'internal',
  'method-not-allowed': 'internal',
  'payload-too-large': 'internal',
  'client-error': 'internal',
};

/** i18n key of the reason for an error code (unknown codes in old log rows → internal). */
export function errorKeyOf(code: string): `sync.errors.${ErrorMessage}` {
  const message = Object.hasOwn(ERROR_MESSAGE, code)
    ? ERROR_MESSAGE[code as SyncErrorCode]
    : 'internal';
  return `sync.errors.${message}`;
}
