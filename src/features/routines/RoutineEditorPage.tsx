import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import {
  addExerciseItem,
  moveExerciseItem,
  normalizeRoutineItems,
  removeExerciseItem,
  restoreExerciseItem,
  routineSummary,
  sameItems,
  validateRoutineItems,
  withNote,
  type Exercise,
  type PlanItem,
  type Routine,
} from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { readCatalog, type CatalogView } from '../../data/exerciseCatalog';
import { saveRoutine } from '../../data/routines';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { buttonClasses } from '../../ui/buttonClasses';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { Notice } from '../../ui/Notice';
import { useToast } from '../../ui/ToastContext';
import { AddExerciseSheet } from '../session/AddExerciseSheet';
import { repsFieldId, rirFieldId } from './fieldIds';
import { RoutineExerciseEditor } from './RoutineExerciseEditor';
import styles from './RoutineEditorPage.module.css';
import { summaryText } from './routineText';

const ADD_BUTTON_ID = 'routine-add-exercise';

/** Edits one routine. Nothing is saved until "Save"; leaving with changes asks first. */
export function RoutineEditorPage() {
  const { t } = useTranslation();
  const db = useDatabase();
  const { routineId = '' } = useParams();
  const catalog = useLiveQuery(() => readCatalog(db), [db]);

  if (!catalog) return null;
  const routine = catalog.routines.find((r) => r.id === routineId);
  if (!routine) {
    return (
      <EmptyState
        icon="info"
        title={t('routines.view.notFound')}
        action={
          <Link to="/routines" className={buttonClasses({ variant: 'secondary' })}>
            {t('routines.view.back')}
          </Link>
        }
      />
    );
  }
  // Keyed by routine: the draft starts from the routine as it was when the page opened.
  return <Editor key={routine.id} routine={routine} catalog={catalog} />;
}

function Editor({ routine, catalog }: { routine: Routine; catalog: CatalogView }) {
  const { t } = useTranslation();
  const db = useDatabase();
  const toast = useToast();
  const navigate = useNavigate();
  const [original] = useState<readonly PlanItem[]>(routine.items);
  const [items, setItems] = useState<PlanItem[]>(() => structuredClone([...routine.items]));
  const [adding, setAdding] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const leaving = useRef(false);

  const byId = useMemo(() => new Map(catalog.exercises.map((e) => [e.id, e])), [catalog]);
  const nameOf = (exerciseId: string) => {
    const exercise = byId.get(exerciseId);
    return exercise ? resolveText(t, exercise.name) : exerciseId;
  };

  const clean = useMemo(() => normalizeRoutineItems(items), [items]);
  const dirty = !sameItems(clean, original);
  const issues = useMemo(() => validateRoutineItems(clean), [clean]);
  const shownIssues = triedToSave ? issues : [];

  // Leaving with changes: the router asks through the dialog; closing the tab, the browser asks.
  const blocker = useBlocker(() => dirty && !leaving.current);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [dirty]);

  const viewPath = `/routines/${routine.id}`;

  const updateItem = (next: PlanItem) => {
    setItems((current) => current.map((i) => (i.exerciseId === next.exerciseId ? next : i)));
  };

  const changeNote = (item: PlanItem, text: string) => {
    // Putting back the text a note that comes with the app already had keeps its translation key.
    const first = original.find((i) => i.exerciseId === item.exerciseId)?.note;
    updateItem(
      first && text === resolveText(t, first) ? withNote(item, first) : withNote(item, text),
    );
  };

  const move = (exerciseId: string, direction: -1 | 1) => {
    setItems((current) => moveExerciseItem(current, exerciseId, direction) ?? current);
  };

  const remove = (exerciseId: string) => {
    const index = items.findIndex((i) => i.exerciseId === exerciseId);
    const removed = items[index];
    const rest = removeExerciseItem(items, exerciseId);
    if (!removed || !rest) return;
    setItems(rest);
    toast.show({
      message: t('routines.edit.removed', { name: nameOf(exerciseId) }),
      action: {
        label: t('routines.edit.undo'),
        onAction: () => {
          setItems((current) => restoreExerciseItem(current, removed, index) ?? current);
        },
      },
    });
  };

  const add = (exerciseId: string) => {
    const exercise: Exercise | undefined = byId.get(exerciseId);
    if (!exercise) return;
    setItems((current) => addExerciseItem(current, exercise, false) ?? current);
    setAdding(false);
  };

  const save = async () => {
    setTriedToSave(true);
    const first = issues[0];
    if (first) {
      const target =
        first.exerciseId === null
          ? ADD_BUTTON_ID
          : first.row === null
            ? rirFieldId(first.exerciseId)
            : repsFieldId(first.exerciseId, first.row);
      // The errors are drawn on the next render; the field gets the focus after it.
      requestAnimationFrame(() => {
        document.getElementById(target)?.focus();
      });
      return;
    }
    setSaving(true);
    try {
      await saveRoutine(db, routine.id, clean);
      toast.show({ message: t('routines.edit.saved'), tone: 'success' });
      leaving.current = true;
      void navigate(viewPath);
    } catch {
      setSaving(false);
      toast.show({ message: t('routines.edit.failed'), tone: 'danger' });
    }
  };

  const issuesOf = (exerciseId: string) => shownIssues.filter((i) => i.exerciseId === exerciseId);

  return (
    <div className={styles.page}>
      <h2 className={styles.name}>{resolveText(t, routine.name)}</h2>

      <div className={styles.actions}>
        <Button disabled={saving} onClick={() => void save()}>
          {t('routines.edit.save')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            void navigate(viewPath);
          }}
        >
          {t('routines.edit.discard')}
        </Button>
      </div>

      {shownIssues.length > 0 && (
        <div role="alert">
          <Notice tone="warning">{t('routines.edit.errorsTitle')}</Notice>
        </div>
      )}

      <p className={styles.summary}>{summaryText(t, routineSummary(items))}</p>

      {items.length === 0 && (
        <p className={styles.error}>{t('routines.edit.errors.noExercises')}</p>
      )}

      <ul className={styles.list} aria-label={t('routines.edit.list')}>
        {items.map((item, index) => (
          <li key={item.exerciseId}>
            <RoutineExerciseEditor
              item={item}
              name={nameOf(item.exerciseId)}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              issues={issuesOf(item.exerciseId)}
              noteText={item.note ? resolveText(t, item.note) : ''}
              onChange={updateItem}
              onNoteChange={(text) => {
                changeNote(item, text);
              }}
              onMove={(direction) => {
                move(item.exerciseId, direction);
              }}
              onRemove={() => {
                remove(item.exerciseId);
              }}
            />
          </li>
        ))}
      </ul>

      <Button
        id={ADD_BUTTON_ID}
        variant="secondary"
        icon="plus"
        onClick={() => {
          setAdding(true);
        }}
      >
        {t('routines.edit.addExercise')}
      </Button>

      <AddExerciseSheet
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        exercises={catalog.exercises}
        inSession={new Set(items.map((i) => i.exerciseId))}
        alreadyLabel={t('routines.edit.alreadyIn')}
        routineExerciseIds={catalog.routineExerciseIds}
        onChoose={add}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={t('routines.edit.discardTitle')}
        message={t('routines.edit.discardText')}
        confirmLabel={t('routines.edit.discardConfirm')}
        cancelLabel={t('routines.edit.keepEditing')}
        destructive
        onConfirm={() => {
          blocker.proceed?.();
        }}
        onCancel={() => {
          blocker.reset?.();
        }}
      />
    </div>
  );
}
