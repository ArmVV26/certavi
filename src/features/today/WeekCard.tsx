import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { WEEK_SIZES, parseIsoDate, type WeekSize } from '../../domain';
import type { WeekPatch } from '../../data/today';
import { formatDate, formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Card } from '../../ui/Card';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { Segmented } from '../../ui/Segmented';
import { Switch } from '../../ui/Switch';
import styles from './TodayPage.module.css';
import type { TodayDay, TodayModel } from './todayModel';
import { useRoutineName } from './useRoutineName';
import { weekRange } from './weekRange';

interface WeekCardProps {
  model: TodayModel;
  onChange: (patch: WeekPatch) => void;
}

const SIZE_VALUES = WEEK_SIZES.map((size) => String(size) as `${WeekSize}`);

/** "Esta semana": the seven days, sets and sessions against the plan, and the week switches. */
export function WeekCard({ model, onChange }: WeekCardProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const range = weekRange(model.monday, locale);
  const number = (value: number) => formatNumber(value, locale);
  const deloadHint = model.week.deload
    ? t('today.week.deloadOn')
    : model.weeksSinceDeload > 0
      ? `${t('today.week.deloadOff')} ${t('today.week.deloadStreak', { count: model.weeksSinceDeload })}`
      : t('today.week.deloadOff');

  return (
    <Card element="section">
      <div className={styles.headingRow}>
        <h2 className={styles.heading}>
          {t('today.week.title')} · <span className={styles.range}>{range}</span>
        </h2>
        {model.weekNumber !== null && (
          <span className={styles.muted}>
            {t('today.week.number', { number: model.weekNumber })}
          </span>
        )}
      </div>

      <ul className={styles.days} aria-label={t('today.week.days')}>
        {model.days.map((day) => (
          <DayCell key={day.date} day={day} model={model} />
        ))}
      </ul>

      <dl className={styles.figures}>
        <div className={styles.figure}>
          <dt>{t('today.week.effectiveSets')}</dt>
          <dd className={styles.figureValue}>
            {number(model.doneSets)} / {number(model.plannedSets)}
          </dd>
        </div>
        <div className={styles.figure}>
          <dt>{t('today.week.sessions')}</dt>
          <dd className={styles.figureValue}>
            {t('today.week.sessionsOf', {
              done: number(model.weekSessions),
              size: number(model.plannedSessions),
            })}
          </dd>
        </div>
      </dl>

      <div className={styles.stack}>
        <Segmented
          legend={t('today.week.size')}
          value={String(model.week.size) as `${WeekSize}`}
          options={SIZE_VALUES.map((value) => ({ value, label: value }))}
          onChange={(value) => {
            onChange({ size: Number(value) as WeekSize });
          }}
        />
        <p className={styles.hint}>{t('today.week.sizeHint')}</p>
      </div>
      <Switch
        label={t('today.week.hiking')}
        description={t('today.week.hikingHint')}
        checked={model.week.hiking}
        onChange={(hiking) => {
          onChange({ hiking });
        }}
      />
      <Switch
        label={t('today.week.deload')}
        description={deloadHint}
        checked={model.week.deload}
        onChange={(deload) => {
          onChange({ deload });
        }}
      />
    </Card>
  );
}

function DayCell({ day, model }: { day: TodayDay; model: TodayModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const routineName = useRoutineName(model.routinesById);
  const date = parseIsoDate(day.date);
  const done = day.sessions.length > 0 || day.activities.length > 0;

  // What was done wins over what was planned: sessions, then an activity, then the plan.
  let label: string;
  const first = day.activities[0];
  if (day.sessions.length > 0)
    label = day.sessions.map((s) => routineName(s.routineId)).join(' + ');
  else if (first) label = t(`activities.kinds.${first.kind}`);
  else if (day.plan.kind === 'routine') {
    const routine = model.routinesById.get(day.plan.routineId);
    label = routine ? resolveText(t, routine.name) : '';
  } else label = t(`today.rest.short.${day.plan.rest}`);

  const name = t(done ? 'today.week.dayDone' : 'today.week.day', {
    day: formatDate(date, locale, { weekday: 'long', day: 'numeric' }),
    plan: label,
  });
  const content = (
    <>
      <span className={styles.dayName} aria-hidden="true">
        {formatDate(date, locale, { weekday: 'short' })}
      </span>
      <span className={styles.dayMark} aria-hidden="true">
        {done && <Icon name="check" size={16} strokeWidth={3} />}
      </span>
      <span className={styles.dayLabel} aria-hidden="true">
        {label}
      </span>
    </>
  );
  const only = day.sessions.length === 1 ? day.sessions[0] : undefined;
  const isToday = day.date === model.today;

  return (
    <li className={cx(styles.day, isToday && styles.today, done && styles.done)}>
      {only ? (
        <Link
          to={`/session/${only.id}`}
          className={styles.dayInner}
          aria-label={name}
          aria-current={isToday ? 'date' : undefined}
        >
          {content}
        </Link>
      ) : (
        <span
          className={styles.dayInner}
          role="img"
          aria-label={name}
          aria-current={isToday ? 'date' : undefined}
        >
          {content}
        </span>
      )}
    </li>
  );
}
