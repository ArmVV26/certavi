import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  isInProgress,
  resolveRowInput,
  restSeconds,
  schemeRows,
  type DisplayRow,
  type ExclusionReason,
} from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { readRestTimes } from '../../data/restSettings';
import type { RowDraft } from '../../data/sessionDrafts';
import {
  addRow,
  applyStrapsBand,
  deleteSession,
  finishSession,
  logSet,
  removeSessionRow,
  reopenSession,
  restoreRow,
  restoreSession,
  saveExerciseNote,
  setRowType,
  UndoConflictError,
  unlogSet,
  updateSessionFields,
  type RowType,
} from '../../data/sessionLog';
import {
  addExercise,
  changeSessionRoutine,
  moveExercise,
  removeExercise,
  restoreExercise,
  updateSessionTimes,
} from '../../data/sessionTools';
import { exportSession } from '../../data/backup';
import { downloadFile } from '../../ui/download';
import type { DetailsPatch } from './SessionDetailsSheet';
import type { SessionView } from '../../data/sessions';
import { useToast } from '../../ui/ToastContext';
import { useToday } from '../today/useToday';
import { fieldId } from './fieldId';
import { unlockAudio } from './restAlerts';
import type { PendingSetsApi } from './usePendingSets';
import type { RestTimerApi } from './useRestTimer';
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
  | { kind: 'removeExercise'; exerciseId: string; name: string; sets: number; note: boolean }
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
export function useSessionActions(
  view: SessionView,
  store: DraftStore,
  rest: RestTimerApi,
  pending: PendingSetsApi,
) {
  const { t } = useTranslation();
  const db = useDatabase();
  const toast = useToast();
  const navigate = useNavigate();
  const today = useToday();
  const sessionId = view.session.id;

  const [invalid, setInvalid] = useState<InvalidField | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  // An exercise just added: its card takes the focus once it shows.
  const [exerciseFocus, setExerciseFocus] = useState<string | null>(null);

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

  /** Runs an "Undo"; says so when it worked and why when it could not. */
  const runUndo = async (restore: () => Promise<string>) => {
    try {
      toast.show({ message: await restore(), tone: 'success' });
    } catch (error) {
      const key =
        error instanceof UndoConflictError ? 'session.toast.cannotUndo' : 'session.toast.failed';
      toast.show({ message: t(key), tone: 'danger' });
    }
  };

  /** A notification for something just removed, with the button that brings it back. */
  const offerUndo = (message: string, restore: () => Promise<string>) => {
    toast.show({
      message,
      tone: 'success',
      action: {
        label: t('session.toast.undo'),
        onAction: () => {
          void runUndo(restore);
        },
      },
    });
  };

  const markDone = async (
    { exerciseId, row, bodyweight }: RowTarget,
    draft: RowDraft | null,
    straps: boolean | undefined,
    band: string | undefined,
  ) => {
    // Sound can only start after a tap: this is the tap.
    unlockAudio();
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
    if (!saved) return;
    // The saved set shows at once; the typed values can go because the row reads it instead.
    pending.add(saved.value);
    store.set(exerciseId, row.slot, null);
    // The rest timer only runs for a new set of today's session that is still in progress.
    if (view.session.date === today && isInProgress(view.session)) {
      const times = await readRestTimes(db);
      const kind = view.exercises.get(exerciseId)?.kind ?? 'compound';
      rest.start(restSeconds(row.kind, kind, times), { exerciseId, slot: row.slot });
    }
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
    if (done) {
      pending.add(done.value);
      store.set(exerciseId, row.slot, null);
    }
  };

  const requestUnsave = (exerciseId: string, slot: number) => {
    setDialog({ kind: 'unsave', exerciseId, slot });
  };

  const removeNow = async (exerciseId: string, slot: number) => {
    const done = await guard(() => removeSessionRow(db, sessionId, exerciseId, slot));
    if (!done) return;
    // The rows below moved: what was pending for them no longer fits.
    pending.forgetExercise(exerciseId);
    store.follow(exerciseId, done.value.remap);
    offerUndo(t('session.toast.rowRemoved'), async () => {
      const edit = await restoreRow(db, done.value.undo);
      pending.forgetExercise(exerciseId);
      store.follow(exerciseId, edit.remap);
      return t('session.toast.rowRestored');
    });
  };

  const removeExerciseNow = async (exerciseId: string) => {
    const done = await guard(() => removeExercise(db, sessionId, exerciseId));
    if (!done) return;
    pending.forgetExercise(exerciseId);
    store.dropExercise(exerciseId);
    offerUndo(t('session.toast.exerciseRemoved'), async () => {
      await restoreExercise(db, done.value);
      return t('session.toast.exerciseRestored');
    });
  };

  /** Asks first when the exercise has saved sets or a note; otherwise removes it at once. */
  const requestRemoveExercise = (exerciseId: string, name: string, sets: number, note: boolean) => {
    if (sets > 0 || note) setDialog({ kind: 'removeExercise', exerciseId, name, sets, note });
    else void removeExerciseNow(exerciseId);
  };

  /** Saves the date, hours and/or routine from the details sheet. False when it failed. */
  const saveDetails = async ({ times, routineId }: DetailsPatch): Promise<boolean> => {
    const done = await guard(async () => {
      if (times) await updateSessionTimes(db, sessionId, times, today);
      if (routineId !== undefined) await changeSessionRoutine(db, sessionId, routineId);
    });
    if (done && times && times.date !== today) rest.close();
    return done !== null;
  };

  const downloadJson = async () => {
    await guard(async () => {
      const file = await exportSession(db, sessionId);
      if (file) downloadFile(file);
    });
  };

  const moveExerciseBy = async (exerciseId: string, direction: -1 | 1) => {
    await guard(() => moveExercise(db, sessionId, exerciseId, direction));
  };

  const addExerciseToSession = async (exerciseId: string) => {
    const done = await guard(() => addExercise(db, sessionId, exerciseId));
    if (done) setExerciseFocus(exerciseId);
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
    pending.forgetExercise(exerciseId);
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
    rest.close();
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
    // One case per kind, no fallback: a new dialog kind fails to compile until it is handled here
    // (the last `else` used to be "delete the session").
    switch (current.kind) {
      case 'unsave':
        pending.forgetSlot(current.exerciseId, current.slot);
        await guard(() => unlogSet(db, sessionId, current.exerciseId, current.slot));
        return;
      case 'remove':
        await removeNow(current.exerciseId, current.slot);
        return;
      case 'removeExercise':
        await removeExerciseNow(current.exerciseId);
        return;
      case 'straps':
        await guard(() => applyStrapsBand(db, sessionId, current.exerciseId, current.patch));
        return;
      case 'delete': {
        const done = await guard(() => deleteSession(db, sessionId));
        if (!done) return;
        store.clear();
        rest.close();
        const undo = done.value;
        if (undo) {
          offerUndo(t('session.toast.deleted'), async () => {
            await restoreSession(db, undo);
            return t('session.toast.restored');
          });
        } else {
          toast.show({ message: t('session.toast.deleted'), tone: 'success' });
        }
        void navigate('/', { replace: true });
        return;
      }
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
    exerciseFocus,
    clearExerciseFocus: () => {
      setExerciseFocus(null);
    },
    markDone,
    editRow,
    requestUnsave,
    requestRemove,
    addNewRow,
    requestRemoveExercise,
    moveExercise: moveExerciseBy,
    saveDetails,
    downloadJson,
    addExercise: addExerciseToSession,
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
