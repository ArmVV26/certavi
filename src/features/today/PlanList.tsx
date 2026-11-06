import { useTranslation } from 'react-i18next';
import { countSchemeSets, type Exercise, type PlanItem } from '../../domain';
import { resolveText } from '../../i18n/text';
import styles from './PlanList.module.css';

interface PlanListProps {
  items: readonly PlanItem[];
  exercises: ReadonlyMap<string, Pick<Exercise, 'name'>>;
}

/** The exercises of a plan with their number of sets: "Remo en T · 3 series". */
export function PlanList({ items, exercises }: PlanListProps) {
  const { t } = useTranslation();
  return (
    <ol className={styles.list}>
      {items.map((item, i) => {
        const exercise = exercises.get(item.exerciseId);
        const name = exercise ? resolveText(t, exercise.name) : item.exerciseId;
        return (
          <li key={`${item.exerciseId}-${String(i)}`} className={styles.item}>
            <span>
              {t('plan.exerciseSets', {
                exercise: name,
                sets: t('plan.sets', { count: countSchemeSets(item.scheme) }),
              })}
            </span>
            {item.optional && <span className={styles.optional}>{t('plan.optional')}</span>}
          </li>
        );
      })}
    </ol>
  );
}
