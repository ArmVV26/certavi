import { describe, expect, it } from 'vitest';
import {
  isValidKey,
  localKeyStore,
  memoryKeyStore,
  normalizeKey,
  SYNC_KEY_STORAGE_KEY,
} from './syncKey';

const KEY = 'k'.repeat(32);

describe('sync key', () => {
  it('trims spaces at the ends and needs at least 32 characters', () => {
    expect(normalizeKey(`  ${KEY}\n`)).toBe(KEY);
    expect(isValidKey(KEY)).toBe(true);
    expect(isValidKey(KEY.slice(1))).toBe(false);
  });

  it('is kept in localStorage under its own key', () => {
    const store = localKeyStore(localStorage);
    expect(store.read()).toBeNull();
    expect(store.write(KEY)).toBe(true);
    expect(localStorage.getItem(SYNC_KEY_STORAGE_KEY)).toBe(KEY);
    expect(store.read()).toBe(KEY);
    store.remove();
    expect(store.read()).toBeNull();
  });

  it('ignores a stored value that cannot be a key', () => {
    localStorage.setItem(SYNC_KEY_STORAGE_KEY, 'short');
    expect(localKeyStore(localStorage).read()).toBeNull();
  });

  it('reports blocked storage without throwing', () => {
    const store = localKeyStore(null);
    expect(store.write(KEY)).toBe(false);
    expect(store.read()).toBeNull();
    expect(() => {
      store.remove();
    }).not.toThrow();
  });

  it('can live in memory, for tests', () => {
    const store = memoryKeyStore(KEY);
    expect(store.read()).toBe(KEY);
    store.remove();
    expect(store.read()).toBeNull();
    expect(store.write('other')).toBe(true);
    expect(store.read()).toBe('other');
  });
});
