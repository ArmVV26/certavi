import { useEffect, useState } from 'react';
import { useSyncEngine } from '../../data/sync/SyncContext';

/**
 * True once a sync brings, from another device, a change to this session: the session itself,
 * one of its sets or one of its notes. The saved values already refresh by themselves (live
 * queries); this only tells the user. `dismiss` hides it until the next change.
 */
export function useRemoteChanges(sessionId: string) {
  const engine = useSyncEngine();
  const [changed, setChanged] = useState(false);

  useEffect(
    () =>
      engine.subscribeRemote((changes) => {
        if (changes.some((c) => c.id === sessionId || c.sessionId === sessionId)) {
          setChanged(true);
        }
      }),
    [engine, sessionId],
  );

  return {
    changed,
    dismiss: () => {
      setChanged(false);
    },
  };
}
