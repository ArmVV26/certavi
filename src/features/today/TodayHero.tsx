import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { isInProgress, planCounts, type ActivityKind, type WorkoutSession } from '../../domain';
import { resolveText } from '../../i18n/text';
import { buttonClasses } from '../../ui/buttonClasses';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { Tag } from '../../ui/Tag';
import { PlanList } from './PlanList';
import styles from './TodayPage.module.css';
import type { TodayModel } from './todayModel';
import { useRoutineName } from './useRoutineName';

interface TodayHeroProps {
  model: TodayModel;
  starting: boolean;
  onStart: (routineId: string) => void;
  onQuickActivity: (kind: ActivityKind) => void;
}

/** "La sesión de hoy": the planned routine (start / continue / done) or the rest day. */
export function TodayHero({ model, starting, onStart, onQuickActivity }: TodayHeroProps) {
  const { t } = useTranslation();
  const routineName = useRoutineName(model.routinesById);
  const { plan, routine, mainSession } = model;

  return (
    <Card element="section" className={styles.hero}>
      <h2 className={styles.heading}>{t('today.title')}</h2>
      {plan.kind === 'routine' && routine ? (
        <>
          <p className={styles.routineName}>{resolveText(t, routine.name)}</p>
          <PlanSummary model={model} />
          {mainSession ? (
            <Link
              to={`/session/${mainSession.id}`}
              className={buttonClasses({
                size: 'lg',
                fullWidth: true,
                variant: isInProgress(mainSession) ? 'primary' : 'secondary',
              })}
            >
              {isInProgress(mainSession)
                ? t('today.continue', { routine: resolveText(t, routine.name) })
                : t('today.done')}
            </Link>
          ) : (
            <Button
              size="lg"
              fullWidth
              disabled={starting}
              onClick={() => {
                onStart(routine.id);
              }}
            >
              {t('today.start', { routine: resolveText(t, routine.name) })}
            </Button>
          )}
          <details className={styles.details}>
            <summary>{t('today.seeExercises')}</summary>
            <PlanList items={model.items} exercises={model.exercisesById} />
          </details>
        </>
      ) : plan.kind === 'rest' ? (
        <>
          <p className={styles.routineName}>{t(`today.rest.names.${plan.rest}`)}</p>
          <p className={styles.muted}>{t(`today.rest.notes.${plan.rest}`)}</p>
          {plan.activities.length > 0 && (
            <div className={styles.chips}>
              {plan.activities.map((kind) => (
                <Chip
                  key={kind}
                  onClick={() => {
                    onQuickActivity(kind);
                  }}
                >
                  {t('today.quickActivity', { activity: t(`activities.kinds.${kind}`) })}
                </Chip>
              ))}
            </div>
          )}
        </>
      ) : null}
      {model.otherSessions.map((session) => (
        <OtherSession key={session.id} session={session} name={routineName(session.routineId)} />
      ))}
    </Card>
  );
}

function PlanSummary({ model }: { model: TodayModel }) {
  const { t } = useTranslation();
  const counts = planCounts(model.items);
  return (
    <div className={styles.summary}>
      <span>
        {t('plan.summary', {
          exercises: t('plan.exercises', { count: counts.exercises }),
          sets: t('plan.sets', { count: counts.sets }),
        })}
      </span>
      {model.week.hiking && <Tag tone="accent">{t('today.tags.hiking')}</Tag>}
      {model.week.deload && <Tag tone="warning">{t('today.tags.deload')}</Tag>}
    </div>
  );
}

function OtherSession({ session, name }: { session: WorkoutSession; name: string }) {
  const { t } = useTranslation();
  return (
    <p className={styles.muted}>
      {t('today.alsoToday')} <Link to={`/session/${session.id}`}>{name}</Link>{' '}
      {isInProgress(session) ? t('today.inProgress') : t('today.finished')}
    </p>
  );
}
