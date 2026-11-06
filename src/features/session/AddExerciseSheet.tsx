import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { filterExercises, type Exercise } from '../../domain';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { ExerciseFilters } from '../exercises/ExerciseFilters';
import { useExerciseFilter } from '../exercises/useExerciseFilter';
import styles from './AddExerciseSheet.module.css';

interface AddExerciseSheetProps {
  open: boolean;
  onClose: () => void;
  /** Every live exercise; the sheet hides the archived ones. */
  exercises: readonly Exercise[];
  /** Exercises the session (or routine) already has: shown, but they cannot be chosen again. */
  inSession: ReadonlySet<string>;
  /** What the disabled ones say; defaults to "Already in the session". */
  alreadyLabel?: string;
  /** Exercises that are in at least one routine (for the "in a routine" filter). */
  routineExerciseIds: ReadonlySet<string>;
  onChoose: (exerciseId: string) => void;
  /** Opens the form to create an exercise, which is then added to the session. */
  onCreate?: () => void;
}

/** Bottom sheet to pick an exercise to add to the session, with search and filters. */
export function AddExerciseSheet({ open, onClose, ...rest }: AddExerciseSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('session.add.title')}>
      <Picker {...rest} />
    </Sheet>
  );
}

type Rest = Omit<AddExerciseSheetProps, 'open' | 'onClose'>;

function Picker({
  exercises,
  inSession,
  alreadyLabel,
  routineExerciseIds,
  onChoose,
  onCreate,
}: Rest) {
  const { t } = useTranslation();
  // The sheet content is only mounted while it is open, so every opening starts without filters.
  const { filter, change } = useExerciseFilter();

  const results = useMemo(
    () =>
      filterExercises(exercises, filter, {
        nameOf: (exercise) => resolveText(t, exercise.name),
        routineExerciseIds,
      }),
    [exercises, filter, routineExerciseIds, t],
  );

  return (
    <div className={styles.picker}>
      {onCreate && (
        <Button variant="secondary" icon="plus" onClick={onCreate}>
          {t('session.add.create')}
        </Button>
      )}

      <ExerciseFilters filter={filter} onChange={change} />

      {results.length === 0 ? (
        <p className={styles.empty} role="status">
          {t('session.add.none')}
        </p>
      ) : (
        <ul className={styles.list} aria-label={t('session.add.results')}>
          {results.map((exercise) => {
            const already = inSession.has(exercise.id);
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  className={styles.item}
                  disabled={already}
                  onClick={() => {
                    onChoose(exercise.id);
                  }}
                >
                  <span className={styles.name}>{resolveText(t, exercise.name)}</span>
                  <span className={styles.meta}>
                    {already
                      ? (alreadyLabel ?? t('session.add.already'))
                      : `${t(`exercises.groups.${exercise.primaryGroup}`)} · ${t(`exercises.equipment.${exercise.equipment}`)}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
