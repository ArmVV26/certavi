import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { isInProgress, parseIsoDate, planCounts } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { readSession } from '../../data/sessions';
import { formatDate } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { buttonClasses } from '../../ui/buttonClasses';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Tag } from '../../ui/Tag';
import { PlanList } from '../today/PlanList';
import styles from './SessionPage.module.css';

/** A workout session. This branch shows its plan; logging sets arrives with session.md. */
export function SessionPage() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const { sessionId = '' } = useParams();
  const view = useLiveQuery(
    async () => ({ value: await readSession(db, sessionId) }),
    [db, sessionId],
  );

  if (!view) return null;
  if (!view.value) {
    return (
      <EmptyState
        icon="info"
        title={t('session.notFound')}
        action={
          <Link to="/" className={buttonClasses({ variant: 'secondary' })}>
            {t('session.backToToday')}
          </Link>
        }
      />
    );
  }

  const { session, routine, exercises } = view.value;
  const counts = planCounts(session.items);
  const date = formatDate(parseIsoDate(session.date), locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const time =
    session.startedAt === null
      ? null
      : formatDate(new Date(session.startedAt), locale, { timeStyle: 'short' });

  return (
    <div className={styles.page}>
      <Card element="section">
        <h2 className={styles.title}>
          {routine ? resolveText(t, routine.name) : t('routines.free')}
        </h2>
        <p className={styles.muted}>{time ? t('session.when', { date, time }) : date}</p>
        <div>
          <Tag tone={isInProgress(session) ? 'accent' : 'success'}>
            {isInProgress(session) ? t('session.inProgress') : t('session.finished')}
          </Tag>
        </div>
      </Card>

      <Card element="section">
        <h3 className={styles.heading}>{t('session.plan')}</h3>
        {session.items.length > 0 ? (
          <>
            <p className={styles.muted}>
              {t('plan.summary', {
                exercises: t('plan.exercises', { count: counts.exercises }),
                sets: t('plan.sets', { count: counts.sets }),
              })}
            </p>
            <PlanList items={session.items} exercises={exercises} />
          </>
        ) : (
          <p className={styles.muted}>{t('session.empty')}</p>
        )}
      </Card>

      <p className={styles.soon}>
        <Tag tone="accent">{t('pages.comingSoon')}</Tag>
        <span>{t('session.comingSoon')}</span>
      </p>
    </div>
  );
}
