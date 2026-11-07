import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { isInProgress, parseIsoDate, type ActivityKind } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { saveActivity } from '../../data/today';
import { formatDate } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { ActivityForm } from '../today/ActivityCard';
import { useRoutineName } from '../today/useRoutineName';
import { useSave } from '../today/useSave';
import { useStartSession } from '../today/useStartSession';
import styles from './CalendarPage.module.css';
import { dayDetail, type CalendarModel } from './calendarModel';

interface DayPanelProps {
  model: CalendarModel;
  date: string;
  onClose: () => void;
}

/** What a day holds (plan, sessions, activities) and the forms to log something on it. */
export function DayPanel({ model, date, onClose }: DayPanelProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const detail = dayDetail(model, date);
  const routineName = useRoutineName(model.routinesById);
  const { starting, start } = useStartSession(model.today, model.routinesById);

  const plannedRoutine =
    detail.plan.kind === 'routine' ? model.routinesById.get(detail.plan.routineId) : undefined;
  const planText = plannedRoutine
    ? resolveText(t, plannedRoutine.name)
    : t(`today.rest.names.${detail.plan.kind === 'rest' ? detail.plan.rest : 'rest'}`);

  return (
    <Card element="section">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          {formatDate(parseIsoDate(date), locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          {t('calendar.close')}
        </Button>
      </div>
      <p className={styles.muted}>{t('calendar.day.plan', { plan: planText })}</p>

      {detail.sessions.length === 0 ? (
        <p className={styles.muted}>{t('calendar.day.noSessions')}</p>
      ) : (
        <ul className={styles.list} aria-label={t('calendar.day.sessions')}>
          {detail.sessions.map(({ session, sets }) => (
            <li key={session.id}>
              <Link to={`/session/${session.id}`} className={styles.listLink}>
                {[
                  routineName(session.routineId),
                  t(isInProgress(session) ? 'calendar.day.inProgress' : 'calendar.day.finished'),
                  t('calendar.day.sets', { count: sets }),
                ].join(' · ')}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {detail.activities.length === 0 ? (
        <p className={styles.muted}>{t('calendar.day.noActivities')}</p>
      ) : (
        <ul className={styles.list} aria-label={t('calendar.day.activities')}>
          {detail.activities.map((a) => {
            const kind = t(`activities.kinds.${a.kind}`);
            return (
              <li key={a.id}>
                {a.minutes > 0
                  ? t('today.activity.withMinutes', { activity: kind, minutes: a.minutes })
                  : kind}
                {a.note !== '' && <span className={styles.muted}> · {a.note}</span>}
              </li>
            );
          })}
        </ul>
      )}

      <h3 className={styles.subheading}>{t('calendar.day.log')}</h3>
      {detail.canLog ? (
        <LogForms
          // A new day starts with fresh forms.
          key={date}
          model={model}
          date={date}
          firstQuick={detail.plan.kind === 'rest' ? detail.plan.activities[0] : undefined}
          starting={starting}
          onStart={(routineId) => {
            void start(routineId, date);
          }}
        />
      ) : (
        <p className={styles.muted}>{t('today.other.future')}</p>
      )}
    </Card>
  );
}

interface LogFormsProps {
  model: CalendarModel;
  date: string;
  firstQuick: ActivityKind | undefined;
  starting: boolean;
  onStart: (routineId: string | null) => void;
}

function LogForms({ model, date, firstQuick, starting, onStart }: LogFormsProps) {
  const { t } = useTranslation();
  const db = useDatabase();
  const save = useSave();
  const minutesId = useId();
  const [kind, setKind] = useState<ActivityKind>(firstQuick ?? 'football');

  return (
    <>
      <div className={styles.chips} role="group" aria-label={t('today.other.routines')}>
        {model.routines.map((routine) => (
          <Chip
            key={routine.id}
            disabled={starting}
            onClick={() => {
              onStart(routine.id);
            }}
          >
            {resolveText(t, routine.name)}
          </Chip>
        ))}
        <Chip
          disabled={starting}
          onClick={() => {
            onStart(null);
          }}
        >
          {t('routines.free')}
        </Chip>
      </div>
      <ActivityForm
        kind={kind}
        onKindChange={setKind}
        minutesId={minutesId}
        saveLabel={t('calendar.day.saveActivity')}
        onSave={(input) =>
          save(
            () => saveActivity(db, { ...input, date }),
            t('today.activity.saved', { activity: t(`activities.kinds.${input.kind}`) }),
          )
        }
      />
    </>
  );
}
