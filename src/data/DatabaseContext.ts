import { createContext, useContext } from 'react';
import type { CertaviDb } from './db';

export const DatabaseContext = createContext<CertaviDb | null>(null);

/** The local database of this device. */
export function useDatabase(): CertaviDb {
  const db = useContext(DatabaseContext);
  if (!db) {
    throw new Error('useDatabase must be used inside <DatabaseProvider>');
  }
  return db;
}
