import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isInProgress,
  sessionTimes,
  timeOfDay,
  type Routine,
  type SessionTimesError,
  type WorkoutSession,
} from '../../domain';
import type { SessionTimesPatch } from '../../data/sessionTools';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { SelectField } from '../../ui/SelectField';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import styles from './SessionDetailsSheet.module.css';

/** What the sheet asks to save: the new date and hours and/or the new routine. */
export interface DetailsPatch {
  /** Set when the date or an hour changed. */
  times?: SessionTimesPatch;
  /** Set when the routine changed; null = free session. */
  routineId?: string | null;
}

interface SessionDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  session: WorkoutSession;
  routines: readonly Routine[];
  /** The device's current date. */
  today: string;
  /** Saves the changes; false when it failed (the sheet stays open). */
  onSave: (patch: DetailsPatch) => Promise<boolean>;
}

/** Bottom sheet to edit the date, the hours and the routine of a session. */
export function SessionDetailsSheet({ open, onClose, ...rest }: SessionDetailsSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('session.details.title')}>
      <Form onClose={onClose} {...rest} />
    </Sheet>
  );
}

/** The start time shown for a session that has none (imported without hours). */
const DEFAULT_START = '18:00';
const startTimeOf = (session: WorkoutSession) =>
  session.startedAt === null ? DEFAULT_START : timeOfDay(session.startedAt);

/**
 * Where the form is: typing (with the error of the last try), waiting for the "change routine"
 * confirmation, or saving (nothing can be sent twice).
 */
type Phase =
  | { kind: 'editing'; error: SessionTimesError | null }
  | { kind: 'confirmingRoutine' }
  | { kind: 'saving' };

/** The routine select uses '' for "free session". */
const FREE = '';

function Form({
  onClose,
  session,
  routines,
  today,
  onSave,
}: Omit<SessionDetailsSheetProps, 'open'>) {
  const { t } = useTranslation();
  const finished = !isInProgress(session);
  const [date, setDate] = useState(session.date);
  const [start, setStart] = useState(startTimeOf(session));
  const [end, setEnd] = useState(timeOfDay(session.endedAt ?? 0));
  const [routineId, setRoutineId] = useState(session.routineId ?? FREE);
  const [phase, setPhase] = useState<Phase>({ kind: 'editing', error: null });
  const error = phase.kind === 'editing' ? phase.error : null;

  const routineChanged = routineId !== (session.routineId ?? FREE);
  const routineName =
    routineId === FREE
      ? t('routines.free')
      : (() => {
          const found = routines.find((r) => r.id === routineId);
          return found ? resolveText(t, found.name) : '';
        })();

  const save = async () => {
    const result = sessionTimes({ date, today, start, end: finished ? end : null });
    if (!result.ok) {
      setPhase({ kind: 'editing', error: result.error });
      return;
    }
    if (routineChanged) setPhase({ kind: 'confirmingRoutine' });
    else await commit();
  };

  const commit = async () => {
    const timesChanged =
      date !== session.date ||
      start !== startTimeOf(session) ||
      (finished && end !== timeOfDay(session.endedAt ?? 0));
    const patch: DetailsPatch = {
      ...(timesChanged ? { times: { date, start, end: finished ? end : null } } : {}),
      ...(routineChanged ? { routineId: routineId === FREE ? null : routineId } : {}),
    };
    if (patch.times === undefined && patch.routineId === undefined) {
      onClose();
      return;
    }
    setPhase({ kind: 'saving' });
    let saved = false;
    try {
      saved = await onSave(patch);
    } catch {
      saved = false; // a failed save is not a crash: the sheet stays as typed
    }
    if (saved) onClose();
    else setPhase({ kind: 'editing', error: null });
  };

  const message = error ? t(`session.details.errors.${error}`) : undefined;
  const dateError =
    error === 'future' || (error === 'invalid' && date === '') ? message : undefined;
  const startError = error === 'invalid' && date !== '' && start === '' ? message : undefined;
  const endError = error === 'endBeforeStart' || (error === 'invalid' && finished && end === '');

  return (
    <div className={styles.form}>
      <TextField
        label={t('session.details.date')}
        type="date"
        max={today}
        value={date}
        error={dateError}
        onChange={(event) => {
          setDate(event.target.value);
        }}
      />
      <div className={styles.times}>
        <TextField
          label={t('session.details.start')}
          type="time"
          value={start}
          error={startError}
          onChange={(event) => {
            setStart(event.target.value);
          }}
        />
        {finished && (
          <TextField
            label={t('session.details.end')}
            type="time"
            value={end}
            error={endError ? message : undefined}
            onChange={(event) => {
              setEnd(event.target.value);
            }}
          />
        )}
      </div>
      <SelectField
        label={t('session.details.routine')}
        value={routineId}
        options={[
          { value: FREE, label: t('routines.free') },
          ...routines.map((r) => ({ value: r.id, label: resolveText(t, r.name) })),
        ]}
        onChange={setRoutineId}
      />
      <div className={styles.buttons}>
        <Button
          disabled={phase.kind !== 'editing'}
          onClick={() => {
            void save();
          }}
        >
          {t('session.details.save')}
        </Button>
        <Button variant="secondary" disabled={phase.kind === 'saving'} onClick={onClose}>
          {t('session.dialog.cancel')}
        </Button>
      </div>
      <ConfirmDialog
        open={phase.kind === 'confirmingRoutine'}
        title={t('session.dialog.routineTitle', { name: routineName })}
        message={t('session.dialog.routineMessage')}
        confirmLabel={t('session.dialog.routineConfirm')}
        cancelLabel={t('session.dialog.cancel')}
        onCancel={() => {
          setPhase({ kind: 'editing', error: null });
        }}
        onConfirm={() => {
          void commit();
        }}
      />
    </div>
  );
}
