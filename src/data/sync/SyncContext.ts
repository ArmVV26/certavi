import { createContext, useContext, useSyncExternalStore } from 'react';
import type { SyncEngine, SyncState } from './engine';

export const SyncContext = createContext<SyncEngine | null>(null);

/** The app's sync engine. */
export function useSyncEngine(): SyncEngine {
  const engine = useContext(SyncContext);
  if (!engine) throw new Error('useSyncEngine must be used inside <SyncProvider>');
  return engine;
}

/** The sync state, re-rendering when it changes. */
export function useSyncState(): SyncState {
  const engine = useSyncEngine();
  return useSyncExternalStore(engine.subscribe, engine.getState);
}
