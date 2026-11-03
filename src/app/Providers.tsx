import type { ReactNode } from 'react';
import type { CertaviDb } from '../data/db';
import { DatabaseProvider } from '../data/DatabaseProvider';
import type { SyncEngine } from '../data/sync/engine';
import { SyncProvider } from '../data/sync/SyncProvider';
import { I18nProvider } from '../i18n/I18nProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ToastProvider } from '../ui/ToastProvider';

interface ProvidersProps {
  db: CertaviDb;
  sync: SyncEngine;
  children: ReactNode;
}

/**
 * App-wide providers: local database, sync engine, theme, language and toasts. The router lives
 * in <App>.
 */
export function Providers({ db, sync, children }: ProvidersProps) {
  return (
    <DatabaseProvider db={db}>
      <SyncProvider engine={sync}>
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>{children}</ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </SyncProvider>
    </DatabaseProvider>
  );
}
