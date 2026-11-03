import type { ReactNode } from 'react';
import { DatabaseContext } from './DatabaseContext';
import type { CertaviDb } from './db';

/** Makes the local database available to every screen. Start-up runs in main.tsx. */
export function DatabaseProvider({ db, children }: { db: CertaviDb; children: ReactNode }) {
  return <DatabaseContext value={db}>{children}</DatabaseContext>;
}
