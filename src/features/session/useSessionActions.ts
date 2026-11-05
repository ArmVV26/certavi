import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { resolveRowInput, schemeRows, type DisplayRow, type ExclusionReason } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import type { RowDraft } from '../../data/sessionDrafts';
import {
  addRow,
  applyStrapsBand,
  deleteSession,
  finishSession,
  logSet,
  removeSessionRow,
  reopenSession,
  saveExerciseNote,
  setRowType,
  unlogSet,
  updateSessionFields,
  type RowType,
} from '../../data/sessionLog';
import type { SessionView } from '../../data/sessions';
import { useToast } from '../../ui/ToastContext';
import { useToday } from '../today/useToday';
import { fieldId } from './fieldId';
import type { DraftStore } from './useSessionDrafts';

export type DialogState =
  | { kind: 'unsave'; exerciseId: string; slot: number }
  | { kind: 'remove'; exerciseId: string; slot: number; name: string; logged: string }
  | {
      kind: 'straps';
      exerciseId: string;
      patch: { straps?: boolean; band?: string };
      count: number;
    }
  | { kind: 'delete' }
  | null;

export interface InvalidField {
  exerciseId: string;
  slot: number;
  field: 'weight' | 'reps';
}

export interface FocusRequest {
  exerciseId: string;
  slot: number;
}

interface RowTarget {
  exerciseId: string;
  row: DisplayRow;
  bodyweight: boolean;
}

export interface NoteChange {
  exerciseId: string;
  text: string;
  excludeFromProgression: boolean;
  reason?: ExclusionReason;
}

/** Everything the session screen does to the data, with errors shown as a toast. */
export function useSessionActions(view: SessionView, store: DraftStore) {
  const { t } = useTranslation();
  const db = useDatabase();
  const toast = useToast();
  const navigate = useNavigate();
  const today = useToday();
  const sessionId = view.session.id;

  const [invalid, setInvalid] = useState<InvalidField | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const guard = useCallback(
    async <T>(work: () => Promise<T>): Promise<{ value: T } | null> => {
      try {
        return { value: await work() };
      } catch {
        toast.show({ message: t('session.toast.failed'), tone: 'danger' });
        return null;
      }
    },
    [t, toast],
  );

  const markDone = async (
    { exerciseId, row, bodyweight }: RowTarget,
    draft: RowDraft | null,
    straps: boolean | undefined,
    band: string | undefined,
  ) => {
    const resolved = resolveRowInput(
      { weight: draft?.weight ?? null, reps: draft?.reps ?? null },
      row.previous,
      bodyweight,
    );
    if (!resolved.ok) {
      setInvalid({ exerciseId, slot: row.slot, field: resolved.field });
      document.getElementById(fieldId(exerciseId, row.slot, resolved.field))?.focus();
      return;
    }
    setInvalid(null);
    const saved = await guard(() =>
      logSet(db, {
        sessionId,
        exerciseId,
        slot: row.slot,
        weight: resolved.weight,
        reps: resolved.reps,
        rir: draft?.rir ?? null,
        ...(straps === undefined ? {} : { straps }),
        ...(band === undefined ? {} : { band }),
      }),
    );
    if (saved) store.set(exerciseId, row.slot, null);
  };

  /** Keeps what is typed; with `commit` a saved row is corrected right away. */
  const editRow = async (
    { exerciseId, row, bodyweight }: RowTarget,
    draft: RowDraft,
    commit: boolean,
  ) => {
    if (invalid?.exerciseId === exerciseId && invalid.slot === row.slot) setInvalid(null);
    store.set(exerciseId, row.slot, draft);
    const saved = row.set;
    if (!commit || !saved) return;
    if (draft.weight === saved.weight && draft.reps === saved.reps && draft.rir === saved.rir) {
      store.set(exerciseId, row.slot, null);
      return;
    }
    const resolved = resolveRowInput({ weight: draft.weight, reps: draft.reps }, null, bodyweight);
    if (!resolved.ok) {
      setInvalid({ exerciseId, slot: row.slot, field: resolved.field });
      return;
    }
    const done = await guard(() =>
      logSet(db, {
        sessionId,
        exerciseId,
        slot: row.slot,
        weight: resolved.weight,
        reps: resolved.reps,
        rir: draft.rir,
      }),
    );
    if (done) store.set(exerciseId, row.slot, null);
  };

  const requestUnsave = (exerciseId: string, slot: number) => {
    setDialog({ kind: 'unsave', exerciseId, slot });
  };

  const removeNow = async (exerciseId: string, slot: number) => {
    const done = await guard(() => removeSessionRow(db, sessionId, exerciseId, slot));
    if (done) store.follow(exerciseId, done.value.remap);
  };

  const requestRemove = (exerciseId: string, row: DisplayRow, name: string, logged: string) => {
    if (row.set) setDialog({ kind: 'remove', exerciseId, slot: row.slot, name, logged });
    else void removeNow(exerciseId, row.slot);
  };

  const addNewRow = async (exerciseId: string, kind: 'warmup' | 'extra') => {
    const item = view.session.items.find((i) => i.exerciseId === exerciseId);
    const rows = item ? schemeRows(item.scheme) : [];
    const firstWork = rows.findIndex((r) => r.kind !== 'warmup');
    const slot = kind === 'extra' ? rows.length : firstWork === -1 ? rows.length : firstWork;
    const done = await guard(() => addRow(db, sessionId, exerciseId, kind));
    if (!done) return;
    store.follow(exerciseId, done.value.remap);
    setFocusRequest({ exerciseId, slot });
  };

  const changeType = async (exerciseId: string, slot: number, type: RowType) => {
    await guard(() => setRowType(db, sessionId, exerciseId, slot, type));
  };

  const requestStrapsBand = (
    exerciseId: string,
    patch: { straps?: boolean; band?: string },
    count: number,
  ) => {
    setDialog({ kind: 'straps', exerciseId, patch, count });
  };

  const saveNote = async (change: NoteChange) => {
    await guard(() => saveExerciseNote(db, { sessionId, ...change }));
  };

  const updateFields = async (patch: { note?: string; readiness?: number | null }) => {
    await guard(() => updateSessionFields(db, sessionId, patch));
  };

  const finish = async () => {
    const done = await guard(() => finishSession(db, sessionId, today));
    if (!done) return;
    store.clear();
    const { records } = done.value;
    toast.show({
      message:
        records > 0
          ? t('session.toast.savedRecords', { count: records })
          : t('session.toast.saved'),
      tone: 'success',
    });
  };

  const reopen = async () => {
    await guard(() => reopenSession(db, sessionId));
  };

  const confirm = async () => {
    const current = dialog;
    setDialog(null);
    if (!current) return;
    if (current.kind === 'unsave') {
      await guard(() => unlogSet(db, sessionId, current.exerciseId, current.slot));
    } else if (current.kind === 'remove') {
      await removeNow(current.exerciseId, current.slot);
    } else if (current.kind === 'straps') {
      await guard(() => applyStrapsBand(db, sessionId, current.exerciseId, current.patch));
    } else {
      const done = await guard(() => deleteSession(db, sessionId));
      if (!done) return;
      store.clear();
      toast.show({ message: t('session.toast.deleted'), tone: 'success' });
      void navigate('/', { replace: true });
    }
  };

  return {
    invalid,
    dialog,
    closeDialog: () => {
      setDialog(null);
    },
    focusRequest,
    clearFocusRequest: () => {
      setFocusRequest(null);
    },
    markDone,
    editRow,
    requestUnsave,
    requestRemove,
    addNewRow,
    changeType,
    requestStrapsBand,
    saveNote,
    updateFields,
    finish,
    reopen,
    requestDelete: () => {
      setDialog({ kind: 'delete' });
    },
    confirm,
  };
}

export type SessionActions = ReturnType<typeof useSessionActions>;
