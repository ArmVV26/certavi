import type { ReactNode } from 'react';
import type { SyncEngine } from './engine';
import { SyncContext } from './SyncContext';

/** Makes the sync engine available to every screen. It is created and started in main.tsx. */
export function SyncProvider({ engine, children }: { engine: SyncEngine; children: ReactNode }) {
  return <SyncContext value={engine}>{children}</SyncContext>;
}
