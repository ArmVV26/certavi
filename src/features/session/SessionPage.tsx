import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import {
  isInProgress,
  isEffectiveSet,
  nextOpenRow,
  parseIsoDate,
  planCounts,
  sessionProgress,
  volume,
} from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { getLocalStorage } from '../../data/deviceStorage';
import { readRestAlerts } from '../../data/restSettings';
import { readSession, type SessionView } from '../../data/sessions';
import { formatDate, formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { buttonClasses } from '../../ui/buttonClasses';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { Notice } from '../../ui/Notice';
import { ScalePicker } from '../../ui/ScalePicker';
import { cx } from '../../ui/cx';
import { Tag } from '../../ui/Tag';
import { TextArea } from '../../ui/TextField';
import { AddExerciseSheet } from './AddExerciseSheet';
import { alertRestEnd } from './restAlerts';
import { RestTimerBar } from './RestTimerBar';
import { useRemoteChanges } from './useRemoteChanges';
import { useRestTimer } from './useRestTimer';
import { SessionDetailsSheet } from './SessionDetailsSheet';
import { ExerciseCard } from './ExerciseCard';
import { useToday } from '../today/useToday';
import styles from './SessionPage.module.css';
import { useDebouncedSave } from './useDebouncedSave';
import { useSessionActions, type DialogState } from './useSessionActions';
import { useSessionDrafts } from './useSessionDrafts';

/** A workout session: its exercises with their sets, the notes and how to finish or delete it. */
export function SessionPage() {
  const { t } = useTranslation();
  const db = useDatabase();
  const { sessionId = '' } = useParams();
  const view = useLiveQuery(
    async () => ({ value: await readSession(db, sessionId) }),
    [db, sessionId],
  );

  if (!view) return null;
  if (!view.value) {
    return (
      <EmptyState
        icon="info"
        title={t('session.notFound')}
        action={
          <Link to="/" className={buttonClasses({ variant: 'secondary' })}>
            {t('session.backToToday')}
          </Link>
        }
      />
    );
  }
  // Keyed by session: each session has its own typed values.
  return <SessionScreen key={sessionId} view={view.value} />;
}

function SessionScreen({ view }: { view: SessionView }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { session, routine, exercises, sets, notes, references, deload } = view;
  const store = useSessionDrafts(session.id);
  const rest = useRestTimer(() => {
    alertRestEnd(readRestAlerts(getLocalStorage(window)));
  });
  const actions = useSessionActions(view, store, rest);
  const remote = useRemoteChanges(session.id);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const today = useToday();

  const inProgress = isInProgress(session);
  const counts = planCounts(session.items);
  const progress = sessionProgress(session.items, sets);
  const date = formatDate(parseIsoDate(session.date), locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const time =
    session.startedAt === null
      ? null
      : formatDate(new Date(session.startedAt), locale, { timeStyle: 'short' });
  const effective = sets.filter(isEffectiveSet);
  const next = rest.timer?.from ? nextOpenRow(session.items, sets, rest.timer.from) : null;
  const nextExercise = next ? exercises.get(next.exerciseId) : undefined;
  const nextName = next
    ? nextExercise
      ? resolveText(t, nextExercise.name)
      : next.exerciseId
    : null;

  return (
    <div className={cx(styles.page, rest.timer && styles.resting)}>
      {remote.changed && (
        <Notice tone="info">
          <div className={styles.remote}>
            <p>{t('session.remote.notice')}</p>
            <Button variant="secondary" onClick={remote.dismiss}>
              {t('session.remote.close')}
            </Button>
          </div>
        </Notice>
      )}

      <Card element="section">
        <h2 className={styles.title}>
          {routine ? resolveText(t, routine.name) : t('routines.free')}
        </h2>
        <p className={styles.muted}>{time ? t('session.when', { date, time }) : date}</p>
        <div>
          <Tag tone={inProgress ? 'accent' : 'success'}>
            {inProgress ? t('session.inProgress') : t('session.finished')}
          </Tag>
        </div>
        {session.items.length > 0 ? (
          <>
            <p className={styles.muted}>
              {t('plan.summary', {
                exercises: t('plan.exercises', { count: counts.exercises }),
                sets: t('plan.sets', { count: counts.sets }),
              })}
            </p>
            <p className={styles.muted}>
              {t('session.progress', { done: progress.done, total: progress.total })}
            </p>
          </>
        ) : (
          <p className={styles.muted}>{t('session.empty')}</p>
        )}
        {deload && <Notice tone="info">{t('session.deloadNotice')}</Notice>}
        <div>
          <ScalePicker
            label={t('session.readiness')}
            value={session.readiness}
            min={1}
            max={5}
            onChange={(readiness) => {
              void actions.updateFields({ readiness });
            }}
          />
          <p className={styles.muted}>{t('session.readinessScale')}</p>
        </div>
        {!inProgress && (
          <>
            <p className={styles.muted}>{t('session.finishedHint')}</p>
            <dl className={styles.totals}>
              <div>
                <dt>{t('session.effectiveSets')}</dt>
                <dd>{effective.length}</dd>
              </div>
              <div>
                <dt>{t('session.volume')}</dt>
                <dd>{formatNumber(volume(sets), locale, { maximumFractionDigits: 0 })}</dd>
              </div>
            </dl>
          </>
        )}
      </Card>

      {session.items.map((item, index) => (
        <ExerciseCard
          key={item.exerciseId}
          item={item}
          isFirst={index === 0}
          isLast={index === session.items.length - 1}
          focusHeading={!adding && actions.exerciseFocus === item.exerciseId}
          exercise={exercises.get(item.exerciseId)}
          sets={sets.filter((s) => s.exerciseId === item.exerciseId)}
          note={notes.find((n) => n.exerciseId === item.exerciseId)}
          reference={references.get(item.exerciseId)}
          deload={deload}
          drafts={store.drafts[item.exerciseId]}
          actions={actions}
        />
      ))}

      <Button
        variant="secondary"
        onClick={() => {
          setAdding(true);
        }}
      >
        {t('session.add.button')}
      </Button>
      <AddExerciseSheet
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        exercises={[...exercises.values()]}
        inSession={new Set(session.items.map((item) => item.exerciseId))}
        routineExerciseIds={view.routineExerciseIds}
        onChoose={(exerciseId) => {
          setAdding(false);
          void actions.addExercise(exerciseId);
        }}
        onCreate={() => {
          void navigate(`/exercises/new?addTo=${session.id}`);
        }}
      />

      <SessionNote note={session.note} onSave={(note) => void actions.updateFields({ note })} />

      <div className={styles.actions}>
        {inProgress ? (
          <Button
            onClick={() => {
              void actions.finish();
            }}
          >
            {t('session.actions.finish')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              void actions.reopen();
            }}
          >
            {t('session.actions.reopen')}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(true);
          }}
        >
          {t('session.actions.details')}
        </Button>
        <Button
          variant="secondary"
          icon="download"
          onClick={() => {
            void actions.downloadJson();
          }}
        >
          {t('session.actions.json')}
        </Button>
        <Button variant="danger" onClick={actions.requestDelete}>
          {t('session.actions.delete')}
        </Button>
      </div>

      {rest.timer && (
        <RestTimerBar
          timer={rest.timer}
          nextName={nextName}
          onAdjust={rest.adjust}
          onClose={rest.close}
        />
      )}

      <SessionDetailsSheet
        open={editing}
        onClose={() => {
          setEditing(false);
        }}
        session={session}
        routines={view.routines}
        today={today}
        onSave={actions.saveDetails}
      />

      <SessionDialog
        dialog={actions.dialog}
        onCancel={actions.closeDialog}
        onConfirm={actions.confirm}
      />
    </div>
  );
}

function SessionNote({ note, onSave }: { note: string; onSave: (note: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(note);
  const [synced, setSynced] = useState(note);
  // Take the saved text when it changes from outside, unless something is being typed.
  if (note !== synced) {
    setSynced(note);
    if (text === synced) setText(note);
  }
  const saver = useDebouncedSave(onSave);
  return (
    <TextArea
      label={t('session.notes.session')}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        saver.schedule(event.target.value);
      }}
      onBlur={saver.flush}
    />
  );
}

interface SessionDialogProps {
  dialog: DialogState;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/** The one confirmation the screen can be showing. */
function SessionDialog({ dialog, onCancel, onConfirm }: SessionDialogProps) {
  const { t } = useTranslation();
  const confirm = () => {
    void onConfirm();
  };
  const common = {
    open: dialog !== null,
    cancelLabel: t('session.dialog.cancel'),
    onCancel,
    onConfirm: confirm,
  };
  switch (dialog?.kind) {
    case 'unsave':
      return (
        <ConfirmDialog
          {...common}
          title={t('session.dialog.unsaveTitle')}
          confirmLabel={t('session.dialog.unsaveConfirm')}
          destructive
        />
      );
    case 'remove':
      return (
        <ConfirmDialog
          {...common}
          title={t('session.dialog.removeTitle', { name: dialog.name })}
          message={t('session.dialog.removeMessage', { set: dialog.logged })}
          confirmLabel={t('session.dialog.removeConfirm')}
          destructive
        />
      );
    case 'straps':
      return (
        <ConfirmDialog
          {...common}
          title={t('session.dialog.strapsTitle', { count: dialog.count })}
          confirmLabel={t('session.dialog.strapsFix', { count: dialog.count })}
          cancelLabel={t('session.dialog.strapsOnlyNext')}
        />
      );
    case 'removeExercise': {
      const key =
        dialog.sets > 0 && dialog.note
          ? 'session.dialog.removeExerciseSetsAndNote'
          : dialog.sets > 0
            ? 'session.dialog.removeExerciseSets'
            : 'session.dialog.removeExerciseNote';
      return (
        <ConfirmDialog
          {...common}
          title={t('session.dialog.removeExerciseTitle', { name: dialog.name })}
          message={t(key, { count: dialog.sets })}
          confirmLabel={t('session.dialog.removeExerciseConfirm')}
          destructive
        />
      );
    }
    case 'delete':
      return (
        <ConfirmDialog
          {...common}
          title={t('session.dialog.deleteTitle')}
          message={t('session.dialog.deleteMessage')}
          confirmLabel={t('session.dialog.deleteConfirm')}
          destructive
        />
      );
    case undefined:
      return null;
  }
}
