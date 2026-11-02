import { describe, expect, it } from 'vitest';
import { setSystemDark } from '../test/matchMedia';
import {
  THEME_COLOR,
  THEME_STORAGE_KEY,
  applyTheme,
  initTheme,
  isThemePreference,
  nextThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from './theme';

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('resolveTheme', () => {
  it('follows the system when the preference is system', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
  });

  it('ignores the system when light or dark is forced', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('nextThemePreference', () => {
  it('cycles automatic → light → dark → automatic', () => {
    expect(nextThemePreference('system')).toBe('light');
    expect(nextThemePreference('light')).toBe('dark');
    expect(nextThemePreference('dark')).toBe('system');
  });
});

describe('isThemePreference', () => {
  it('accepts only the three known values', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(1)).toBe(false);
  });
});

describe('readThemePreference / writeThemePreference', () => {
  it('defaults to system when nothing is saved', () => {
    expect(readThemePreference(localStorage)).toBe('system');
  });

  it('round-trips a saved preference', () => {
    expect(writeThemePreference(localStorage, 'dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readThemePreference(localStorage)).toBe('dark');
  });

  it('falls back to system for an invalid saved value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readThemePreference(localStorage)).toBe('system');
  });

  it('survives blocked or missing storage', () => {
    expect(readThemePreference(throwingStorage)).toBe('system');
    expect(readThemePreference(null)).toBe('system');
    expect(writeThemePreference(throwingStorage, 'light')).toBe(false);
    expect(writeThemePreference(null, 'light')).toBe(false);
  });
});

describe('applyTheme', () => {
  it('sets data-theme on <html>', () => {
    applyTheme(document, 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme(document, 'light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('updates every theme-color meta to the active background', () => {
    for (const media of ['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)']) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.media = media;
      document.head.append(meta);
    }

    applyTheme(document, 'dark');

    const metas = [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    expect(metas).toHaveLength(2);
    expect(metas.map((m) => m.content)).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
  });

  it('creates the theme-color meta when it is missing', () => {
    applyTheme(document, 'light');
    const meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    expect(meta?.content).toBe(THEME_COLOR.light);
  });
});

describe('initTheme', () => {
  it('applies the system theme when nothing is saved', () => {
    setSystemDark(true);
    expect(initTheme(window)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies the saved preference over the system', () => {
    setSystemDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(initTheme(window)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
