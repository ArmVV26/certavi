import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { differsFromSeed, routineSummary, type Exercise, type Routine } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { readCatalog } from '../../data/exerciseCatalog';
import { restoreSeedRoutine } from '../../data/routines';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { buttonClasses } from '../../ui/buttonClasses';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/ToastContext';
import { schemeText, summaryText, weekdayText } from './routineText';
import styles from './RoutineViewPage.module.css';

/** One routine, read only: its exercises with their sets. Looking at it never starts a session. */
export function RoutineViewPage() {
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
  return <View routine={routine} exercises={catalog.exercises} />;
}

function View({ routine, exercises }: { routine: Routine; exercises: readonly Exercise[] }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const name = resolveText(t, routine.name);
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const edited = differsFromSeed(routine);

  const restore = async () => {
    setConfirming(false);
    try {
      await restoreSeedRoutine(db, routine.id);
      toast.show({ message: t('routines.view.restored'), tone: 'success' });
    } catch {
      toast.show({ message: t('routines.view.failed'), tone: 'danger' });
    }
  };

  return (
    <div className={styles.page}>
      <Link to="/routines" className={styles.back}>
        <Icon name="back" size={20} />
        {t('routines.view.back')}
      </Link>

      <div className={styles.header}>
        <h2 className={styles.name}>{name}</h2>
        {edited && (
          <div className={styles.tags}>
            <Tag tone="accent">{t('routines.edited')}</Tag>
          </div>
        )}
        <p className={styles.meta}>{weekdayText(t, locale, routine.weekday)}</p>
        <p className={styles.meta}>{summaryText(t, routineSummary(routine.items))}</p>
        <div className={styles.actions}>
          <Link
            to={`/routines/${routine.id}/edit`}
            className={buttonClasses({ variant: 'secondary' })}
          >
            {t('routines.view.edit')}
          </Link>
          {edited && (
            <Button
              variant="secondary"
              onClick={() => {
                setConfirming(true);
              }}
            >
              {t('routines.view.restore')}
            </Button>
          )}
        </div>
      </div>

      <section aria-labelledby="routine-exercises">
        <h3 id="routine-exercises" className={styles.heading}>
          {t('routines.view.exercises')}
        </h3>
        {routine.items.length === 0 ? (
          <p className={styles.muted}>{t('routines.view.empty')}</p>
        ) : (
          <ol className={styles.list} aria-label={t('routines.view.list')}>
            {routine.items.map((item) => {
              const exercise = byId.get(item.exerciseId);
              return (
                <li key={item.exerciseId} className={styles.item}>
                  <span className={styles.top}>
                    <Link to={`/exercises/${item.exerciseId}`} className={styles.link}>
                      {exercise ? resolveText(t, exercise.name) : item.exerciseId}
                    </Link>
                    {item.optional && <Tag>{t('routines.optional')}</Tag>}
                  </span>
                  <span className={styles.scheme}>{schemeText(t, item.scheme)}</span>
                  {item.note && <span className={styles.note}>{resolveText(t, item.note)}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <ConfirmDialog
        open={confirming}
        title={t('routines.view.restoreTitle')}
        message={t('routines.view.restoreText', { name })}
        confirmLabel={t('routines.view.restoreConfirm')}
        cancelLabel={t('routines.view.restoreCancel')}
        onConfirm={() => void restore()}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </div>
  );
}
