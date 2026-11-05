import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RowEdit } from '../../domain';
import { getLocalStorage } from '../../data/deviceStorage';
import {
  clearDrafts,
  readDrafts,
  remapDrafts,
  setDraft,
  writeDrafts,
  type RowDraft,
  type SessionDrafts,
} from '../../data/sessionDrafts';

export interface DraftStore {
  drafts: SessionDrafts;
  /** Sets the draft of a row; null (or a blank draft) removes it. */
  set: (exerciseId: string, slot: number, draft: RowDraft | null) => void;
  /** Moves the drafts of an exercise after its rows changed. */
  follow: (exerciseId: string, remap: RowEdit['remap']) => void;
  /** Drops every draft of the session (it ended or was deleted). */
  clear: () => void;
}

/**
 * What is typed in the rows but not saved. It lives in React state, so it survives every re-draw
 * the live queries cause, and in localStorage, so it survives a reload.
 */
export function useSessionDrafts(sessionId: string): DraftStore {
  const storage = useMemo(() => getLocalStorage(window), []);
  const [drafts, setDrafts] = useState(() => readDrafts(storage, sessionId));

  useEffect(() => {
    writeDrafts(storage, sessionId, drafts);
  }, [storage, sessionId, drafts]);

  const set = useCallback((exerciseId: string, slot: number, draft: RowDraft | null) => {
    setDrafts((current) => setDraft(current, exerciseId, slot, draft));
  }, []);
  const follow = useCallback((exerciseId: string, remap: RowEdit['remap']) => {
    setDrafts((current) => remapDrafts(current, exerciseId, remap));
  }, []);
  const clear = useCallback(() => {
    setDrafts({});
    clearDrafts(storage, sessionId);
  }, [storage, sessionId]);

  return { drafts, set, follow, clear };
}
