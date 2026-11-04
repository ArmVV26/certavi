// The sync key: a device-only setting (never synced, logged or shown again after saving).
import { MIN_SECRET_LENGTH } from '../../domain';
import { readDeviceSetting, removeDeviceSetting, writeDeviceSetting } from '../deviceStorage';

export const SYNC_KEY_STORAGE_KEY = 'certavi.syncKey';

/** Where the engine keeps the key. */
export interface KeyStore {
  read: () => string | null;
  /** Returns false if the key could not be saved (blocked storage). */
  write: (key: string) => boolean;
  remove: () => void;
}

/** Spaces at the ends are a copy-paste accident, never part of the key. */
export function normalizeKey(input: string): string {
  return input.trim();
}

/** The server only accepts secrets of at least 32 characters, so shorter keys cannot work. */
export function isValidKey(key: string): boolean {
  return key.length >= MIN_SECRET_LENGTH;
}

const isStoredKey = (value: unknown): value is string =>
  typeof value === 'string' && isValidKey(value);

/** The key in `localStorage` (or nowhere, when storage is blocked). */
export function localKeyStore(storage: Storage | null): KeyStore {
  return {
    read: () => {
      const key = readDeviceSetting(storage, SYNC_KEY_STORAGE_KEY, isStoredKey, '');
      return key === '' ? null : key;
    },
    write: (key) => writeDeviceSetting(storage, SYNC_KEY_STORAGE_KEY, key),
    remove: () => {
      removeDeviceSetting(storage, SYNC_KEY_STORAGE_KEY);
    },
  };
}

/** A key kept in memory only: for tests. */
export function memoryKeyStore(initial: string | null = null): KeyStore {
  let key = initial;
  return {
    read: () => key,
    write: (value) => {
      key = value;
      return true;
    },
    remove: () => {
      key = null;
    },
  };
}
