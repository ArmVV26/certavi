import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { getLocalStorage } from '../data/deviceStorage';
import { ThemeContext } from './ThemeContext';
import type { ThemeContextValue } from './ThemeContext';
import {
  DARK_SCHEME_QUERY,
  applyTheme,
  nextThemePreference,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  writeThemePreference,
} from './theme';
import type { ThemePreference } from './theme';

function subscribeToSystemScheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(DARK_SCHEME_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

const getSystemPrefersDark = () => systemPrefersDark(window);
const getServerSnapshot = () => false;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readThemePreference(getLocalStorage(window)),
  );
  // Follows the system setting live (e.g. iOS switching to dark at sunset).
  const prefersDark = useSyncExternalStore(
    subscribeToSystemScheme,
    getSystemPrefersDark,
    getServerSnapshot,
  );
  const resolved = resolveTheme(preference, prefersDark);

  useLayoutEffect(() => {
    applyTheme(document, resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeThemePreference(getLocalStorage(window), next);
  }, []);

  const cyclePreference = useCallback(() => {
    setPreference(nextThemePreference(preference));
  }, [preference, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, cyclePreference }),
    [preference, resolved, setPreference, cyclePreference],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
