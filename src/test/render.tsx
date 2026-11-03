// Renders UI with the app providers (database, theme, language, toasts), as the app does.
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { openDatabase } from '../data/db';
import type { CertaviDb } from '../data/db';
import { DatabaseProvider } from '../data/DatabaseProvider';
import { createI18n } from '../i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Locale } from '../i18n/locale';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ToastProvider } from '../ui/ToastProvider';

let databaseCount = 0;

/** A fresh, empty in-memory database (fake-indexeddb), unique per call. */
export function openTestDatabase(): CertaviDb {
  databaseCount += 1;
  return openDatabase(`certavi-test-${String(databaseCount)}`);
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: Locale;
  /** Database to use; a fresh empty one by default (no seed: call ensureSeed if needed). */
  db?: CertaviDb;
}

export function renderWithProviders(
  ui: ReactElement,
  { locale = 'es', db = openTestDatabase(), ...options }: RenderWithProvidersOptions = {},
) {
  const i18n = createI18n(locale);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DatabaseProvider db={db}>
        <ThemeProvider>
          <I18nProvider i18n={i18n}>
            <ToastProvider>{children}</ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </DatabaseProvider>
    );
  }
  return { i18n, db, ...render(ui, { wrapper: Wrapper, ...options }) };
}
