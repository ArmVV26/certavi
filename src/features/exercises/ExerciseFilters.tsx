import { useTranslation } from 'react-i18next';
import { EQUIPMENT, EXERCISE_KINDS, MUSCLE_GROUPS, type ExerciseFilter } from '../../domain';
import { Chip } from '../../ui/Chip';
import { TextField } from '../../ui/TextField';
import styles from './ExerciseFilters.module.css';

interface ExerciseFiltersProps {
  filter: ExerciseFilter;
  onChange: (patch: Partial<ExerciseFilter>) => void;
  /** The catalog adds a "Show archived" chip; the pickers do not pass these. */
  showArchived?: boolean;
  onShowArchivedChange?: (value: boolean) => void;
}

/** Search field and filter chips shared by the catalog and the "Add exercise" sheet. */
export function ExerciseFilters({
  filter,
  onChange,
  showArchived,
  onShowArchivedChange,
}: ExerciseFiltersProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.filters}>
      <TextField
        label={t('exercises.filters.search')}
        type="search"
        autoComplete="off"
        value={filter.text}
        onChange={(event) => {
          onChange({ text: event.target.value });
        }}
      />

      <div role="group" aria-label={t('exercises.filters.group')} className={styles.chips}>
        {MUSCLE_GROUPS.map((group) => (
          <Chip
            key={group}
            selected={filter.group === group}
            onClick={() => {
              onChange({ group: filter.group === group ? null : group });
            }}
          >
            {t(`exercises.groups.${group}`)}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label={t('exercises.filters.equipment')} className={styles.chips}>
        {EQUIPMENT.map((equipment) => (
          <Chip
            key={equipment}
            selected={filter.equipment === equipment}
            onClick={() => {
              onChange({ equipment: filter.equipment === equipment ? null : equipment });
            }}
          >
            {t(`exercises.equipment.${equipment}`)}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label={t('exercises.filters.kind')} className={styles.chips}>
        {EXERCISE_KINDS.map((kind) => (
          <Chip
            key={kind}
            selected={filter.kind === kind}
            onClick={() => {
              onChange({ kind: filter.kind === kind ? null : kind });
            }}
          >
            {t(`exercises.kind.${kind}`)}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label={t('exercises.filters.others')} className={styles.chips}>
        <Chip
          selected={filter.straps}
          onClick={() => {
            onChange({ straps: !filter.straps });
          }}
        >
          {t('exercises.filters.straps')}
        </Chip>
        <Chip
          selected={filter.custom}
          onClick={() => {
            onChange({ custom: !filter.custom });
          }}
        >
          {t('exercises.filters.custom')}
        </Chip>
        <Chip
          selected={filter.inRoutine}
          onClick={() => {
            onChange({ inRoutine: !filter.inRoutine });
          }}
        >
          {t('exercises.filters.inRoutine')}
        </Chip>
        {onShowArchivedChange && (
          <Chip
            selected={showArchived === true}
            onClick={() => {
              onShowArchivedChange(showArchived !== true);
            }}
          >
            {t('exercises.filters.archived')}
          </Chip>
        )}
      </div>
    </div>
  );
}
