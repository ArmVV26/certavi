// Theme preference (system | light | dark) and how it is applied to the document.
// The preference is a device-only setting: it lives in localStorage and is never synced.
import { getLocalStorage, readDeviceSetting, writeDeviceSetting } from '../data/deviceStorage';
import type { ReadableStorage, WritableStorage } from '../data/deviceStorage';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'certavi.theme';
export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** Browser UI colour (address bar, status bar) per theme. Must equal `--bg` in tokens.css. */
export const THEME_COLOR: Readonly<Record<ResolvedTheme, string>> = {
  light: '#f4f5f7',
  dark: '#0b0f14',
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/** Order of the header button: automatic → light → dark → automatic. */
export function nextThemePreference(preference: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(preference);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? 'system';
}

/** Reads the saved preference. Missing, invalid or blocked storage (private mode) → 'system'. */
export function readThemePreference(storage: ReadableStorage | null): ThemePreference {
  return readDeviceSetting(storage, THEME_STORAGE_KEY, isThemePreference, 'system');
}

/** Saves the preference. Returns false if storage is unavailable; the theme still applies. */
export function writeThemePreference(
  storage: WritableStorage | null,
  preference: ThemePreference,
): boolean {
  return writeDeviceSetting(storage, THEME_STORAGE_KEY, preference);
}

export function systemPrefersDark(win: Window): boolean {
  return typeof win.matchMedia === 'function' && win.matchMedia(DARK_SCHEME_QUERY).matches;
}

/** Sets `data-theme` on <html> and the browser's theme-color. */
export function applyTheme(doc: Document, theme: ResolvedTheme): void {
  doc.documentElement.dataset.theme = theme;

  const metas = doc.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = doc.createElement('meta');
    meta.name = 'theme-color';
    meta.content = THEME_COLOR[theme];
    doc.head.append(meta);
    return;
  }
  for (const meta of metas) {
    meta.content = THEME_COLOR[theme];
  }
}

/** Applies the saved theme before React renders, so the first frame has the right colours. */
export function initTheme(win: Window): ResolvedTheme {
  const theme = resolveTheme(readThemePreference(getLocalStorage(win)), systemPrefersDark(win));
  applyTheme(win.document, theme);
  return theme;
}
