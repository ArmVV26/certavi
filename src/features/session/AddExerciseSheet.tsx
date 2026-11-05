import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EMPTY_EXERCISE_FILTER,
  EQUIPMENT,
  EXERCISE_KINDS,
  MUSCLE_GROUPS,
  filterExercises,
  type Exercise,
  type ExerciseFilter,
} from '../../domain';
import { resolveText } from '../../i18n/text';
import { Chip } from '../../ui/Chip';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import styles from './AddExerciseSheet.module.css';

interface AddExerciseSheetProps {
  open: boolean;
  onClose: () => void;
  /** Every live exercise; the sheet hides the archived ones. */
  exercises: readonly Exercise[];
  /** Exercises the session already has: shown, but they cannot be chosen again. */
  inSession: ReadonlySet<string>;
  /** Exercises that are in at least one routine (for the "in a routine" filter). */
  routineExerciseIds: ReadonlySet<string>;
  onChoose: (exerciseId: string) => void;
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

function Picker({ exercises, inSession, routineExerciseIds, onChoose }: Rest) {
  const { t } = useTranslation();
  // The sheet content is only mounted while it is open, so every opening starts without filters.
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_EXERCISE_FILTER);
  const change = (patch: Partial<ExerciseFilter>) => {
    setFilter((current) => ({ ...current, ...patch }));
  };

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
      <TextField
        label={t('session.add.search')}
        type="search"
        autoComplete="off"
        value={filter.text}
        onChange={(event) => {
          change({ text: event.target.value });
        }}
      />

      <div role="group" aria-label={t('session.add.group')} className={styles.chips}>
        {MUSCLE_GROUPS.map((group) => (
          <Chip
            key={group}
            selected={filter.group === group}
            onClick={() => {
              change({ group: filter.group === group ? null : group });
            }}
          >
            {t(`exercises.groups.${group}`)}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label={t('session.add.equipment')} className={styles.chips}>
        {EQUIPMENT.map((equipment) => (
          <Chip
            key={equipment}
            selected={filter.equipment === equipment}
            onClick={() => {
              change({ equipment: filter.equipment === equipment ? null : equipment });
            }}
          >
            {t(`exercises.equipment.${equipment}`)}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label={t('session.add.kind')} className={styles.chips}>
        {EXERCISE_KINDS.map((kind) => (
          <Chip
            key={kind}
            selected={filter.kind === kind}
            onClick={() => {
              change({ kind: filter.kind === kind ? null : kind });
            }}
          >
            {t(kind === 'compound' ? 'session.exercise.basic' : 'session.exercise.isolation')}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label={t('session.add.others')} className={styles.chips}>
        <Chip
          selected={filter.straps}
          onClick={() => {
            change({ straps: !filter.straps });
          }}
        >
          {t('session.add.straps')}
        </Chip>
        <Chip
          selected={filter.custom}
          onClick={() => {
            change({ custom: !filter.custom });
          }}
        >
          {t('session.add.custom')}
        </Chip>
        <Chip
          selected={filter.inRoutine}
          onClick={() => {
            change({ inRoutine: !filter.inRoutine });
          }}
        >
          {t('session.add.inRoutine')}
        </Chip>
      </div>

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
                      ? t('session.add.already')
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
