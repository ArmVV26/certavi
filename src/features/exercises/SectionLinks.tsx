import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import styles from './SectionLinks.module.css';

/** Switch between the two sections of the Routines tab: the routines and the exercise catalog. */
export function SectionLinks() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('exercises.sections.label')} className={styles.nav}>
      <NavLink to="/routines" className={styles.link}>
        {t('exercises.sections.routines')}
      </NavLink>
      <NavLink to="/exercises" className={styles.link}>
        {t('exercises.sections.exercises')}
      </NavLink>
    </nav>
  );
}
