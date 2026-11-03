import type { ReactNode } from 'react';
import type { CertaviDb } from '../data/db';
import { DatabaseProvider } from '../data/DatabaseProvider';
import { I18nProvider } from '../i18n/I18nProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ToastProvider } from '../ui/ToastProvider';

/** App-wide providers: local database, theme, language and toasts. The router lives in <App>. */
export function Providers({ db, children }: { db: CertaviDb; children: ReactNode }) {
  return (
    <DatabaseProvider db={db}>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </DatabaseProvider>
  );
}
