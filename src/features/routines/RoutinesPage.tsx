import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { differsFromSeed, routineSummary, sortRoutines } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { readCatalog } from '../../data/exerciseCatalog';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Tag } from '../../ui/Tag';
import { SectionLinks } from '../exercises/SectionLinks';
import styles from './RoutinesPage.module.css';
import { summaryText, weekdayText } from './routineText';

/** The routines of the plan: a link to each one, with its day and what it has. */
export function RoutinesPage() {
  const { t } = useTranslation();
  const db = useDatabase();
  const { locale } = useLocale();
  const catalog = useLiveQuery(() => readCatalog(db), [db]);
  const routines = catalog ? sortRoutines(catalog.routines) : [];

  return (
    <div className={styles.page}>
      <SectionLinks />
      <h2 className={styles.heading} id="routines-heading">
        {t('routines.yourRoutines')}
      </h2>
      {catalog && (
        <ul className={styles.list} aria-labelledby="routines-heading">
          {routines.map((routine) => (
            <li key={routine.id}>
              <Link to={`/routines/${routine.id}`} className={styles.item}>
                <span className={styles.top}>
                  <span className={styles.name}>{resolveText(t, routine.name)}</span>
                  {differsFromSeed(routine) && <Tag tone="accent">{t('routines.edited')}</Tag>}
                </span>
                <span className={styles.meta}>{weekdayText(t, locale, routine.weekday)}</span>
                <span className={styles.meta}>{summaryText(t, routineSummary(routine.items))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
