import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  DRAFT_SETS_RANGE,
  EQUIPMENT,
  EXERCISE_KINDS,
  INCREMENT_RANGE,
  MAX_EXERCISE_NAME,
  MUSCLE_GROUPS,
  draftFromExercise,
  newExerciseDraft,
  suggestedIncrement,
  validateExerciseDraft,
  type Equipment,
  type Exercise,
  type ExerciseDraft,
  type ExerciseDraftError,
  type ExerciseDraftField,
  type ExerciseKind,
  type MuscleGroup,
} from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { readCatalog, type CatalogView } from '../../data/exerciseCatalog';
import { InvalidExerciseError, createExercise, updateExercise } from '../../data/exercises';
import { addExercise } from '../../data/sessionTools';
import { formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { buttonClasses } from '../../ui/buttonClasses';
import { Checkbox } from '../../ui/Checkbox';
import { EmptyState } from '../../ui/EmptyState';
import { NumberField } from '../../ui/NumberField';
import { SelectField } from '../../ui/SelectField';
import { TextField } from '../../ui/TextField';
import { useToast } from '../../ui/ToastContext';
import styles from './ExerciseFormPage.module.css';

const FIELD_IDS: Record<ExerciseDraftField, string> = {
  name: 'exercise-name',
  sets: 'exercise-sets',
  reps: 'exercise-reps',
  rir: 'exercise-rir',
  increment: 'exercise-increment',
};

/** Create an exercise (`/exercises/new`) or edit one the user created (`/exercises/:id/edit`). */
export function ExerciseFormPage() {
  const { t } = useTranslation();
  const db = useDatabase();
  const { exerciseId } = useParams();
  const catalog = useLiveQuery(() => readCatalog(db), [db]);

  if (!catalog) return null;
  if (exerciseId === undefined) return <ExerciseForm catalog={catalog} />;

  const exercise = catalog.exercises.find((e) => e.id === exerciseId);
  if (!exercise) {
    return (
      <EmptyState
        icon="info"
        title={t('exercises.detail.notFound')}
        action={
          <Link to="/exercises" className={buttonClasses({ variant: 'secondary' })}>
            {t('exercises.detail.back')}
          </Link>
        }
      />
    );
  }
  // Seed exercises are not edited here: their page only lets the user change the weight step.
  if (!exercise.custom) return <Navigate to={`/exercises/${exerciseId}`} replace />;
  return <ExerciseForm key={exerciseId} catalog={catalog} exercise={exercise} />;
}

interface ExerciseFormProps {
  catalog: CatalogView;
  /** The exercise being edited; absent when creating one. */
  exercise?: Exercise;
}

function ExerciseForm({ catalog, exercise }: ExerciseFormProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Created from a session: the exercise is added to it and the app goes back there.
  const addTo = exercise ? null : params.get('addTo');
  const nameOf = (e: Pick<Exercise, 'name'>) => resolveText(t, e.name);

  const [draft, setDraft] = useState<ExerciseDraft>(() =>
    exercise ? draftFromExercise(exercise, nameOf(exercise)) : newExerciseDraft(),
  );
  // The step follows group, equipment and type until the user types their own value.
  const [ownStep, setOwnStep] = useState(exercise !== undefined);
  const [errors, setErrors] = useState<readonly ExerciseDraftError[]>([]);
  const [saving, setSaving] = useState(false);

  const change = (patch: Partial<ExerciseDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (patch.primaryGroup) {
        next.secondaryMuscles = next.secondaryMuscles.filter((g) => g !== patch.primaryGroup);
      }
      if (!ownStep && (patch.primaryGroup || patch.equipment || patch.kind)) {
        next.increment = suggestedIncrement(next);
      }
      return next;
    });
  };

  const changeScheme = (patch: Partial<ExerciseDraft['scheme']>) => {
    setDraft((current) => ({ ...current, scheme: { ...current.scheme, ...patch } }));
  };

  const toggleSecondary = (group: MuscleGroup, on: boolean) => {
    change({
      secondaryMuscles: on
        ? [...draft.secondaryMuscles, group]
        : draft.secondaryMuscles.filter((g) => g !== group),
    });
  };

  const errorText = (field: ExerciseDraftField): string | undefined => {
    const found = errors.find((e) => e.field === field);
    if (!found) return undefined;
    switch (found.code) {
      case 'name-too-long':
        return t('exercises.errors.name-too-long', { max: MAX_EXERCISE_NAME });
      case 'increment-range':
        return t('exercises.errors.increment-range', {
          min: formatNumber(INCREMENT_RANGE.min, locale),
          max: formatNumber(INCREMENT_RANGE.max, locale),
        });
      case 'sets-range':
        return t('exercises.errors.sets-range', {
          min: DRAFT_SETS_RANGE.min,
          max: DRAFT_SETS_RANGE.max,
        });
      default:
        return t(`exercises.errors.${found.code}`);
    }
  };
  const fieldError = (field: ExerciseDraftField) => {
    const text = errorText(field);
    return text === undefined ? {} : { error: text };
  };

  const fail = (found: readonly ExerciseDraftError[]) => {
    setErrors(found);
    const first = found[0];
    if (first) document.getElementById(FIELD_IDS[first.field])?.focus();
  };

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (saving) return;
    const found = validateExerciseDraft(draft, catalog.exercises, {
      nameOf,
      ...(exercise ? { editingId: exercise.id } : {}),
    });
    if (found.length > 0) {
      fail(found);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      if (exercise) {
        await updateExercise(db, exercise.id, draft, { nameOf });
        toast.show({ message: t('exercises.form.saved'), tone: 'success' });
        void navigate(`/exercises/${exercise.id}`);
        return;
      }
      const created = await createExercise(db, draft, { nameOf });
      if (addTo && (await addToSession(addTo, created.id))) {
        toast.show({ message: t('exercises.form.createdInSession'), tone: 'success' });
        void navigate(`/session/${addTo}`);
      } else {
        toast.show({ message: t('exercises.form.created'), tone: 'success' });
        void navigate(`/exercises/${created.id}`);
      }
    } catch (error) {
      setSaving(false);
      if (error instanceof InvalidExerciseError) fail(error.errors);
      else toast.show({ message: t('exercises.form.failed'), tone: 'danger' });
    }
  };

  /** True when the new exercise is now in the session. */
  const addToSession = async (sessionId: string, exerciseId: string) => {
    try {
      await addExercise(db, sessionId, exerciseId);
      return true;
    } catch {
      return false;
    }
  };

  const cancelTo = exercise
    ? `/exercises/${exercise.id}`
    : addTo
      ? `/session/${addTo}`
      : '/exercises';

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <Link to={cancelTo} className={styles.back}>
        {t('exercises.form.back')}
      </Link>

      <TextField
        id={FIELD_IDS.name}
        label={t('exercises.form.name')}
        value={draft.name}
        autoComplete="off"
        onChange={(event) => {
          change({ name: event.target.value });
        }}
        {...fieldError('name')}
      />

      <SelectField
        label={t('exercises.form.primary')}
        value={draft.primaryGroup}
        options={MUSCLE_GROUPS.map((group) => ({
          value: group,
          label: t(`exercises.groups.${group}`),
        }))}
        onChange={(value) => {
          change({ primaryGroup: value as MuscleGroup });
        }}
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('exercises.form.secondary')}</legend>
        <div className={styles.checks}>
          {MUSCLE_GROUPS.filter((group) => group !== draft.primaryGroup).map((group) => (
            <Checkbox
              key={group}
              label={t(`exercises.groups.${group}`)}
              checked={draft.secondaryMuscles.includes(group)}
              onChange={(on) => {
                toggleSecondary(group, on);
              }}
            />
          ))}
        </div>
      </fieldset>

      <SelectField
        label={t('exercises.form.equipment')}
        value={draft.equipment}
        options={EQUIPMENT.map((equipment) => ({
          value: equipment,
          label: t(`exercises.equipment.${equipment}`),
        }))}
        onChange={(value) => {
          change({ equipment: value as Equipment });
        }}
      />

      <SelectField
        label={t('exercises.form.kind')}
        value={draft.kind}
        options={EXERCISE_KINDS.map((kind) => ({
          value: kind,
          label: t(`exercises.kind.${kind}`),
        }))}
        onChange={(value) => {
          change({ kind: value as ExerciseKind });
        }}
      />

      <div className={styles.checks}>
        <Checkbox
          label={t('exercises.form.unilateral')}
          checked={draft.unilateral}
          onChange={(unilateral) => {
            change({ unilateral });
          }}
        />
        <Checkbox
          label={t('exercises.form.straps')}
          checked={draft.supportsStraps}
          onChange={(supportsStraps) => {
            change({ supportsStraps });
          }}
        />
        <Checkbox
          label={t('exercises.form.band')}
          checked={draft.supportsBand}
          onChange={(supportsBand) => {
            change({ supportsBand });
          }}
        />
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('exercises.form.scheme')}</legend>
        <div className={styles.scheme}>
          <NumberField
            id={FIELD_IDS.sets}
            label={t('exercises.form.sets')}
            value={draft.scheme.sets}
            maxFractionDigits={0}
            onChange={(sets) => {
              changeScheme({ sets });
            }}
            {...fieldError('sets')}
          />
          <TextField
            id={FIELD_IDS.reps}
            label={t('exercises.form.reps')}
            value={draft.scheme.reps}
            autoComplete="off"
            onChange={(event) => {
              changeScheme({ reps: event.target.value });
            }}
            {...fieldError('reps')}
          />
          <TextField
            id={FIELD_IDS.rir}
            label={t('exercises.form.rir')}
            value={draft.scheme.rir}
            autoComplete="off"
            onChange={(event) => {
              changeScheme({ rir: event.target.value });
            }}
            {...fieldError('rir')}
          />
        </div>
      </fieldset>

      <NumberField
        id={FIELD_IDS.increment}
        label={t('exercises.form.increment')}
        value={draft.increment}
        onChange={(increment) => {
          setOwnStep(true);
          change({ increment });
        }}
        {...fieldError('increment')}
      />

      <div className={styles.actions}>
        <Button type="submit" disabled={saving}>
          {t('exercises.form.save')}
        </Button>
        <Link to={cancelTo} className={buttonClasses({ variant: 'secondary' })}>
          {t('exercises.form.cancel')}
        </Link>
      </div>
    </form>
  );
}
