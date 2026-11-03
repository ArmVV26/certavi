import { describe, expect, it } from 'vitest';
import {
  getLocalStorage,
  readDeviceSetting,
  removeDeviceSetting,
  writeDeviceSetting,
} from './deviceStorage';

const isColor = (value: unknown): value is 'red' | 'blue' => value === 'red' || value === 'blue';

const blocked = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('deviceStorage', () => {
  it('returns localStorage when it is available', () => {
    expect(getLocalStorage(window)).toBe(window.localStorage);
  });

  it('returns null when reading localStorage throws', () => {
    const win = {
      get localStorage(): Storage {
        throw new Error('SecurityError');
      },
    } as unknown as Window;
    expect(getLocalStorage(win)).toBeNull();
  });

  it('round-trips a valid value', () => {
    expect(writeDeviceSetting(localStorage, 'k', 'blue')).toBe(true);
    expect(readDeviceSetting(localStorage, 'k', isColor, 'red')).toBe('blue');
  });

  it('falls back for missing, invalid, null or blocked storage', () => {
    expect(readDeviceSetting(localStorage, 'missing', isColor, 'red')).toBe('red');
    localStorage.setItem('k', 'green');
    expect(readDeviceSetting(localStorage, 'k', isColor, 'red')).toBe('red');
    expect(readDeviceSetting(null, 'k', isColor, 'red')).toBe('red');
    expect(readDeviceSetting(blocked, 'k', isColor, 'red')).toBe('red');
  });

  it('reports a failed write without throwing', () => {
    expect(writeDeviceSetting(null, 'k', 'red')).toBe(false);
    expect(writeDeviceSetting(blocked, 'k', 'red')).toBe(false);
  });

  it('removes a setting, and reports a failed removal without throwing', () => {
    localStorage.setItem('k', 'blue');
    expect(removeDeviceSetting(localStorage, 'k')).toBe(true);
    expect(localStorage.getItem('k')).toBeNull();
    expect(removeDeviceSetting(null, 'k')).toBe(false);
    expect(removeDeviceSetting(blocked, 'k')).toBe(false);
  });
});
