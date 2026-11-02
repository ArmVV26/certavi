// Device-only settings (theme, language…) kept in localStorage. They are never synced.
// Every access is guarded: storage can be missing or throw (private mode, blocked site data),
// and the app must keep working with its defaults when that happens.

export type ReadableStorage = Pick<Storage, 'getItem'>;
export type WritableStorage = Pick<Storage, 'setItem'>;

/** localStorage, or null where accessing it throws (some privacy settings do). */
export function getLocalStorage(win: Window): Storage | null {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
}

/** Reads `key` and returns it if `isValid` accepts it; otherwise `fallback`. */
export function readDeviceSetting<T extends string>(
  storage: ReadableStorage | null,
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): T {
  try {
    const value = storage?.getItem(key);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/** Saves `value` under `key`. Returns false if storage is unavailable. */
export function writeDeviceSetting(
  storage: WritableStorage | null,
  key: string,
  value: string,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
