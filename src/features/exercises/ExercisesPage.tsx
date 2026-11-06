import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { filterExercises } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { readCatalog, type CatalogView } from '../../data/exerciseCatalog';
import { resolveText } from '../../i18n/text';
import { buttonClasses } from '../../ui/buttonClasses';
import { Tag } from '../../ui/Tag';
import { ExerciseFilters } from './ExerciseFilters';
import styles from './ExercisesPage.module.css';
import { SectionLinks } from './SectionLinks';
import { useExerciseFilter } from './useExerciseFilter';

/** The exercise catalog: search, filters and a link to each exercise's page. */
export function ExercisesPage() {
  const db = useDatabase();
  const catalog = useLiveQuery(() => readCatalog(db), [db]);
  return (
    <div className={styles.page}>
      <SectionLinks />
      {catalog && <Catalog catalog={catalog} />}
    </div>
  );
}

function Catalog({ catalog }: { catalog: CatalogView }) {
  const { t } = useTranslation();
  // The filters are not remembered: every visit to the page starts without them.
  const { filter, change } = useExerciseFilter();
  const [showArchived, setShowArchived] = useState(false);

  const results = useMemo(
    () =>
      filterExercises(catalog.exercises, filter, {
        nameOf: (exercise) => resolveText(t, exercise.name),
        routineExerciseIds: catalog.routineExerciseIds,
        includeArchived: showArchived,
      }),
    [catalog, filter, showArchived, t],
  );

  return (
    <>
      <Link to="/exercises/new" className={buttonClasses({ variant: 'secondary' })}>
        {t('exercises.list.create')}
      </Link>

      <ExerciseFilters
        filter={filter}
        onChange={change}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
      />

      <p className={styles.count} role="status">
        {t('exercises.list.count', { count: results.length })}
      </p>

      {results.length === 0 ? (
        <p className={styles.empty}>{t('exercises.list.none')}</p>
      ) : (
        <ul className={styles.list} aria-label={t('exercises.list.results')}>
          {results.map((exercise) => (
            <li key={exercise.id}>
              <Link to={`/exercises/${exercise.id}`} className={styles.item}>
                <span className={styles.name}>{resolveText(t, exercise.name)}</span>
                <span className={styles.meta}>
                  {t(`exercises.groups.${exercise.primaryGroup}`)} ·{' '}
                  {t(`exercises.equipment.${exercise.equipment}`)}
                </span>
                {(exercise.supportsStraps || exercise.custom || exercise.archived) && (
                  <span className={styles.tags}>
                    {exercise.supportsStraps && (
                      <Tag tone="accent">{t('exercises.list.straps')}</Tag>
                    )}
                    {exercise.custom && <Tag>{t('exercises.list.mine')}</Tag>}
                    {exercise.archived && <Tag tone="warning">{t('exercises.list.archived')}</Tag>}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
