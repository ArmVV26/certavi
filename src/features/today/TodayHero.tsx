import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  isInProgress,
  planCounts,
  type ActivityKind,
  type DayPlan,
  type WorkoutSession,
} from '../../domain';
import { resolveText } from '../../i18n/text';
import { buttonClasses } from '../../ui/buttonClasses';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { Tag } from '../../ui/Tag';
import { PlanList } from './PlanList';
import styles from './TodayPage.module.css';
import type { HeroState, TodayModel } from './todayModel';
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
  const { hero } = model;

  return (
    <Card element="section" className={styles.hero}>
      <h2 className={styles.heading}>{t('today.title')}</h2>
      {hero.kind === 'rest' ? (
        <RestHero plan={hero.plan} onQuickActivity={onQuickActivity} />
      ) : (
        <RoutineHero hero={hero} model={model} starting={starting} onStart={onStart} />
      )}
      {model.otherSessions.map((session) => (
        <OtherSession key={session.id} session={session} name={routineName(session.routineId)} />
      ))}
    </Card>
  );
}

function RoutineHero({
  hero,
  model,
  starting,
  onStart,
}: {
  hero: Exclude<HeroState, { kind: 'rest' }>;
  model: TodayModel;
  starting: boolean;
  onStart: (routineId: string) => void;
}) {
  const { t } = useTranslation();
  const name = resolveText(t, hero.routine.name);
  return (
    <>
      <p className={styles.routineName}>{name}</p>
      <PlanSummary model={model} />
      {hero.kind === 'start' ? (
        <Button
          size="lg"
          fullWidth
          disabled={starting}
          onClick={() => {
            onStart(hero.routine.id);
          }}
        >
          {t('today.start', { routine: name })}
        </Button>
      ) : (
        <Link
          to={`/session/${hero.session.id}`}
          className={buttonClasses({
            size: 'lg',
            fullWidth: true,
            variant: hero.kind === 'continue' ? 'primary' : 'secondary',
          })}
        >
          {hero.kind === 'continue' ? t('today.continue', { routine: name }) : t('today.done')}
        </Link>
      )}
      <details className={styles.details}>
        <summary>{t('today.seeExercises')}</summary>
        <PlanList items={model.items} exercises={model.exercisesById} />
      </details>
    </>
  );
}

function RestHero({
  plan,
  onQuickActivity,
}: {
  plan: Extract<DayPlan, { kind: 'rest' }>;
  onQuickActivity: (kind: ActivityKind) => void;
}) {
  const { t } = useTranslation();
  return (
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
